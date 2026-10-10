import assert from 'node:assert/strict'
import test from 'node:test'
import { editorDraftKey, readEditorDraft, writeEditorDraft } from '../src/editorDraftStorage.ts'

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}
const validate = (value: unknown): value is { name: string } =>
  Boolean(value && typeof value === 'object' && 'name' in value && typeof value.name === 'string')

test('unfinished content keeps its exact source revision and remains isolated by account, gym, editor and entity', () => {
  const session = storage(),
    key = editorDraftKey('coach', 'atlas', 'exercise', 'new')
  writeEditorDraft(session, key, { name: '' }, 7)
  assert.deepEqual(readEditorDraft(session, key, validate), {
    version: 1,
    revision: 7,
    value: { name: '' },
  })
  for (const other of [
    editorDraftKey('admin', 'atlas', 'exercise', 'new'),
    editorDraftKey('coach', 'sur', 'exercise', 'new'),
    editorDraftKey('coach', 'atlas', 'program', 'new'),
    editorDraftKey('coach', 'atlas', 'exercise', 'saved'),
  ])
    assert.equal(readEditorDraft(session, other, validate), null)
  assert.notEqual(
    editorDraftKey('a.b', 'c', 'exercise', 'new'),
    editorDraftKey('a', 'b.c', 'exercise', 'new'),
  )
  session.removeItem(key)
  assert.equal(readEditorDraft(session, key, validate), null)
})
test('corrupt, incompatible or unversioned drafts cannot be recovered', () => {
  const session = storage(),
    key = 'copy'
  for (const invalid of [
    '{',
    'null',
    '{}',
    JSON.stringify({ version: 2, revision: 1, value: { name: 'Text' } }),
    JSON.stringify({ version: 1, revision: -1, value: { name: 'Text' } }),
    JSON.stringify({ version: 1, revision: 1, value: { name: 10 } }),
  ]) {
    session.setItem(key, invalid)
    assert.equal(readEditorDraft(session, key, validate), null)
  }
  writeEditorDraft(session, key, { name: 'New' }, null)
  assert.equal(readEditorDraft(session, key, validate)?.revision, null)
})
test('storage read failures are recoverable while failed writes are surfaced to the editor', () => {
  const blocked = {
    getItem: () => {
      throw new Error('Blocked')
    },
    setItem: () => {
      throw new Error('Quota')
    },
    removeItem: () => {},
  }
  assert.equal(readEditorDraft(blocked, 'copy', validate), null)
  assert.throws(
    () => writeEditorDraft(blocked, 'copy', { name: 'Still in React state' }, 3),
    /Quota/,
  )
})
