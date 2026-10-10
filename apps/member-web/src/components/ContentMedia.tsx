import { lazy, Suspense } from 'react'
import type { Asset } from '@klisteniapp/b2b-contracts'

const EquipmentModelViewer = lazy(() =>
  import('@klisteniapp/anatomy-viewer/equipment').then((module) => ({
    default: module.EquipmentModelViewer,
  })),
)

export function ContentMedia({ assets }: { assets: Asset[] }) {
  return assets.map((asset) => (
    <figure key={asset.id}>
      {asset.kind === 'model3d' ? (
        <Suspense fallback={<p role="status">Preparando visor…</p>}>
          <EquipmentModelViewer
            url={asset.url}
            label={asset.label}
            attribution={asset.attribution}
          />
        </Suspense>
      ) : asset.kind === 'video' ? (
        <video className="media" controls preload="none" src={asset.url} aria-label={asset.label} />
      ) : (
        <img className="media" src={asset.url} alt={asset.label} loading="lazy" />
      )}
      <figcaption className="small muted">
        {asset.label}
        {asset.attribution && ` · ${asset.attribution}`}
      </figcaption>
    </figure>
  ))
}
