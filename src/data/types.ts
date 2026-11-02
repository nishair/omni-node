export type StationId = '63rd' | 'foster' | 'oak'
export type StationFilter = StationId | 'all'

export interface Station {
  id: StationId
  /** Exact `station_name` value in the dataset. */
  name: string
  shortName: string
  /** Categorical palette slot. Fixed per station so color follows the entity, never its rank. */
  slot: 1 | 2 | 3
}

/** Fixed order: palette slot is assigned by this order and never re-cycled when the filter changes. */
export const STATIONS: readonly Station[] = [
  { id: '63rd', name: '63rd Street Weather Station', shortName: '63rd Street', slot: 1 },
  { id: 'foster', name: 'Foster Weather Station', shortName: 'Foster', slot: 2 },
  { id: 'oak', name: 'Oak Street Weather Station', shortName: 'Oak Street', slot: 3 },
]

export const STATION_BY_ID: Record<StationId, Station> = Object.fromEntries(
  STATIONS.map((s) => [s.id, s]),
) as Record<StationId, Station>

export interface Reading {
  station: StationId
  /** Epoch ms. The dataset publishes floating Chicago wall-clock times; they are parsed as browser-local time. */
  ts: number
  airTemp: number | null // °C
  humidity: number | null // %
  windSpeed: number | null // m/s
  maxWind: number | null // m/s
  windDir: number | null // degrees, 0 = north
  pressure: number | null // hPa
  solar: number | null // W/m²
  rain: number | null // mm in the interval
  battery: number | null // volts
}

export type MetricKey = 'airTemp' | 'humidity' | 'windSpeed' | 'pressure'

export interface MetricDef {
  key: MetricKey
  label: string
  unit: string
  digits: number
}

export const METRICS: readonly MetricDef[] = [
  { key: 'airTemp', label: 'Air temperature', unit: '°C', digits: 1 },
  { key: 'humidity', label: 'Humidity', unit: '%', digits: 0 },
  { key: 'windSpeed', label: 'Wind speed', unit: 'm/s', digits: 1 },
  { key: 'pressure', label: 'Barometric pressure', unit: 'hPa', digits: 1 },
]

export const METRIC_BY_KEY: Record<MetricKey, MetricDef> = Object.fromEntries(
  METRICS.map((m) => [m.key, m]),
) as Record<MetricKey, MetricDef>
