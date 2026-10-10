import type { Exercise } from '@klisteniapp/b2b-contracts'
import { ExercisePreview } from '@klisteniapp/anatomy-viewer/preview'
import { Field } from '@klisteniapp/b2b-ui'
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
  const normalizedQuery = query.toLocaleLowerCase()
  const visible = exercises.filter((exercise) =>
    `${exercise.name} ${exercise.equipment}`.toLocaleLowerCase().includes(normalizedQuery),
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
      <div className="grid three" style={{ marginTop: 22 }}>
        {visible.map((exercise) => (
          <article className="card" key={exercise.id}>
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
