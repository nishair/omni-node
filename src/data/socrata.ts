import { STATIONS, type Reading, type StationId } from './types'

/** Chicago Park District, "Beach Weather Stations - Automated Sensors". */
export const DATASET_URL = 'https://data.cityofchicago.org/Parks-Recreation/Beach-Weather-Stations-Automated-Sensors/k7hf-8y75'
const API = 'https://data.cityofchicago.org/resource/k7hf-8y75.json'

export const WINDOW_DAYS = 14
const HOUR = 3_600_000

const FIELDS = [
  'station_name',
  'measurement_timestamp',
  'air_temperature',
  'humidity',
  'wind_speed',
  'maximum_wind_speed',
  'wind_direction',
  'barometric_pressure',
  'solar_radiation',
  'interval_rain',
  'battery_life',
] as const

export type RawRow = Partial<Record<(typeof FIELDS)[number], string>>

export type Source = 'live' | 'snapshot'

export interface Dataset {
  readings: Reading[]
  source: Source
  fetchedAt: Date
}

const ID_BY_NAME = new Map<string, StationId>(STATIONS.map((s) => [s.name, s.id]))

const pad = (n: number) => String(n).padStart(2, '0')

/** Floating local ISO string, matching how the dataset stores timestamps (no zone). */
export function floatingIso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`
}

export function buildQuery(days: number, now = new Date()): string {
  const since = new Date(now.getTime() - days * 24 * HOUR)
  const params = new URLSearchParams({
    $select: FIELDS.join(','),
    $where: `measurement_timestamp > '${floatingIso(since)}'`,
    $order: 'measurement_timestamp ASC',
    $limit: '50000',
  })
  return `${API}?${params.toString()}`
}

function num(v: string | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Parses raw Socrata rows, drops unknown stations and malformed times, and dedupes on station + hour. */
export function parseRows(rows: RawRow[]): Reading[] {
  const seen = new Map<string, Reading>()
  for (const row of rows) {
    const station = row.station_name ? ID_BY_NAME.get(row.station_name) : undefined
    if (!station || !row.measurement_timestamp) continue
    const ts = new Date(row.measurement_timestamp).getTime()
    if (!Number.isFinite(ts)) continue
    seen.set(`${station}|${ts}`, {
      station,
      ts,
      airTemp: num(row.air_temperature),
      humidity: num(row.humidity),
      windSpeed: num(row.wind_speed),
      maxWind: num(row.maximum_wind_speed),
      windDir: num(row.wind_direction),
      pressure: num(row.barometric_pressure),
      solar: num(row.solar_radiation),
      rain: num(row.interval_rain),
      battery: num(row.battery_life),
    })
  }
  return [...seen.values()].sort((a, b) => a.ts - b.ts)
}

export async function fetchLive(days = WINDOW_DAYS, signal?: AbortSignal): Promise<Dataset> {
  const res = await fetch(buildQuery(days), { signal })
  if (!res.ok) throw new Error(`Chicago Data Portal responded ${res.status}`)
  const rows = (await res.json()) as RawRow[]
  return { readings: parseRows(rows), source: 'live', fetchedAt: new Date() }
}

export async function fetchSnapshot(signal?: AbortSignal): Promise<Dataset> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/snapshot.json`, { signal })
  if (!res.ok) throw new Error(`Snapshot missing (${res.status})`)
  const body = (await res.json()) as { fetchedAt: string; rows: RawRow[] }
  return { readings: parseRows(body.rows), source: 'snapshot', fetchedAt: new Date(body.fetchedAt) }
}

/** Live first; falls back to the bundled snapshot so the dashboard still renders offline. */
export async function fetchReadings(signal?: AbortSignal): Promise<Dataset> {
  try {
    return await fetchLive(WINDOW_DAYS, signal)
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn('Live fetch failed, using bundled snapshot:', err)
    return fetchSnapshot(signal)
  }
}
