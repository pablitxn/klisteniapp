import { ApiError } from '@klisteniapp/b2b-client'
import type { Exercise, Program, ProgramStep } from '@klisteniapp/b2b-contracts'
import { useAccountClient } from '@klisteniapp/b2b-react'
import { Field, prescriptionStepLabel } from '@klisteniapp/b2b-ui'
import { useEffect, useState, type FormEvent } from 'react'
import { Heading } from '../../shared/Heading'
import { DraftConflict, DraftRecovery, useEditorDraft } from '../../shared/editor/useEditorDraft'
import { useAction } from '../../shared/useAction'
import { ProgramExercisePicker } from './ProgramExercisePicker'
import { ProgramStepEditor } from './ProgramStepEditor'
import {
  isProgramDraft,
  moveProgramStep,
  newProgramStep,
  programDraft,
  programInput,
  type ProgramDraft,
} from './programDraft'

export function ProgramEditor({
  orgId,
  program,
  exercises,
  active,
  onClose,
  onSaved,
}: {
  orgId: string
  program?: Program
  exercises: Exercise[]
  active: boolean
  onClose: () => void
  onSaved: (program: Program) => void
}) {
  const client = useAccountClient()
  const [latest, setLatest] = useState(program)
  const [conflict, setConflict] = useState(false)
  const local = useEditorDraft(
    orgId,
    'program',
    program?.id ?? 'new',
    programDraft(program),
    program?.revision ?? null,
    isProgramDraft,
  )
  const draft = local.value
  const steps = draft.steps
  const action = useAction()
  const published = exercises.filter((exercise) => exercise.status === 'published')
  useEffect(() => {
    if (program && (!latest || program.revision > latest.revision)) setLatest(program)
  }, [program, latest])
  const stale = Boolean(program && latest && local.revision !== latest.revision)
  const blocked = Boolean(local.pending) || conflict || stale
  function change(patch: Partial<ProgramDraft>) {
    local.change({ ...draft, ...patch })
  }
  function changeStep(id: string, patch: Partial<ProgramStep>) {
    change({ steps: steps.map((step) => (step.id === id ? { ...step, ...patch } : step)) })
  }
  function move(index: number, delta: number) {
    change({ steps: moveProgramStep(steps, index, delta) })
  }
  async function readLatest() {
    const { programs } = await client.programs.list(orgId)
    const updated = programs.find((item) => item.id === program?.id)
    if (!updated)
      throw new Error('Esta rutina ya no está disponible. Tu borrador local sigue conservado.')
    if (local.isCurrent()) {
      setLatest((current) => (current && current.revision > updated.revision ? current : updated))
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked) return
    await action.run(async () => {
      const body = programInput(draft)
      try {
        const result = program
          ? await client.programs.update(orgId, program.id, {
              ...body,
              expectedRevision: local.savedRevision(),
            })
          : await client.programs.create(orgId, body)
        if (!local.isCurrent()) return
        local.reset(programDraft(result.program), result.program.revision)
        setLatest(result.program)
        setConflict(false)
        onSaved(result.program)
      } catch (error) {
        if (!local.isCurrent()) return
        if (error instanceof ApiError && error.status === 409 && program) {
          setConflict(true)
          await readLatest()
        }
        throw error
      }
    }, 'Borrador guardado. Podés publicarlo desde la lista de rutinas cuando esté listo.')
  }
  const exerciseName = (id: string) => exercises.find((exercise) => exercise.id === id)?.name ?? id
  return (
    <>
      <Heading
        title={program ? 'Ajustá el próximo paso.' : 'Una rutina a medida.'}
        description="Definí dosis, descansos y alternativas permitidas para cada movimiento."
      >
        <button className="button" onClick={onClose}>
          Volver a rutinas
        </button>
      </Heading>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={action.busy || !active}
        onRecover={local.recover}
        onDiscard={() => local.reset(programDraft(latest), latest?.revision ?? null)}
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
            local.reset(programDraft(latest), latest.revision)
            setConflict(false)
            action.clear()
          }}
        >
          <h3>{latest.name}</h3>
          <p>{latest.description}</p>
          <ol>
            {latest.steps.map((step) => (
              <li key={step.id}>
                <strong>{exerciseName(step.exerciseId)}</strong>
                <p>{prescriptionStepLabel(step)}</p>
                {step.notes && <p>{step.notes}</p>}
                {step.alternatives.length > 0 && (
                  <p>Alternativas: {step.alternatives.map(exerciseName).join(', ')}</p>
                )}
              </li>
            ))}
          </ol>
        </DraftConflict>
      )}
      <form onSubmit={submit}>
        <fieldset
          className="form-stack"
          disabled={action.busy || !active || Boolean(local.pending)}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <section className="card form-stack">
            <Field label="Nombre de la rutina">
              <input
                name="name"
                required
                maxLength={150}
                value={draft.name}
                onChange={(event) => change({ name: event.target.value })}
              />
            </Field>
            <Field label="Objetivo o descripción">
              <textarea
                name="description"
                maxLength={2000}
                value={draft.description}
                onChange={(event) => change({ description: event.target.value })}
              />
            </Field>
          </section>
          {steps.map((step, index) => (
            <ProgramStepEditor
              key={step.id}
              step={step}
              index={index}
              stepCount={steps.length}
              exerciseName={exerciseName(step.exerciseId)}
              published={published}
              onMove={(delta) => move(index, delta)}
              onRemove={() => change({ steps: steps.filter((item) => item.id !== step.id) })}
              onChange={(patch) => changeStep(step.id, patch)}
            />
          ))}
          <ProgramExercisePicker
            published={published}
            stepCount={steps.length}
            onAdd={(exerciseId) => change({ steps: [...steps, newProgramStep(exerciseId)] })}
          />
          <div className="session-footer">
            <span>{steps.length} movimientos en esta rutina</span>
            <button className="button primary" disabled={blocked || !steps.length}>
              {action.busy ? 'Guardando…' : 'Guardar borrador de rutina'}
            </button>
          </div>
        </fieldset>
        {action.notices}
      </form>
    </>
  )
}
