import { stationHealth, type Window } from '../data/compute'
import { WINDOW_DAYS, type Reading, type Source } from '../data/types'
import { fmtDateTime, fmtNum, fmtRelative } from '../data/format'

interface Props {
  source: Source
  latest: Map<string, Reading>
  stations: string[]
  window: Window | null
}

const HEALTH_LABEL = { reporting: 'Reporting', stale: 'Stale', silent: 'Silent' } as const

/** Table view of the latest reading per device. Every number in the charts is reachable here without hovering. */
export function StationTable({ source, latest, stations, window }: Props) {
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
              {source.tableColumns.map((c) => (
                <th scope="col" className="num" key={c.key}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {source.stations
              .filter((s) => stations.includes(s.id))
              .map((s) => {
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
                        <span className="muted">No readings in {WINDOW_DAYS} days</span>
                      )}
                    </td>
                    {source.tableColumns.map((c) => (
                      <td className="num" key={c.key}>
                        {fmtNum(r?.values[c.key], c.digits)}
                      </td>
                    ))}
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
