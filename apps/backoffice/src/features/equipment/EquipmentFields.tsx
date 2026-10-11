import type { Machine } from '@klisteniapp/b2b-contracts'
import { Field } from '@klisteniapp/b2b-ui'
import { AssetEditor } from '../../shared'
import type { EquipmentDraft, EquipmentEditorSource } from './equipmentDraft'

export function EquipmentFields({
  orgId,
  source,
  draft,
  machines,
  websitePublished,
  unitReviewed,
  onReview,
  onChange: change,
}: {
  orgId: string
  source: EquipmentEditorSource
  draft: EquipmentDraft
  machines: Machine[]
  websitePublished: boolean
  unitReviewed: boolean
  onReview: (reviewed: boolean) => void
  onChange: (patch: Partial<EquipmentDraft>) => void
}) {
  const editingUnit = source.kind === 'unit' ? source.unit : undefined
  const selectedModel = draft.machineId,
    quantity = draft.quantity,
    assets = draft.assets,
    publicUnit = draft.public
  const model = machines.find((machine) => machine.id === selectedModel)
  function setAssets(assets: EquipmentDraft['assets']) {
    change({ assets })
  }
  function setQuantity(quantity: number) {
    change({ quantity })
  }
  function setPublicUnit(publicUnit: boolean) {
    change({ public: publicUnit })
  }
  return (
    <>
      <div className="form-grid">
        {source.kind === 'machine' ? (
          <>
            <Field label="Nombre del modelo">
              <input
                name="name"
                required
                maxLength={150}
                value={draft.name}
                onChange={(event) => change({ name: event.target.value })}
              />
            </Field>
            <Field label="Tipo de máquina">
              <input
                name="type"
                required
                maxLength={100}
                value={draft.type}
                onChange={(event) => change({ type: event.target.value })}
                placeholder="Prensa, poleas, bicicleta…"
              />
            </Field>
            <Field label="Fabricante">
              <input
                name="manufacturer"
                maxLength={100}
                value={draft.manufacturer}
                onChange={(event) => change({ manufacturer: event.target.value })}
              />
            </Field>
            <Field label="Referencia del fabricante">
              <input
                name="model"
                maxLength={100}
                value={draft.model}
                onChange={(event) => change({ model: event.target.value })}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="Modelo de máquina">
              <select
                name="machineId"
                required
                value={selectedModel}
                onChange={(event) =>
                  change({
                    machineId: event.target.value,
                    public:
                      machines.find((machine) => machine.id === event.target.value)?.status ===
                        'published' && draft.public,
                  })
                }
              >
                <option value="">Elegí un modelo</option>
                {machines.map((machine) => (
                  <option key={machine.id} value={machine.id}>
                    {machine.name}
                    {machine.status !== 'published' ? ' · sin publicar' : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field
              label="Nombre de esta unidad"
              hint={
                !editingUnit
                  ? 'Para varias unidades, agregamos un número al nombre base.'
                  : undefined
              }
            >
              <input
                name="label"
                required
                maxLength={quantity > 1 ? 90 : 100}
                value={draft.label}
                onChange={(event) => change({ label: event.target.value })}
                placeholder="Ej.: Prensa"
              />
            </Field>
            {!editingUnit && (
              <Field label="Cantidad de unidades">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={quantity}
                  onChange={(event) => {
                    const count = Number(event.target.value)
                    setQuantity(
                      Number.isFinite(count) ? Math.max(1, Math.min(20, Math.floor(count))) : 1,
                    )
                    onReview(false)
                  }}
                />
              </Field>
            )}
            {!editingUnit && quantity > 1 && (
              <Field label="Número inicial">
                <input
                  name="start"
                  type="number"
                  min={1}
                  max={9999}
                  value={draft.start}
                  onChange={(event) =>
                    change({
                      start: Math.max(1, Math.min(9999, Number(event.target.value) || 1)),
                    })
                  }
                />
              </Field>
            )}
            <Field label="Ubicación">
              <input
                name="location"
                maxLength={200}
                value={draft.location}
                onChange={(event) => change({ location: event.target.value })}
                placeholder="Planta baja · sector piernas"
              />
            </Field>
          </>
        )}
      </div>
      <Field
        label={
          source.kind === 'machine'
            ? 'Instrucciones del modelo'
            : 'Ajustes y particularidades de esta unidad'
        }
      >
        <textarea
          name={source.kind === 'machine' ? 'instructions' : 'adjustments'}
          value={source.kind === 'machine' ? draft.instructions : draft.adjustments}
          maxLength={source.kind === 'machine' ? 5000 : 3000}
          onChange={(event) =>
            change(
              source.kind === 'machine'
                ? { instructions: event.target.value }
                : { adjustments: event.target.value },
            )
          }
        />
      </Field>
      {source.kind === 'unit' && quantity > 1 && (
        <p className="small muted">
          Ubicación, ajustes y recursos iniciales se aplican a todas. Después podés editar cada
          unidad por separado.
        </p>
      )}
      <AssetEditor
        orgId={orgId}
        value={assets}
        onChange={(value) => {
          setAssets(value)
          onReview(false)
        }}
      />
      {source.kind === 'unit' && (
        <div style={{ margin: '20px 0' }}>
          <label className="check">
            <input
              type="checkbox"
              checked={publicUnit}
              disabled={model?.status !== 'published' && !publicUnit}
              onChange={(event) => {
                setPublicUnit(event.target.checked)
                onReview(false)
              }}
            />
            Mostrar ficha y recursos en la web pública del gimnasio
          </label>
          {model?.status !== 'published' && (
            <p className="small muted">
              Publicá el modelo antes de habilitar una ficha pública. Podés guardar las unidades
              para uso interno.
            </p>
          )}
          {publicUnit && (
            <label className="check" style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={unitReviewed}
                onChange={(event) => onReview(event.target.checked)}
              />
              Revisé el nombre, la ubicación, los ajustes y los recursos de estas unidades.
            </label>
          )}
          {publicUnit && !websitePublished && (
            <p className="small muted">Las fichas se habilitarán cuando publiques el website.</p>
          )}
        </div>
      )}
    </>
  )
}
