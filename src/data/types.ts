/** Shared shapes. A Source plugs a dataset into the dashboard; everything else is generic. */

export type StationFilter = string // a station id, or ALL
export const ALL = 'all'

export interface Station {
  id: string
  name: string
  shortName: string
  /** Categorical palette slot, fixed per station so color follows the entity, never its rank. */
  slot: 1 | 2 | 3 | 4
}

export interface Reading {
  station: string
  /** Epoch ms, parsed from the dataset's floating local time as browser-local time. */
  ts: number
  /** Metric key to value. Missing or unparsable values are null. */
  values: Record<string, number | null>
}

/** Every source must publish these two keys for the wind-direction breakdown. */
export const WIND_SPEED = 'windSpeed'
export const WIND_DIR = 'windDir'

export interface MetricDef {
  key: string
  label: string
  unit: string
  digits: number
  /** Decimals on axis ticks; defaults to 0. */
  tickDigits?: number
}

export type StatusLevel = 'good' | 'warning' | 'critical'

export type TileSpec =
  | { kind: 'latest'; metric: string; label: string; unit: string; digits: number }
  | { kind: 'sum'; metric: string; label: string; unit: string; digits: number; countLabel: string }
  | {
      kind: 'minLatest'
      metric: string
      label: string
      unit: string
      digits: number
      status: (value: number) => StatusLevel
      statusLabel: Record<StatusLevel, string>
    }
  | { kind: 'range24h'; metric: string; label: string; unit: string; digits: number }
  | { kind: 'completeness'; label: string }

export interface TableColumn {
  key: string
  label: string
  digits: number
}

export interface Source {
  id: string
  /** Page heading. */
  name: string
  /** Region switch label. */
  shortName: string
  lede: string
  datasetUrl: string
  datasetLabel: string
  stations: readonly Station[]
  metrics: readonly MetricDef[]
  tiles: readonly TileSpec[]
  tableColumns: readonly TableColumn[]
  /** Fetches the raw payload from the live API. The same shape is stored in public/data/<id>.json. */
  fetchRaw(signal?: AbortSignal): Promise<unknown>
  parse(raw: unknown): Reading[]
}

export interface Dataset {
  readings: Reading[]
  origin: 'live' | 'snapshot'
  fetchedAt: Date
}

export const WINDOW_DAYS = 14

export function stationById(source: Source, id: string): Station | undefined {
  return source.stations.find((s) => s.id === id)
}
