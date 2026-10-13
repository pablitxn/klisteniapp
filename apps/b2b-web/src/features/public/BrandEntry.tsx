import { b2bClient } from '@klisteniapp/b2b-client'
import type { BrandContext } from '@klisteniapp/b2b-contracts'
import { useLoad } from '@klisteniapp/b2b-react'
import { Notice, Shell } from '@klisteniapp/b2b-ui'
import { GymWebsite } from './PublicGym'

export function BrandEntry({ context }: { context: BrandContext }) {
  const website = useLoad(
    (signal) =>
      context.websitePublished
        ? b2bClient.withSignal(signal).public.site(context.organization.slug)
        : Promise.resolve(null),
    `${context.organization.id}/${context.websitePublished}`,
  )
  return (
    <Shell
      name={context.theme.brand.name}
      logoUrl={context.theme.brand.logoUrl}
      eyebrow="TU MARCA"
      actions={
        <a className="button small" href="/login">
          Ingresar
        </a>
      }
    >
      <section className="hero">
        <p className="eyebrow">UN ESPACIO PARA VOS</p>
        <h1>
          {website.data?.website.headline || context.theme.loginTitle || context.theme.brand.name}
        </h1>
        <p>
          {website.data?.website.introduction ||
            context.theme.loginDescription ||
            context.theme.brand.description}
        </p>
        <a className="button primary" href="/login">
          Entrar a mi espacio →
        </a>
      </section>
      <section style={{ marginTop: 30 }}>
        <Notice error>{website.error}</Notice>
        {website.error && (
          <button className="button" onClick={website.reload}>
            Reintentar
          </button>
        )}
        <h2>Nuestras sedes</h2>
        <div className="grid two">
          {context.branches.map((branch) => (
            <article className="card" key={branch.id}>
              <h3>{branch.name}</h3>
              <p>{branch.address}</p>
              <p>{branch.contact}</p>
              <a className="button" href={`/sedes/${encodeURIComponent(branch.slug)}`}>
                Conocer {branch.name}
              </a>
            </article>
          ))}
        </div>
        {!context.branches.length && (
          <p>El equipo está preparando la información de sus sedes. Tu acceso sigue disponible.</p>
        )}
      </section>
      {website.data && <GymWebsite site={website.data} />}
    </Shell>
  )
}
