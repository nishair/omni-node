import type { TileResult } from '../data/compute'
import { fmtNum } from '../data/format'

const STATUS_ICON = { good: '●', warning: '▲', critical: '■' } as const

export function StatTiles({ tiles }: { tiles: TileResult[] }) {
  return (
    <section className="tiles" aria-label="Summary">
      {tiles.map((t) => (
        <div className="tile" key={t.label}>
          <div className="tile-label">{t.label}</div>
          <div className="tile-value">
            {fmtNum(t.value, t.digits)}
            {t.value != null && <span className="tile-unit">{t.unit}</span>}
          </div>
          <div className="tile-hint">
            {t.status && (
              <>
                <span className={`status status-${t.status}`}>
                  <span aria-hidden="true">{STATUS_ICON[t.status]}</span> {t.statusLabel}
                </span>
                {' · '}
              </>
            )}
            {t.hint}
          </div>
        </div>
      ))}
    </section>
  )
}
