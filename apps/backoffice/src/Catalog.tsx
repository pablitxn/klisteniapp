import { useState } from 'react'
import type { Exercise, Machine } from '@klisteniapp/b2b-contracts'
import { useAccountClient, Field } from '@klisteniapp/b2b-ui'
import { Heading, useAction } from './shared'
import { latestEditorEntity } from './editorEntity'
import { ExerciseEditor } from './features/catalog/ExerciseEditor'
import { ExerciseCard } from './features/catalog/ExerciseCard'
import { ExerciseReview } from './features/catalog/ExerciseReview'

export function Catalog({
  orgId,
  exercises,
  machines,
  active,
  reload,
}: {
  orgId: string
  exercises: Exercise[]
  machines: Machine[]
  active: boolean
  reload: () => void
}) {
  const client = useAccountClient()
  const [editing, setEditing] = useState<Exercise | 'new' | null>(null)
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all')
  const [preview, setPreview] = useState<Exercise | null>(null),
    [reviewAccepted, setReviewAccepted] = useState(false)
  const action = useAction()
  async function publish(exercise: Exercise) {
    await action.run(async () => {
      const result = await client.catalog.publishExercise(orgId, exercise.id, {
        expectedRevision: exercise.revision,
      })
      if (preview?.id === exercise.id) setPreview(result.exercise)
      reload()
    }, 'Ejercicio publicado. Ya se puede usar en nuevas rutinas.')
  }
  async function review(exercise: Exercise) {
    if (!reviewAccepted) return
    await action.run(async () => {
      const result = await client.catalog.reviewExercise(orgId, exercise.id, {
        expectedRevision: exercise.revision,
      })
      setPreview(result.exercise)
      setReviewAccepted(false)
      reload()
    }, 'Revisión guardada. El ejercicio está listo para publicar.')
  }
  function openPreview(exercise: Exercise) {
    setPreview(exercise)
    setReviewAccepted(false)
    action.clear()
  }
  if (editing)
    return (
      <ExerciseEditor
        orgId={orgId}
        exercise={editing === 'new' ? undefined : latestEditorEntity(editing, exercises)}
        exercises={exercises}
        machines={machines}
        active={active}
        onClose={() => setEditing(null)}
        onSaved={(exercise) => {
          setEditing(exercise)
          reload()
        }}
      />
    )
  return (
    <>
      <Heading
        title="Una biblioteca que crece."
        description="Los movimientos publicados de la biblioteca ya están disponibles para tus rutinas. Adaptá una plantilla o creá una variante cuando necesites instrucciones propias."
      >
        <button
          className="button primary"
          disabled={!active}
          onClick={() => {
            setPreview(null)
            setEditing('new')
          }}
        >
          + Crear ejercicio
        </button>
      </Heading>
      {action.notices}
      <div className="form-grid">
        <Field label="Buscar ejercicio">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Nombre, patrón o equipamiento"
          />
        </Field>
        <Field label="Mostrar ejercicios">
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="base">Biblioteca reutilizable</option>
            <option value="organization">Mi gimnasio</option>
            <option value="draft">Borradores y plantillas</option>
            <option value="reviewed">Revisados por publicar</option>
          </select>
        </Field>
      </div>
      {preview && (
        <ExerciseReview
          exercise={preview}
          active={active}
          busy={action.busy}
          reviewAccepted={reviewAccepted}
          onReviewAccepted={setReviewAccepted}
          onClose={() => setPreview(null)}
          onReview={() => void review(preview)}
          onPublish={() => void publish(preview)}
        />
      )}
      <div className="grid three" style={{ marginTop: 24 }}>
        {exercises
          .filter(
            (exercise) =>
              (filter === 'all' || exercise.scope === filter || exercise.status === filter) &&
              `${exercise.name} ${exercise.pattern} ${exercise.equipment}`
                .toLocaleLowerCase()
                .includes(query.toLocaleLowerCase()),
          )
          .map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              active={active}
              busy={action.busy}
              onPreview={() => openPreview(exercise)}
              onEdit={() => {
                setPreview(null)
                setEditing(exercise)
              }}
              onPublish={() => void publish(exercise)}
            />
          ))}
      </div>
    </>
  )
}
export { Equipment } from './Equipment'
