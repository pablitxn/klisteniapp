import assert from 'node:assert/strict'
import test from 'node:test'
import { ThemeInputSchema } from '@klisteniapp/b2b-contracts'
import { isThemeDraft } from '../src/features/organization/themeDraft.ts'
import {
  editorDraftKey,
  readEditorDraft,
  writeEditorDraft,
} from '../src/shared/editor/editorDraftStorage.ts'

test('unfinished branding remains recoverable without making invalid URLs publishable', () => {
  const theme = ThemeInputSchema.parse({ brand: { name: 'QA' } })
  const unfinished = {
    ...theme,
    brand: { ...theme.brand, name: '', logoUrl: 'https://' },
    heroImageUrl: 'https://',
  }
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
  const key = editorDraftKey('admin', 'atlas', 'theme', 'brand', 'centro', 'admin')
  writeEditorDraft(storage, key, unfinished, 7)
  assert.deepEqual(readEditorDraft(storage, key, isThemeDraft), {
    version: 1,
    revision: 7,
    value: unfinished,
  })
  assert.equal(ThemeInputSchema.safeParse(unfinished).success, false)
  assert.equal(
    readEditorDraft(
      storage,
      editorDraftKey('other-admin', 'atlas', 'theme', 'brand', 'centro', 'admin'),
      isThemeDraft,
    ),
    null,
  )
  assert.equal(isThemeDraft({ ...theme, brand: { ...theme.brand, logoUrl: null } }), false)
})

test('branch recovery accepts unfinished timezone and name without changing its revision or owner', async () => {
  const { isBranchDraft } = await import('../src/features/organization/branchDraft.ts')
  const draft = {
    name: '',
    address: 'Trabajo sin guardar',
    contact: '',
    timezone: 'America/',
    status: 'active',
  }
  assert.equal(isBranchDraft(draft), true)
  assert.equal(isBranchDraft({ ...draft, status: 'deleted' }), false)
  assert.equal(isBranchDraft({ ...draft, address: null }), false)
  assert.notEqual(
    editorDraftKey('admin', 'atlas', 'branch', 'norte', 'centro', 'admin'),
    editorDraftKey('admin', 'atlas', 'branch', 'norte', 'norte', 'admin'),
  )
})
