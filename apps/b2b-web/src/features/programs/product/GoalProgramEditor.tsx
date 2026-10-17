import { createClientId } from '@klisteniapp/b2b-client'
import { useState } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import { GoalProgramContentSchema, type Enrollment } from '@klisteniapp/b2b-contracts/product-v2'
import { DraftConflict, DraftRecovery } from '../../../shared/editor/useEditorDraft'
import { EditorFeedback, PlanningAudit, RetryPlanningRequest } from './EditorFeedback'
import { StageScheduleEditor, type RoutineChoice } from './StageScheduleEditor'
import { goalContent, goalIssues, isGoalContent, readAttempt, type Goal } from './programmingModel'
import { saveGoalAndReadCurrent } from './planningRequests'
import { usePlanningEditor } from './usePlanningEditor'

export function GoalProgramEditor({
  orgId,
  memberId,
  client,
  goal,
  choices,
  onSaved,
  onEnrolled,
  onClose,
}: {
  orgId: string
  memberId: string
  client: ProductV2Client
  goal?: Goal
  choices: RoutineChoice[]
  onSaved: (goal: Goal) => void
  onEnrolled: (enrollment: Enrollment) => void
  onClose: () => void
}) {
  const editor = usePlanningEditor({
    orgId,
    family: `goal/${memberId}`,
    id: goal?.id,
    content: goalContent(goal),
    revision: goal?.revision ?? 0,
    validate: isGoalContent,
  })
  const { local } = editor
  const content = local.value.content
  const [latest, setLatest] = useState(goal)
  const [confirm, setConfirm] = useState(false)
  const stale = Boolean(latest && latest.revision !== local.revision)
  const blocked = editor.busy || Boolean(local.pending) || stale || editor.conflict
  async function save() {
    const input = { id: local.value.id, memberId, expectedRevision: local.savedRevision(), content }
    await editor.run('saveGoal', input, async (operationId) => {
      const { accepted: saved, current } = await saveGoalAndReadCurrent(client, {
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
      local.reset({ id: saved.id, content: goalContent(saved), attempt: null }, saved.revision)
      setLatest(saved)
      setConfirm(false)
      onSaved(saved)
      editor.setMessage('Programa guardado. Todavía no se creó una inscripción.')
    })
  }
  async function enroll() {
    const issues = goalIssues(content)
    if (issues.length) {
      editor.setIssues(issues)
      return
    }
    if (!latest || JSON.stringify(content) !== JSON.stringify(goalContent(latest))) {
      editor.setMessage('Guardá este programa antes de asignarlo.')
      return
    }
    const proposed = GoalProgramContentSchema.parse(content)
    const pending = readAttempt(local.value.attempt, 'enroll')
    const input = {
      id:
        pending?.memberId === memberId &&
        pending.goalProgramId === latest.id &&
        pending.issuedGoalRevision === latest.revision
          ? pending.id
          : createClientId(),
      memberId,
      expectedRevision: 0,
      goalProgramId: latest.id,
      issuedGoalRevision: latest.revision,
      content: proposed,
    }
    await editor.run('enroll', input, async (operationId) => {
      const result = await client.call('enroll', { ...input, operationId })
      if (!local.isCurrent()) return
      local.reset({ id: latest.id, content: goalContent(latest), attempt: null }, latest.revision)
      setConfirm(false)
      onEnrolled(result)
      editor.setMessage('Programa asignado con sus versiones y zona horaria confirmadas.')
    })
  }
  async function retryLast() {
    const saveInput = readAttempt(local.value.attempt, 'saveGoal')
    const enrollInput = readAttempt(local.value.attempt, 'enroll')
    if ((saveInput?.memberId ?? enrollInput?.memberId) !== memberId) return
    if ((saveInput?.id ?? enrollInput?.goalProgramId) !== local.value.id) return
    await editor.run(null, null, async () => {
      if (saveInput) {
        await client.call('saveGoal', saveInput)
        const rows = await client.call('goals', { memberId })
        const saved = rows.find((g) => g.id === local.value.id)
        if (!saved) throw new Error('El programa ya no está disponible.')
        if (!local.isCurrent()) return
        setLatest(saved)
        onSaved(saved)
        editor.setConflict(true)
        editor.setMessage('Solicitud confirmada. Revisá la versión actual antes de continuar.')
      }
      if (enrollInput) {
        const result = await client.call('enroll', enrollInput)
        if (!local.isCurrent()) return
        local.reset({ ...local.value, attempt: null }, local.savedRevision())
        onEnrolled(result)
      }
    })
  }
  return (
    <div className="form-stack">
      <div className="row">
        <h2>Programa por objetivo</h2>
        <button type="button" className="button" disabled={editor.busy} onClick={onClose}>
          Volver
        </button>
      </div>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={editor.busy}
        onRecover={local.recover}
        onDiscard={() =>
          local.reset(
            { id: latest?.id ?? local.value.id, content: goalContent(latest), attempt: null },
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
              const goals = await client.call('goals', { memberId })
              const saved = goals.find((g) => g.id === local.value.id)
              if (!saved) throw new Error('El programa ya no está disponible.')
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
                { id: latest.id, content: goalContent(latest), attempt: null },
                latest.revision,
              )
            editor.setConflict(false)
          }}
        >
          <pre>{JSON.stringify(latest && goalContent(latest), null, 2)}</pre>
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
          <StageScheduleEditor
            content={content}
            choices={choices}
            onChange={(value) => {
              editor.change(value)
              setConfirm(false)
            }}
          />
          <button className="button primary" disabled={blocked}>
            Guardar programa incompleto
          </button>
          <label className="check">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
            />
            Confirmo fechas, sesiones y zona horaria para asignar una nueva inscripción a esta
            persona.
          </label>
          <button
            type="button"
            className="button"
            disabled={blocked || !latest || !confirm}
            onClick={() => void enroll()}
          >
            Asignar programa completo
          </button>
        </fieldset>
      </form>
      <EditorFeedback error={editor.error} message={editor.message} issues={editor.issues} />
      {latest && <PlanningAudit key={latest.id + latest.revision} client={client} id={latest.id} />}
    </div>
  )
}
