import type { Dataset, Source } from './types'

/** Live first; falls back to the bundled snapshot so the dashboard still renders offline. */
export async function fetchReadings(source: Source, signal?: AbortSignal): Promise<Dataset> {
  try {
    const raw = await source.fetchRaw(signal)
    return { readings: source.parse(raw), origin: 'live', fetchedAt: new Date() }
  } catch (err) {
    if (signal?.aborted) throw err
    console.warn(`Live fetch for ${source.id} failed, using bundled snapshot:`, err)
    const res = await fetch(`${import.meta.env.BASE_URL}data/${source.id}.json`, { signal })
    if (!res.ok) throw new Error(`Snapshot missing (${res.status})`)
    const body = (await res.json()) as { fetchedAt: string; raw: unknown }
    return { readings: source.parse(body.raw), origin: 'snapshot', fetchedAt: new Date(body.fetchedAt) }
  }
}
