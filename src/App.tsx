import { useMemo, useState } from 'react'
import {
  clampToWindow,
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
import { ALL, WINDOW_DAYS, type Reading, type StationFilter as Filter } from './data/types'
import { useHash } from './hooks/useHash'
import { useReadings } from './hooks/useReadings'
import { DEFAULT_SOURCE, SOURCES, sourceById } from './sources'
import { StatTiles } from './components/StatTiles'
import { StationFilter } from './components/StationFilter'
import { StationTable } from './components/StationTable'
import { TimeSeries } from './components/TimeSeries'
import { WindBreakdown } from './components/WindBreakdown'

const NO_READINGS: Reading[] = []

export default function App() {
  const [hash, setHash] = useHash()
  const source = sourceById(hash) ?? DEFAULT_SOURCE
  const state = useReadings(source)
  const [rawFilter, setFilter] = useState<Filter>(ALL)
  const [rawMetric, setMetric] = useState<string>(source.metrics[0].key)

  // A station or metric chosen under another region falls back to the default for this one.
  const filter = rawFilter === ALL || source.stations.some((s) => s.id === rawFilter) ? rawFilter : ALL
  const metric = source.metrics.some((m) => m.key === rawMetric) ? rawMetric : source.metrics[0].key

  // Only use data that belongs to the current region; the previous region's frame stays visible while loading.
  const current = state.data && state.sourceId === source.id ? state.data : null
  const allReadings = current?.readings ?? NO_READINGS
  const window = useMemo(() => computeWindow(allReadings), [allReadings])
  const readings = useMemo(() => clampToWindow(allReadings, window), [allReadings, window])
  const scoped = useMemo(() => filterByStation(readings, filter), [readings, filter])
  const stations = useMemo(() => selectedStations(source, filter), [source, filter])
  const latestAll = useMemo(() => latestByStation(readings), [readings])
  const health = useMemo(() => {
    const out: Partial<Record<string, StationHealth>> = {}
    for (const s of source.stations) out[s.id] = stationHealth(latestAll.get(s.id), window)
    return out
  }, [source, latestAll, window])

  const tiles = useMemo(() => computeTiles(source, scoped, filter, window), [source, scoped, filter, window])
  const rows = useMemo(() => hourlySeries(scoped, metric, stations, window), [scoped, metric, stations, window])
  const sectors = useMemo(() => windSectors(scoped), [scoped])

  return (
    <main className="page">
      <header className="masthead">
        <div>
          <div className="segmented regions" role="group" aria-label="Region">
            {SOURCES.map((s) => (
              <button
                key={s.id}
                type="button"
                id={`region-${s.id}`}
                className={s.id === source.id ? 'is-selected' : ''}
                aria-pressed={s.id === source.id}
                onClick={() => setHash(s.id)}
              >
                {s.shortName}
              </button>
            ))}
          </div>
          <h1>{source.name}</h1>
          <p className="lede">
            {source.lede} Last {WINDOW_DAYS} days
            {window && (
              <>
                , {fmtDay(window.start)} to {fmtDateTime(window.end)}
              </>
            )}
            .
          </p>
        </div>
        <p className="source">
          <a href={source.datasetUrl} target="_blank" rel="noreferrer">
            {source.datasetLabel}
          </a>
          {current && (
            <span className={`source-badge source-${current.origin}`}>
              {current.origin === 'live' ? 'Live' : `Snapshot from ${fmtDateTime(current.fetchedAt.getTime())}`}
            </span>
          )}
        </p>
      </header>

      <div className="filter-row">
        <StationFilter source={source} value={filter} onChange={setFilter} health={health} />
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
        <StatTiles tiles={tiles} />
        <div className="charts">
          <TimeSeries source={source} rows={rows} stations={stations} metric={metric} onMetricChange={setMetric} window={window} />
          <WindBreakdown source={source} sectors={sectors} filter={filter} />
        </div>
        <StationTable source={source} latest={latestAll} stations={stations} window={window} />
      </div>
    </main>
  )
}
