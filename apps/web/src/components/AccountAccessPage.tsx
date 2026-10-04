import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { accountApi, AccountApiError } from '../lib/account-api'
import { clearAccountAccessToken, type AccountAccessRoute } from '../lib/account-route'
import './account.css'

export default function AccountAccessPage({ route }: { route: AccountAccessRoute }) {
  const { t } = useTranslation('account')
  const token = useRef(route.token)
  const [busy, setBusy] = useState(false)
  const [checking, setChecking] = useState(Boolean(route.token))
  const [identity, setIdentity] = useState<{ email: string; name: string; access?: 'trial' | 'lifetime'; label?: string } | null>(null)
  const [infoAttempt, setInfoAttempt] = useState(0)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [invalid, setInvalid] = useState(!route.token)
  const join = route.mode === 'join'
  const activate = route.mode !== 'recover'
  useEffect(() => { document.title = `${activate ? t("Activar mi cuenta") : t("Recuperar mi cuenta")} · Klisteni` }, [activate, t])
  useEffect(() => {
    if (!token.current) return
    let active = true
    void (join ? accountApi.shareInfo(token.current).then(info => ({ kind: 'activation' as const, email: '', name: '', access: 'trial' as const, label: info.label })) : accountApi.tokenInfo(token.current)).then(info => {
      if (!active) return
      if (info.kind !== (activate ? 'activation' : 'recovery')) { setInvalid(true); setError('Este enlace corresponde a otra acción. Abrí el enlace original que te compartieron.'); return }
      setIdentity({ email: info.email, name: info.name ?? '', access: info.access, ...('label' in info ? { label: String(info.label) } : {}) })
    }).catch(reason => {
      if (!active) return
      setError(reason instanceof AccountApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 429 ? activate ? "Este enlace ya no está disponible. Pedí uno nuevo al administrador." : "Este enlace ya no está disponible. Podés pedir uno nuevo por email." : "No pudimos verificar el enlace. Revisá tu conexión y volvé a intentar.")
      if (reason instanceof AccountApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 429) setInvalid(true)
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [activate, join, infoAttempt])
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
      if (join) await accountApi.join({ token: token.current, email: String(values.get('email')).trim(), name: String(values.get('name')).trim(), password })
      else if (activate) await accountApi.acceptInvitation({ token: token.current, name: String(values.get('name')).trim(), password })
      else await accountApi.completeRecovery({ token: token.current, password })
      token.current = ''
      clearAccountAccessToken()
      element.reset()
      setDone(true)
    } catch (reason) {
      if (reason instanceof AccountApiError && reason.code === 'USER_EXISTS') { setError('Ya existe una cuenta con ese email. Iniciá sesión o pedí un enlace de recuperación.'); return }
      if (reason instanceof AccountApiError && reason.status >= 400 && reason.status < 500 && reason.status !== 429) {
        setError(activate ? "No pudimos activar la cuenta. Si el enlace venció o ya se usó, pedí uno nuevo al administrador." : "El enlace no está disponible: puede haber vencido, haberse usado o sido revocado. Podés pedir uno nuevo por email.")
        if (reason.code === 'INVALID_TOKEN' || reason.code === 'TOKEN_EXPIRED' || reason.code === 'TOKEN_USED' || reason.code === 'INVITATION_UNAVAILABLE') { token.current = ''; clearAccountAccessToken(); setInvalid(true) }
      } else setError('No pudimos confirmar el cambio. Revisá la conexión y volvé a intentar con este enlace.')
    } finally { setBusy(false) }
  }
  return <main className="account-access" id="main">
    <a href="/" className="account-access-brand" aria-label={t("Klisteni, abrir la aplicación")}>klisteni<span>.</span></a>
    <section className="account-access-card" aria-labelledby="account-access-title">
      <div className="account-access-intro">
        <span className="eyebrow">{t("TU ESPACIO DE MOVIMIENTO")}</span>
        <h1 id="account-access-title">{done ? activate ? t("Tu cuenta está lista.") : t("Contraseña actualizada.") : activate ? t("Bienvenido a tu práctica.") : t("Volvé a tu práctica.")}</h1>
        <p>{done ? activate ? t("Ya podés entrar con tu email y la contraseña que elegiste.") : t("Tus sesiones anteriores se cerraron. Iniciá sesión con tu nueva contraseña.") : activate ? t("Recibiste una invitación para guardar tu rutina y tu progreso entre dispositivos.") : t("Elegí una nueva contraseña con tu enlace personal de recuperación.")}</p>
      </div>
      {done ? <div className="form-stack"><a className="primary-button full-width" href="/?account=login">{t("Iniciar sesión")}</a><p className="fine-print">{t("El enlace ya cumplió su función. Tu contraseña queda bajo tu control.")}</p></div> : checking ? <p role="status">{t("Verificando tu enlace…")}</p> : invalid ? <div className="form-stack"><p role="alert" className="form-error">{t(error) || (activate ? t("El enlace está incompleto. Abrí el enlace original que te compartieron. Si ya no está disponible, pedí uno nuevo al administrador.") : t("El enlace está incompleto. Abrí el enlace original o pedí uno nuevo por email."))}</p>{!activate && <a className="primary-button full-width" href="/account/forgot-password">{t("Pedir un nuevo enlace")}</a>}<a className="secondary-button full-width" href="/">{t("Explorar Klisteni")}</a></div> : !identity ? <div className="form-stack"><p role="alert" className="form-error">{t(error)}</p><button className="secondary-button" onClick={() => { setChecking(true); setError(''); setInfoAttempt(value => value + 1) }}>{t("Reintentar verificación")}</button></div> : <form className="form-stack" onSubmit={submit} aria-busy={busy}>
        {activate && <><p className="billing-notice">{identity.access === 'lifetime' ? t("Esta invitación incluye acceso vitalicio a la nube, sin suscripción.") : t("Incluye 15 días gratis de acceso a la nube desde la activación, sin tarjeta. Después podés suscribirte o seguir gratis en modo local.")}{identity.label && <small> {t("Invitación:")} {identity.label}.</small>}</p><label>{t("Tu nombre")}<input name="name" autoComplete="name" required maxLength={100} defaultValue={identity.name} disabled={busy} /></label><label>{join ? t("Tu email") : t("Email de la invitación")}<input name="email" type="email" autoComplete="email" required maxLength={254} defaultValue={identity.email} readOnly={!join} disabled={busy} /></label></>}
        <label>{activate ? t("Elegí una contraseña") : t("Nueva contraseña")}<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} aria-describedby="password-help" /></label>
        <p className="fine-print" id="password-help">{t("Usá al menos 12 caracteres. Puede ser una frase que te resulte fácil recordar.")}</p>
        <label>{t("Repetí la contraseña")}<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={busy} /></label>
        {error && <p role="alert" className="form-error">{t(error)}</p>}
        <button className="primary-button full-width" disabled={busy}>{busy ? t("Guardando…") : activate ? t("Activar mi cuenta") : t("Guardar nueva contraseña")}</button>
        <p className="fine-print">{activate ? t("El acceso es por invitación. Si necesitás un nuevo enlace, contactá a quien te invitó.") : t("Al cambiar la contraseña, cerramos tus sesiones anteriores.")} {t("Al recargar esta página, volvé a abrir el enlace original.")}</p>
        {!activate && <a className="text-button" href="/account/forgot-password">{t("Pedir un nuevo enlace")}</a>}
      </form>}
    </section>
    <a href="/" className="text-button account-access-return">{t("← Seguir gratis en modo local")}</a>
  </main>
}
