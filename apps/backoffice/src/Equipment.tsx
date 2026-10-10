import { lazy, Suspense, useEffect, useState, type FormEvent } from 'react'
import { UnitBatchSchema, type Asset, type Machine, type Unit } from '@klisteniapp/b2b-contracts'
import { ApiError, Empty, Field, Notice, useAccountClient } from '@klisteniapp/b2b-ui'
import QRCode from 'qrcode'
import { AssetEditor, Heading, useAction } from './shared'

const EquipmentModelViewer = lazy(() =>
  import('@klisteniapp/anatomy-viewer/equipment').then((module) => ({
    default: module.EquipmentModelViewer,
  })),
)
type UnitInput = Pick<
  Unit,
  'machineId' | 'label' | 'location' | 'assets' | 'adjustments' | 'public' | 'archived'
>
type Batch = { id: string; units: UnitInput[] }

function Resources({ assets }: { assets: Asset[] }) {
  return (
    <div className="review-media">
      {assets.map((asset) => (
        <figure key={asset.id}>
          {asset.kind === 'model3d' ? (
            <Suspense fallback={<p role="status">Preparando visor…</p>}>
              <EquipmentModelViewer
                url={asset.url}
                label={asset.label}
                attribution={asset.attribution}
              />
            </Suspense>
          ) : asset.kind === 'image' ? (
            <img className="media" src={asset.url} alt={asset.label} loading="lazy" />
          ) : (
            <video
              className="media"
              controls
              preload="none"
              src={asset.url}
              aria-label={asset.label}
            />
          )}
          <figcaption className="small muted">
            {asset.label}
            {asset.attribution && ` · ${asset.attribution}`}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
function UnitQr({ unit }: { unit: Unit }) {
  const [image, setImage] = useState(''),
    [error, setError] = useState('')
  const url = new URL(unit.publicPath, location.origin).href
  useEffect(() => {
    let live = true
    void QRCode.toDataURL(url, {
      width: 360,
      margin: 2,
      color: { dark: '#183d32', light: '#ffffff' },
    })
      .then((value) => {
        if (live) setImage(value)
      })
      .catch(() => {
        if (live) setError('No pudimos generar el QR. El enlace público sigue disponible.')
      })
    return () => {
      live = false
    }
  }, [url])
  return (
    <div className="row" style={{ marginTop: 15 }}>
      {image && (
        <a href={image} download={`qr-${unit.id}.png`} aria-label={`Descargar QR de ${unit.label}`}>
          <img className="qr" src={image} alt={`QR de ${unit.label}`} />
        </a>
      )}
      <div style={{ flex: 1, minWidth: 150 }}>
        <a href={url} target="_blank" rel="noreferrer">
          Abrir ficha pública ↗
        </a>
        <p className="small muted" style={{ overflowWrap: 'anywhere' }}>
          {url}
        </p>
        {image && (
          <a className="text-button small" href={image} download={`qr-${unit.id}.png`}>
            Descargar QR para imprimir
          </a>
        )}
        <Notice error>{error}</Notice>
      </div>
    </div>
  )
}

export function Equipment({
  orgId,
  userId,
  machines,
  units,
  active,
  admin,
  websitePublished,
  reload,
}: {
  orgId: string
  userId: string
  machines: Machine[]
  units: Unit[]
  active: boolean
  admin: boolean
  websitePublished: boolean
  reload: (resource: 'machines' | 'units') => void
}) {
  const client = useAccountClient(),
    action = useAction()
  const batchStorageKey = `klisteni.b2b.unit-batch.v1.${orgId}.${userId}`
  const [mode, setMode] = useState<'units' | 'models'>('units'),
    [creating, setCreating] = useState(false),
    [assets, setAssets] = useState<Asset[]>([])
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null),
    [editingUnit, setEditingUnit] = useState<Unit | null>(null),
    [selectedModel, setSelectedModel] = useState('')
  const [quantity, setQuantity] = useState(1),
    [publicUnit, setPublicUnit] = useState(false),
    [unitReviewed, setUnitReviewed] = useState(false),
    [pendingBatch, setPendingBatch] = useState<Batch | null>(() => {
      try {
        const stored = sessionStorage.getItem(batchStorageKey)
        if (stored) {
          const parsed = UnitBatchSchema.safeParse(JSON.parse(stored))
          if (parsed.success) return parsed.data
        }
      } catch {
        /* A new batch is sent only after its durable draft can be stored. */
      }
      return null
    })
  const [reviewing, setReviewing] = useState<Machine | null>(null),
    [reviewAccepted, setReviewAccepted] = useState(false),
    [query, setQuery] = useState('')
  const canEdit = active && admin
  function closeEditor() {
    setCreating(false)
    setAssets([])
    setEditingMachine(null)
    setEditingUnit(null)
    setSelectedModel('')
    setQuantity(1)
    setPublicUnit(false)
    setUnitReviewed(false)
  }
  function createUnits(modelId = '') {
    if (pendingBatch) return
    closeEditor()
    setMode('units')
    setSelectedModel(modelId)
    setCreating(true)
    action.clear()
  }
  function editMachine(machine: Machine) {
    if (pendingBatch) return
    closeEditor()
    setMode('models')
    setEditingMachine(machine)
    setAssets(machine.assets)
    setCreating(true)
    setReviewing(null)
    action.clear()
  }
  function editUnit(unit: Unit) {
    if (pendingBatch) return
    closeEditor()
    setMode('units')
    setEditingUnit(unit)
    setSelectedModel(unit.machineId)
    setAssets(unit.assets)
    setPublicUnit(unit.public)
    setCreating(true)
    action.clear()
  }
  async function retireUnit(unit: Unit) {
    await action.run(
      async () => {
        await client.equipment.updateUnit(orgId, unit.id, {
          machineId: unit.machineId,
          label: unit.label,
          location: unit.location,
          assets: unit.assets,
          adjustments: unit.adjustments,
          archived: !unit.archived,
          public: unit.public,
          expectedRevision: unit.revision,
        })
        reload('units')
      },
      unit.archived
        ? 'Equipo restaurado.'
        : 'Equipo retirado. Su ficha deja de estar disponible públicamente.',
    )
  }
  async function sendBatch(batch: Batch) {
    const saved = await action.run(
      async () => {
        try {
          sessionStorage.setItem(batchStorageKey, JSON.stringify(batch))
        } catch {
          throw new Error(
            'No pudimos conservar el alta en esta pestaña. No se enviaron nuevas unidades; mantené los datos en pantalla e intentá nuevamente.',
          )
        }
        setPendingBatch(batch)
        try {
          await client.equipment.createUnitsBatch(orgId, batch)
          sessionStorage.removeItem(batchStorageKey)
          setPendingBatch(null)
          reload('units')
        } catch (error) {
          if (error instanceof ApiError && (error.status === 400 || error.status === 422)) {
            sessionStorage.removeItem(batchStorageKey)
            setPendingBatch(null)
          }
          throw error
        }
      },
      batch.units.length === 1
        ? 'Equipo guardado. Podés revisar sus ajustes y habilitar su ficha.'
        : `${batch.units.length} equipos guardados. Cada unidad tiene ajustes y QR propios.`,
    )
    if (saved) closeEditor()
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    if (mode === 'units') {
      if (publicUnit && !unitReviewed) return
      const body: UnitInput = {
        machineId: selectedModel,
        label: String(data.get('label')),
        location: String(data.get('location')),
        adjustments: String(data.get('adjustments')),
        assets,
        public: publicUnit,
        archived: editingUnit?.archived ?? false,
      }
      if (!editingUnit) {
        const start = Number(data.get('start') || 1)
        await sendBatch({
          id: crypto.randomUUID(),
          units: Array.from({ length: quantity }, (_, i) => ({
            ...body,
            label:
              quantity === 1 ? body.label : `${body.label} ${String(start + i).padStart(2, '0')}`,
          })),
        })
        return
      }
      const saved = await action.run(async () => {
        await client.equipment.updateUnit(orgId, editingUnit.id, {
          ...body,
          expectedRevision: editingUnit.revision,
        })
        reload('units')
      }, 'Equipo guardado. Su ficha refleja los ajustes revisados.')
      if (saved) closeEditor()
      return
    }
    const own = editingMachine?.scope === 'organization'
    const saved = await action.run(async () => {
      const body = {
        name: String(data.get('name') ?? ''),
        type: String(data.get('type') ?? ''),
        manufacturer: String(data.get('manufacturer') ?? ''),
        model: String(data.get('model') ?? ''),
        instructions: String(data.get('instructions') ?? ''),
        assets,
        derivedFromId:
          editingMachine?.scope === 'base'
            ? editingMachine.id
            : (editingMachine?.derivedFromId ?? null),
        derivedFromVersion:
          editingMachine?.scope === 'base'
            ? editingMachine.version
            : (editingMachine?.derivedFromVersion ?? null),
      }
      if (own)
        await client.equipment.updateMachine(orgId, editingMachine.id, {
          ...body,
          expectedRevision: editingMachine.revision,
        })
      else await client.equipment.createMachine(orgId, body)
      reload('machines')
    }, 'Modelo guardado como borrador. Revisalo y publicalo para habilitar sus fichas públicas.')
    if (saved) closeEditor()
  }
  async function reviewModel(machine: Machine) {
    if (!reviewAccepted) return
    await action.run(async () => {
      const result = await client.equipment.reviewMachine(orgId, machine.id, {
        expectedRevision: machine.revision,
      })
      setReviewing(result.machine)
      setReviewAccepted(false)
      reload('machines')
    }, 'Modelo revisado. Ya podés publicarlo.')
  }
  async function publishModel(machine: Machine) {
    await action.run(async () => {
      const result = await client.equipment.publishMachine(orgId, machine.id, {
        expectedRevision: machine.revision,
      })
      if (reviewing?.id === machine.id) setReviewing(result.machine)
      reload('machines')
    }, 'Modelo publicado. Las unidades públicas ya pueden usar sus instrucciones y recursos.')
  }
  const model = machines.find((machine) => machine.id === selectedModel)
  const visibleMachines = machines.filter((machine) =>
    `${machine.name} ${machine.type} ${machine.manufacturer}`
      .toLocaleLowerCase()
      .includes(query.toLocaleLowerCase()),
  )
  return (
    <>
      <Heading
        title="Conocé cada equipo."
        description="La biblioteca define el modelo; cada unidad del gimnasio conserva su nombre, ubicación, fotos y ajustes."
      >
        {admin && (
          <button
            className="button primary"
            disabled={!canEdit || Boolean(pendingBatch)}
            onClick={() => {
              if (creating) closeEditor()
              else if (mode === 'units') createUnits()
              else {
                closeEditor()
                setCreating(true)
                action.clear()
              }
            }}
          >
            {creating
              ? 'Cerrar formulario'
              : mode === 'models'
                ? '+ Crear modelo'
                : '+ Registrar equipo'}
          </button>
        )}
      </Heading>
      <div className="tabs">
        <button
          disabled={Boolean(pendingBatch)}
          aria-pressed={mode === 'units'}
          onClick={() => {
            setMode('units')
            closeEditor()
          }}
        >
          Equipos del gimnasio
        </button>
        <button
          disabled={Boolean(pendingBatch)}
          aria-pressed={mode === 'models'}
          onClick={() => {
            setMode('models')
            closeEditor()
          }}
        >
          Biblioteca de modelos
        </button>
      </div>
      {!admin && (
        <p className="small muted">
          Podés consultar los equipos. Su configuración y publicación están a cargo de la
          administración.
        </p>
      )}
      {action.notices}
      {creating && (
        <form
          key={`${mode}/${editingMachine?.id ?? editingUnit?.id ?? 'new'}`}
          className="card form-stack"
          style={{ marginBottom: 24 }}
          onSubmit={submit}
        >
          <h2>
            {mode === 'models'
              ? editingMachine?.scope === 'base'
                ? 'Crear versión propia del modelo base'
                : editingMachine
                  ? 'Editar modelo propio'
                  : 'Nuevo modelo de máquina'
              : editingUnit
                ? 'Editar unidad física'
                : 'Registrar unidades físicas'}
          </h2>
          {editingMachine?.status === 'published' && editingMachine.scope === 'organization' && (
            <Notice>
              Guardar cambios deja el modelo en borrador. Sus fichas públicas vuelven a estar
              disponibles cuando revisás y publicás la nueva versión.
            </Notice>
          )}
          <fieldset
            disabled={!canEdit || action.busy || Boolean(pendingBatch)}
            style={{ border: 0, padding: 0, minWidth: 0 }}
          >
            <div className="form-grid">
              {mode === 'models' ? (
                <>
                  <Field label="Nombre del modelo">
                    <input
                      name="name"
                      required
                      maxLength={150}
                      defaultValue={editingMachine?.name ?? ''}
                    />
                  </Field>
                  <Field label="Tipo de máquina">
                    <input
                      name="type"
                      required
                      maxLength={100}
                      defaultValue={editingMachine?.type ?? ''}
                      placeholder="Prensa, poleas, bicicleta…"
                    />
                  </Field>
                  <Field label="Fabricante">
                    <input
                      name="manufacturer"
                      maxLength={100}
                      defaultValue={editingMachine?.manufacturer ?? ''}
                    />
                  </Field>
                  <Field label="Referencia del fabricante">
                    <input
                      name="model"
                      maxLength={100}
                      defaultValue={editingMachine?.model ?? ''}
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
                      onChange={(event) => {
                        setSelectedModel(event.target.value)
                        setUnitReviewed(false)
                        if (
                          machines.find((machine) => machine.id === event.target.value)?.status !==
                          'published'
                        )
                          setPublicUnit(false)
                      }}
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
                      defaultValue={editingUnit?.label ?? ''}
                      onChange={() => setUnitReviewed(false)}
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
                            Number.isFinite(count)
                              ? Math.max(1, Math.min(20, Math.floor(count)))
                              : 1,
                          )
                          setUnitReviewed(false)
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
                        defaultValue={1}
                        onChange={() => setUnitReviewed(false)}
                      />
                    </Field>
                  )}
                  <Field label="Ubicación">
                    <input
                      name="location"
                      maxLength={200}
                      defaultValue={editingUnit?.location ?? ''}
                      onChange={() => setUnitReviewed(false)}
                      placeholder="Planta baja · sector piernas"
                    />
                  </Field>
                </>
              )}
            </div>
            <Field
              label={
                mode === 'models'
                  ? 'Instrucciones del modelo'
                  : 'Ajustes y particularidades de esta unidad'
              }
            >
              <textarea
                name={mode === 'models' ? 'instructions' : 'adjustments'}
                defaultValue={
                  mode === 'models'
                    ? (editingMachine?.instructions ?? '')
                    : (editingUnit?.adjustments ?? '')
                }
                maxLength={mode === 'models' ? 5000 : 3000}
                onChange={() => setUnitReviewed(false)}
              />
            </Field>
            {mode === 'units' && quantity > 1 && (
              <p className="small muted">
                Ubicación, ajustes y recursos iniciales se aplican a todas. Después podés editar
                cada unidad por separado.
              </p>
            )}
            <AssetEditor
              orgId={orgId}
              value={assets}
              onChange={(value) => {
                setAssets(value)
                setUnitReviewed(false)
              }}
            />
            {mode === 'units' && (
              <div style={{ margin: '20px 0' }}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={publicUnit}
                    disabled={model?.status !== 'published' && !publicUnit}
                    onChange={(event) => {
                      setPublicUnit(event.target.checked)
                      setUnitReviewed(false)
                    }}
                  />
                  Mostrar ficha y recursos en la web pública del gimnasio
                </label>
                {model?.status !== 'published' && (
                  <p className="small muted">
                    Publicá el modelo antes de habilitar una ficha pública. Podés guardar las
                    unidades para uso interno.
                  </p>
                )}
                {publicUnit && (
                  <label className="check" style={{ marginTop: 12 }}>
                    <input
                      type="checkbox"
                      checked={unitReviewed}
                      onChange={(event) => setUnitReviewed(event.target.checked)}
                    />
                    Revisé el nombre, la ubicación, los ajustes y los recursos de estas unidades.
                  </label>
                )}
                {publicUnit && !websitePublished && (
                  <p className="small muted">
                    Las fichas se habilitarán cuando publiques el website.
                  </p>
                )}
              </div>
            )}
            <button
              className="button primary"
              style={{ marginTop: 20 }}
              disabled={mode === 'units' && publicUnit && !unitReviewed}
            >
              {action.busy
                ? 'Guardando…'
                : mode === 'models'
                  ? 'Guardar modelo'
                  : editingUnit
                    ? 'Guardar equipo'
                    : quantity > 1
                      ? `Registrar ${quantity} equipos`
                      : 'Registrar equipo'}
            </button>
          </fieldset>
        </form>
      )}
      {pendingBatch && (
        <section className="card review-panel">
          <Notice>
            Recuperamos un alta pendiente de confirmación en esta cuenta y gimnasio. Reenviamos el
            mismo lote para evitar duplicar las unidades.
          </Notice>
          <h2>{pendingBatch.units.length} unidades pendientes</h2>
          <ul>
            {pendingBatch.units.map((unit, index) => (
              <li key={index}>
                {unit.label}
                {unit.location && ` · ${unit.location}`}
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="button primary"
            disabled={action.busy || !canEdit}
            onClick={() => void sendBatch(pendingBatch)}
          >
            Confirmar alta pendiente
          </button>
        </section>
      )}
      {mode === 'models' && (
        <>
          <Field label="Buscar modelo de máquina">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nombre, tipo o fabricante"
            />
          </Field>
          {reviewing && (
            <section className="card review-panel">
              <div className="card-head">
                <div>
                  <p className="eyebrow">REVISIÓN DEL MODELO</p>
                  <h2>{reviewing.name}</h2>
                </div>
                <button className="text-button" onClick={() => setReviewing(null)}>
                  Cerrar revisión
                </button>
              </div>
              <p>
                {[reviewing.type, reviewing.manufacturer, reviewing.model]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p style={{ whiteSpace: 'pre-line' }}>{reviewing.instructions}</p>
              <Resources assets={reviewing.assets} />
              {reviewing.status === 'draft' && (
                <>
                  <label className="check" style={{ marginTop: 20 }}>
                    <input
                      type="checkbox"
                      checked={reviewAccepted}
                      onChange={(event) => setReviewAccepted(event.target.checked)}
                    />
                    Revisé las instrucciones y los recursos de este modelo.
                  </label>
                  <button
                    className="button primary"
                    style={{ marginTop: 18 }}
                    disabled={!canEdit || action.busy || !reviewAccepted}
                    onClick={() => void reviewModel(reviewing)}
                  >
                    Confirmar revisión del modelo
                  </button>
                </>
              )}
              {reviewing.status === 'reviewed' && (
                <button
                  className="button primary"
                  style={{ marginTop: 18 }}
                  disabled={!canEdit || action.busy}
                  onClick={() => void publishModel(reviewing)}
                >
                  Publicar modelo revisado
                </button>
              )}
            </section>
          )}
          <div className="grid three" style={{ marginTop: 22 }}>
            {visibleMachines.map((machine) => (
              <article className="card" key={machine.id}>
                <div className="exercise-art">
                  {machine.assets.find((asset) => asset.kind === 'image') ? (
                    <img
                      src={machine.assets.find((asset) => asset.kind === 'image')!.url}
                      alt={machine.name}
                      loading="lazy"
                    />
                  ) : (
                    <span aria-hidden="true">◇</span>
                  )}
                </div>
                <span className={`pill ${machine.status === 'draft' ? 'warning' : ''}`}>
                  {machine.scope === 'base'
                    ? 'MODELO BASE'
                    : machine.status === 'published'
                      ? 'MODELO PUBLICADO'
                      : machine.status === 'reviewed'
                        ? 'MODELO REVISADO'
                        : 'MODELO EN BORRADOR'}{' '}
                  · V{machine.version}
                </span>
                <h3 style={{ marginTop: 14 }}>{machine.name}</h3>
                <p className="muted small">
                  {[machine.type, machine.manufacturer, machine.model].filter(Boolean).join(' · ')}
                </p>
                <p className="small">{machine.instructions}</p>
                <p className="small muted">
                  {units.filter((unit) => unit.machineId === machine.id && !unit.archived).length}{' '}
                  unidades activas de este modelo
                </p>
                {machine.scope === 'base' && (
                  <p className="small muted">
                    Registrá unidades para reutilizarlo. Creá un modelo propio sólo si necesitás
                    cambiar sus instrucciones o recursos comunes.
                  </p>
                )}
                {machine.assets.length > 0 && (
                  <details>
                    <summary>Ver recursos del modelo</summary>
                    <Resources assets={machine.assets} />
                  </details>
                )}
                {admin && (
                  <div className="row" style={{ marginTop: 15 }}>
                    <button
                      className="text-button"
                      disabled={!canEdit || Boolean(pendingBatch)}
                      onClick={() => createUnits(machine.id)}
                    >
                      Registrar una unidad →
                    </button>
                    <button
                      className="button small"
                      disabled={!canEdit || Boolean(pendingBatch)}
                      onClick={() => editMachine(machine)}
                    >
                      {machine.scope === 'base' ? 'Crear modelo propio' : 'Editar modelo'}
                    </button>
                    {machine.scope === 'organization' && machine.status === 'draft' && (
                      <button
                        className="text-button"
                        onClick={() => {
                          setReviewing(machine)
                          setReviewAccepted(false)
                          action.clear()
                        }}
                      >
                        Revisar modelo
                      </button>
                    )}
                    {machine.scope === 'organization' && machine.status === 'reviewed' && (
                      <button
                        className="button small"
                        disabled={!canEdit || action.busy}
                        onClick={() => void publishModel(machine)}
                      >
                        Publicar modelo
                      </button>
                    )}
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {mode === 'units' &&
        (units.length ? (
          <div className="grid two">
            {units.map((unit) => {
              const machine = machines.find((machine) => machine.id === unit.machineId),
                publicReady =
                  websitePublished &&
                  machine?.status === 'published' &&
                  unit.public &&
                  !unit.archived
              return (
                <article className="card" key={unit.id}>
                  <span className={`pill ${!publicReady ? 'warning' : ''}`}>
                    {unit.archived
                      ? 'RETIRADO'
                      : publicReady
                        ? 'FICHA PÚBLICA'
                        : unit.public
                          ? 'PUBLICACIÓN PENDIENTE'
                          : 'USO INTERNO'}
                  </span>
                  <h2 style={{ marginTop: 16 }}>{unit.label}</h2>
                  <p className="muted">
                    {machine?.name} · {unit.location || 'Ubicación sin especificar'}
                  </p>
                  {unit.adjustments && <p>{unit.adjustments}</p>}
                  {unit.assets.length > 0 && (
                    <details>
                      <summary>Ver recursos de esta unidad</summary>
                      <Resources assets={unit.assets} />
                    </details>
                  )}
                  {publicReady && <UnitQr unit={unit} />}
                  {unit.public && !publicReady && !unit.archived && (
                    <p className="small muted">
                      Para habilitar el QR necesitás el modelo y el website publicados.
                    </p>
                  )}
                  {admin && (
                    <div className="row" style={{ marginTop: 15 }}>
                      <button
                        className="button small"
                        disabled={!canEdit || Boolean(pendingBatch)}
                        onClick={() => editUnit(unit)}
                      >
                        Editar equipo
                      </button>
                      <button
                        className="text-button"
                        disabled={!canEdit || action.busy || Boolean(pendingBatch)}
                        onClick={() => void retireUnit(unit)}
                      >
                        {unit.archived ? 'Restaurar equipo' : 'Retirar equipo'}
                      </button>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        ) : (
          <Empty title="Hagamos un mapa del gimnasio">
            Elegí un modelo de la biblioteca y registrá las unidades que hay en tu espacio.
          </Empty>
        ))}
    </>
  )
}
