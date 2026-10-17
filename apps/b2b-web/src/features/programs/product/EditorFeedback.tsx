import type { ProductIssue, ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
import { Field } from '@klisteniapp/b2b-ui'
import { useState } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'

export function EditorFeedback({
  error,
  message,
  issues,
}: {
  error: string
  message: string
  issues: ProductIssue[]
}) {
  return (
    <>
      {error && <p role="alert">{error} Tus cambios se conservan en esta pestaña.</p>}
      {message && <p role="status">{message}</p>}
      {issues.length > 0 && (
        <section role="alert" aria-label="Campos a revisar">
          <h3>Revisá estos campos antes de continuar</h3>
          <ul>
            {issues.map((issue, i) => (
              <li key={i}>
                {issue.stepId ? (
                  <a href={`#step-${issue.stepId}`}>Movimiento {issue.stepId}</a>
                ) : (
                  'Programa'
                )}
                {' · '}
                {issue.path.join(' → ')}: {issue.message}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}

export function PlanningAudit({ client, id }: { client: ProductV2Client; id: string }) {
  const [rows, setRows] = useState<ProductOutput<'audit'> | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="card" aria-label="Cambios del programa">
      <h3>Cambios guardados</h3>
      <p>Referencia: {id}</p>
      <button
        type="button"
        className="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setError('')
          try {
            setRows(await client.call('audit', { id }))
          } catch (error) {
            setRows(null)
            setError(error instanceof Error ? error.message : 'No pudimos cargar los cambios.')
          } finally {
            setBusy(false)
          }
        }}
      >
        {busy ? 'Consultando…' : 'Ver quién cambió qué y cuándo'}
      </button>
      {error && <p role="alert">{error}</p>}
      {rows &&
        (rows.length ? (
          <ol>
            {rows.map((row) => (
              <li key={row.id}>
                <p>
                  {row.actorId ?? 'Sistema'} · <time dateTime={row.createdAt}>{row.createdAt}</time>{' '}
                  · {row.action}
                </p>
                <p>
                  Revisión {row.beforeRevision ?? 'desconocida'} →{' '}
                  {row.afterRevision ?? 'desconocida'} ·{' '}
                  {row.changedFields.join(', ') || 'Detalle anterior no disponible'}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p role="status">No hay cambios disponibles para esta referencia.</p>
        ))}
    </section>
  )
}

export function TimeZoneInput({
  value,
  onChange,
}: {
  value: string | null
  onChange: (value: string | null) => void
}) {
  const [input, setInput] = useState(value ?? '')
  // Keep unconfirmed/invalid text in this control; only an explicit choice enters a server draft.
  const [error, setError] = useState('')
  return (
    <div>
      <Field
        label="Zona horaria IANA"
        hint="Confirmala para este programa. Ej.: America/Argentina/Buenos_Aires. No se toma la zona del dispositivo."
      >
        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value)
            setError('')
            if (!e.target.value) onChange(null)
          }}
        />
      </Field>
      <button
        type="button"
        className="button"
        onClick={() => {
          try {
            new Intl.DateTimeFormat('en', { timeZone: input })
            if (!input) throw new Error()
            onChange(input)
            setError('')
          } catch {
            setError('Ingresá una zona horaria IANA válida.')
          }
        }}
      >
        Confirmar zona horaria
      </button>
      <p role="status">{value ? `Zona confirmada: ${value}` : 'Zona sin confirmar'}</p>
      {error && <p role="alert">{error}</p>}
    </div>
  )
}

export function RetryPlanningRequest({ busy, onRetry }: { busy: boolean; onRetry: () => void }) {
  return (
    <section className="card" aria-label="Solicitud pendiente de confirmar">
      <p>
        Si la conexión se cortó después de enviar, podés consultar otra vez la misma solicitud. Se
        conserva su identidad para evitar duplicados. Los cambios posteriores del editor no se
        incluyen en este reintento.
      </p>
      <button type="button" className="button" disabled={busy} onClick={onRetry}>
        Reintentar la última solicitud enviada
      </button>
    </section>
  )
}
