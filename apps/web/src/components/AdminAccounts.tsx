import { useRef, useState, type FormEvent } from 'react'
import { accountApi, AccountApiError, type AccountInvitation, type AdminUser, type IssuedInvitation } from '../lib/account-api'
import { useAppStore } from '../lib/store'

const invitationStatus = { pending: 'Pendiente', used: 'Utilizado', revoked: 'Revocado', expired: 'Vencido' }
const deliveryStatus: Record<string, string> = { not_requested: 'Para compartir manualmente', smtp_accepted: 'Aceptado por el servidor de correo', unavailable: 'Correo no disponible', failed: 'No se pudo enviar el correo' }
function dateLabel(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : value
}

export default function AdminAccounts({ userId }: { userId: string }) {
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [invitations, setInvitations] = useState<AccountInvitation[]>([])
  const [mailConfigured, setMailConfigured] = useState(false)
  const [sendEmail, setSendEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [issued, setIssued] = useState<IssuedInvitation | null>(null)
  const [copied, setCopied] = useState(false)
  const loading = useRef(false)
  const linkInput = useRef<HTMLInputElement>(null)
  async function reportError(reason: unknown) {
    setError(reason instanceof Error ? reason.message : 'No pudimos completar la operación.')
    if (reason instanceof AccountApiError && (reason.status === 401 || reason.status === 403)) await useAppStore.getState().refreshSession()
  }
  async function load() {
    if (loading.current) return
    loading.current = true
    setBusy(true)
    setError('')
    try {
      const [people, links] = await Promise.all([accountApi.adminUsers(userId), accountApi.adminInvitations(userId)])
      if (useAppStore.getState().user?.id !== userId) return
      setUsers(people.users)
      setInvitations(links.invitations)
      setMailConfigured(links.mailConfigured)
      if (!links.mailConfigured) setSendEmail(false)
    } catch (reason) { await reportError(reason) }
    finally { loading.current = false; setBusy(false) }
  }
  async function operate(action: () => Promise<unknown>, success: string) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    setIssued(null)
    setCopied(false)
    try {
      await action()
      if (useAppStore.getState().user?.id !== userId) return
      setMessage(success)
      await load()
    } catch (reason) { await reportError(reason) }
    finally { setBusy(false) }
  }
  function showIssued(result: IssuedInvitation) {
    const url = new URL(result.url, window.location.origin)
    const route = result.invitation.kind === 'activation' ? '/account/activate' : '/account/recover'
    if (url.origin !== window.location.origin || url.pathname !== route || !new URLSearchParams(url.hash.slice(1)).get('token')) throw new Error('El servidor generó un enlace que no corresponde a esta aplicación.')
    if (useAppStore.getState().user?.id === userId) setIssued(result)
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    await operate(async () => {
      const name = String(data.get('name')).trim()
      const result = await accountApi.invite({ email: String(data.get('email')).trim(), ...(name ? { name } : {}), sendEmail }, userId)
      showIssued(result)
      form.reset()
    }, 'Invitación creada. La persona elegirá su propia contraseña al activar la cuenta.')
  }
  return <details className="account-section admin-accounts" onToggle={event => {
    if (event.currentTarget.open && users === null) void load()
    if (!event.currentTarget.open) { setIssued(null); setCopied(false) }
  }}>
    <summary>Usuarios e invitaciones</summary>
    <p className="fine-print">Administrá quién puede entrar. Cada persona tiene su propio historial privado.</p>
    {users === null ? <><p role="status">{busy ? 'Cargando usuarios e invitaciones…' : 'No pudimos cargar la administración.'}</p>{!busy && <button className="secondary-button" onClick={() => void load()}>Reintentar</button>}</> : <>
      <form className="form-stack admin-invite-form" onSubmit={invite}>
        <h3>Invitar a una persona</h3>
        <label>Email de la persona<input name="email" type="email" autoComplete="off" required maxLength={254} disabled={busy} /></label>
        <label>Nombre <small>Opcional</small><input name="name" autoComplete="off" maxLength={100} disabled={busy} /></label>
        <label className="toggle-label"><span>Enviar los nuevos enlaces por email<small>{mailConfigured ? 'El servidor de correo está configurado. También podés compartir el enlace personalmente.' : 'El correo no está configurado. Podés copiar y compartir el enlace personalmente.'}</small></span><input type="checkbox" checked={sendEmail} disabled={busy || !mailConfigured} onChange={event => setSendEmail(event.target.checked)} /></label>
        <button className="primary-button full-width" disabled={busy}>{busy ? 'Procesando…' : 'Crear invitación'}</button>
      </form>
      {issued && <section className="admin-issued" aria-label="Nuevo enlace personal">
        <h3>{issued.invitation.kind === 'activation' ? 'Invitación para' : 'Recuperación para'} {issued.invitation.email}</h3>
        <p>{deliveryStatus[issued.delivery.status]}. Vence el {dateLabel(issued.invitation.expiresAt)}.</p>
        <label>Enlace personal<input ref={linkInput} value={issued.url} readOnly onFocus={event => event.target.select()} /></label>
        <button type="button" className="secondary-button" onClick={async () => {
          try { await navigator.clipboard.writeText(issued.url); setCopied(true) }
          catch { linkInput.current?.focus(); linkInput.current?.select(); setMessage('Seleccionamos el enlace para que puedas copiarlo manualmente.') }
        }}>{copied ? 'Enlace copiado' : 'Copiar enlace'}</button>
        <p className="fine-print">Compartilo solamente con esta persona. El enlace se muestra ahora; para obtener otro después, reemití la invitación. La aceptación por el servidor de correo no confirma que llegó a la bandeja de entrada.</p>
      </section>}
      <div className="admin-list-heading"><h3>Personas con acceso</h3><button className="text-button" disabled={busy} onClick={() => void load()}>Actualizar</button></div>
      <div className="admin-list">{users.map(user => <article className="admin-row" key={user.id}>
        <div><strong>{user.name}</strong><p>{user.email}</p><span className={`admin-state ${user.disabled ? 'is-muted' : ''}`}>{user.disabled ? 'Deshabilitado' : user.role === 'admin' ? 'Administrador' : 'Activo'}{user.id === userId ? ' · tu cuenta' : ''}</span></div>
        {user.id !== userId && <div className="admin-actions">
          <button className="text-button" disabled={busy} onClick={() => void operate(() => accountApi.manageUser(user.id, user.disabled ? 'enable' : 'disable', userId), user.disabled ? 'Acceso habilitado. La persona puede iniciar una nueva sesión.' : 'Acceso deshabilitado y sesiones revocadas.')}>{user.disabled ? 'Habilitar acceso' : 'Deshabilitar acceso'}</button>
          {!user.disabled && <><button className="text-button" disabled={busy} onClick={() => void operate(() => accountApi.manageUser(user.id, 'revoke-sessions', userId), 'Sesiones revocadas. La persona deberá volver a entrar.')}>Cerrar sus sesiones</button><button className="text-button" disabled={busy} onClick={() => void operate(async () => showIssued(await accountApi.createRecovery(user.id, sendEmail, userId)), 'Enlace de recuperación creado. Los enlaces de recuperación anteriores ya no sirven.')}>Crear recuperación</button></>}
        </div>}
      </article>)}</div>
      <h3 className="admin-invitations-heading">Enlaces de acceso</h3>
      {invitations.length === 0 ? <p className="fine-print">Todavía no hay invitaciones ni enlaces de recuperación.</p> : <div className="admin-list">{invitations.map(invitation => <article className="admin-row" key={invitation.id}>
        <div><strong>{invitation.email}</strong><p>{invitation.kind === 'activation' ? 'Activación' : 'Recuperación'} · {invitationStatus[invitation.status]}</p><small>Vence el {dateLabel(invitation.expiresAt)}{invitation.deliveryStatus && deliveryStatus[invitation.deliveryStatus] ? ` · ${deliveryStatus[invitation.deliveryStatus]}` : ''}</small></div>
        {invitation.status !== 'used' && <div className="admin-actions"><button className="text-button" disabled={busy} onClick={() => void operate(async () => showIssued(await accountApi.reissueInvitation(invitation.id, sendEmail, userId)), 'Enlace reemitido. El enlace anterior ya no sirve.')}>{sendEmail ? 'Reemitir y enviar' : 'Reemitir enlace'}</button>{invitation.status === 'pending' && <button className="text-button" disabled={busy} onClick={() => void operate(() => accountApi.revokeInvitation(invitation.id, userId), 'Enlace revocado. Ya no se puede utilizar.')}>Revocar enlace</button>}</div>}
      </article>)}</div>}
    </>}
    {error && <p role="alert" className="form-error">{error}</p>}
    {message && <p role="status">{message}</p>}
  </details>
}
