import { b2bClient } from '@klisteniapp/b2b-client'
import type { BrandContext, PublicSite, PublicUnit } from '@klisteniapp/b2b-contracts'
import { useLoad } from '@klisteniapp/b2b-react'
import { Notice, Shell } from '@klisteniapp/b2b-ui'
import { ContentMedia, FloorPlan } from '@klisteniapp/b2b-ui/content'
import { PublicUnitDetails, PublicUnits } from './PublicEquipment'

export function GymWebsite({ site }: { site: PublicSite }) {
  const {
    website,
    organization: { brand },
  } = site
  return (
    <>
      {website.activities.length > 0 && (
        <section className="website-content">
          <p className="eyebrow">ENCONTRÁ TU PRÁCTICA</p>
          <h2>Actividades del gimnasio</h2>
          <div className="grid three">
            {website.activities.map((activity) => (
              <article className="card" key={activity.id}>
                <h3>{activity.name}</h3>
                <p>{activity.description}</p>
                {activity.schedule && <p className="small muted">{activity.schedule}</p>}
              </article>
            ))}
          </div>
        </section>
      )}
      {website.gallery.length > 0 && (
        <section className="website-content">
          <p className="eyebrow">CONOCÉ EL LUGAR</p>
          <h2>Un espacio para moverte</h2>
          <div className="website-gallery">
            <ContentMedia assets={website.gallery} />
          </div>
        </section>
      )}
      {website.floorPlan && <FloorPlan plan={website.floorPlan} units={site.units} />}
      {website.spatialModel && (
        <section className="website-content">
          <h2>Conocé el espacio en 3D</h2>
          <p>
            Explorá una vista orientativa del gimnasio. También podés consultar las fotos y las
            ubicaciones de cada equipo.
          </p>
          <ContentMedia assets={[website.spatialModel]} />
        </section>
      )}
      <section style={{ marginTop: 30 }}>
        <p className="eyebrow">EXPLORÁ EL ESPACIO</p>
        <h2>Equipos que acompañan tu práctica</h2>
        <PublicUnits site={site} />
      </section>
      <section className="card" style={{ marginTop: 30 }}>
        <h2>Nos encontramos acá</h2>
        <p>{brand.address || 'Consultá con el gimnasio la ubicación y los horarios.'}</p>
        {brand.contact && <p>{brand.contact}</p>}
        {website.openingHours.length > 0 && (
          <>
            <h3>Horarios de apertura</h3>
            <dl>
              {website.openingHours.map((hours) => (
                <div
                  className="row spread"
                  style={{ maxWidth: 600, padding: '8px 0' }}
                  key={hours.id}
                >
                  <dt>
                    <strong>{hours.days}</strong>
                  </dt>
                  <dd style={{ margin: 0 }}>{hours.hours}</dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </section>
    </>
  )
}

export function PublicGym({
  slug,
  unitId,
  branchSlug,
  branchId,
  themeColor,
  branches,
}: {
  slug: string
  unitId?: string
  branchSlug?: string
  branchId?: string
  themeColor?: string
  branches?: BrandContext['branches']
}) {
  const { data, error, loading, reload } = useLoad<PublicSite | PublicUnit>((signal) => {
    const client = b2bClient.withSignal(signal)
    return unitId ? client.public.unit(slug, unitId) : client.public.site(slug, branchSlug)
  }, `${slug}/${unitId}/${branchSlug}`)
  const brand = data?.organization.brand
  const unit = data && 'unit' in data ? data : null
  const site = data && 'website' in data ? data : null
  const selectedBranchId = unit?.unit.branchId ?? branchId
  const selectedBranch = branches?.find((branch) => branch.id === selectedBranchId)
  const memberUrl = `/login?gym=${encodeURIComponent(slug)}${selectedBranchId ? `&branch=${encodeURIComponent(selectedBranchId)}` : ''}`
  const gymUrl = selectedBranch
    ? `/sedes/${encodeURIComponent(selectedBranch.slug)}`
    : `/g/${encodeURIComponent(slug)}`

  return (
    <Shell
      name={brand?.name}
      logoUrl={brand?.logoUrl}
      color={themeColor ?? brand?.color}
      eyebrow="TU GIMNASIO"
      actions={
        <a className="button small" href={memberUrl}>
          Mi espacio →
        </a>
      }
    >
      {loading ? (
        <p className="loading" role="status">
          Conociendo tu gimnasio…
        </p>
      ) : error ? (
        <>
          <Notice error>{error}</Notice>
          <button className="button" onClick={reload}>
            Reintentar
          </button>
        </>
      ) : (
        data && (
          <>
            <section className="hero">
              <p className="eyebrow">{unit ? 'CONOCÉ TU EQUIPO' : 'UN ESPACIO PARA VOS'}</p>
              <h1>{unit ? unit.unit.label : site?.website.headline || brand?.name}</h1>
              <p>
                {unit
                  ? unit.machine.instructions
                  : site?.website.introduction ||
                    brand?.description ||
                    'Movete con acompañamiento, a tu ritmo. Descubrí nuestro espacio y encontrá tu próxima rutina.'}
              </p>
              {unit ? (
                <a className="button" href={gymUrl}>
                  Ver el gimnasio
                </a>
              ) : (
                <a className="button" href={memberUrl}>
                  Entrar a mi espacio <span aria-hidden="true">↗</span>
                </a>
              )}
            </section>
            {unit && <PublicUnitDetails data={unit} slug={slug} />}
            {site && <GymWebsite site={site} />}
          </>
        )
      )}
    </Shell>
  )
}
