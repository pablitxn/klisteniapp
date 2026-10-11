import assert from 'node:assert/strict'
import test from 'node:test'
import { MachineSchema, UnitSchema } from '@klisteniapp/b2b-contracts'
import {
  qrOriginReadiness,
  unitPublicationBlockers,
} from '../src/features/equipment/equipmentReadiness.ts'

const machine = MachineSchema.parse({
  id: 'press',
  name: 'Prensa',
  type: 'press',
  scope: 'organization',
  status: 'published',
  version: 1,
  revision: 2,
  manufacturer: '',
  model: '',
  instructions: '',
  assets: [],
  derivedFromId: null,
  derivedFromVersion: null,
})
const unit = UnitSchema.parse({
  id: 'press-01',
  machineId: machine.id,
  label: 'Prensa 01',
  publicPath: '/g/atlas-demo/units/press-01',
  revision: 1,
  location: '',
  assets: [],
  adjustments: '',
  public: true,
  archived: false,
})

test('public QR eligibility accounts for the unit, model and published website independently', () => {
  assert.deepEqual(unitPublicationBlockers(unit, machine, true), [])
  assert.deepEqual(
    unitPublicationBlockers(unit, machine, false).map((item) => item.destination),
    ['website'],
  )
  assert.match(
    unitPublicationBlockers(unit, { ...machine, status: 'draft' }, true)[0].reason,
    /modelo/,
  )
  assert.match(unitPublicationBlockers(unit, undefined, true)[0].reason, /modelo/)
  assert.match(
    unitPublicationBlockers({ ...unit, archived: true }, machine, true)[0].reason,
    /retirada/,
  )
  assert.match(
    unitPublicationBlockers({ ...unit, public: false }, machine, true)[0].reason,
    /habilitar/,
  )
  assert.equal(
    unitPublicationBlockers({ ...unit, public: false, archived: true }, undefined, false).length,
    4,
  )
})

test('local and insecure QR origins stay explicitly labeled as test labels', () => {
  for (const origin of [
    'http://127.0.0.1:4200',
    'https://127.1',
    'https://localhost',
    'https://demo.localhost',
    'https://[::1]',
    'http://0.0.0.0:4200',
    'http://[::]:4200',
  ]) {
    const result = qrOriginReadiness(origin)
    assert.equal(result.ready, false, origin)
    assert.match(result.message, /propio teléfono/, origin)
  }
  assert.equal(qrOriginReadiness('http://gym.example.test').ready, false)
  assert.equal(qrOriginReadiness('not a url').ready, false)
  const https = qrOriginReadiness('https://gym.example.test')
  assert.equal(https.ready, true)
  assert.match(https.message, /desde el teléfono/)
})
