import assert from 'node:assert/strict'
import test from 'node:test'
import { createClientId } from '../src/client-id.ts'
test('client operation IDs need only native CSPRNG and keep UUIDv4 version and variant bits', () => {
  const id = createClientId({
    getRandomValues: (array) => {
      new Uint8Array(array!.buffer).fill(255)
      return array
    },
  })
  assert.equal(id, 'ffffffff-ffff-4fff-bfff-ffffffffffff')
  assert.match(
    createClientId(),
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
})
test('client IDs never substitute clock or weak randomness when native CSPRNG is unavailable', () => {
  assert.throws(() => createClientId({} as Crypto), /identificadores seguros/)
})
