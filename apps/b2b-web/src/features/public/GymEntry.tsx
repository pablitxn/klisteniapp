import { Field, Notice, Shell } from '@klisteniapp/b2b-ui'
import { useState, type FormEvent } from 'react'
import { useApplication } from '../../app/ApplicationProvider'

/** Public B2B entry. It does not load sessions, expose a gym directory or couple to B2C. */
export function GymEntry() {
  const { navigate } = useApplication()
  const [slug, setSlug] = useState('')
  const [error, setError] = useState('')
  function openGym(event: FormEvent) {
    event.preventDefault()
    const candidate = slug.trim().toLowerCase()
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(candidate) || candidate.length > 100) {
      setError('Ingresá el código que te compartió tu gimnasio, por ejemplo atlas-demo.')
      return
    }
    navigate(`/g/${encodeURIComponent(candidate)}`)
  }
  return (
    <Shell
      name="Klisteni · Gimnasios"
      eyebrow="ENTRENAR CON ACOMPAÑAMIENTO"
      actions={
        <a className="button small" href="/app">
          Ingresar
        </a>
      }
    >
      <section className="hero">
        <p className="eyebrow">UN ESPACIO COMPARTIDO PARA ENTRENAR</p>
        <h1>
          Tu gimnasio.
          <br />
          Tu práctica.
        </h1>
        <p>
          Conocé el espacio, encontrá cada equipo y llevá un registro de lo que hiciste con la
          rutina que te preparó tu profesor.
        </p>
        <a className="button" href="/app">
          Entrar como socio →
        </a>
      </section>
      <div className="grid two" style={{ marginTop: 30 }}>
        <section className="card">
          <h2>Conocé tu gimnasio</h2>
          <p>
            Consultá las actividades, los horarios y las fichas de equipos. También podés abrir
            directamente el QR de una unidad.
          </p>
          <form className="form-stack" onSubmit={openGym}>
            <Field
              label="Código del gimnasio"
              hint="Lo encontrás al final del enlace público que te compartió el equipo."
            >
              <input
                value={slug}
                onChange={(event) => {
                  setSlug(event.target.value)
                  setError('')
                }}
                maxLength={100}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="atlas-demo"
                required
              />
            </Field>
            <Notice error>{error}</Notice>
            <button className="button primary">Ver gimnasio</button>
          </form>
        </section>
        <section className="card">
          <p className="eyebrow">PARA EL EQUIPO</p>
          <h2>Prepará, acompañá y observá</h2>
          <p>
            Administrá el catálogo y el website, publicá rutinas versionadas y compará la
            prescripción con los registros de tus socios.
          </p>
          <a className="button" href="/manage">
            Entrar a gestión →
          </a>
          <p className="small muted" style={{ marginTop: 20 }}>
            El acceso se habilita mediante una invitación del gimnasio. Cada organización conserva
            sus personas y sus registros.
          </p>
        </section>
      </div>
    </Shell>
  )
}
