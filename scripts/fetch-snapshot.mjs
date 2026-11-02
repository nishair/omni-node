// Refreshes public/data/snapshot.json with the last N days of hourly readings
// from the Chicago Beach Weather Stations dataset (Socrata id k7hf-8y75).
// The app loads this file only when the live API is unreachable.
//
//   node scripts/fetch-snapshot.mjs [days]

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const BASE = 'https://data.cityofchicago.org/resource/k7hf-8y75.json'
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
]

const days = Number(process.argv[2] ?? 14)
const since = new Date(Date.now() - days * 86_400_000)
const pad = (n) => String(n).padStart(2, '0')
const sinceIso = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}T${pad(since.getHours())}:00:00`

const params = new URLSearchParams({
  $select: FIELDS.join(','),
  $where: `measurement_timestamp > '${sinceIso}'`,
  $order: 'measurement_timestamp ASC',
  $limit: '50000',
})

const res = await fetch(`${BASE}?${params}`)
if (!res.ok) throw new Error(`Socrata responded ${res.status}`)
const rows = await res.json()

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, '../public/data/snapshot.json')
await mkdir(dirname(out), { recursive: true })
await writeFile(
  out,
  JSON.stringify({ fetchedAt: new Date().toISOString(), days, rows }),
)
console.log(`Wrote ${rows.length} rows (${days} days) to ${out}`)
