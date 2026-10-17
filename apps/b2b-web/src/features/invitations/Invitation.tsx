import { b2bClient, errorMessage } from '@klisteniapp/b2b-client'
import type { BrandContext } from '@klisteniapp/b2b-contracts'
import { Field, Notice, Shell } from '@klisteniapp/b2b-ui'
import { useEffect, useState, type FormEvent } from 'react'

function invitationToken() {
  return (
    new URLSearchParams(location.search).get('token') ??
    new URLSearchParams(location.hash.slice(1)).get('token') ??
    ''
  )
}

export function Invitation({
  context,
  onAuthenticated,
}: {
  context?: BrandContext
  onAuthenticated: () => void
}) {
  const [token, setToken] = useState(invitationToken)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [existing, setExisting] = useState(false)

  useEffect(() => {
    // Opening another fragment link can keep this document and component alive.
    const changed = () => {
      const next = invitationToken()
      if (next === token) return
      setToken(next)
      setDone(false)
      setExisting(false)
      setError('')
    }
    window.addEventListener('hashchange', changed)
    window.addEventListener('popstate', changed)
    return () => {
      window.removeEventListener('hashchange', changed)
      window.removeEventListener('popstate', changed)
    }
  }, [token])

  function accepted() {
    setDone(true)
    history.replaceState(null, '', '/app/invite')
    setToken('')
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

  if (existing && !done) {
    return (
      <Shell
        name={context?.theme.brand.name}
        logoUrl={context?.theme.brand.logoUrl}
        eyebrow="INVITACIÓN"
      >
        <section className="card" style={{ maxWidth: 500, margin: '40px auto' }}>
          <h1>Sumate con tu cuenta</h1>
          <p>
            Esta invitación concede únicamente el acceso indicado por la marca. Tus otras marcas
            conservan sus sesiones y permisos.
          </p>
          <form
            className="form-stack"
            onSubmit={(event) => {
              event.preventDefault()
              const values = new FormData(event.currentTarget)
              setBusy(true)
              setError('')
              void b2bClient.invitations
                .signIn({
                  email: String(values.get('email') ?? ''),
                  password: String(values.get('password') ?? ''),
                  token,
                  consent: true,
                })
                .then(() => {
                  accepted()
                  onAuthenticated()
                })
                .catch((error) => setError(errorMessage(error)))
                .finally(() => setBusy(false))
            }}
          >
            <Field label="Email">
              <input name="email" type="email" autoComplete="username" required />
            </Field>
            <Field label="Contraseña">
              <input name="password" type="password" autoComplete="current-password" required />
            </Field>
            <label>
              <input type="checkbox" required /> Acepto incorporarme a esta marca con el acceso de
              esta invitación.
            </label>
            <Notice error>{error}</Notice>
            <button className="button primary" disabled={busy || !token}>
              {busy ? 'Aceptando…' : 'Aceptar invitación con mi cuenta'}
            </button>
            <button type="button" className="text-button" onClick={() => setExisting(false)}>
              Volver
            </button>
          </form>
        </section>
      </Shell>
    )
  }

  return (
    <Shell
      name={context?.theme.brand.name}
      logoUrl={context?.theme.brand.logoUrl}
      eyebrow="BIENVENIDO"
    >
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
