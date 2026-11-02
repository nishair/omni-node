import { useEffect, useState } from 'react'
import { fetchReadings, type Dataset } from '../data/socrata'

export type ReadingsState =
  | { status: 'loading' }
  | { status: 'ready'; data: Dataset }
  | { status: 'error'; message: string }

export function useReadings(): ReadingsState {
  const [state, setState] = useState<ReadingsState>({ status: 'loading' })

  useEffect(() => {
    const ctrl = new AbortController()
    fetchReadings(ctrl.signal)
      .then((data) => setState({ status: 'ready', data }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
      })
    return () => ctrl.abort()
  }, [])

  return state
}
