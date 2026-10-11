import { useEffect, useState, type FormEvent } from 'react'
import type { Machine } from '@klisteniapp/b2b-contracts'
import { ApiError } from '@klisteniapp/b2b-client'
import { useAccountClient } from '@klisteniapp/b2b-react'
import { Notice } from '@klisteniapp/b2b-ui'
import { useAction } from '../../shared'
import { DraftConflict, DraftRecovery, useEditorDraft } from '../../useEditorDraft'
import { EquipmentFields } from './EquipmentFields'
import {
  equipmentDraft,
  isEquipmentDraft,
  machineInput,
  unitInput,
  unitBatchInputs,
  type EquipmentDraft,
  type EquipmentEditorSource,
} from './equipmentDraft'

export type EquipmentBatch = { id: string; units: ReturnType<typeof unitInput>[] }

export function EquipmentEditor({
  orgId,
  source,
  machines,
  active,
  websitePublished,
  batchBusy,
  pendingBatch,
  onCreateUnits,
  onSaved,
}: {
  orgId: string
  source: EquipmentEditorSource
  machines: Machine[]
  active: boolean
  websitePublished: boolean
  batchBusy: boolean
  pendingBatch: boolean
  onCreateUnits: (batch: EquipmentBatch) => Promise<boolean>
  onSaved: (resource: 'machines' | 'units', message: string) => void
}) {
  const client = useAccountClient()
  const editingMachine = source.kind === 'machine' ? source.machine : undefined
  const editingUnit = source.kind === 'unit' ? source.unit : undefined
  const entity = editingMachine ?? editingUnit
  const editing =
    source.kind === 'machine' ? editingMachine?.scope === 'organization' : Boolean(editingUnit)
  const [latest, setLatest] = useState(source)
  const [conflict, setConflict] = useState(false)
  const [unitReviewed, setUnitReviewed] = useState(false)
  const latestEntity = latest.kind === 'machine' ? latest.machine : latest.unit
  useEffect(() => {
    if (entity && (!latestEntity || entity.revision > latestEntity.revision)) setLatest(source)
  }, [source, entity, latestEntity])
  const local = useEditorDraft(
    orgId,
    source.kind,
    entity ? `${editing ? 'edit' : 'variant'}:${entity.id}` : 'new',
    equipmentDraft(source),
    editing ? (entity?.revision ?? null) : null,
    isEquipmentDraft,
  )
  const draft = local.value
  const action = useAction()
  const stale = Boolean(editing && latestEntity && latestEntity.revision !== local.revision)
  const blocked = Boolean(local.pending) || stale || conflict || pendingBatch
  function change(patch: Partial<EquipmentDraft>) {
    local.change({ ...draft, ...patch })
    setUnitReviewed(false)
  }
  const publicUnit = draft.public,
    quantity = draft.quantity
  async function readLatest() {
    if (source.kind === 'machine') {
      const { machines } = await client.equipment.listMachines(orgId)
      const machine = machines.find((item) => item.id === entity?.id)
      if (!machine)
        throw new Error('Este modelo ya no está disponible. Tu borrador sigue conservado.')
      if (local.isCurrent()) setLatest({ kind: 'machine', machine })
    } else {
      const { units } = await client.equipment.listUnits(orgId)
      const unit = units.find((item) => item.id === entity?.id)
      if (!unit) throw new Error('Esta unidad ya no está disponible. Tu borrador sigue conservado.')
      if (local.isCurrent()) setLatest({ kind: 'unit', unit })
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked || !active || (source.kind === 'unit' && publicUnit && !unitReviewed)) return
    await action.run(async () => {
      try {
        if (source.kind === 'machine') {
          const body = machineInput(draft, editingMachine)
          const result =
            editingMachine?.scope === 'organization'
              ? await client.equipment.updateMachine(orgId, editingMachine.id, {
                  ...body,
                  expectedRevision: local.savedRevision(),
                })
              : await client.equipment.createMachine(orgId, body)
          if (!local.isCurrent()) return
          local.reset(
            equipmentDraft({ kind: 'machine', machine: result.machine }),
            result.machine.revision,
          )
          onSaved(
            'machines',
            'Modelo guardado como borrador. Revisalo y publicalo para habilitar sus fichas públicas.',
          )
        } else if (editingUnit) {
          const result = await client.equipment.updateUnit(orgId, editingUnit.id, {
            ...unitInput(draft),
            expectedRevision: local.savedRevision(),
          })
          if (!local.isCurrent()) return
          local.reset(equipmentDraft({ kind: 'unit', unit: result.unit }), result.unit.revision)
          onSaved('units', 'Equipo guardado. Su ficha refleja los ajustes revisados.')
        } else {
          const saved = await onCreateUnits({
            id: crypto.randomUUID(),
            units: unitBatchInputs(draft),
          })
          if (saved && local.isCurrent()) {
            local.reset(equipmentDraft({ kind: 'unit' }), null)
            onSaved('units', '')
          }
        }
      } catch (error) {
        if (!local.isCurrent()) return
        if (error instanceof ApiError && error.status === 409 && editing) {
          setConflict(true)
          await readLatest()
        }
        throw error
      }
    }, '')
  }
  return (
    <>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={action.busy || batchBusy || !active || pendingBatch}
        onRecover={local.recover}
        onDiscard={() =>
          local.reset(equipmentDraft(latest), editing ? (latestEntity?.revision ?? null) : null)
        }
      />
      {latestEntity && !local.pending && (stale || conflict) && (
        <DraftConflict
          key={latestEntity.revision}
          busy={action.busy || !active}
          currentAvailable={stale}
          onRefresh={() => void action.run(readLatest, '')}
          onKeep={() => {
            local.rebase(latestEntity.revision)
            setConflict(false)
            setUnitReviewed(false)
            action.clear()
          }}
          onDiscard={() => {
            local.reset(equipmentDraft(latest), latestEntity.revision)
            setConflict(false)
            setUnitReviewed(false)
            action.clear()
          }}
        >
          {latest.kind === 'machine' && latest.machine ? (
            <>
              <h3>{latest.machine.name}</h3>
              <p>
                {[latest.machine.type, latest.machine.manufacturer, latest.machine.model]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p style={{ whiteSpace: 'pre-line' }}>{latest.machine.instructions}</p>
            </>
          ) : latest.kind === 'unit' && latest.unit ? (
            <>
              <h3>{latest.unit.label}</h3>
              <p>{machines.find((machine) => machine.id === latest.unit?.machineId)?.name}</p>
              <p>{latest.unit.location}</p>
              <p>{latest.unit.adjustments}</p>
              <p>
                {latest.unit.archived
                  ? 'Retirada'
                  : latest.unit.public
                    ? 'Ficha habilitada'
                    : 'Uso interno'}
              </p>
            </>
          ) : null}
          <ul>
            {latestEntity.assets.map((asset) => (
              <li key={asset.id}>
                <a href={asset.url} target="_blank" rel="noreferrer">
                  {asset.label}
                </a>
                {asset.attribution && ` · ${asset.attribution}`}
              </li>
            ))}
          </ul>
        </DraftConflict>
      )}
      {action.notices}
      <form className="card form-stack" style={{ marginBottom: 24 }} onSubmit={submit}>
        <h2>
          {source.kind === 'machine'
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
          disabled={!active || action.busy || batchBusy || pendingBatch || Boolean(local.pending)}
          style={{ border: 0, padding: 0, minWidth: 0 }}
        >
          <EquipmentFields
            orgId={orgId}
            source={source}
            draft={draft}
            machines={machines}
            websitePublished={websitePublished}
            unitReviewed={unitReviewed}
            onReview={setUnitReviewed}
            onChange={change}
          />
          <button
            className="button primary"
            style={{ marginTop: 20 }}
            disabled={blocked || (source.kind === 'unit' && publicUnit && !unitReviewed)}
          >
            {action.busy
              ? 'Guardando…'
              : source.kind === 'machine'
                ? 'Guardar modelo'
                : editingUnit
                  ? 'Guardar equipo'
                  : quantity > 1
                    ? `Registrar ${quantity} equipos`
                    : 'Registrar equipo'}
          </button>
        </fieldset>
      </form>
    </>
  )
}
