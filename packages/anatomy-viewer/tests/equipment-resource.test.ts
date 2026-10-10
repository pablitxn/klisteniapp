import assert from 'node:assert/strict'
import test from 'node:test'
import { isEquipmentModelUrl } from '../src/equipment-resource.ts'

test('optional equipment accepts local or hosted GLBs without pretending other media are models', () => {
  for (const url of ['/machines/row.glb', 'https://assets.example.test/cable.GLB?version=2']) assert.equal(isEquipmentModelUrl(url), true)
  for (const url of ['/machines/row.png', '/machines/row.mp4', 'javascript:row.glb', 'data:model/gltf-binary;base64,AA==', 'file:///row.glb', 'row']) assert.equal(isEquipmentModelUrl(url), false)
})
