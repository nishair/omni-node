import type { Reading, Source, Station } from '../data/types'
import { WINDOW_DAYS } from '../data/types'

/** NOAA CO-OPS tide and meteorological stations around Alameda, on San Francisco Bay. */
const API = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter'
const HOUR = 3_600_000

export const NOAA_PRODUCTS = ['air_temperature', 'water_temperature', 'wind', 'air_pressure', 'water_level'] as const
type Product = (typeof NOAA_PRODUCTS)[number]

interface NoaaRow {
  t: string
  v?: string // value
  s?: string // wind speed (wind product) or sigma (water level)
  d?: string // wind direction, degrees
  g?: string // wind gust
}
type NoaaPayload = { data?: NoaaRow[]; error?: { message?: string } }

/** Station id to product to rows. This is the shape stored in public/data/sfbay.json. */
export type NoaaRaw = Record<string, Partial<Record<Product, NoaaRow[]>>>

const STATIONS: readonly Station[] = [
  { id: '9414750', name: 'Alameda', shortName: 'Alameda', slot: 1 },
  { id: '9414290', name: 'San Francisco', shortName: 'San Francisco', slot: 2 },
  { id: '9414863', name: 'Richmond', shortName: 'Richmond', slot: 3 },
  { id: '9414523', name: 'Redwood City', shortName: 'Redwood City', slot: 4 },
]

const pad = (n: number) => String(n).padStart(2, '0')
const yyyymmdd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`

export function buildNoaaUrl(station: string, product: Product, days: number, now = new Date()): string {
  const begin = new Date(now.getTime() - days * 86_400_000)
  const params = new URLSearchParams({
    begin_date: yyyymmdd(begin),
    end_date: yyyymmdd(now),
    station,
    product,
    time_zone: 'lst_ldt',
    units: 'metric',
    format: 'json',
    interval: 'h',
    application: 'omni-node',
  })
  if (product === 'water_level') params.set('datum', 'MLLW')
  return `${API}?${params.toString()}`
}

function num(v: string | undefined): number | null {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** "2026-10-19 00:00" (station local time, no zone) parsed as browser-local time. */
function parseTime(t: string): number {
  return new Date(t.replace(' ', 'T')).getTime()
}

export const sfbay: Source = {
  id: 'sfbay',
  name: 'Alameda Shoreline Stations',
  shortName: 'San Francisco Bay',
  lede: 'Hourly readings from the NOAA tide and weather station at Alameda and its three nearest stations on San Francisco Bay.',
  datasetUrl: 'https://tidesandcurrents.noaa.gov/stationhome.html?id=9414750',
  datasetLabel: 'NOAA CO-OPS · station 9414750',
  stations: STATIONS,
  metrics: [
    { key: 'airTemp', label: 'Air temperature', unit: '°C', digits: 1 },
    { key: 'waterTemp', label: 'Water temperature', unit: '°C', digits: 1 },
    { key: 'windSpeed', label: 'Wind speed', unit: 'm/s', digits: 1, tickDigits: 1 },
    { key: 'pressure', label: 'Barometric pressure', unit: 'hPa', digits: 1 },
    { key: 'waterLevel', label: 'Water level', unit: 'm MLLW', digits: 2, tickDigits: 1 },
  ],
  tiles: [
    { kind: 'latest', metric: 'airTemp', label: 'Air temperature', unit: '°C', digits: 1 },
    { kind: 'latest', metric: 'waterTemp', label: 'Water temperature', unit: '°C', digits: 1 },
    { kind: 'range24h', metric: 'waterLevel', label: 'Tidal range, 24 h', unit: 'm', digits: 2 },
    { kind: 'completeness', label: 'Reporting completeness' },
  ],
  tableColumns: [
    { key: 'airTemp', label: 'Air °C', digits: 1 },
    { key: 'waterTemp', label: 'Water °C', digits: 1 },
    { key: 'windSpeed', label: 'Wind m/s', digits: 1 },
    { key: 'maxWind', label: 'Gust m/s', digits: 1 },
    { key: 'pressure', label: 'Pressure hPa', digits: 1 },
    { key: 'waterLevel', label: 'Level m', digits: 2 },
  ],

  /** One request per station and product, in parallel. A product that fails is left empty; if nothing loads, throw. */
  async fetchRaw(signal) {
    const raw: NoaaRaw = {}
    let loaded = 0
    await Promise.all(
      STATIONS.flatMap((s) =>
        NOAA_PRODUCTS.map(async (product) => {
          try {
            const res = await fetch(buildNoaaUrl(s.id, product, WINDOW_DAYS), { signal })
            if (!res.ok) throw new Error(`NOAA responded ${res.status}`)
            const body = (await res.json()) as NoaaPayload
            if (body.data) {
              ;(raw[s.id] ??= {})[product] = body.data
              loaded++
            }
          } catch (err) {
            if (signal?.aborted) throw err
            console.warn(`NOAA ${product} for ${s.name} unavailable:`, err)
          }
        }),
      ),
    )
    if (loaded === 0) throw new Error('No NOAA products could be loaded')
    return raw
  },

  parse(raw) {
    const data = raw as NoaaRaw
    const byKey = new Map<string, Reading>()
    const levelSums = new Map<string, { sum: number; n: number }>()

    const row = (station: string, hourTs: number): Reading => {
      const key = `${station}|${hourTs}`
      let r = byKey.get(key)
      if (!r) {
        r = {
          station,
          ts: hourTs,
          values: {
            airTemp: null,
            waterTemp: null,
            windSpeed: null,
            maxWind: null,
            windDir: null,
            pressure: null,
            waterLevel: null,
          },
        }
        byKey.set(key, r)
      }
      return r
    }

    for (const station of Object.keys(data)) {
      const products = data[station]
      for (const product of NOAA_PRODUCTS) {
        for (const item of products[product] ?? []) {
          const ts = parseTime(item.t)
          if (!Number.isFinite(ts)) continue
          const hourTs = Math.floor(ts / HOUR) * HOUR
          const r = row(station, hourTs)
          switch (product) {
            case 'air_temperature':
              r.values.airTemp = num(item.v)
              break
            case 'water_temperature':
              r.values.waterTemp = num(item.v)
              break
            case 'air_pressure':
              r.values.pressure = num(item.v)
              break
            case 'wind':
              r.values.windSpeed = num(item.s)
              r.values.maxWind = num(item.g)
              r.values.windDir = num(item.d)
              break
            case 'water_level': {
              // Water level arrives every 6 minutes; average it into the hour.
              const v = num(item.v)
              if (v == null) break
              const key = `${station}|${hourTs}`
              const acc = levelSums.get(key) ?? { sum: 0, n: 0 }
              acc.sum += v
              acc.n++
              levelSums.set(key, acc)
              r.values.waterLevel = acc.sum / acc.n
              break
            }
          }
        }
      }
    }
    return [...byKey.values()].sort((a, b) => a.ts - b.ts)
  },
}
