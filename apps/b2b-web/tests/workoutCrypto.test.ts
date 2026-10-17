import assert from 'node:assert/strict'
import { createHash, webcrypto } from 'node:crypto'
import test from 'node:test'
import { canonicalJson } from '@klisteniapp/b2b-domain/sessions'
import { workoutContentHash, newWorkoutId } from '../src/features/training/sync/workoutCrypto.ts'
import { occurrenceWorkoutId } from '../src/features/training/sync/workoutEdit.ts'
import { workoutRequestHash } from '../src/features/training/sync/workoutSync.ts'
import { scope, draft } from './fixtures/workout.ts'

test('pure SHA-256 matches published empty and ASCII known vectors', () => {
  assert.equal(
    workoutContentHash(''),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
  )
  assert.equal(
    workoutContentHash('abc'),
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
  )
  assert.equal(
    workoutContentHash('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  )
})
test('UTF-8, scalar/array ordering, binary and long content match Node and WebCrypto byte for byte', async () => {
  const values = [
    'Entrené 🏋🏽‍♀️ · mañana · 東京',
    '\ud800',
    'a'.repeat(1_000_000),
    canonicalJson({ notes: 'é', values: [0, 1, null, false] }),
    canonicalJson({ values: [1, 0, null, false], notes: 'é' }),
  ]
  for (const value of values) {
    const bytes = new TextEncoder().encode(value)
    const expected = createHash('sha256').update(bytes).digest('hex')
    assert.equal(workoutContentHash(value), expected)
    assert.equal(workoutContentHash(bytes), expected)
    assert.equal(
      Buffer.from(await webcrypto.subtle.digest('SHA-256', bytes)).toString('hex'),
      expected,
    )
  }
  assert.notEqual(workoutContentHash(values[3]), workoutContentHash(values[4]))
})
test('operation request hash and occurrence identity preserve the exact pre-fix SHA-256 envelope', async () => {
  const d = draft(),
    input = {
      id: d.id,
      origin: d.origin,
      content: d.content,
      operationId: 'exact-operation',
      expectedRevision: 0,
    }
  const expected = createHash('sha256')
    .update(
      canonicalJson({
        organizationId: scope.organizationId,
        branchId: scope.branchId,
        actorId: scope.actorId,
        action: 'session.save',
        input,
      }),
    )
    .digest('hex')
  assert.equal(await workoutRequestHash(scope, input), expected)
  const idHash = createHash('sha256')
    .update(
      JSON.stringify([
        'klisteni-session-v2',
        scope.organizationId,
        scope.branchId,
        scope.actorId,
        'occurrence',
      ]),
    )
    .digest('hex')
  assert.equal(await occurrenceWorkoutId(scope, 'occurrence'), `session-${idHash.slice(0, 40)}`)
})
test('training UUID uses CSPRNG bytes with RFC version/variant bits and rejects absent secure randomness', () => {
  const source = {
    getRandomValues: <T extends ArrayBufferView | null>(array: T): T => {
      if (array instanceof Uint8Array) array.set(Array.from({ length: 16 }, (_, index) => index))
      return array
    },
  }
  assert.equal(newWorkoutId(source), '00010203-0405-4607-8809-0a0b0c0d0e0f')
  assert.match(
    newWorkoutId(),
    /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/,
  )
  assert.throws(() => newWorkoutId({} as Crypto), /identificadores seguros/)
})
