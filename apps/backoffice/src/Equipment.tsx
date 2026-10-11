import { useEffect, useState } from 'react'
import { UnitBatchSchema, type Asset, type Machine, type Unit } from '@klisteniapp/b2b-contracts'
import { ApiError } from '@klisteniapp/b2b-client'
import { Empty, Field, Notice } from '@klisteniapp/b2b-ui'
import { useAccountClient } from '@klisteniapp/b2b-react'
import QRCode from 'qrcode'
import { Heading, useAction } from './shared'
import { EquipmentEditor, type EquipmentBatch } from './features/equipment/EquipmentEditor'
import type { EquipmentEditorSource } from './features/equipment/equipmentDraft'
import { editorDraftKey } from './editorDraftStorage'
import { latestEditorEntity } from './editorEntity'
import { qrOriginReadiness, unitPublicationBlockers } from './equipmentReadiness'

import { ContentMedia } from '@klisteniapp/b2b-ui/content'

function Resources({ assets }: { assets: Asset[] }) {
  return (
    <div className="review-media">
      <ContentMedia assets={assets} />
    </div>
  )
}
function UnitQr({ unit }: { unit: Unit }) {
  const [image, setImage] = useState(''),
    [error, setError] = useState('')
  const url = new URL(unit.publicPath, location.origin).href
  const origin = qrOriginReadiness(location.origin)
  useEffect(() => {
    let live = true
    setImage('')
    setError('')
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
        {!origin.ready && (
          <p className="small muted">
            QR de prueba. Usá la dirección HTTPS accesible del gimnasio para imprimir la etiqueta
            definitiva.
          </p>
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
  const [mode, setMode] = useState<'units' | 'models'>('units')
  const [editor, setEditor] = useState<EquipmentEditorSource | null>(null)
  const creating = Boolean(editor)
  const [pendingBatch, setPendingBatch] = useState<EquipmentBatch | null>(() => {
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
    setEditor(null)
  }
  function createUnits(machineId = '') {
    if (pendingBatch) return
    setMode('units')
    setEditor({ kind: 'unit', machineId })
    action.clear()
  }
  function editMachine(machine: Machine) {
    if (pendingBatch) return
    setMode('models')
    setEditor({ kind: 'machine', machine })
    setReviewing(null)
    action.clear()
  }
  function editUnit(unit: Unit) {
    if (pendingBatch) return
    setMode('units')
    setEditor({ kind: 'unit', unit })
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
  async function sendBatch(batch: EquipmentBatch) {
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
          sessionStorage.removeItem(editorDraftKey(userId, orgId, 'unit', 'new'))
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
    return saved
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
                setEditor({ kind: 'machine' })
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
      {editor && (
        <EquipmentEditor
          key={`${editor.kind}/${editor.kind === 'machine' ? (editor.machine?.id ?? 'new') : (editor.unit?.id ?? editor.machineId ?? 'new')}`}
          orgId={orgId}
          source={
            editor.kind === 'machine'
              ? {
                  ...editor,
                  machine: editor.machine
                    ? latestEditorEntity(editor.machine, machines)
                    : undefined,
                }
              : {
                  ...editor,
                  unit: editor.unit ? latestEditorEntity(editor.unit, units) : undefined,
                }
          }
          machines={machines}
          active={canEdit}
          websitePublished={websitePublished}
          batchBusy={action.busy}
          pendingBatch={Boolean(pendingBatch)}
          onCreateUnits={sendBatch}
          onSaved={(resource, message) => {
            closeEditor()
            if (message)
              void action.run(async () => {
                reload(resource)
              }, message)
            else reload(resource)
          }}
        />
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
            onClick={() =>
              void sendBatch(pendingBatch).then((saved) => {
                if (saved) closeEditor()
              })
            }
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
                blockers = unitPublicationBlockers(unit, machine, websitePublished),
                publicReady = blockers.length === 0
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
                      {blockers.map((blocker) => blocker.reason).join(' ')}
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
