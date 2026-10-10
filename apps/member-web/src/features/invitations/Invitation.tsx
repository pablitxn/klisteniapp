import { useState, type FormEvent } from 'react'
import {
  b2bClient,
  createB2BClient,
  errorMessage,
  Field,
  Login,
  Notice,
  Shell,
} from '@klisteniapp/b2b-ui'

export function Invitation() {
  const token =
    new URLSearchParams(location.search).get('token') ??
    new URLSearchParams(location.hash.slice(1)).get('token') ??
    ''
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [existing, setExisting] = useState(false)
  const [signedIn, setSignedIn] = useState('')

  function accepted() {
    setDone(true)
    history.replaceState(null, '', '/app/invite')
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true)
    setError('')
    const values = new FormData(event.currentTarget)
    try {
      await b2bClient.invitations.accept({
        token,
        name: String(values.get('name') ?? ''),
        password: String(values.get('password') ?? ''),
      })
      accepted()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function join() {
    setBusy(true)
    setError('')
    try {
      await createB2BClient(signedIn).invitations.join({ token })
      accepted()
    } catch (error) {
      setError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  async function signedInSuccessfully() {
    try {
      setSignedIn((await b2bClient.me()).user.id)
    } catch (error) {
      setError(errorMessage(error))
    }
  }

  if (existing && !signedIn) {
    return (
      <Shell eyebrow="BIENVENIDO">
        <button className="text-button" onClick={() => setExisting(false)}>
          Volver a la invitación
        </button>
        <Login onDone={() => void signedInSuccessfully()} />
      </Shell>
    )
  }

  return (
    <Shell eyebrow="BIENVENIDO">
      <section className="card" style={{ maxWidth: 500, margin: '40px auto' }}>
        <p className="eyebrow">TU PRÓXIMO PASO</p>
        <h1>Hagamos espacio.</h1>
        {done ? (
          <>
            <Notice>
              Tu cuenta está lista. Ya podés iniciar sesión con el email de tu invitación.
            </Notice>
            <a className="button primary" href="/app">
              Iniciar sesión
            </a>
          </>
        ) : signedIn ? (
          <>
            <p>Con tu cuenta actual, aceptá la invitación para sumarte a este gimnasio.</p>
            <Notice error>{error}</Notice>
            <button
              className="button primary"
              disabled={busy || !token}
              onClick={() => void join()}
            >
              {busy ? 'Aceptando…' : 'Aceptar invitación con mi cuenta'}
            </button>
          </>
        ) : (
          <form className="form-stack" onSubmit={submit}>
            <p>
              Completá tu nombre y elegí una contraseña para activar la invitación del gimnasio.
            </p>
            <Field label="Tu nombre">
              <input name="name" required maxLength={100} autoComplete="name" />
            </Field>
            <Field label="Nueva contraseña" hint="Al menos 12 caracteres.">
              <input
                name="password"
                type="password"
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </Field>
            <Notice error>
              {error ||
                (!token ? 'Falta el enlace de invitación. Pedile uno nuevo al gimnasio.' : '')}
            </Notice>
            <button className="button primary" disabled={busy || !token}>
              {busy ? 'Activando…' : 'Activar mi cuenta'}
            </button>
            <button type="button" className="text-button" onClick={() => setExisting(true)}>
              Ya tengo una cuenta de gimnasio
            </button>
          </form>
        )}
      </section>
    </Shell>
  )
}
