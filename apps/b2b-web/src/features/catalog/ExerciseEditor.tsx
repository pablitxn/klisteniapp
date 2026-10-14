import { ApiError } from '@klisteniapp/b2b-client'
import type { Exercise, Machine } from '@klisteniapp/b2b-contracts'
import { useAccountClient } from '@klisteniapp/b2b-react'
import { useEffect, useState, type FormEvent } from 'react'
import { DraftConflict, DraftRecovery, useEditorDraft } from '../../shared/editor/useEditorDraft'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'
import { exerciseDraft, exerciseInput, isExerciseDraft, type ExerciseDraft } from './exerciseDraft'
import { ExerciseFields } from './ExerciseFields'

export function ExerciseEditor({
  orgId,
  exercise,
  exercises,
  machines,
  active,
  onClose,
  onSaved,
}: {
  orgId: string
  exercise?: Exercise
  exercises: Exercise[]
  machines: Machine[]
  active: boolean
  onClose: () => void
  onSaved: (exercise: Exercise) => void
}) {
  const client = useAccountClient()
  const editing = exercise?.scope === 'organization'
  const [latest, setLatest] = useState(exercise)
  const [conflict, setConflict] = useState(false)
  const local = useEditorDraft(
    orgId,
    'exercise',
    exercise ? `${editing ? 'edit' : 'variant'}:${exercise.id}` : 'new',
    exerciseDraft(exercise),
    editing ? exercise.revision : null,
    isExerciseDraft,
  )
  const draft = local.value
  const action = useAction()
  useEffect(() => {
    if (exercise && (!latest || exercise.revision > latest.revision)) setLatest(exercise)
  }, [exercise, latest])
  const stale = Boolean(editing && latest && local.revision !== latest.revision)
  const blocked = Boolean(local.pending) || conflict || stale
  function change(patch: Partial<ExerciseDraft>) {
    local.change({ ...draft, ...patch })
  }
  async function readLatest() {
    const { exercises: current } = await client.catalog.listExercises(orgId)
    const updated = current.find((item) => item.id === exercise?.id)
    if (!updated)
      throw new Error('Este ejercicio ya no está disponible. Tu borrador local sigue conservado.')
    if (local.isCurrent()) {
      setLatest((current) => (current && current.revision > updated.revision ? current : updated))
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked) return
    await action.run(async () => {
      const body = exerciseInput(draft, exercise)
      try {
        const result = editing
          ? await client.catalog.updateExercise(orgId, exercise.id, {
              ...body,
              expectedRevision: local.savedRevision(),
            })
          : await client.catalog.createExercise(orgId, body)
        if (!local.isCurrent()) return
        local.reset(exerciseDraft(result.exercise), result.exercise.revision)
        setLatest(result.exercise)
        setConflict(false)
        onSaved(result.exercise)
      } catch (error) {
        if (!local.isCurrent()) return
        if (error instanceof ApiError && error.status === 409 && editing) {
          setConflict(true)
          await readLatest()
        }
        throw error
      }
    }, 'Borrador guardado. Revisalo y publicalo desde el catálogo cuando esté listo.')
  }
  return (
    <>
      <Heading
        title={editing ? 'Refiná el movimiento.' : 'Un nuevo movimiento.'}
        description="Guardá el borrador, revisá sus instrucciones y publicalo para incorporarlo a las rutinas."
      >
        <button className="button" disabled={action.busy} onClick={onClose}>
          Volver al catálogo
        </button>
      </Heading>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={action.busy || !active}
        onRecover={local.recover}
        onDiscard={() =>
          local.reset(exerciseDraft(latest), editing ? (latest?.revision ?? null) : null)
        }
      />
      {latest && !local.pending && (stale || conflict) && (
        <DraftConflict
          key={latest.revision}
          busy={action.busy || !active}
          currentAvailable={stale}
          onRefresh={() => void action.run(readLatest, '')}
          onKeep={() => {
            local.rebase(latest.revision)
            setConflict(false)
            action.clear()
          }}
          onDiscard={() => {
            local.reset(exerciseDraft(latest), latest.revision)
            setConflict(false)
            action.clear()
          }}
        >
          <h3>{latest.name}</h3>
          <p>{latest.description}</p>
          <p className="small muted">
            {latest.pattern} · {latest.equipment} · {latest.muscles.join(', ')}
          </p>
          <p className="small muted">
            Máquinas:{' '}
            {[latest.machineId, ...latest.compatibleMachineIds]
              .filter(Boolean)
              .map((id) => machines.find((machine) => machine.id === id)?.name ?? id)
              .join(', ') || 'Sin máquina específica'}
          </p>
          <p className="small muted">
            Animación:{' '}
            {exercises.find((item) => item.animationId === latest.animationId)?.name ??
              'Sin animación'}
          </p>
          <ol>
            {latest.instructions.map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ol>
          <ul>
            {latest.assets.map((asset) => (
              <li key={asset.id}>
                <a href={asset.url} target="_blank" rel="noreferrer">
                  {asset.label}
                </a>
                {asset.attribution && ` · ${asset.attribution}`}
              </li>
            ))}
          </ul>
        </DraftConflict>
      )}
      <form className="card form-stack" onSubmit={submit}>
        <fieldset
          disabled={action.busy || !active || Boolean(local.pending)}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <ExerciseFields
            orgId={orgId}
            draft={draft}
            machines={machines}
            exercises={exercises}
            disabled={action.busy || !active || Boolean(local.pending)}
            onChange={change}
          />
          <button className="button primary" disabled={blocked} style={{ marginTop: 20 }}>
            {action.busy ? 'Guardando…' : 'Guardar borrador'}
          </button>
        </fieldset>
        {action.notices}
      </form>
    </>
  )
}
