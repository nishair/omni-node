import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { dayTicks, type SeriesRow, type Window } from '../data/compute'
import { stationById, type Source } from '../data/types'
import { fmtDay, fmtNum } from '../data/format'
import { SeriesTooltip } from './ChartTooltip'

interface Props {
  source: Source
  rows: SeriesRow[]
  stations: string[]
  metric: string
  onMetricChange: (m: string) => void
  window: Window | null
}

export function TimeSeries({ source, rows, stations, metric, onMetricChange, window }: Props) {
  const def = source.metrics.find((m) => m.key === metric) ?? source.metrics[0]
  const ticks = dayTicks(window)
  const lastIndex: Record<string, number> = {}
  for (const id of stations) {
    lastIndex[id] = -1
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i][id] != null) {
        lastIndex[id] = i
        break
      }
    }
  }
  const hasData = stations.some((id) => lastIndex[id] >= 0)

  return (
    <section className="card card-series">
      <header className="card-head">
        <div>
          <h2 className="card-title">{def.label}, hourly</h2>
          <p className="card-sub">Gaps are hours with no reading from that station.</p>
        </div>
        <div className="segmented" role="group" aria-label="Metric">
          {source.metrics.map((m) => (
            <button
              key={m.key}
              type="button"
              id={`metric-${m.key}`}
              className={m.key === def.key ? 'is-selected' : ''}
              aria-pressed={m.key === def.key}
              onClick={() => onMetricChange(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {stations.length > 1 && (
        <ul className="legend" aria-label="Series">
          {stations.map((id) => {
            const s = stationById(source, id)
            return (
              <li key={id}>
                <span className="legend-key" style={{ background: `var(--series-${s?.slot ?? 1})` }} />
                {s?.shortName ?? id}
              </li>
            )
          })}
        </ul>
      )}

      <div className="plot">
        {!hasData && <p className="empty">No {def.label.toLowerCase()} readings in this window.</p>}
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={rows} margin={{ top: 12, right: 96, bottom: 4, left: 0 }}>
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
              tickFormatter={(v: number) => fmtNum(v, def.tickDigits ?? 0)}
              domain={['auto', 'auto']}
            />
            <Tooltip
              cursor={{ stroke: 'var(--axis)', strokeWidth: 1 }}
              isAnimationActive={false}
              content={(props) => <SeriesTooltip {...props} source={source} unit={def.unit} digits={def.digits} />}
            />
            {stations.map((id) => {
              const s = stationById(source, id)
              return (
                <Line
                  key={id}
                  type="monotone"
                  dataKey={id}
                  name={s?.shortName ?? id}
                  stroke={`var(--series-${s?.slot ?? 1})`}
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
                        {s?.shortName ?? id} {fmtNum(p.value, def.digits)}
                      </text>
                    )
                  }}
                />
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
