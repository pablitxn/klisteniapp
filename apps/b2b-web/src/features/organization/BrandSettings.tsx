import { type Organization } from '@klisteniapp/b2b-contracts'
import { useAccountClient } from '@klisteniapp/b2b-react'
import { Field } from '@klisteniapp/b2b-ui'
import { useState, type FormEvent } from 'react'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'
import { MediaLibrary } from '../media/MediaLibrary'

export function BrandSettings({
  organization,
  active,
  onSaved,
}: {
  organization: Organization
  active: boolean
  onSaved: (organization: Organization) => void
}) {
  const client = useAccountClient()
  const action = useAction(),
    brand = organization.brand
  const [color, setColor] = useState(brand.color),
    [logoUrl, setLogoUrl] = useState(brand.logoUrl),
    [chooseLogo, setChooseLogo] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await action.run(async () => {
      const result = await client.brand.update(organization.id, {
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? ''),
        color,
        logoUrl,
        contact: String(data.get('contact') ?? ''),
        address: String(data.get('address') ?? ''),
      })
      onSaved(result.organization)
    }, 'Identidad guardada en la app. Revisá y publicá el website para actualizar su versión pública.')
  }
  return (
    <>
      <Heading
        title="Un espacio con tu identidad."
        description="La misma marca acompaña a tus socios en la web pública, su app y este espacio."
      >
        <a className="button" href={`/g/${organization.slug}`} target="_blank" rel="noreferrer">
          Ver web pública ↗
        </a>
      </Heading>
      <form className="card form-stack" onSubmit={save}>
        <div className="form-grid">
          <Field label="Nombre del gimnasio">
            <input name="name" required maxLength={100} defaultValue={brand.name} />
          </Field>
          <Field label="Color principal">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </Field>
          <Field
            label="URL del logo"
            hint="Ruta local o HTTPS. Dejá vacío para usar la marca tipográfica."
          >
            <input
              name="logoUrl"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              maxLength={2048}
            />
          </Field>
          <Field label="Contacto público">
            <input name="contact" defaultValue={brand.contact} maxLength={200} />
          </Field>
          <Field label="Dirección">
            <input name="address" defaultValue={brand.address} maxLength={300} />
          </Field>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setChooseLogo((current) => !current)}
        >
          {chooseLogo ? 'Cerrar biblioteca del logo' : 'Elegir o subir logo'}
        </button>
        {chooseLogo && (
          <MediaLibrary
            orgId={organization.id}
            imagesOnly
            disabled={!active || action.busy}
            onChoose={(asset) => {
              setLogoUrl(asset.url)
              setChooseLogo(false)
            }}
          />
        )}
        <Field label="Presentación del gimnasio">
          <textarea name="description" defaultValue={brand.description} maxLength={2000} />
        </Field>
        <div className="hero" style={{ background: color }}>
          <p className="eyebrow">UN ESPACIO PARA VOS</p>
          <h2>{brand.name}</h2>
          <p>Tu marca, en cada nuevo movimiento.</p>
        </div>
        {action.notices}
        <button className="button primary" disabled={!active || action.busy}>
          {action.busy ? 'Guardando…' : 'Guardar identidad'}
        </button>
      </form>
    </>
  )
}
