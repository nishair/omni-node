import { useMemo, useState } from 'react'
import {
  computeTiles,
  computeWindow,
  filterByStation,
  hourlySeries,
  latestByStation,
  selectedStations,
  stationHealth,
  windSectors,
  type StationHealth,
} from './data/compute'
import { fmtDateTime, fmtDay } from './data/format'
import { DATASET_URL, WINDOW_DAYS } from './data/socrata'
import { STATIONS, type MetricKey, type Reading, type StationFilter as Filter } from './data/types'
import { useReadings } from './hooks/useReadings'
import { StatTiles } from './components/StatTiles'
import { StationFilter } from './components/StationFilter'
import { StationTable } from './components/StationTable'
import { TimeSeries } from './components/TimeSeries'
import { WindBreakdown } from './components/WindBreakdown'

const NO_READINGS: Reading[] = []

export default function App() {
  const state = useReadings()
  const [filter, setFilter] = useState<Filter>('all')
  const [metric, setMetric] = useState<MetricKey>('airTemp')

  const readings = state.status === 'ready' ? state.data.readings : NO_READINGS
  const window = useMemo(() => computeWindow(readings), [readings])
  const scoped = useMemo(() => filterByStation(readings, filter), [readings, filter])
  const stations = useMemo(() => selectedStations(filter), [filter])
  const latestAll = useMemo(() => latestByStation(readings), [readings])
  const health = useMemo(() => {
    const out: Partial<Record<string, StationHealth>> = {}
    for (const s of STATIONS) out[s.id] = stationHealth(latestAll.get(s.id), window)
    return out
  }, [latestAll, window])

  const tiles = useMemo(() => computeTiles(scoped, filter, window), [scoped, filter, window])
  const rows = useMemo(() => hourlySeries(scoped, metric, stations, window), [scoped, metric, stations, window])
  const sectors = useMemo(() => windSectors(scoped), [scoped])

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <h1>Lakefront Weather Stations</h1>
          <p className="lede">
            Hourly readings from the Chicago Park District's beach weather sensors over the last {WINDOW_DAYS} days.
            {window && (
              <>
                {' '}
                {fmtDay(window.start)} to {fmtDateTime(window.end)}.
              </>
            )}
          </p>
        </div>
        <p className="source">
          <a href={DATASET_URL} target="_blank" rel="noreferrer">
            Chicago Data Portal · k7hf-8y75
          </a>
          {state.status === 'ready' && (
            <span className={`source-badge source-${state.data.source}`}>
              {state.data.source === 'live' ? 'Live' : `Snapshot from ${fmtDateTime(state.data.fetchedAt.getTime())}`}
            </span>
          )}
        </p>
      </header>

      <div className="filter-row">
        <StationFilter value={filter} onChange={setFilter} health={health} />
      </div>

      {state.status === 'loading' && (
        <p className="notice" role="status">
          Loading {WINDOW_DAYS} days of hourly readings…
        </p>
      )}
      {state.status === 'error' && (
        <p className="notice notice-error" role="alert">
          Could not load readings: {state.message}. Check your connection and reload.
        </p>
      )}

      <div className={state.status === 'loading' ? 'content is-loading' : 'content'}>
        <StatTiles tiles={tiles} stationCount={stations.length} />
        <div className="charts">
          <TimeSeries rows={rows} stations={stations} metric={metric} onMetricChange={setMetric} window={window} />
          <WindBreakdown sectors={sectors} filter={filter} />
        </div>
        <StationTable latest={latestAll} stations={stations} window={window} />
      </div>
    </main>
  )
}
