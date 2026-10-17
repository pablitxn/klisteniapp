import { useState } from 'react'
import { type ProductV2Client } from '@klisteniapp/b2b-client'
import type { Exercise } from '@klisteniapp/b2b-contracts'
import {
  RoutineDraftContentSchema,
  type ProductOutput,
  type RoutineVersionV2,
} from '@klisteniapp/b2b-contracts/product-v2'
import { Field } from '@klisteniapp/b2b-ui'
import { DraftConflict, DraftRecovery } from '../../../shared/editor/useEditorDraft'
import { ReviewedAlternatives } from '../../alternatives/ReviewedAlternatives'
import { EditorFeedback, PlanningAudit, RetryPlanningRequest } from './EditorFeedback'
import { PrescriptionEditor } from './PrescriptionEditor'
import {
  blankStep,
  isRoutineContent,
  routineContent,
  readAttempt,
  routineIssues,
  type Routine,
} from './programmingModel'
import { saveRoutineAndReadCurrent } from './planningRequests'
import { usePlanningEditor } from './usePlanningEditor'

export function RoutineEditorV2({
  orgId,
  client,
  routine,
  exercises,
  onSaved,
  onPublished,
  onClose,
}: {
  orgId: string
  client: ProductV2Client
  routine?: Routine
  exercises: Exercise[]
  onSaved: (routine: Routine) => void
  onPublished: (publication: RoutineVersionV2) => void
  onClose: () => void
}) {
  const editor = usePlanningEditor({
    orgId,
    family: 'routine',
    id: routine?.id,
    content: routineContent(routine),
    revision: routine?.revision ?? 0,
    validate: isRoutineContent,
  })
  const { local } = editor
  const content = local.value.content
  const [latest, setLatest] = useState(routine)
  const [publication, setPublication] = useState<RoutineVersionV2 | null>(null)
  const [relations, setRelations] = useState<ProductOutput<'alternatives'> | null>(null)
  const stale = Boolean(latest && latest.revision !== local.revision)
  const blocked = editor.busy || Boolean(local.pending) || stale || editor.conflict
  async function save() {
    const input = { id: local.value.id, expectedRevision: local.savedRevision(), content }
    await editor.run('saveRoutine', input, async (operationId) => {
      RoutineDraftContentSchema.parse(content)
      const { accepted: saved, current } = await saveRoutineAndReadCurrent(client, {
        ...input,
        operationId,
      })
      if (!local.isCurrent()) return
      if (current.revision > saved.revision) {
        setLatest(current)
        onSaved(current)
        editor.setConflict(true)
        editor.setMessage(
          'La solicitud se confirmó, pero otra persona ya guardó una versión posterior. Revisala antes de continuar.',
        )
        return
      }
      local.reset({ id: saved.id, content: routineContent(saved), attempt: null }, saved.revision)
      setLatest(saved)
      setPublication(null)
      setRelations(null)
      onSaved(saved)
      editor.setMessage(
        'Borrador guardado en el gimnasio. Las publicaciones anteriores conservan su contenido.',
      )
    })
  }
  async function publish() {
    const issues = routineIssues(content)
    if (issues.length) {
      editor.setIssues(issues)
      return
    }
    if (!latest || JSON.stringify(content) !== JSON.stringify(routineContent(latest))) {
      editor.setMessage('Guardá este borrador antes de publicar.')
      return
    }
    const input = { id: latest.id, expectedRevision: local.savedRevision() }
    await editor.run('publishRoutine', input, async (operationId) => {
      const published = await client.call('publishRoutine', { ...input, operationId })
      const saved = await client.call('routine', { id: latest.id })
      if (!local.isCurrent()) return
      local.reset({ id: saved.id, content: routineContent(saved), attempt: null }, saved.revision)
      setLatest(saved)
      onSaved(saved)
      onPublished(published)
      setPublication(published)
      setRelations(published.relations)
      editor.setMessage(
        `Versión ${published.version} publicada. Las asignaciones anteriores conservan su versión.`,
      )
    })
  }
  async function retryLast() {
    const saveInput = readAttempt(local.value.attempt, 'saveRoutine')
    const publishInput = readAttempt(local.value.attempt, 'publishRoutine')
    if ((saveInput?.id ?? publishInput?.id) !== local.value.id) return
    await editor.run(null, null, async () => {
      if (saveInput) await client.call('saveRoutine', saveInput)
      if (publishInput) {
        const published = await client.call('publishRoutine', publishInput)
        if (!local.isCurrent()) return
        onPublished(published)
        setPublication(published)
        setRelations(published.relations)
      }
      const saved = await client.call('routine', { id: local.value.id })
      if (!local.isCurrent()) return
      // Fetch current head after replay: an old operation receipt may precede another trainer's edit.
      setLatest(saved)
      onSaved(saved)
      editor.setMessage('Solicitud confirmada. Revisá la versión actual antes de continuar.')
      editor.setConflict(true)
    })
  }
  return (
    <div className="form-stack">
      <div className="row">
        <h2>{latest?.name || 'Nueva rutina'}</h2>
        <button type="button" className="button" disabled={editor.busy} onClick={onClose}>
          Volver
        </button>
      </div>
      <p>
        Podés guardar una rutina vacía o incompleta. Al publicar se revisan los campos necesarios.
      </p>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={editor.busy}
        onRecover={local.recover}
        onDiscard={() =>
          local.reset(
            { id: latest?.id ?? local.value.id, content: routineContent(latest), attempt: null },
            latest?.revision ?? 0,
          )
        }
      />
      {(stale || editor.conflict) && (
        <DraftConflict
          key={latest?.revision ?? 0}
          busy={editor.busy}
          currentAvailable={stale}
          onRefresh={() =>
            void editor.run(null, null, async () => {
              const saved = await client.call('routine', { id: local.value.id })
              if (local.isCurrent()) setLatest(saved)
            })
          }
          onKeep={() => {
            if (latest) local.rebase(latest.revision)
            editor.setConflict(false)
          }}
          onDiscard={() => {
            if (latest)
              local.reset(
                { id: latest.id, content: routineContent(latest), attempt: null },
                latest.revision,
              )
            editor.setConflict(false)
          }}
        >
          <pre>{JSON.stringify(latest && routineContent(latest), null, 2)}</pre>
        </DraftConflict>
      )}
      {local.value.attempt && !local.pending && (
        <RetryPlanningRequest busy={editor.busy} onRetry={() => void retryLast()} />
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          if (!blocked) void save()
        }}
      >
        <fieldset
          className="form-stack"
          disabled={editor.busy || Boolean(local.pending)}
          style={{ border: 0, padding: 0 }}
        >
          <Field label="Nombre de la rutina">
            <input
              maxLength={150}
              value={content.name}
              onChange={(e) => editor.change({ ...content, name: e.target.value })}
            />
          </Field>
          <Field label="Descripción de la rutina">
            <textarea
              maxLength={2000}
              value={content.description}
              onChange={(e) => editor.change({ ...content, description: e.target.value })}
            />
          </Field>
          {content.steps.map((step, index) => (
            <PrescriptionEditor
              key={step.id}
              step={step}
              index={index}
              count={content.steps.length}
              exercises={exercises}
              onChange={(value) =>
                editor.change({
                  ...content,
                  steps: content.steps.map((s) => (s.id === step.id ? value : s)),
                })
              }
              onRemove={() =>
                editor.change({ ...content, steps: content.steps.filter((s) => s.id !== step.id) })
              }
              onMove={(delta) => {
                const steps = [...content.steps]
                const next = index + delta
                if (!steps[next]) return
                ;[steps[index], steps[next]] = [steps[next], steps[index]]
                editor.change({ ...content, steps })
              }}
            />
          ))}
          <button
            type="button"
            className="button"
            disabled={content.steps.length >= 100}
            onClick={() => editor.change({ ...content, steps: [...content.steps, blankStep()] })}
          >
            Agregar movimiento sin configurar
          </button>
          <div className="row">
            <button className="button primary" disabled={blocked}>
              {editor.busy ? 'Guardando…' : 'Guardar borrador incompleto'}
            </button>
            <button
              type="button"
              className="button"
              disabled={blocked || !latest}
              onClick={() => void publish()}
            >
              Publicar versión para asignar
            </button>
          </div>
        </fieldset>
      </form>
      <EditorFeedback error={editor.error} message={editor.message} issues={editor.issues} />
      {publication && (
        <section className="card">
          <h3>Versión publicada {publication.version}</h3>
          {publication.steps.map((step) => (
            <div key={step.id}>
              <h4>
                {publication.exercises.find((e) => e.id === step.exerciseId)?.name ??
                  step.exerciseId}
              </h4>
              <fieldset disabled aria-label="Vista previa de alternativas publicadas">
                <ReviewedAlternatives
                  step={step}
                  relations={relations ?? []}
                  unavailableIds={new Set()}
                  onSelect={() => {}}
                />
              </fieldset>
            </div>
          ))}
          <p>
            Vista de la publicación. La disponibilidad y las condiciones se confirman al entrenar.
          </p>
        </section>
      )}
      {latest && <PlanningAudit key={latest.id + latest.revision} client={client} id={latest.id} />}
    </div>
  )
}
