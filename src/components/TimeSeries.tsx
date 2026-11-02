import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dayTicks, type SeriesRow, type Window } from '../data/compute'
import { METRICS, METRIC_BY_KEY, STATION_BY_ID, type MetricKey, type StationId } from '../data/types'
import { fmtDay, fmtNum } from '../data/format'
import { SeriesTooltip } from './ChartTooltip'

interface Props {
  rows: SeriesRow[]
  stations: StationId[]
  metric: MetricKey
  onMetricChange: (m: MetricKey) => void
  window: Window | null
}

export function TimeSeries({ rows, stations, metric, onMetricChange, window }: Props) {
  const def = METRIC_BY_KEY[metric]
  const ticks = dayTicks(window)
  const lastIndex = Object.fromEntries(
    stations.map((id) => {
      let idx = -1
      for (let i = rows.length - 1; i >= 0; i--) {
        if (rows[i][id] != null) {
          idx = i
          break
        }
      }
      return [id, idx]
    }),
  ) as Record<StationId, number>
  const hasData = stations.some((id) => lastIndex[id] >= 0)

  return (
    <section className="card card-series">
      <header className="card-head">
        <div>
          <h2 className="card-title">
            {def.label}, hourly
          </h2>
          <p className="card-sub">Gaps are hours with no reading from that station.</p>
        </div>
        <div className="segmented" role="group" aria-label="Metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              id={`metric-${m.key}`}
              className={m.key === metric ? 'is-selected' : ''}
              aria-pressed={m.key === metric}
              onClick={() => onMetricChange(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {stations.length > 1 && (
        <ul className="legend" aria-label="Series">
          {stations.map((id) => (
            <li key={id}>
              <span className="legend-key" style={{ background: `var(--series-${STATION_BY_ID[id].slot})` }} />
              {STATION_BY_ID[id].shortName}
            </li>
          ))}
        </ul>
      )}

      <div className="plot">
        {!hasData && <p className="empty">No {def.label.toLowerCase()} readings in this window.</p>}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ top: 12, right: 72, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis
              dataKey="ts"
              type="number"
              scale="time"
              domain={['dataMin', 'dataMax']}
              ticks={ticks}
              tickFormatter={fmtDay}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
              minTickGap={24}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--ink-muted)', fontSize: 12 }}
              tickFormatter={(v: number) => fmtNum(v, def.key === 'windSpeed' ? 1 : 0)}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={(props) => <SeriesTooltip {...props} unit={def.unit} digits={def.digits} />}
            />
            {stations.map((id) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                name={STATION_BY_ID[id].shortName}
                stroke={`var(--series-${STATION_BY_ID[id].slot})`}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }}
                connectNulls={false}
                isAnimationActive={false}
                label={(p: { x?: string | number; y?: string | number; index?: number; value?: unknown }) => {
                  const x = Number(p.x)
                  const y = Number(p.y)
                  if (p.index !== lastIndex[id] || typeof p.value !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) {
                    return <g />
                  }
                  return (
                    <text x={x + 8} y={y} dy={4} fontSize={12} fill="var(--ink-secondary)" className="end-label">
                      {STATION_BY_ID[id].shortName} {fmtNum(p.value, def.digits)}
                    </text>
                  )
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
