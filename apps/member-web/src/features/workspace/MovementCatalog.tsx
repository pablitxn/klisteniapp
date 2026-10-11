import type { Exercise } from '@klisteniapp/b2b-contracts'
import { ExercisePreview } from '@klisteniapp/anatomy-viewer/preview'
import { Empty, Field } from '@klisteniapp/b2b-ui'
import { ExerciseDetails } from '../../components/ExerciseDetails'

export function MovementCatalog({
  exercises,
  query,
  onQuery,
}: {
  exercises: Exercise[]
  query: string
  onQuery: (value: string) => void
}) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase()
      .trim()
  const normalizedQuery = normalize(query)
  const visible = exercises.filter((exercise) =>
    normalize(`${exercise.name} ${exercise.equipment}`).includes(normalizedQuery),
  )
  return (
    <>
      <Field label="Buscar movimiento">
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder="Nombre o equipamiento"
        />
      </Field>
      <p className="small muted" role="status" style={{ marginTop: 12 }}>
        {visible.length}{' '}
        {visible.length === 1 ? 'movimiento disponible' : 'movimientos disponibles'}
      </p>
      {!visible.length && (
        <Empty
          title={
            query.trim()
              ? 'No encontramos ese movimiento'
              : 'Todavía no hay movimientos disponibles'
          }
        >
          {query.trim() ? (
            <>
              Probá otro nombre o equipo.{' '}
              <button className="text-button" onClick={() => onQuery('')}>
                Limpiar búsqueda
              </button>
            </>
          ) : (
            'El equipo del gimnasio publicará las instrucciones para tus ejercicios.'
          )}
        </Empty>
      )}
      <div className="grid three" style={{ marginTop: 22 }}>
        {visible.map((exercise) => (
          <article className="card member-catalog-card" key={exercise.id}>
            <div className="exercise-art">
              {exercise.animationId ? (
                <ExercisePreview exerciseId={exercise.animationId} alt={exercise.name} />
              ) : (
                <span aria-hidden="true">↗</span>
              )}
            </div>
            <span className="pill">
              {exercise.scope === 'base' ? 'BASE DE MOVIMIENTO' : 'TU GIMNASIO'}
            </span>
            <h3 style={{ marginTop: 14 }}>{exercise.name}</h3>
            <ExerciseDetails exercise={exercise} previewAlreadyShown />
          </article>
        ))}
      </div>
    </>
  )
}
