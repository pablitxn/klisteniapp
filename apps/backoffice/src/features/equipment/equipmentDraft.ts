import {
  AssetSchema,
  MachineInputSchema,
  UnitInputSchema,
  type Asset,
  type Machine,
  type Unit,
} from '@klisteniapp/b2b-contracts'

const DraftAssetSchema = AssetSchema.extend({
  attribution: AssetSchema.shape.attribution.removeDefault(),
})

export type EquipmentEditorSource =
  | { kind: 'machine'; machine?: Machine }
  | { kind: 'unit'; unit?: Unit; machineId?: string }

/** The form copy accepts incomplete text; persisted inputs use the public contracts. */
export type EquipmentDraft = {
  name: string
  type: string
  manufacturer: string
  model: string
  instructions: string
  machineId: string
  label: string
  location: string
  adjustments: string
  assets: Asset[]
  public: boolean
  archived: boolean
  quantity: number
  start: number
}

export function equipmentDraft(source: EquipmentEditorSource): EquipmentDraft {
  const machine = source.kind === 'machine' ? source.machine : undefined
  const unit = source.kind === 'unit' ? source.unit : undefined
  return {
    name: machine?.name ?? '',
    type: machine?.type ?? '',
    manufacturer: machine?.manufacturer ?? '',
    model: machine?.model ?? '',
    instructions: machine?.instructions ?? '',
    machineId: unit?.machineId ?? (source.kind === 'unit' ? (source.machineId ?? '') : ''),
    label: unit?.label ?? '',
    location: unit?.location ?? '',
    adjustments: unit?.adjustments ?? '',
    assets: (machine?.assets ?? unit?.assets ?? []).map((asset) => ({ ...asset })),
    public: unit?.public ?? false,
    archived: unit?.archived ?? false,
    quantity: 1,
    start: 1,
  }
}

export function isEquipmentDraft(value: unknown): value is EquipmentDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return (
    [
      'name',
      'type',
      'manufacturer',
      'model',
      'instructions',
      'machineId',
      'label',
      'location',
      'adjustments',
    ].every((key) => typeof draft[key] === 'string') &&
    typeof draft.public === 'boolean' &&
    typeof draft.archived === 'boolean' &&
    typeof draft.quantity === 'number' &&
    Number.isInteger(draft.quantity) &&
    draft.quantity >= 1 &&
    draft.quantity <= 20 &&
    typeof draft.start === 'number' &&
    Number.isInteger(draft.start) &&
    draft.start >= 1 &&
    draft.start <= 9999 &&
    Array.isArray(draft.assets) &&
    draft.assets.length <= 10 &&
    draft.assets.every((asset) => DraftAssetSchema.safeParse(asset).success)
  )
}

export function machineInput(draft: EquipmentDraft, source?: Machine) {
  return MachineInputSchema.parse({
    name: draft.name,
    type: draft.type,
    manufacturer: draft.manufacturer,
    model: draft.model,
    instructions: draft.instructions,
    assets: draft.assets,
    derivedFromId: source?.scope === 'base' ? source.id : (source?.derivedFromId ?? null),
    derivedFromVersion:
      source?.scope === 'base' ? source.version : (source?.derivedFromVersion ?? null),
  })
}

export function unitInput(draft: EquipmentDraft) {
  return UnitInputSchema.parse({
    machineId: draft.machineId,
    label: draft.label,
    location: draft.location,
    adjustments: draft.adjustments,
    assets: draft.assets,
    public: draft.public,
    archived: draft.archived,
  })
}

export function unitBatchInputs(draft: EquipmentDraft) {
  const unit = unitInput(draft)
  return Array.from({ length: draft.quantity }, (_, index) =>
    UnitInputSchema.parse({
      ...unit,
      label:
        draft.quantity === 1
          ? unit.label
          : `${unit.label} ${String(draft.start + index).padStart(2, '0')}`,
    }),
  )
}
