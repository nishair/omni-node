import { useEffect, useState } from 'react'
import { fetchReadings } from '../data/fetch'
import type { Dataset, Source } from '../data/types'

export interface ReadingsState {
  status: 'loading' | 'ready' | 'error'
  /** The last dataset loaded, kept on screen while a new source loads. */
  data: Dataset | null
  /** Source id the `data` belongs to. */
  sourceId: string | null
  message?: string
}

interface Store {
  data: Dataset | null
  sourceId: string | null
  error: { sourceId: string; message: string } | null
}

export function useReadings(source: Source): ReadingsState {
  const [store, setStore] = useState<Store>({ data: null, sourceId: null, error: null })

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadings(source, ctrl.signal)
      .then((data) => setStore({ data, sourceId: source.id, error: null }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        const message = err instanceof Error ? err.message : String(err)
        setStore((s) => ({ ...s, error: { sourceId: source.id, message } }))
      })
    return () => ctrl.abort()
  }, [source])

  // Status is derived: whichever source is current is loading until its data or error arrives.
  if (store.error && store.error.sourceId === source.id) {
    return { status: 'error', data: store.data, sourceId: store.sourceId, message: store.error.message }
  }
  if (store.sourceId === source.id) return { status: 'ready', data: store.data, sourceId: store.sourceId }
  return { status: 'loading', data: store.data, sourceId: store.sourceId }
}
