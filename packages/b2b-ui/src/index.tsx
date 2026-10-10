import { cloneElement, createContext, isValidElement, useContext, useEffect, useId, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react'

import { ApiError, b2bClient, createB2BClient } from './client.ts'
export { ApiError, b2bClient, createB2BClient, type B2BClient } from './client.ts'

export function watchSessionChange(refresh: (immediate: boolean) => void) {
  const storage = (event: StorageEvent) => { if (event.key === 'klisteni.b2b.auth-change') refresh(true) }
  const visibility = () => { if (document.visibilityState === 'visible') refresh(false) }
  const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('klisteni.b2b.auth') : null
  if (channel) channel.onmessage = () => refresh(true)
  const focus = () => refresh(false)
  window.addEventListener('storage', storage); window.addEventListener('focus', focus); document.addEventListener('visibilitychange', visibility)
  return () => { channel?.close(); window.removeEventListener('storage', storage); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', visibility) }
}
const AccountContext = createContext<string | null>(null)
export function AccountProvider({ userId, children }: { userId: string; children: ReactNode }) { return <AccountContext.Provider value={userId}>{children}</AccountContext.Provider> }
export function useAccountId() {
  const accountId = useContext(AccountContext)
  if (!accountId) throw new Error('Missing account context')
  return accountId
}
export function useAccountClient() {
  const accountId = useAccountId()
  return useMemo(() => createB2BClient(accountId), [accountId])
}
export function errorMessage(error: unknown) { return error instanceof Error ? error.message : 'Ocurrió un problema. Volvé a intentar.' }
export function Notice({ children, error = false }: { children?: ReactNode; error?: boolean }) {
  return children ? <div className={`notice ${error ? 'notice-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</div> : null
}
export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return <div className="empty"><span aria-hidden="true">↗</span><h3>{title}</h3><p>{children}</p></div>
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  const generatedId = useId()
  const control = isValidElement<{ id?: string; 'aria-describedby'?: string }>(children) ? children : null
  const id = control?.props.id ?? generatedId
  return <div className="field"><label htmlFor={id}>{label}</label>{control ? cloneElement(control, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) }) : children}{hint && <small id={`${id}-hint`}>{hint}</small>}</div>
}
export function BrandMark({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  return <span className="brand"><span className="brand-symbol" aria-hidden="true">{logoUrl ? <img src={logoUrl} alt="" /> : '↗'}</span><span>{name}</span></span>
}
export function Shell({ name = 'Tu gimnasio', logoUrl, color, eyebrow, navigation, children, actions }: {
  name?: string; logoUrl?: string | null; color?: string; eyebrow: string; navigation?: ReactNode; children: ReactNode; actions?: ReactNode
}) {
  const style = color && /^#[0-9a-f]{6}$/i.test(color) ? { '--brand': color } as CSSProperties : undefined
  return <div className="site-shell" style={style}>
    <a className="skip-link" href="#main">Ir al contenido</a>
    <header className="site-header"><a className="brand-link" href="/app"><BrandMark name={name} logoUrl={logoUrl} /></a><div className="header-actions">{actions}</div></header>
    <div className="workspace">{navigation && <aside className="side-nav"><p className="eyebrow">{eyebrow}</p>{navigation}<div className="sidebar-note">Un paso a la vez.<br/><strong>El progreso es tuyo.</strong></div></aside>}
    <main id="main" className="main-content">{children}</main></div>
    <footer className="site-footer">{name}<span>Tu espacio para moverte mejor.</span></footer>
  </div>
}
export function Login({ onDone, backoffice = false }: { onDone: () => void; backoffice?: boolean }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(''); setBusy(true)
    const values = new FormData(event.currentTarget)
    try { await b2bClient.auth.signIn({ email: String(values.get('email') ?? ''), password: String(values.get('password') ?? '') }); onDone() }
    catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <div className="access-layout"><section className="access-intro"><span className="pill">{backoffice ? 'ESPACIO PROFESIONAL' : 'TU PRÁCTICA, CERCA'}</span><h1>{backoffice ? <>Acompañá cada<br/>nuevo logro.</> : <>Hacé lugar<br/>al movimiento.</>}</h1><p>{backoffice ? 'Personas, rutinas y equipamiento. Todo lo que necesitás para acompañar a tu comunidad.' : 'Encontrá la rutina que prepararon para vos y llevá un registro de tu propio progreso.'}</p><div className="hero-orbit" aria-hidden="true">↗</div></section><section className="card access-card"><p className="eyebrow">BIENVENIDO DE NUEVO</p><h2>Ingresá a tu espacio</h2><p className="muted">Usá la cuenta que te invitó tu gimnasio.</p><form className="form-stack" onSubmit={submit}><Field label="Email"><input name="email" type="email" autoComplete="username" required /></Field><Field label="Contraseña"><input name="password" type="password" autoComplete="current-password" required /></Field><Notice error>{error}</Notice><button className="button primary" disabled={busy}>{busy ? 'Ingresando…' : 'Iniciar sesión'}<span aria-hidden="true">→</span></button></form><p className="small muted">¿Todavía no tenés acceso? Pedile una invitación al equipo de tu gimnasio.</p></section></div>
}
export function useLoad<T>(loader: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | null>(null), [error, setError] = useState(''), [loading, setLoading] = useState(true), [refresh, setRefresh] = useState(0)
  useEffect(() => { let live = true; setLoading(true); setError(''); void loader().then(value => { if (live) setData(value) }).catch(error => { if (live) { setError(errorMessage(error)); if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setData(null) } }).finally(() => { if (live) setLoading(false) }); return () => { live = false } }, [key, refresh])
  return { data, error, loading, reload: () => setRefresh(value => value + 1), setData }
}
export function dateLabel(value: string) { return new Intl.DateTimeFormat('es', { dateStyle: 'medium' }).format(new Date(value)) }
