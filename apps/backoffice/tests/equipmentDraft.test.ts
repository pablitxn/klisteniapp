import assert from 'node:assert/strict'
import test from 'node:test'
import type { Machine } from '@klisteniapp/b2b-contracts'
import {
  equipmentDraft,
  isEquipmentDraft,
  machineInput,
  unitBatchInputs,
} from '../src/features/equipment/equipmentDraft.ts'
import { editorDraftKey, readEditorDraft, writeEditorDraft } from '../src/editorDraftStorage.ts'

test('an incomplete equipment form survives storage without becoming a valid publishable model', () => {
  const draft = equipmentDraft({ kind: 'machine' })
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  const key = editorDraftKey('admin', 'atlas', 'machine', 'new')
  writeEditorDraft(storage, key, draft, 3)
  assert.deepEqual(readEditorDraft(storage, key, isEquipmentDraft), {
    version: 1,
    revision: 3,
    value: draft,
  })
  assert.throws(() => machineInput(draft))
  assert.equal(
    readEditorDraft(storage, editorDraftKey('admin', 'atlas', 'unit', 'new'), isEquipmentDraft),
    null,
  )
  assert.equal(
    readEditorDraft(storage, editorDraftKey('admin', 'sur', 'machine', 'new'), isEquipmentDraft),
    null,
  )
  assert.equal(
    readEditorDraft(storage, editorDraftKey('coach', 'atlas', 'machine', 'new'), isEquipmentDraft),
    null,
  )
  assert.equal(isEquipmentDraft({ ...draft, quantity: 21 }), false)
  assert.equal(isEquipmentDraft({ ...draft, start: NaN }), false)
})

test('machine adaptations retain canonical provenance and cannot mutate fetched media', () => {
  const machine: Machine = {
    id: 'base-press',
    name: 'Prensa',
    type: 'press',
    manufacturer: '',
    model: '',
    instructions: 'Ajustar asiento.',
    assets: [
      { id: 'photo', kind: 'image', url: '/photo.jpg', label: 'Asiento', attribution: 'Gimnasio' },
    ],
    scope: 'base',
    status: 'published',
    version: 2,
    revision: 4,
    derivedFromId: null,
    derivedFromVersion: null,
  }
  const draft = equipmentDraft({ kind: 'machine', machine })
  draft.assets[0].label = 'Nuevo encuadre'
  assert.equal(machine.assets[0].label, 'Asiento')
  assert.equal(machineInput(draft, machine).derivedFromId, 'base-press')
  assert.equal(machineInput(draft, machine).derivedFromVersion, 2)
  const adapted = {
    ...machine,
    id: 'gym-press',
    scope: 'organization' as const,
    derivedFromId: machine.id,
    derivedFromVersion: 2,
  }
  assert.equal(machineInput(draft, adapted).derivedFromId, machine.id)
})

test('batch recovery preserves numbering, unit publication and machine identity', () => {
  const draft = {
    ...equipmentDraft({ kind: 'unit', machineId: 'base-press' }),
    label: 'Prensa',
    quantity: 2,
    start: 9,
    location: 'Sala de fuerza',
    adjustments: 'Asiento 3',
    public: true,
  }
  const units = unitBatchInputs(draft)
  assert.deepEqual(
    units.map((unit) => unit.label),
    ['Prensa 09', 'Prensa 10'],
  )
  assert.ok(
    units.every(
      (unit) => unit.machineId === 'base-press' && unit.public && unit.adjustments === 'Asiento 3',
    ),
  )
  assert.equal(isEquipmentDraft(draft), true)
  assert.throws(() => unitBatchInputs({ ...draft, label: 'x'.repeat(100) }))
})
