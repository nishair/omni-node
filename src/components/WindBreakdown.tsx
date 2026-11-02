import { Bar, BarChart, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { SectorShare } from '../data/compute'
import { ALL, stationById, type Source, type StationFilter } from '../data/types'
import { fmtInt, fmtPercent } from '../data/format'

interface Props {
  source: Source
  sectors: SectorShare[]
  filter: StationFilter
}

/** Breakdown: share of windy hours by compass sector. Single series, so the bars take the selected station's color. */
export function WindBreakdown({ source, sectors, filter }: Props) {
  const slot = filter === ALL ? null : stationById(source, filter)?.slot
  const color = slot ? `var(--series-${slot})` : 'var(--mark-neutral)'
  const total = sectors.reduce((a, s) => a + s.hours, 0)
  const top = sectors.reduce((a, s) => (s.hours > a.hours ? s : a), sectors[0])

  return (
    <section className="card card-breakdown">
      <header className="card-head">
        <div>
          <h2 className="card-title">Wind direction</h2>
          <p className="card-sub">
            {total > 0
              ? `Share of ${fmtInt(total)} windy hours · mostly from the ${top.sector}`
              : 'No wind readings in this window'}
          </p>
        </div>
      </header>
      <div className="plot">
        {total === 0 && <p className="empty">No wind readings in this window.</p>}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={sectors} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 0 }} barCategoryGap={4}>
            <XAxis type="number" hide domain={[0, (max: number) => Math.max(max, 0.05)]} />
            <YAxis
              type="category"
              dataKey="sector"
              width={32}
              tickLine={false}
              axisLine={{ stroke: 'var(--axis)' }}
              tick={{ fill: 'var(--ink-secondary)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--hover-wash)' }}
              isAnimationActive={false}
              content={({ active, payload }) => {
                const s = payload?.[0]?.payload as SectorShare | undefined
                if (!active || !s) return null
                return (
                  <div className="tooltip" role="status">
                    <div className="tooltip-row">
                      <strong className="tooltip-value">{fmtPercent(s.share, 1)}</strong>
                      <span className="tooltip-name">
                        from {s.sector} · {fmtInt(s.hours)} h
                      </span>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="share" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
              {sectors.map((s) => (
                <Cell key={s.sector} fill={color} />
              ))}
              <LabelList
                dataKey="share"
                position="right"
                formatter={(v: unknown) => fmtPercent(typeof v === 'number' ? v : null, 0)}
                style={{ fill: 'var(--ink-secondary)', fontSize: 12 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
