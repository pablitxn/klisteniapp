import { useEffect, useRef, useState, type FormEvent } from 'react'
import { accountApi, AccountApiError } from '../lib/account-api'
import { clearAccountAccessToken, type AccountAccessRoute } from '../lib/account-route'
import './account.css'

export default function AccountAccessPage({ route }: { route: AccountAccessRoute }) {
  const token = useRef(route.token)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(Boolean(route.token))
  const [identity, setIdentity] = useState<{ email: string; name: string } | null>(null)
  const [infoAttempt, setInfoAttempt] = useState(0)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(!route.token)
  const activate = route.mode === 'activate'
  useEffect(() => { document.title = `${activate ? 'Activar mi cuenta' : 'Recuperar mi cuenta'} · Klisteni` }, [activate])
  useEffect(() => {
    if (!token.current) return
    let active = true
    void accountApi.tokenInfo(token.current).then(info => {
      if (!active) return
      if (info.kind !== (activate ? 'activation' : 'recovery')) { setInvalid(true); setError('Este enlace corresponde a otra acción. Abrí el enlace original que te compartieron.'); return }
      setIdentity({ email: info.email, name: info.name ?? '' })
    }).catch(reason => {
      if (!active) return
      setError(reason instanceof AccountApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 429 ? 'Este enlace ya no está disponible. Pedí uno nuevo al administrador.' : 'No pudimos verificar el enlace. Revisá tu conexión y volvé a intentar.')
      if (reason instanceof AccountApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 429) setInvalid(true)
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [activate, infoAttempt])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || invalid || !token.current) return
    const element = event.currentTarget
    const values = new FormData(element)
    const password = String(values.get('password'))
    if (password !== values.get('confirmPassword')) { setError('Las contraseñas no coinciden. Revisalas antes de continuar.'); return }
    setBusy(true)
    setError('')
    try {
      if (activate) await accountApi.acceptInvitation({ token: token.current, name: String(values.get('name')).trim(), password })
      else await accountApi.completeRecovery({ token: token.current, password })
      token.current = ''
      clearAccountAccessToken()
      element.reset()
      setDone(true)
    } catch (reason) {
      if (reason instanceof AccountApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 429) {
        setError(activate ? 'No pudimos activar la cuenta. Si el enlace venció o ya se usó, pedí uno nuevo al administrador.' : 'El enlace no está disponible: puede haber vencido, haberse usado o sido revocado. Pedí uno nuevo al administrador.')
        if (reason.code === 'INVALID_TOKEN' || reason.code === 'TOKEN_EXPIRED' || reason.code === 'TOKEN_USED') { token.current = ''; clearAccountAccessToken(); setInvalid(true) }
      } else setError('No pudimos confirmar el cambio. Revisá la conexión y volvé a intentar con este enlace.')
    } finally { setBusy(false) }
  }
  return <main className="account-access" id="main">
    <a href="/" className="account-access-brand" aria-label="Klisteni, abrir la aplicación">klisteni<span>.</span></a>
    <section className="account-access-card" aria-labelledby="account-access-title">
      <div className="account-access-intro">
        <span className="eyebrow">TU ESPACIO DE MOVIMIENTO</span>
        <h1 id="account-access-title">{done ? activate ? 'Tu cuenta está lista.' : 'Contraseña actualizada.' : activate ? 'Bienvenido a tu práctica.' : 'Volvé a tu práctica.'}</h1>
        <p>{done ? activate ? 'Ya podés entrar con tu email y la contraseña que elegiste.' : 'Tus sesiones anteriores se cerraron. Iniciá sesión con tu nueva contraseña.' : activate ? 'Recibiste una invitación para guardar tu rutina y tu progreso entre dispositivos.' : 'Elegí una nueva contraseña con el enlace personal que te compartió el administrador.'}</p>
      </div>
      {done ? <div className="form-stack"><a className="primary-button full-width" href="/?account=login">Iniciar sesión</a><p className="fine-print">El enlace ya cumplió su función. Tu contraseña queda bajo tu control.</p></div> : checking ? <p role="status">Verificando tu enlace…</p> : invalid ? <div className="form-stack"><p role="alert" className="form-error">{error || 'El enlace está incompleto. Abrí el enlace original que te compartieron. Si ya no está disponible, pedí uno nuevo al administrador.'}</p><a className="secondary-button full-width" href="/">Explorar Klisteni</a></div> : !identity ? <div className="form-stack"><p role="alert" className="form-error">{error}</p><button className="secondary-button" onClick={() => { setChecking(true); setError(''); setInfoAttempt(value => value + 1) }}>Reintentar verificación</button></div> : <form className="form-stack" onSubmit={submit} aria-busy={busy}>
        {activate && <><label>Tu nombre<input name="name" autoComplete="name" required maxLength={100} defaultValue={identity.name} disabled={busy} /></label><label>Email de la invitación<input name="email" type="email" autoComplete="email" required maxLength={254} value={identity.email} readOnly /></label></>}
        <label>{activate ? 'Elegí una contraseña' : 'Nueva contraseña'}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} aria-describedby="password-help" /></label>
        <p className="fine-print" id="password-help">Usá al menos 12 caracteres. Puede ser una frase que te resulte fácil recordar.</p>
        <label>Repetí la contraseña<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} /></label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="primary-button full-width" disabled={busy}>{busy ? 'Guardando…' : activate ? 'Activar mi cuenta' : 'Guardar nueva contraseña'}</button>
        <p className="fine-print">El acceso es por invitación. Si necesitás un nuevo enlace, contactá a quien te invitó. Al recargar esta página, volvé a abrir el enlace original.</p>
      </form>}
    </section>
    <a href="/" className="text-button account-access-return">← Volver a la demo pública</a>
  </main>
}
