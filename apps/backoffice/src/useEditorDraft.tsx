import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Notice } from '@klisteniapp/b2b-ui'
import { useAccountScope } from '@klisteniapp/b2b-react'
import {
  editorDraftKey,
  readEditorDraft,
  writeEditorDraft,
  type EditorDraft,
} from './editorDraftStorage'

type DraftState<T> = {
  key: string
  value: T
  revision: number | null
  pending: EditorDraft<T> | null
  storageError: string
}

export function useEditorDraft<T>(
  orgId: string,
  kind: 'exercise' | 'program' | 'machine' | 'unit' | 'website',
  entityId: string,
  initial: T,
  initialRevision: number | null,
  validate: (value: unknown) => value is T,
) {
  const { userId: accountId, branchId, role } = useAccountScope()
  const key = editorDraftKey(accountId, orgId, kind, entityId, branchId, role)

  function initialState(): DraftState<T> {
    let pending: EditorDraft<T> | null = null
    try {
      pending = readEditorDraft(sessionStorage, key, validate)
    } catch {
      /* Storage may be unavailable. */
    }
    return { key, value: initial, revision: initialRevision, pending, storageError: '' }
  }

  const [state, setState] = useState(initialState)
  const activeKey = useRef(key)
  const mounted = useRef(false)
  useLayoutEffect(() => {
    activeKey.current = key
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [key])

  // A saved new entity has a new storage identity. Never carry a different
  // account/entity's value or recovery prompt into that identity.
  const current = state.key === key ? state : initialState()
  if (state.key !== key) setState(current)

  function isCurrent() {
    return mounted.current && activeKey.current === key
  }

  function persist(value: T, revision: number | null) {
    try {
      writeEditorDraft(sessionStorage, key, value, revision)
      return ''
    } catch {
      return 'No pudimos conservar la copia en esta pestaña. Tus cambios siguen en pantalla; guardalos antes de salir.'
    }
  }

  function change(value: T) {
    if (!isCurrent()) return
    const storageError = persist(value, current.revision)
    setState({ ...current, value, storageError })
  }

  function reset(value: T, revision: number | null) {
    if (!isCurrent()) return
    let storageError = ''
    try {
      sessionStorage.removeItem(key)
    } catch {
      storageError =
        'No pudimos borrar la copia anterior de esta pestaña. Podría volver a aparecer al abrir el editor.'
    }
    setState({ key, value, revision, pending: null, storageError })
  }

  function recover() {
    if (!isCurrent() || !current.pending) return
    const { value, revision } = current.pending
    setState({ ...current, value, revision, pending: null })
  }

  function rebase(revision: number) {
    if (!isCurrent()) return
    const storageError = persist(current.value, revision)
    setState({ ...current, revision, storageError })
  }

  function savedRevision() {
    if (current.revision === null) {
      throw new Error('No se pudo recuperar la revisión del borrador. Volvé a abrir el editor.')
    }
    return current.revision
  }

  return { ...current, change, reset, recover, rebase, isCurrent, savedRevision }
}

export function DraftRecovery({
  pending,
  error,
  disabled,
  onRecover,
  onDiscard,
}: {
  pending: boolean
  error: string
  disabled: boolean
  onRecover: () => void
  onDiscard: () => void
}) {
  return (
    <>
      <Notice error>{error}</Notice>
      {pending && (
        <section className="card review-panel">
          <Notice>Hay cambios sin guardar de este editor en esta pestaña.</Notice>
          <div className="row">
            <button type="button" className="button" disabled={disabled} onClick={onRecover}>
              Recuperar borrador local
            </button>
            <button type="button" className="text-button" disabled={disabled} onClick={onDiscard}>
              Descartar copia local
            </button>
          </div>
        </section>
      )}
    </>
  )
}

export function DraftConflict({
  currentAvailable,
  busy,
  children,
  onRefresh,
  onKeep,
  onDiscard,
}: {
  currentAvailable: boolean
  busy: boolean
  children: ReactNode
  onRefresh: () => void
  onKeep: () => void
  onDiscard: () => void
}) {
  const [confirmed, setConfirmed] = useState(false)
  return (
    <section className="card review-panel">
      <Notice>
        Este contenido cambió desde que empezaste a editar. Tu borrador local sigue en pantalla.
      </Notice>
      {currentAvailable ? (
        <>
          <details open>
            <summary>Versión actual guardada en el gimnasio</summary>
            {children}
          </details>
          <label className="check" style={{ marginTop: 18 }}>
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.
          </label>
          <div className="row" style={{ marginTop: 18 }}>
            <button type="button" className="button" disabled={busy || !confirmed} onClick={onKeep}>
              Continuar con mis cambios
            </button>
            <button type="button" className="text-button" disabled={busy} onClick={onDiscard}>
              Descartar mis cambios y cargar versión actual
            </button>
          </div>
        </>
      ) : (
        <button type="button" className="button" disabled={busy} onClick={onRefresh}>
          Consultar versión actual
        </button>
      )}
    </section>
  )
}
