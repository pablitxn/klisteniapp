import { useState, type ReactNode } from 'react'
import { Notice, useAccountId } from '@klisteniapp/b2b-ui'
import { editorDraftKey, readEditorDraft, writeEditorDraft } from './editorDraftStorage'

export function useEditorDraft<T>(orgId: string, kind: 'exercise' | 'program', entityId: string, initial: T, initialRevision: number | null, validate: (value: unknown) => value is T) {
  const accountId = useAccountId()
  const key = editorDraftKey(accountId, orgId, kind, entityId)
  const [value, setValue] = useState(initial), [revision, setRevision] = useState(initialRevision)
  const [pending, setPending] = useState(() => { try { return readEditorDraft(sessionStorage, key, validate) } catch { return null } })
  const [storageError, setStorageError] = useState('')
  function persist(next: T, sourceRevision: number | null) {
    try { writeEditorDraft(sessionStorage, key, next, sourceRevision); setStorageError('') }
    catch { setStorageError('No pudimos conservar la copia en esta pestaña. Tus cambios siguen en pantalla; guardalos antes de salir.') }
  }
  function change(next: T) { setValue(next); persist(next, revision) }
  function reset(next: T, sourceRevision: number | null) {
    setValue(next); setRevision(sourceRevision); setPending(null)
    try { sessionStorage.removeItem(key); setStorageError('') }
    catch { setStorageError('No pudimos borrar la copia anterior de esta pestaña. Podría volver a aparecer al abrir el editor.') }
  }
  function recover() { if (pending) { setValue(pending.value); setRevision(pending.revision); setPending(null) } }
  function rebase(sourceRevision: number) { setRevision(sourceRevision); persist(value, sourceRevision) }
  return { value, revision, pending, change, reset, recover, rebase, storageError }
}

export function DraftRecovery({ pending, error, disabled, onRecover, onDiscard }: { pending: boolean; error: string; disabled: boolean; onRecover: () => void; onDiscard: () => void }) {
  return <><Notice error>{error}</Notice>{pending && <section className="card review-panel"><Notice>Hay cambios sin guardar de este editor en esta pestaña.</Notice><div className="row"><button type="button" className="button" disabled={disabled} onClick={onRecover}>Recuperar borrador local</button><button type="button" className="text-button" disabled={disabled} onClick={onDiscard}>Descartar copia local</button></div></section>}</>
}

export function DraftConflict({ currentAvailable, busy, children, onRefresh, onKeep, onDiscard }: { currentAvailable: boolean; busy: boolean; children: ReactNode; onRefresh: () => void; onKeep: () => void; onDiscard: () => void }) {
  const [confirmed, setConfirmed] = useState(false)
  return <section className="card review-panel"><Notice>Este contenido cambió desde que empezaste a editar. Tu borrador local sigue en pantalla.</Notice>
    {currentAvailable ? <><details open><summary>Versión actual guardada en el gimnasio</summary>{children}</details><label className="check" style={{ marginTop: 18 }}><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.</label><div className="row" style={{ marginTop: 18 }}><button type="button" className="button" disabled={busy || !confirmed} onClick={onKeep}>Continuar con mis cambios</button><button type="button" className="text-button" disabled={busy} onClick={onDiscard}>Descartar mis cambios y cargar versión actual</button></div></> : <button type="button" className="button" disabled={busy} onClick={onRefresh}>Consultar versión actual</button>}
  </section>
}
