import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ProductErrorSchema } from '@klisteniapp/b2b-contracts/product-v2'
import { ApiError, createProductV2Client } from '../src/index.ts'

test('withdrawn selection parses through the frozen error contract and client with its field issue retained', async () => {
  const payload = ProductErrorSchema.parse({
    error:
      'This exercise option is no longer available. Choose a currently available option; your recorded work is retained.',
    code: 'INVALID_INPUT',
    issues: [
      {
        code: 'unavailable',
        path: ['content', 'selectedSegments'],
        stepId: null,
        message:
          'This exercise option is no longer available. Choose a currently available option; your recorded work is retained.',
      },
    ],
  })
  const request = {
    id: 'session',
    operationId: 'immutable-operation',
    expectedRevision: 1,
    origin: {
      kind: 'legacy' as const,
      assignmentId: 'assignment',
      executionId: null,
      routine: { programId: 'routine', version: 1, schemaVersion: 2 as const },
    },
    content: {
      status: 'draft' as const,
      explicitCompletion: false,
      performedAt: '2026-10-17T10:00:00Z',
      notes: 'Keep local actual work',
      correctionReason: '',
      segments: [],
      selectedSegments: [],
      sets: [],
    },
  }
  const before = structuredClone(request)
  let authChanges = 0,
    calls = 0
  const client = createProductV2Client('member', 'atlas', {
    branchId: 'atlas-principal',
    onAuthChange: () => {
      authChanges++
    },
    fetch: async (_url, init) => {
      calls++
      assert.deepEqual(JSON.parse(String(init?.body)), request)
      return new Response(JSON.stringify(payload), {
        status: 409,
        headers: { 'content-type': 'application/json' },
      })
    },
  })
  await assert.rejects(client.call('saveSession', request), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 409)
    assert.equal(error.code, 'INVALID_INPUT')
    assert.deepEqual(error.issues, payload.issues)
    assert.ok(!error.message.includes('REVIEWED_TARGET_UNAVAILABLE'))
    return true
  })
  assert.equal(calls, 1)
  assert.equal(authChanges, 0)
  assert.deepEqual(request, before)
})
