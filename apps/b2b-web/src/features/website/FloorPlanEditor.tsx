import type { Asset } from '@klisteniapp/b2b-contracts'
import type { FloorPlan, WebsiteInput } from '@klisteniapp/b2b-contracts/website'
import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { Field, Notice } from '@klisteniapp/b2b-ui'
import { ContentMedia, FloorPlan as PlanPreview } from '@klisteniapp/b2b-ui/content'
import { useState } from 'react'
import { MediaLibrary } from '../media/MediaLibrary'

function PointsEditor({
  orgId,
  plan,
  onChange,
}: {
  orgId: string
  plan: FloorPlan
  onChange: (plan: FloorPlan) => void
}) {
  const client = useAccountClient()
  const { data, error, reload } = useLoad(
    (signal) => client.withSignal(signal).equipment.listUnits(orgId),
    orgId,
  )
  const units = data?.units ?? []
  const available = units.filter(
    (unit) => !unit.archived && !plan.points.some((point) => point.unitId === unit.id),
  )
  function move(unitId: string, axis: 'x' | 'y', value: number) {
    if (!Number.isFinite(value)) return
    onChange({
      ...plan,
      points: plan.points.map((point) =>
        point.unitId === unitId ? { ...point, [axis]: Math.min(100, Math.max(0, value)) } : point,
      ),
    })
  }
  return (
    <>
      <Notice error>{error}</Notice>
      {error && (
        <button type="button" className="button" onClick={reload}>
          Reintentar equipos del plano
        </button>
      )}
      <Field
        label="Agregar equipo al plano"
        hint="Cada punto abre la ficha pública de una unidad. Las unidades privadas nunca aparecen en el plano público."
      >
        <select
          value=""
          disabled={plan.points.length >= 200 || !available.length}
          onChange={(event) => {
            if (event.target.value)
              onChange({
                ...plan,
                points: [...plan.points, { unitId: event.target.value, x: 50, y: 50 }],
              })
          }}
        >
          <option value="">Elegí una unidad…</option>
          {available.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.label} · {unit.location || 'Sin ubicación'}
            </option>
          ))}
        </select>
      </Field>
      {plan.points.map((point, index) => {
        const unit = units.find((candidate) => candidate.id === point.unitId)
        return (
          <fieldset className="content-row" key={point.unitId} style={{ minWidth: 0 }}>
            <legend>
              {index + 1}. {unit?.label ?? 'Unidad no disponible'}
            </legend>
            {unit && (!unit.public || unit.archived) && (
              <p className="small muted">Esta unidad no se mostrará al público.</p>
            )}
            <div className="form-grid">
              <Field label={`Posición horizontal del punto ${index + 1} (%)`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={point.x}
                  onChange={(event) => move(point.unitId, 'x', event.target.valueAsNumber)}
                />
              </Field>
              <Field label={`Posición vertical del punto ${index + 1} (%)`}>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={point.y}
                  onChange={(event) => move(point.unitId, 'y', event.target.valueAsNumber)}
                />
              </Field>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onChange({
                  ...plan,
                  points: plan.points.filter((item) => item.unitId !== point.unitId),
                })
              }
            >
              Quitar punto {index + 1}
            </button>
          </fieldset>
        )
      })}
      <PlanPreview plan={plan} units={units} />
    </>
  )
}

export function SpaceEditor({
  orgId,
  value,
  onChange,
}: {
  orgId: string
  value: WebsiteInput
  onChange: (patch: Partial<WebsiteInput>) => void
}) {
  const [picker, setPicker] = useState<'plan' | 'model' | null>(null)
  const [error, setError] = useState('')
  function choose(asset: Asset) {
    if (picker === 'plan' && asset.kind === 'image') {
      onChange({
        floorPlan: {
          title: value.floorPlan?.title ?? 'Plano del gimnasio',
          description: value.floorPlan?.description ?? '',
          image: { ...asset, kind: 'image' },
          points: value.floorPlan?.points ?? [],
        },
      })
    } else if (picker === 'model' && asset.kind === 'model3d') {
      onChange({ spatialModel: { ...asset, kind: 'model3d' } })
    } else {
      setError(
        picker === 'plan'
          ? 'Elegí una imagen para el plano.'
          : 'Elegí un archivo GLB para la vista del espacio.',
      )
      return
    }
    setError('')
    setPicker(null)
  }
  return (
    <details className="content-row" style={{ marginTop: 24 }}>
      <summary>Plano y vista del espacio</summary>
      <p>
        Usá un croquis o una foto del plano y vinculá cada punto con una unidad. La publicación del
        website también publica estos recursos.
      </p>
      <Notice error>{error}</Notice>
      <button
        type="button"
        className="button"
        onClick={() => setPicker(picker === 'plan' ? null : 'plan')}
      >
        {value.floorPlan ? 'Cambiar imagen del plano' : 'Elegir imagen del plano'}
      </button>
      {picker && <MediaLibrary orgId={orgId} imagesOnly={picker === 'plan'} onChoose={choose} />}
      {value.floorPlan && (
        <>
          <Field label="Título del plano">
            <input
              value={value.floorPlan.title}
              maxLength={150}
              required
              onChange={(event) =>
                onChange({ floorPlan: { ...value.floorPlan!, title: event.target.value } })
              }
            />
          </Field>
          <Field label="Orientación del plano">
            <textarea
              value={value.floorPlan.description}
              maxLength={2000}
              onChange={(event) =>
                onChange({ floorPlan: { ...value.floorPlan!, description: event.target.value } })
              }
              placeholder="Entrada, sectores y referencias para orientarse…"
            />
          </Field>
          <PointsEditor
            orgId={orgId}
            plan={value.floorPlan}
            onChange={(floorPlan) => onChange({ floorPlan })}
          />
          <button
            type="button"
            className="text-button"
            onClick={() => onChange({ floorPlan: null })}
          >
            Quitar plano del website
          </button>
        </>
      )}
      <h3>Vista 3D del espacio (opcional)</h3>
      <p className="small muted">
        Podés incorporar un sector exportado desde Blender como GLB estático. Su apertura es
        voluntaria; conservá fotos y el plano para quienes no usen 3D.
      </p>
      <button
        type="button"
        className="button"
        onClick={() => setPicker(picker === 'model' ? null : 'model')}
      >
        Elegir modelo del espacio
      </button>
      {value.spatialModel && (
        <>
          <ContentMedia assets={[value.spatialModel]} />
          <button
            type="button"
            className="text-button"
            onClick={() => onChange({ spatialModel: null })}
          >
            Quitar vista 3D del espacio
          </button>
        </>
      )}
    </details>
  )
}
