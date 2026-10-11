import { useState, type FormEvent } from 'react'
import { Field, Notice } from './components.tsx'

export type LoginProps = {
  onSignIn: (credentials: { email: string; password: string }) => Promise<unknown>
  onDone: () => void
  backoffice?: boolean
}

export function Login({ onSignIn, onDone, backoffice = false }: LoginProps) {
  const [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const values = new FormData(event.currentTarget)
    try {
      await onSignIn({
        email: String(values.get('email') ?? ''),
        password: String(values.get('password') ?? ''),
      })
      onDone()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Ocurrió un problema. Volvé a intentar.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="access-layout">
      <section className="access-intro">
        <span className="pill">{backoffice ? 'ESPACIO PROFESIONAL' : 'TU PRÁCTICA, CERCA'}</span>
        <h1>
          {backoffice ? (
            <>
              Acompañá cada
              <br />
              nuevo logro.
            </>
          ) : (
            <>
              Hacé lugar
              <br />
              al movimiento.
            </>
          )}
        </h1>
        <p>
          {backoffice
            ? 'Personas, rutinas y equipamiento. Todo lo que necesitás para acompañar a tu comunidad.'
            : 'Encontrá la rutina que prepararon para vos y llevá un registro de tu propio progreso.'}
        </p>
        <div className="hero-orbit" aria-hidden="true">
          ↗
        </div>
      </section>
      <section className="card access-card">
        <p className="eyebrow">BIENVENIDO DE NUEVO</p>
        <h2>Ingresá a tu espacio</h2>
        <p className="muted">Usá la cuenta que te invitó tu gimnasio.</p>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="username" required />
          </Field>
          <Field label="Contraseña">
            <input name="password" type="password" autoComplete="current-password" required />
          </Field>
          <Notice error>{error}</Notice>
          <button className="button primary" disabled={busy}>
            {busy ? 'Ingresando…' : 'Iniciar sesión'}
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="small muted">
          ¿Todavía no tenés acceso? Pedile una invitación al equipo de tu gimnasio.
        </p>
      </section>
    </div>
  )
}
