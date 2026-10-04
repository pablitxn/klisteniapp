import { useTranslation } from 'react-i18next'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { accountApi, AccountApiError } from '../lib/account-api'
import './account.css'

export default function ForgotPasswordPage() {
  const { t } = useTranslation('account')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const confirmation = useRef<HTMLDivElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  useEffect(() => { document.title = t("Recuperar contraseña · Klisteni") }, [t])
  useEffect(() => { if (done) confirmation.current?.focus(); else emailInput.current?.focus() }, [done])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const form = event.currentTarget
    const email = String(new FormData(form).get('email') ?? '').trim()
    setBusy(true)
    setError('')
    try {
      await accountApi.requestRecovery(email)
      form.reset()
      setDone(true)
    } catch (reason) {
      setError(reason instanceof AccountApiError && reason.status === 429
        ? "Hiciste varias solicitudes. Esperá unos minutos y volvé a intentar."
        : reason instanceof AccountApiError && reason.status === 400
          ? "Revisá que el email esté completo y volvé a intentar."
          : "No pudimos confirmar la solicitud. Revisá tu conexión y volvé a intentar.")
    } finally { setBusy(false) }
  }
  return <main className="account-access" id="main">
    <a href="/" className="account-access-brand" aria-label={t("Klisteni, abrir la aplicación")}>klisteni<span>.</span></a>
    <section className="account-access-card" aria-labelledby="forgot-password-title">
      <div className="account-access-intro">
        <span className="eyebrow">{t("TU ESPACIO DE MOVIMIENTO")}</span>
        <h1 id="forgot-password-title">{done ? t("Revisá tu email.") : t("Recuperá tu contraseña.")}</h1>
        {!done && <p>{t("Ingresá el email de tu cuenta para pedir un enlace personal de recuperación.")}</p>}
      </div>
      {done ? <div className="form-stack">
        <div className="account-recovery-status" ref={confirmation} tabIndex={-1} role="status">
          <p>{t("Si ese email tiene una cuenta activa, recibirás un enlace para elegir una nueva contraseña.")}</p>
        </div>
        <p className="fine-print">{t("Si no llega, revisá la carpeta de spam y esperá cinco minutos antes de volver a pedirlo.")}</p>
        <button className="secondary-button full-width" onClick={() => { setDone(false); setError('') }}>{t("Volver a intentar")}</button>
      </div> : <form className="form-stack" onSubmit={submit} aria-busy={busy}>
        <label>{t("Email")}<input ref={emailInput} name="email" type="email" autoComplete="email" required maxLength={254} disabled={busy} aria-describedby={error ? 'recovery-request-error' : undefined} /></label>
        {error && <p className="form-error" id="recovery-request-error" role="alert">{t(error)}</p>}
        {busy && <p role="status">{t("Enviando la solicitud…")}</p>}
        <button className="primary-button full-width" disabled={busy}>{busy ? t("Enviando…") : t("Enviar enlace de recuperación")}</button>
      </form>}
      <a className="text-button account-access-return" href="/?account=login">{t("Volver a iniciar sesión")}</a>
    </section>
    <a href="/" className="text-button account-access-return">{t("← Volver a la demo pública")}</a>
  </main>
}
