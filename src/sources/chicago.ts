import { batteryStatus } from '../data/compute'
import type { Reading, Source, Station } from '../data/types'
import { WINDOW_DAYS } from '../data/types'

/** Chicago Park District, "Beach Weather Stations - Automated Sensors" (Socrata id k7hf-8y75). */
const API = 'https://data.cityofchicago.org/resource/k7hf-8y75.json'

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

type RawRow = Partial<Record<(typeof FIELDS)[number], string>>

const STATIONS: readonly Station[] = [
  { id: '63rd', name: '63rd Street Weather Station', shortName: '63rd Street', slot: 1 },
  { id: 'foster', name: 'Foster Weather Station', shortName: 'Foster', slot: 2 },
  { id: 'oak', name: 'Oak Street Weather Station', shortName: 'Oak Street', slot: 3 },
]
const ID_BY_NAME = new Map(STATIONS.map((s) => [s.name, s.id]))

const pad = (n: number) => String(n).padStart(2, '0')
const floatingIso = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00:00`

export function buildChicagoQuery(days: number, now = new Date()): string {
  const since = new Date(now.getTime() - days * 86_400_000)
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

export const chicago: Source = {
  id: 'chicago',
  name: 'Chicago Lakefront Stations',
  shortName: 'Chicago lakefront',
  lede: "Hourly readings from the Chicago Park District's three automated beach weather stations on Lake Michigan.",
  datasetUrl: 'https://data.cityofchicago.org/Parks-Recreation/Beach-Weather-Stations-Automated-Sensors/k7hf-8y75',
  datasetLabel: 'Chicago Data Portal · k7hf-8y75',
  stations: STATIONS,
  metrics: [
    { key: 'airTemp', label: 'Air temperature', unit: '°C', digits: 1 },
    { key: 'humidity', label: 'Humidity', unit: '%', digits: 0 },
    { key: 'windSpeed', label: 'Wind speed', unit: 'm/s', digits: 1, tickDigits: 1 },
    { key: 'pressure', label: 'Barometric pressure', unit: 'hPa', digits: 1 },
  ],
  tiles: [
    { kind: 'latest', metric: 'airTemp', label: 'Air temperature', unit: '°C', digits: 1 },
    { kind: 'sum', metric: 'rain', label: `Rainfall, ${WINDOW_DAYS} days`, unit: 'mm', digits: 1, countLabel: 'wet hours recorded' },
    {
      kind: 'minLatest',
      metric: 'battery',
      label: 'Battery',
      unit: 'V',
      digits: 1,
      status: batteryStatus,
      statusLabel: { good: 'Healthy', warning: 'Low', critical: 'Critical' },
    },
    { kind: 'completeness', label: 'Reporting completeness' },
  ],
  tableColumns: [
    { key: 'airTemp', label: 'Air °C', digits: 1 },
    { key: 'humidity', label: 'Humidity %', digits: 0 },
    { key: 'windSpeed', label: 'Wind m/s', digits: 1 },
    { key: 'maxWind', label: 'Gust m/s', digits: 1 },
    { key: 'pressure', label: 'Pressure hPa', digits: 1 },
    { key: 'battery', label: 'Battery V', digits: 1 },
  ],

  async fetchRaw(signal) {
    const res = await fetch(buildChicagoQuery(WINDOW_DAYS), { signal })
    if (!res.ok) throw new Error(`Chicago Data Portal responded ${res.status}`)
    return (await res.json()) as RawRow[]
  },

  parse(raw) {
    const rows = raw as RawRow[]
    const seen = new Map<string, Reading>()
    for (const row of rows) {
      const station = row.station_name ? ID_BY_NAME.get(row.station_name) : undefined
      if (!station || !row.measurement_timestamp) continue
      const ts = new Date(row.measurement_timestamp).getTime()
      if (!Number.isFinite(ts)) continue
      seen.set(`${station}|${ts}`, {
        station,
        ts,
        values: {
          airTemp: num(row.air_temperature),
          humidity: num(row.humidity),
          windSpeed: num(row.wind_speed),
          maxWind: num(row.maximum_wind_speed),
          windDir: num(row.wind_direction),
          pressure: num(row.barometric_pressure),
          solar: num(row.solar_radiation),
          rain: num(row.interval_rain),
          battery: num(row.battery_life),
        },
      })
    }
    return [...seen.values()].sort((a, b) => a.ts - b.ts)
  },
}
