import type { PublicSite, PublicUnit } from '@klisteniapp/b2b-contracts'
import { Empty } from '@klisteniapp/b2b-ui'
import { ContentMedia } from '@klisteniapp/b2b-ui/content'
import { ExerciseDetails } from '../../components/ExerciseDetails'

export function PublicUnitDetails({ data, slug }: { data: PublicUnit; slug: string }) {
  const { machine, unit, exercises } = data
  const routineUrl = `/app?${unit.branchId ? `branch=${encodeURIComponent(unit.branchId)}&` : ''}gym=${encodeURIComponent(slug)}&unit=${encodeURIComponent(unit.id)}&machine=${encodeURIComponent(machine.id)}`
  return (
    <section style={{ marginTop: 30 }}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">{machine.type}</p>
          <h2>{machine.name}</h2>
          <p>{[machine.manufacturer, machine.model, unit.location].filter(Boolean).join(' · ')}</p>
        </div>
      </div>
      <ContentMedia assets={[...machine.assets, ...unit.assets]} />
      {unit.adjustments && (
        <section className="card" style={{ marginBottom: 24 }}>
          <h3>Ajustes de este equipo</h3>
          <p>{unit.adjustments}</p>
        </section>
      )}
      <div className="row spread" style={{ marginBottom: 24 }}>
        <h2>Movimientos para este equipo</h2>
        <a className="button primary" href={routineUrl}>
          Ver este equipo en mi rutina →
        </a>
      </div>
      {exercises.length ? (
        <div className="grid two">
          {exercises.map((exercise) => (
            <article className="card" key={exercise.id}>
              <h3>{exercise.name}</h3>
              <ExerciseDetails exercise={exercise} />
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Pronto, más movimientos">
          Consultá al equipo del gimnasio para conocer el uso de esta máquina.
        </Empty>
      )}
    </section>
  )
}

export function PublicUnits({ site }: { site: PublicSite }) {
  if (!site.units.length) {
    return (
      <Empty title="Un espacio en movimiento">
        El equipo está preparando la guía de máquinas del gimnasio.
      </Empty>
    )
  }
  const machines = new Map(site.machines.map((machine) => [machine.id, machine]))
  return (
    <div className="grid three">
      {site.units.map((unit) => {
        const machine = machines.get(unit.machineId)
        const image = [...unit.assets, ...(machine?.assets ?? [])].find(
          (asset) => asset.kind === 'image',
        )
        return (
          <a
            className="card"
            style={{ textDecoration: 'none' }}
            key={unit.id}
            href={unit.publicPath}
          >
            <div className="exercise-art">
              {image ? (
                <img src={image.url} alt={image.label || unit.label} />
              ) : (
                <span aria-hidden="true">↗</span>
              )}
            </div>
            <h3>{unit.label}</h3>
            <p className="muted">{unit.location || machine?.name}</p>
            <span className="text-button">Conocer equipo →</span>
          </a>
        )
      })}
    </div>
  )
}
