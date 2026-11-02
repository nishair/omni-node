import type { Tiles } from '../data/compute'
import { STATION_BY_ID } from '../data/types'
import { fmtInt, fmtNum, fmtPercent, fmtSigned } from '../data/format'

interface Props {
  tiles: Tiles
  stationCount: number
}

const STATUS_LABEL = { good: 'Healthy', warning: 'Low', critical: 'Critical' } as const
const STATUS_ICON = { good: '●', warning: '▲', critical: '■' } as const

export function StatTiles({ tiles, stationCount }: Props) {
  const { airTemp, rain, battery, completeness } = tiles
  const tempHint =
    airTemp.delta24h == null
      ? 'No reading 24 h earlier'
      : `${fmtSigned(airTemp.delta24h)} °C vs 24 h ago`

  return (
    <section className="tiles" aria-label="Summary">
      <div className="tile">
        <div className="tile-label">Air temperature</div>
        <div className="tile-value">
          {fmtNum(airTemp.value)}
          <span className="tile-unit">°C</span>
        </div>
        <div className="tile-hint">
          {stationCount > 1 ? 'Mean of latest readings · ' : 'Latest reading · '}
          <span className={deltaClass(airTemp.delta24h)}>{tempHint}</span>
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">Rainfall, 14 days</div>
        <div className="tile-value">
          {fmtNum(rain.total)}
          <span className="tile-unit">mm</span>
        </div>
        <div className="tile-hint">
          {rain.total == null ? 'No rain gauge data' : `${fmtInt(rain.wetHours)} wet hours recorded`}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">Battery</div>
        <div className="tile-value">
          {fmtNum(battery.min, 1)}
          <span className="tile-unit">V</span>
        </div>
        <div className="tile-hint">
          {battery.status && (
            <span className={`status status-${battery.status}`}>
              <span aria-hidden="true">{STATUS_ICON[battery.status]}</span> {STATUS_LABEL[battery.status]}
            </span>
          )}
          {battery.station
            ? stationCount > 1
              ? ` · lowest, ${STATION_BY_ID[battery.station].shortName}`
              : ' · latest reading'
            : 'No battery reading'}
        </div>
      </div>

      <div className="tile">
        <div className="tile-label">Reporting completeness</div>
        <div className="tile-value">{fmtPercent(completeness.ratio)}</div>
        <div className="tile-hint">
          {fmtInt(completeness.received)} of {fmtInt(completeness.expected)} expected hourly readings
        </div>
      </div>
    </section>
  )
}

function deltaClass(delta: number | null): string {
  if (delta == null || Math.abs(delta) < 0.05) return ''
  return delta > 0 ? 'delta-up' : 'delta-down'
}
