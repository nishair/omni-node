import { fmtInt, fmtSigned } from './format'
import {
  ALL,
  WINDOW_DAYS,
  WIND_DIR,
  WIND_SPEED,
  stationById,
  type Reading,
  type Source,
  type StationFilter,
  type StatusLevel,
  type TileSpec,
} from './types'

const HOUR = 3_600_000
const DAY = 24 * HOUR

export interface Window {
  start: number
  end: number
  hours: number
}

/** The window is anchored to the newest reading, so live and snapshot data behave the same way. */
export function computeWindow(readings: Reading[]): Window | null {
  if (readings.length === 0) return null
  const end = readings[readings.length - 1].ts
  const start = end - WINDOW_DAYS * DAY
  return { start, end, hours: Math.round((end - start) / HOUR) + 1 }
}

/** Drops readings older than the window. APIs that take whole dates return hours before the window starts. */
export function clampToWindow(readings: Reading[], window: Window | null): Reading[] {
  if (!window) return readings
  const i = readings.findIndex((r) => r.ts >= window.start)
  return i <= 0 ? (i === 0 ? readings : []) : readings.slice(i)
}

export function selectedStations(source: Source, filter: StationFilter): string[] {
  return filter === ALL ? source.stations.map((s) => s.id) : [filter]
}

export function filterByStation(readings: Reading[], filter: StationFilter): Reading[] {
  if (filter === ALL) return readings
  return readings.filter((r) => r.station === filter)
}

/** Newest reading per station that carries a value for `metric` (any value when metric is omitted). */
export function latestByStation(readings: Reading[], metric?: string): Map<string, Reading> {
  const out = new Map<string, Reading>()
  for (const r of readings) {
    if (metric && r.values[metric] == null) continue
    const cur = out.get(r.station)
    if (!cur || r.ts > cur.ts) out.set(r.station, r)
  }
  return out
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Reading for a station nearest to `ts` with a value for `metric`, within ±90 minutes. */
function readingNear(readings: Reading[], station: string, metric: string, ts: number): Reading | null {
  let best: Reading | null = null
  for (const r of readings) {
    if (r.station !== station || r.values[metric] == null) continue
    const d = Math.abs(r.ts - ts)
    if (d <= 1.5 * HOUR && (!best || d < Math.abs(best.ts - ts))) best = r
  }
  return best
}

/** 12 V sealed lead-acid: 12.4 V and up is healthy at rest, below 11.8 V is deeply discharged. */
export function batteryStatus(volts: number): StatusLevel {
  if (volts >= 12.4) return 'good'
  if (volts >= 11.8) return 'warning'
  return 'critical'
}

export interface TileResult {
  label: string
  value: number | null
  unit: string
  digits: number
  hint: string
  status?: StatusLevel
  statusLabel?: string
}

function computeTile(spec: TileSpec, source: Source, readings: Reading[], stations: string[], window: Window | null): TileResult {
  const many = stations.length > 1
  switch (spec.kind) {
    case 'latest': {
      const latest = latestByStation(readings, spec.metric)
      const values: number[] = []
      const deltas: number[] = []
      for (const id of stations) {
        const last = latest.get(id)
        const v = last?.values[spec.metric]
        if (last == null || v == null) continue
        values.push(v)
        const prior = readingNear(readings, id, spec.metric, last.ts - DAY)?.values[spec.metric]
        if (prior != null) deltas.push(v - prior)
      }
      const delta = mean(deltas)
      const value = mean(values)
      return {
        label: spec.label,
        value,
        unit: spec.unit,
        digits: spec.digits,
        hint:
          value == null
            ? 'No readings in this window'
            : `${many ? 'Mean of latest readings' : 'Latest reading'} · ${
                delta == null ? 'no reading 24 h earlier' : `${fmtSigned(delta, spec.digits)} ${spec.unit} vs 24 h ago`
              }`,
      }
    }
    case 'sum': {
      let total = 0
      let any = false
      let count = 0
      for (const r of readings) {
        const v = r.values[spec.metric]
        if (v == null) continue
        any = true
        total += v
        if (v > 0) count++
      }
      return {
        label: spec.label,
        value: any ? total : null,
        unit: spec.unit,
        digits: spec.digits,
        hint: any ? `${fmtInt(count)} ${spec.countLabel}` : 'No readings in this window',
      }
    }
    case 'minLatest': {
      const latest = latestByStation(readings, spec.metric)
      let min: number | null = null
      let at: string | null = null
      for (const id of stations) {
        const v = latest.get(id)?.values[spec.metric]
        if (v != null && (min == null || v < min)) {
          min = v
          at = id
        }
      }
      const status = min == null ? undefined : spec.status(min)
      return {
        label: spec.label,
        value: min,
        unit: spec.unit,
        digits: spec.digits,
        status,
        statusLabel: status && spec.statusLabel[status],
        hint:
          min == null || !at
            ? 'No readings in this window'
            : many
              ? `lowest, ${stationById(source, at)?.shortName ?? at}`
              : 'latest reading',
      }
    }
    case 'range24h': {
      if (!window) return { label: spec.label, value: null, unit: spec.unit, digits: spec.digits, hint: 'No readings in this window' }
      const ranges: number[] = []
      for (const id of stations) {
        let lo = Infinity
        let hi = -Infinity
        for (const r of readings) {
          const v = r.values[spec.metric]
          if (r.station !== id || v == null || r.ts < window.end - DAY) continue
          lo = Math.min(lo, v)
          hi = Math.max(hi, v)
        }
        if (hi > lo) ranges.push(hi - lo)
      }
      const value = mean(ranges)
      return {
        label: spec.label,
        value,
        unit: spec.unit,
        digits: spec.digits,
        hint: value == null ? 'No readings in the last 24 h' : many ? 'High minus low, mean across stations' : 'High minus low',
      }
    }
    case 'completeness': {
      const expected = window ? window.hours * stations.length : 0
      const received = readings.length
      return {
        label: spec.label,
        value: expected > 0 ? (received / expected) * 100 : null,
        unit: '%',
        digits: 0,
        hint: `${fmtInt(received)} of ${fmtInt(expected)} expected hourly readings`,
      }
    }
  }
}

export function computeTiles(source: Source, readings: Reading[], filter: StationFilter, window: Window | null): TileResult[] {
  const stations = selectedStations(source, filter)
  return source.tiles.map((spec) => computeTile(spec, source, readings, stations, window))
}

export type SeriesRow = { ts: number } & Record<string, number | null>

/** One row per hour across the window, so an outage shows as a gap in the line instead of a straight bridge. */
export function hourlySeries(readings: Reading[], metric: string, stations: string[], window: Window | null): SeriesRow[] {
  if (!window) return []
  const byHour = new Map<number, SeriesRow>()
  const firstHour = Math.ceil(window.start / HOUR) * HOUR
  for (let ts = firstHour; ts <= window.end; ts += HOUR) {
    const row = { ts } as SeriesRow
    for (const id of stations) row[id] = null
    byHour.set(ts, row)
  }
  for (const r of readings) {
    if (!stations.includes(r.station)) continue
    const hour = Math.round(r.ts / HOUR) * HOUR
    const row = byHour.get(hour)
    if (row) row[r.station] = r.values[metric] ?? null
  }
  return [...byHour.values()]
}

/** Local-midnight ticks, thinned to every other day when the window is long. */
export function dayTicks(window: Window | null): number[] {
  if (!window) return []
  const ticks: number[] = []
  const d = new Date(window.start)
  d.setHours(24, 0, 0, 0)
  while (d.getTime() <= window.end) {
    ticks.push(d.getTime())
    d.setDate(d.getDate() + 1)
  }
  return ticks.length > 8 ? ticks.filter((_, i) => i % 2 === 0) : ticks
}

export const SECTORS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const

export interface SectorShare {
  sector: (typeof SECTORS)[number]
  hours: number
  share: number
}

/** Share of hours the wind blew from each compass sector. Calm hours (under 0.5 m/s) are excluded. */
export function windSectors(readings: Reading[]): SectorShare[] {
  const counts = new Array<number>(SECTORS.length).fill(0)
  let total = 0
  for (const r of readings) {
    const dir = r.values[WIND_DIR]
    const speed = r.values[WIND_SPEED]
    if (dir == null || speed == null || speed < 0.5) continue
    const i = Math.round((((dir % 360) + 360) % 360) / 45) % SECTORS.length
    counts[i]++
    total++
  }
  return SECTORS.map((sector, i) => ({
    sector,
    hours: counts[i],
    share: total > 0 ? counts[i] / total : 0,
  }))
}

export type StationHealth = 'reporting' | 'stale' | 'silent'

/** A station is stale when its newest reading trails the newest reading of any station by more than 3 hours. */
export function stationHealth(last: Reading | undefined, window: Window | null): StationHealth {
  if (!last || !window) return 'silent'
  return window.end - last.ts > 3 * HOUR ? 'stale' : 'reporting'
}
