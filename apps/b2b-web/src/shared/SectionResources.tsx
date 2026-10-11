import type { Membership } from '@klisteniapp/b2b-contracts'
import { Notice } from '@klisteniapp/b2b-ui'
import type { ReactNode } from 'react'

export type WorkspaceViewContext = { membership: Membership; dataRefresh: number }
type Resource = { data: unknown; error: string; loading: boolean; reload: () => void }

// A section owns its requests. Background refresh keeps its editor mounted;
// useLoad clears protected data when a request loses authorization (401/403).
export function SectionResources({
  resources,
  children,
}: {
  resources: Resource[]
  children: ReactNode
}) {
  const failed = resources.filter((resource) => resource.error)
  return (
    <>
      {[...new Set(failed.map((resource) => resource.error))].map((error) => (
        <Notice key={error} error>
          {error}
        </Notice>
      ))}
      {failed.length > 0 && (
        <button className="button" onClick={() => failed.forEach((resource) => resource.reload())}>
          Reintentar carga
        </button>
      )}
      {resources.some((resource) => resource.loading && !resource.data) && (
        <p className="loading" role="status">
          Cargando esta sección…
        </p>
      )}
      {children}
    </>
  )
}
