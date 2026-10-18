import { useState } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import {
  GoalProgramContentSchema,
  type Enrollment,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { DraftConflict, DraftRecovery } from '../../../shared/editor/useEditorDraft'
import { EditorFeedback, PlanningAudit, RetryPlanningRequest } from './EditorFeedback'
import { StageScheduleEditor, type RoutineChoice } from './StageScheduleEditor'
import { goalIssues, isGoalContent, readAttempt } from './programmingModel'
import { usePlanningEditor } from './usePlanningEditor'

export function PeriodImpactEditor({
  orgId,
  client,
  enrollment,
  choices,
  onSaved,
  onClose,
}: {
  orgId: string
  client: ProductV2Client
  enrollment: Enrollment
  choices: RoutineChoice[]
  onSaved: (enrollment: Enrollment) => void
  onClose: () => void
}) {
  const editor = usePlanningEditor({
    orgId,
    family: 'period',
    id: enrollment.id,
    content: structuredClone(enrollment.content),
    revision: enrollment.revision,
    validate: isGoalContent,
  })
  const { local } = editor
  const [latest, setLatest] = useState(enrollment)
  const [preview, setPreview] = useState<ProductOutput<'periodPreview'> | null>(null)
  const [accepted, setAccepted] = useState(false)
  const stale = latest.revision !== local.revision
  const blocked = editor.busy || Boolean(local.pending) || stale || editor.conflict
  const matches =
    preview &&
    JSON.stringify(preview.proposed) === JSON.stringify(local.value.content) &&
    preview.expectedRevision === local.revision
  async function makePreview() {
    const issues = goalIssues(local.value.content)
    if (issues.length) {
      editor.setIssues(issues)
      return
    }
    setPreview(null)
    setAccepted(false)
    await editor.run(null, null, async () => {
      const result = await client.call('periodPreview', {
        id: enrollment.id,
        expectedRevision: local.savedRevision(),
        proposed: GoalProgramContentSchema.parse(local.value.content),
      })
      if (local.isCurrent()) setPreview(result)
    })
  }
  async function apply() {
    if (!matches || !accepted || !preview) return
    if (Date.parse(preview.expiresAt) <= Date.now()) {
      setPreview(null)
      setAccepted(false)
      editor.setMessage('La vista previa venció. Consultá el impacto otra vez.')
      return
    }
    const input = {
      enrollmentId: enrollment.id,
      expectedRevision: preview.expectedRevision,
      proposed: preview.proposed,
      previewHash: preview.previewHash,
    }
    await editor.run('applyPeriod', input, async (operationId) => {
      try {
        const result = await client.call('applyPeriod', { ...input, operationId })
        if (!local.isCurrent()) return
        local.reset(
          { id: result.id, content: structuredClone(result.content), attempt: null },
          result.revision,
        )
        setLatest(result)
        setPreview(null)
        setAccepted(false)
        onSaved(result)
        editor.setMessage(
          'Períodos actualizados. Se conservan las sesiones y sus vínculos originales.',
        )
      } catch (error) {
        if (local.isCurrent()) {
          setPreview(null)
          setAccepted(false)
        }
        throw error
      }
    })
  }
  async function retryLast() {
    const input = readAttempt(local.value.attempt, 'applyPeriod')
    if (!input || input.enrollmentId !== enrollment.id) return
    await editor.run(null, null, async () => {
      const result = await client.call('applyPeriod', input)
      const continuity = await client.call('continuity', { memberId: enrollment.scope.memberId })
      const current = [...continuity.current, ...continuity.past, ...continuity.future].find(
        (e) => e.id === result.id,
      )
      if (!current) throw new Error('La inscripción ya no está disponible.')
      if (!local.isCurrent()) return
      setLatest(current)
      onSaved(current)
      editor.setConflict(true)
      setPreview(null)
      setAccepted(false)
      editor.setMessage('Solicitud confirmada. Revisá los períodos actuales antes de continuar.')
    })
  }
  return (
    <div className="form-stack">
      <div className="row">
        <h2>Cambiar períodos</h2>
        <button type="button" className="button" disabled={editor.busy} onClick={onClose}>
          Volver
        </button>
      </div>
      <p>
        Inscripción {enrollment.id} · revisión {local.revision}. Las sesiones registradas y sus
        vínculos originales se conservan; la elegibilidad puede cambiar.
      </p>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={editor.busy}
        onRecover={local.recover}
        onDiscard={() =>
          local.reset(
            { id: latest.id, content: structuredClone(latest.content), attempt: null },
            latest.revision,
          )
        }
      />
      {(stale || editor.conflict) && (
        <DraftConflict
          key={latest.revision}
          busy={editor.busy}
          currentAvailable={stale}
          onRefresh={() =>
            void editor.run(null, null, async () => {
              const result = await client.call('continuity', {
                memberId: enrollment.scope.memberId,
              })
              const saved = [...result.current, ...result.past, ...result.future].find(
                (e) => e.id === enrollment.id,
              )
              if (!saved) throw new Error('La inscripción ya no está disponible.')
              if (local.isCurrent()) setLatest(saved)
            })
          }
          onKeep={() => {
            local.rebase(latest.revision)
            editor.setConflict(false)
            setPreview(null)
            setAccepted(false)
          }}
          onDiscard={() => {
            local.reset(
              { id: latest.id, content: structuredClone(latest.content), attempt: null },
              latest.revision,
            )
            editor.setConflict(false)
            setPreview(null)
            setAccepted(false)
          }}
        >
          <pre>{JSON.stringify(latest.content, null, 2)}</pre>
        </DraftConflict>
      )}
      {local.value.attempt && !local.pending && (
        <RetryPlanningRequest busy={editor.busy} onRetry={() => void retryLast()} />
      )}
      <fieldset
        className="form-stack"
        disabled={editor.busy || Boolean(local.pending)}
        style={{ border: 0, padding: 0 }}
      >
        <StageScheduleEditor
          content={local.value.content}
          choices={choices}
          onChange={(content) => {
            editor.change(content)
            setPreview(null)
            setAccepted(false)
          }}
        />
        <button
          type="button"
          className="button"
          disabled={blocked}
          onClick={() => void makePreview()}
        >
          Consultar impacto antes de aplicar
        </button>
        {matches && preview && (
          <section className="card" aria-label="Impacto del cambio">
            <h3>Impacto en sesiones prescritas y registros</h3>
            <p>
              Vista válida hasta {preview.expiresAt}. Si otra persona cambia una sesión, será
              necesario revisarla otra vez.
            </p>
            {preview.impacts.length ? (
              <ul>
                {preview.impacts.map((impact) => (
                  <li key={impact.occurrenceId}>
                    <strong>Sesión {impact.occurrenceId}</strong>
                    <p>
                      {impact.beforeDate} → {impact.afterDate ?? 'Fuera de prescripción'} ·{' '}
                      {impact.beforeEligibility} → {impact.afterEligibility}
                    </p>
                    <p>{impact.reason}</p>
                    <p>Registros conservados: {impact.linkedSessionIds.join(', ') || 'Ninguno'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                No se informan cambios en las obligaciones existentes. La propuesta puede crear
                nuevas sesiones.
              </p>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(e) => setAccepted(e.target.checked)}
              />
              Revisé el impacto y confirmo aplicar estos períodos.
            </label>
            <button
              type="button"
              className="button primary"
              disabled={blocked || !accepted}
              onClick={() => void apply()}
            >
              Aplicar períodos revisados
            </button>
          </section>
        )}
      </fieldset>
      <EditorFeedback error={editor.error} message={editor.message} issues={editor.issues} />
      <PlanningAudit key={latest.id + latest.revision} client={client} id={latest.id} />
    </div>
  )
}
