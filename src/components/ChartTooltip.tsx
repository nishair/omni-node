import { STATION_BY_ID, type StationId } from '../data/types'
import { fmtDateTime, fmtNum } from '../data/format'

interface Entry {
  dataKey?: unknown
  value?: unknown
  color?: string
}

interface Props {
  active?: boolean
  label?: unknown
  payload?: ReadonlyArray<Entry>
  unit: string
  digits: number
}

/** Shared readout: value leads, series name follows, keyed by a short stroke of the series color. */
export function SeriesTooltip({ active, label, payload, unit, digits }: Props) {
  if (!active || !payload || payload.length === 0) return null
  const ts = typeof label === 'number' ? label : null
  const rows = payload.filter((p) => typeof p.value === 'number')
  return (
    <div className="tooltip" role="status">
      {ts != null && <div className="tooltip-head">{fmtDateTime(ts)}</div>}
      {rows.length === 0 && <div className="tooltip-empty">No readings this hour</div>}
      {rows.map((p) => {
        const id = String(p.dataKey) as StationId
        const station = STATION_BY_ID[id]
        return (
          <div className="tooltip-row" key={id}>
            <span className="tooltip-key" style={{ background: `var(--series-${station?.slot ?? 1})` }} />
            <strong className="tooltip-value">
              {fmtNum(p.value as number, digits)} {unit}
            </strong>
            <span className="tooltip-name">{station?.shortName ?? id}</span>
          </div>
        )
      })}
    </div>
  )
}
