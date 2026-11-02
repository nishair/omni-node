import { STATIONS, type StationFilter as Filter } from '../data/types'
import type { StationHealth } from '../data/compute'

interface Props {
  value: Filter
  onChange: (v: Filter) => void
  health: Partial<Record<string, StationHealth>>
}

/** The one filter. Native radios so it works with the keyboard; each chip carries its station's fixed color. */
export function StationFilter({ value, onChange, health }: Props) {
  return (
    <fieldset className="filter">
      <legend className="filter-label">Station</legend>
      <div className="chips">
        <label className={`chip ${value === 'all' ? 'is-selected' : ''}`}>
          <input
            type="radio"
            name="station"
            id="station-all"
            value="all"
            checked={value === 'all'}
            onChange={() => onChange('all')}
          />
          All stations
        </label>
        {STATIONS.map((s) => (
          <label className={`chip ${value === s.id ? 'is-selected' : ''}`} key={s.id}>
            <input
              type="radio"
              name="station"
              id={`station-${s.id}`}
              value={s.id}
              checked={value === s.id}
              onChange={() => onChange(s.id)}
            />
            <span className="swatch" style={{ background: `var(--series-${s.slot})` }} aria-hidden="true" />
            {s.shortName}
            {health[s.id] === 'silent' && <span className="chip-note">silent</span>}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
