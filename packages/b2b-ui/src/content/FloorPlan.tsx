import { useState } from 'react'
import type { FloorPlan as Plan } from '@klisteniapp/b2b-contracts/website'
import type { Unit } from '@klisteniapp/b2b-contracts/catalog'

/** The text list is also the keyboard and failed-image alternative to the map. */
export function FloorPlan({ plan, units }: { plan: Plan; units: readonly Unit[] }) {
  const [failed, setFailed] = useState<string | null>(null)
  const points = plan.points.flatMap((point) => {
    const unit = units.find((candidate) => candidate.id === point.unitId)
    return unit ? [{ ...point, unit }] : []
  })
  return (
    <section className="website-content" aria-label="Plano del gimnasio">
      <p className="eyebrow">ORIENTATE EN EL ESPACIO</p>
      <h2>{plan.title}</h2>
      {plan.description && <p>{plan.description}</p>}
      {failed === plan.image.url ? (
        <p role="status">No pudimos cargar el plano. Podés consultar los equipos en la lista.</p>
      ) : (
        <div className="floor-plan">
          <img
            src={plan.image.url}
            alt={plan.image.label}
            loading="lazy"
            onError={() => setFailed(plan.image.url)}
          />
          {points.map((point, index) => (
            <a
              className="floor-plan-point"
              key={point.unitId}
              href={point.unit.publicPath}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              aria-label={`${index + 1}. ${point.unit.label}`}
              title={point.unit.label}
            >
              {index + 1}
            </a>
          ))}
        </div>
      )}
      {plan.image.attribution && <p className="small muted">{plan.image.attribution}</p>}
      <ol className="floor-plan-list">
        {points.map((point) => (
          <li key={point.unitId}>
            <a href={point.unit.publicPath}>{point.unit.label}</a>
            {point.unit.location && <span className="muted"> · {point.unit.location}</span>}
          </li>
        ))}
      </ol>
      <p className="small muted">
        Plano orientativo del gimnasio. Consultá con el equipo si necesitás ayuda para ubicar una
        unidad.
      </p>
    </section>
  )
}
