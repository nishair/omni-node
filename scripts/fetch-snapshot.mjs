// Refreshes public/data/<source>.json with the last N days of readings for every
// region. The app loads a snapshot only when the live API is unreachable.
//
//   node scripts/fetch-snapshot.mjs [days]
//
// The query builders here mirror src/sources/*.ts.

import { writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const days = Number(process.argv[2] ?? 14)
const now = new Date()
const since = new Date(now.getTime() - days * 86_400_000)
const pad = (n) => String(n).padStart(2, '0')

// Chicago Beach Weather Stations (Socrata k7hf-8y75)
async function chicago() {
  const sinceIso = `${since.getFullYear()}-${pad(since.getMonth() + 1)}-${pad(since.getDate())}T${pad(since.getHours())}:00:00`
  const params = new URLSearchParams({
    $select: [
      'station_name', 'measurement_timestamp', 'air_temperature', 'humidity', 'wind_speed',
      'maximum_wind_speed', 'wind_direction', 'barometric_pressure', 'solar_radiation',
      'interval_rain', 'battery_life',
    ].join(','),
    $where: `measurement_timestamp > '${sinceIso}'`,
    $order: 'measurement_timestamp ASC',
    $limit: '50000',
  })
  const res = await fetch(`https://data.cityofchicago.org/resource/k7hf-8y75.json?${params}`)
  if (!res.ok) throw new Error(`Socrata responded ${res.status}`)
  const rows = await res.json()
  return { raw: rows, count: rows.length }
}

function hourlyMeans(rows) {
  const buckets = new Map()
  for (const r of rows) {
    const v = Number(r.v)
    if (!Number.isFinite(v)) continue
    const hour = r.t.slice(0, 13) // "YYYY-MM-DD HH"
    const b = buckets.get(hour) ?? { sum: 0, n: 0 }
    b.sum += v
    b.n++
    buckets.set(hour, b)
  }
  return [...buckets].map(([hour, b]) => ({ t: `${hour}:00`, v: (b.sum / b.n).toFixed(3) }))
}

// NOAA CO-OPS stations on San Francisco Bay
async function sfbay() {
  const stations = ['9414750', '9414290', '9414863', '9414523']
  const products = ['air_temperature', 'water_temperature', 'wind', 'air_pressure', 'water_level']
  const yyyymmdd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  const raw = {}
  let count = 0
  await Promise.all(
    stations.flatMap((station) =>
      products.map(async (product) => {
        const params = new URLSearchParams({
          begin_date: yyyymmdd(since), end_date: yyyymmdd(now), station, product,
          time_zone: 'lst_ldt', units: 'metric', format: 'json', interval: 'h', application: 'omni-node',
        })
        if (product === 'water_level') params.set('datum', 'MLLW')
        const res = await fetch(`https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params}`)
        if (!res.ok) throw new Error(`NOAA responded ${res.status} for ${station} ${product}`)
        const body = await res.json()
        if (body.data) {
          // Water level arrives every 6 minutes; store hourly means to keep the snapshot small.
          const rows = product === 'water_level' ? hourlyMeans(body.data) : body.data
          ;(raw[station] ??= {})[product] = rows
          count += rows.length
        }
      }),
    ),
  )
  return { raw, count }
}

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../public/data')
await mkdir(outDir, { recursive: true })

for (const [id, load] of Object.entries({ chicago, sfbay })) {
  const { raw, count } = await load()
  const out = resolve(outDir, `${id}.json`)
  await writeFile(out, JSON.stringify({ fetchedAt: now.toISOString(), days, raw }))
  console.log(`${id}: wrote ${count} rows (${days} days) to ${out}`)
}
