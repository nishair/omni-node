import { WINDOW_DAYS } from './socrata'
import {
  STATIONS,
  type MetricKey,
  type Reading,
  type StationFilter,
  type StationId,
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

export function selectedStations(filter: StationFilter): StationId[] {
  return filter === 'all' ? STATIONS.map((s) => s.id) : [filter]
}

export function filterByStation(readings: Reading[], filter: StationFilter): Reading[] {
  if (filter === 'all') return readings
  return readings.filter((r) => r.station === filter)
}

export function latestByStation(readings: Reading[]): Map<StationId, Reading> {
  const out = new Map<StationId, Reading>()
  for (const r of readings) {
    const cur = out.get(r.station)
    if (!cur || r.ts > cur.ts) out.set(r.station, r)
  }
  return out
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** Reading for a station nearest to `ts`, within ±90 minutes. */
function readingNear(readings: Reading[], station: StationId, ts: number): Reading | null {
  let best: Reading | null = null
  for (const r of readings) {
    if (r.station !== station) continue
    const d = Math.abs(r.ts - ts)
    if (d <= 1.5 * HOUR && (!best || d < Math.abs(best.ts - ts))) best = r
  }
  return best
}

export type BatteryStatus = 'good' | 'warning' | 'critical'

/** 12 V sealed lead-acid: 12.4 V and up is healthy at rest, below 11.8 V is deeply discharged. */
export function batteryStatus(volts: number): BatteryStatus {
  if (volts >= 12.4) return 'good'
  if (volts >= 11.8) return 'warning'
  return 'critical'
}

export interface Tiles {
  airTemp: { value: number | null; delta24h: number | null }
  rain: { total: number | null; wetHours: number }
  battery: { min: number | null; station: StationId | null; status: BatteryStatus | null }
  completeness: { received: number; expected: number; ratio: number | null }
}

export function computeTiles(readings: Reading[], filter: StationFilter, window: Window | null): Tiles {
  const stations = selectedStations(filter)
  const latest = latestByStation(readings)

  const temps: number[] = []
  const deltas: number[] = []
  let battery: Tiles['battery'] = { min: null, station: null, status: null }
  for (const id of stations) {
    const last = latest.get(id)
    if (!last) continue
    if (last.airTemp != null) {
      temps.push(last.airTemp)
      const prior = readingNear(readings, id, last.ts - DAY)
      if (prior?.airTemp != null) deltas.push(last.airTemp - prior.airTemp)
    }
    if (last.battery != null && (battery.min == null || last.battery < battery.min)) {
      battery = { min: last.battery, station: id, status: batteryStatus(last.battery) }
    }
  }

  let total = 0
  let any = false
  let wetHours = 0
  for (const r of readings) {
    if (r.rain == null) continue
    any = true
    total += r.rain
    if (r.rain > 0) wetHours++
  }

  const expected = window ? window.hours * stations.length : 0
  const received = readings.length

  return {
    airTemp: { value: mean(temps), delta24h: mean(deltas) },
    rain: { total: any ? total : null, wetHours },
    battery,
    completeness: { received, expected, ratio: expected > 0 ? received / expected : null },
  }
}

export type SeriesRow = { ts: number } & Partial<Record<StationId, number | null>>

/** One row per hour across the window, so an outage shows as a gap in the line instead of a straight bridge. */
export function hourlySeries(
  readings: Reading[],
  metric: MetricKey,
  stations: StationId[],
  window: Window | null,
): SeriesRow[] {
  if (!window) return []
  const byHour = new Map<number, SeriesRow>()
  const firstHour = Math.ceil(window.start / HOUR) * HOUR
  for (let ts = firstHour; ts <= window.end; ts += HOUR) {
    const row: SeriesRow = { ts }
    for (const id of stations) row[id] = null
    byHour.set(ts, row)
  }
  for (const r of readings) {
    if (!stations.includes(r.station)) continue
    const hour = Math.round(r.ts / HOUR) * HOUR
    const row = byHour.get(hour)
    if (row) row[r.station] = r[metric]
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
    if (r.windDir == null || r.windSpeed == null || r.windSpeed < 0.5) continue
    const i = Math.round((((r.windDir % 360) + 360) % 360) / 45) % SECTORS.length
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
