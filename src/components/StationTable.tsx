import { stationHealth, type Window } from '../data/compute'
import { STATIONS, type Reading, type StationId } from '../data/types'
import { fmtDateTime, fmtNum, fmtRelative } from '../data/format'

interface Props {
  latest: Map<StationId, Reading>
  stations: StationId[]
  window: Window | null
}

const HEALTH_LABEL = { reporting: 'Reporting', stale: 'Stale', silent: 'Silent' } as const

/** Table view of the latest reading per device. Every number in the charts is reachable here without hovering. */
export function StationTable({ latest, stations, window }: Props) {
  return (
    <section className="card">
      <header className="card-head">
        <div>
          <h2 className="card-title">Latest reading by station</h2>
          <p className="card-sub">Stale means the newest reading trails the network by more than 3 hours.</p>
        </div>
      </header>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Station</th>
              <th scope="col">Status</th>
              <th scope="col">Last seen</th>
              <th scope="col" className="num">Air °C</th>
              <th scope="col" className="num">Humidity %</th>
              <th scope="col" className="num">Wind m/s</th>
              <th scope="col" className="num">Gust m/s</th>
              <th scope="col" className="num">Pressure hPa</th>
              <th scope="col" className="num">Battery V</th>
            </tr>
          </thead>
          <tbody>
            {STATIONS.filter((s) => stations.includes(s.id)).map((s) => {
              const r = latest.get(s.id)
              const health = stationHealth(r, window)
              return (
                <tr key={s.id}>
                  <th scope="row">
                    <span className="swatch" style={{ background: `var(--series-${s.slot})` }} aria-hidden="true" />
                    {s.name}
                  </th>
                  <td>
                    <span className={`health health-${health}`}>{HEALTH_LABEL[health]}</span>
                  </td>
                  <td>
                    {r && window ? (
                      <>
                        {fmtDateTime(r.ts)}
                        <span className="muted"> · {fmtRelative(r.ts, window.end)}</span>
                      </>
                    ) : (
                      <span className="muted">No readings in 14 days</span>
                    )}
                  </td>
                  <td className="num">{fmtNum(r?.airTemp)}</td>
                  <td className="num">{fmtNum(r?.humidity, 0)}</td>
                  <td className="num">{fmtNum(r?.windSpeed)}</td>
                  <td className="num">{fmtNum(r?.maxWind)}</td>
                  <td className="num">{fmtNum(r?.pressure)}</td>
                  <td className="num">{fmtNum(r?.battery)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
