import { useEffect, useId, useRef, useState } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import { peopleError } from '../people/peopleModel'
import { auditDescription, type AuditChange } from './auditModel'
import './audit.css'

export function AuditEntries({
  changes,
  actors,
}: {
  changes: AuditChange[]
  actors: readonly { userId: string; name: string }[]
}) {
  return (
    <ol className="audit-events">
      {changes.map((change) => {
        const detail = auditDescription(change, actors)
        return (
          <li key={change.id}>
            <h3>{detail.action}</h3>
            <dl>
              <div>
                <dt>Quién</dt>
                <dd>
                  {detail.actor}
                  {change.actorId && <small> · {change.actorId}</small>}
                </dd>
              </div>
              <div>
                <dt>Cuándo</dt>
                <dd>
                  <time dateTime={change.createdAt}>
                    {new Date(change.createdAt).toLocaleString()}
                  </time>
                </dd>
              </div>
              <div>
                <dt>Qué cambió</dt>
                <dd>
                  {detail.fields.length
                    ? detail.fields.join(', ')
                    : 'El registro histórico no conserva el detalle del cambio.'}
                </dd>
              </div>
              <div>
                <dt>Recurso</dt>
                <dd>{change.resourceId}</dd>
              </div>
              <div>
                <dt>Sede</dt>
                <dd>{change.branchId ?? 'Ámbito de marca: registro histórico'}</dd>
              </div>
              {detail.revision && (
                <div>
                  <dt>Revisión</dt>
                  <dd>{detail.revision}</dd>
                </div>
              )}
              {change.operationId && (
                <div>
                  <dt>Operación</dt>
                  <dd>{change.operationId}</dd>
                </div>
              )}
            </dl>
          </li>
        )
      })}
    </ol>
  )
}
export function AuditDrawer({
  createClient,
  resourceId,
  resourceName,
  actors = [],
  signal,
  close,
}: {
  createClient: (signal?: AbortSignal) => ProductV2Client
  resourceId: string
  resourceName?: string
  actors?: readonly { userId: string; name: string }[]
  signal: AbortSignal
  close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    heading = useId(),
    closeButton = useRef<HTMLButtonElement>(null)
  const [state, setState] = useState<{
    changes: AuditChange[] | null
    error: string
    loading: boolean
    resourceId: string
    signal: AbortSignal
  }>({ resourceId, signal, changes: null, error: '', loading: true })
  const [refresh, setRefresh] = useState(0)
  const factory = useRef(createClient)
  factory.current = createClient
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const node = dialog.current
    node?.showModal()
    closeButton.current?.focus()
    return () => {
      node?.close()
      if (previous?.isConnected) previous.focus()
    }
  }, [])
  useEffect(() => {
    const request = new AbortController(),
      combined = AbortSignal.any([signal, request.signal])
    let current = true
    const publish = (next: { changes: AuditChange[] | null; error: string; loading: boolean }) =>
      setState({ ...next, resourceId, signal })
    publish({ changes: null, error: '', loading: true })
    const invalidate = () => {
      current = false
      publish({
        changes: null,
        error: 'El contexto cambió. Cerrá y volvé a validar el acceso.',
        loading: false,
      })
    }
    combined.addEventListener('abort', invalidate, { once: true })
    void Promise.resolve()
      .then(() => factory.current(combined).call('audit', { id: resourceId }))
      .then(
        (changes) => {
          if (current && !combined.aborted) publish({ changes, error: '', loading: false })
        },
        (error) => {
          if (current && !combined.aborted)
            publish({ changes: null, error: peopleError(error).message, loading: false })
        },
      )
    return () => {
      current = false
      combined.removeEventListener('abort', invalidate)
      request.abort()
    }
  }, [resourceId, refresh, signal])
  const visible =
    state.resourceId === resourceId && state.signal === signal && !signal.aborted
      ? state
      : {
          changes: null,
          error: signal.aborted ? 'El acceso cambió. Cerrá y volvé a validar.' : '',
          loading: !signal.aborted,
        }
  return (
    <dialog
      className="audit-drawer"
      ref={dialog}
      aria-labelledby={heading}
      onCancel={(event) => {
        event.preventDefault()
        close()
      }}
    >
      <header>
        <h2 id={heading}>Cambios registrados{resourceName ? `: ${resourceName}` : ''}</h2>
        <button className="button" ref={closeButton} onClick={close}>
          Cerrar cambios
        </button>
      </header>
      <p>
        Solo cambios autorizados de la organización y sede actuales. Los valores de salud y las
        mediciones privadas no se incluyen.
      </p>
      {visible.loading && <p role="status">Cargando cambios…</p>}
      {visible.error && (
        <div role="alert">
          <p>{visible.error}</p>
          <button
            className="button"
            disabled={signal.aborted}
            onClick={() => setRefresh((n) => n + 1)}
          >
            Reintentar cambios
          </button>
        </div>
      )}
      {visible.changes?.length === 0 && (
        <p role="status">No hay cambios visibles para este recurso en la sede actual.</p>
      )}
      {visible.changes && !signal.aborted && (
        <AuditEntries changes={visible.changes} actors={actors} />
      )}
    </dialog>
  )
}
