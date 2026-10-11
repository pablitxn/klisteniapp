import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialResourceState, resourceReducer } from '../src/resource-state.ts'

test('changing data owner clears old data while same-owner refresh preserves the editor', () => {
  let state = initialResourceState<string>('gym-a')
  state = resourceReducer(state, { type: 'start', key: 'gym-a', requestId: 1 })
  state = resourceReducer(state, { type: 'success', key: 'gym-a', requestId: 1, data: 'private-a' })
  state = resourceReducer(state, { type: 'start', key: 'gym-a', requestId: 2 })
  assert.equal(state.data, 'private-a')
  state = resourceReducer(state, { type: 'start', key: 'gym-b', requestId: 3 })
  assert.equal(state.data, null)
})

test('late success and rejection cannot replace the latest request or another owner', () => {
  let state = initialResourceState<string>('gym-b')
  state = resourceReducer(state, { type: 'start', key: 'gym-b', requestId: 2 })
  state = resourceReducer(state, { type: 'success', key: 'gym-b', requestId: 2, data: 'current' })
  assert.equal(
    resourceReducer(state, { type: 'success', key: 'gym-a', requestId: 1, data: 'stale' }),
    state,
  )
  assert.equal(
    resourceReducer(state, {
      type: 'failure',
      key: 'gym-b',
      requestId: 1,
      error: 'old failure',
      clearData: true,
    }),
    state,
  )
})

test('temporary failures retain existing data; authorization loss clears it', () => {
  let state = initialResourceState<string>('gym')
  state = resourceReducer(state, { type: 'start', key: 'gym', requestId: 1 })
  state = resourceReducer(state, { type: 'success', key: 'gym', requestId: 1, data: 'visible' })
  state = resourceReducer(state, { type: 'start', key: 'gym', requestId: 2 })
  state = resourceReducer(state, {
    type: 'failure',
    key: 'gym',
    requestId: 2,
    error: 'offline',
    clearData: false,
  })
  assert.equal(state.data, 'visible')
  state = resourceReducer(state, { type: 'start', key: 'gym', requestId: 3 })
  state = resourceReducer(state, {
    type: 'failure',
    key: 'gym',
    requestId: 3,
    error: 'revoked',
    clearData: true,
  })
  assert.equal(state.data, null)
  assert.equal(state.error, 'revoked')
  assert.equal(state.loading, false)
})
