import assert from 'node:assert/strict'
import test from 'node:test'
import { WebsiteInputSchema } from '@klisteniapp/b2b-contracts'
import { editorDraftKey, writeEditorDraft } from '../src/shared/editor/editorDraftStorage.ts'
import {
  discardSavedWebsiteCopy,
  normalizeWebsiteDraft,
  readWebsiteCopy,
} from '../src/features/website/websiteDraft.ts'

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
const website = WebsiteInputSchema.parse({ headline: 'My gym' })

test('website recovery keeps unfinished activity, hour and floor-plan labels without allowing publication', () => {
  const unfinished = {
    ...website,
    activities: [{ id: 'a', name: '', description: 'Retain this', schedule: '' }],
    openingHours: [{ id: 'h', days: ' ', hours: '' }],
    floorPlan: {
      title: '',
      description: 'Precise orientation notes',
      image: { id: 'image', kind: 'image', url: '/models/plan.png', label: 'Map', attribution: '' },
      points: [{ unitId: 'unit', x: 25, y: 75 }],
    },
  }
  assert.deepEqual(normalizeWebsiteDraft(unfinished), unfinished)
  assert.equal(WebsiteInputSchema.safeParse(unfinished).success, false)
  assert.equal(
    normalizeWebsiteDraft({
      ...unfinished,
      floorPlan: { ...unfinished.floorPlan, points: [{ unitId: 'unit', x: 125, y: 75 }] },
    }),
    null,
  )
  assert.equal(normalizeWebsiteDraft({ ...unfinished, activities: [null] }), null)
})

test('website copies retain their original revision across reloads and isolate account/gym identities', () => {
  const device = storage()
  const key = editorDraftKey('account', 'gym', 'website', 'website')
  writeEditorDraft(device, key, website, 7)
  assert.deepEqual(readWebsiteCopy(device, key, 'legacy'), {
    version: 1,
    revision: 7,
    value: website,
  })
  for (const other of [
    editorDraftKey('other', 'gym', 'website', 'website'),
    editorDraftKey('account', 'other', 'website', 'website'),
  ])
    assert.equal(readWebsiteCopy(device, other, 'absent'), null)
  const old = { ...website } as Partial<typeof website>
  delete old.floorPlan
  delete old.spatialModel
  device.setItem('legacy', JSON.stringify(old))
  assert.deepEqual(readWebsiteCopy(device, 'empty', 'legacy'), {
    version: 1,
    revision: null,
    value: website,
  })
  // A current malformed copy must not silently resurrect an unrelated older one.
  device.setItem(key, '{broken')
  assert.equal(readWebsiteCopy(device, key, 'legacy'), null)
})

test('a saved website removes only its exact copy, never newer local edits or a new source revision', () => {
  const device = storage(),
    key = 'website'
  const sent = { version: 1 as const, revision: 7, value: website }
  writeEditorDraft(device, key, { ...website, introduction: 'More recent edit' }, 7)
  discardSavedWebsiteCopy(device, key, sent)
  assert.ok(device.getItem(key))
  writeEditorDraft(device, key, website, 8)
  discardSavedWebsiteCopy(device, key, sent)
  assert.ok(device.getItem(key))
  writeEditorDraft(device, key, website, 7)
  discardSavedWebsiteCopy(device, key, sent)
  assert.equal(device.getItem(key), null)
})

test('branch website recovery cannot import a legacy unscoped copy or another branch draft', () => {
  const device = storage()
  const center = editorDraftKey('person', 'brand', 'website', 'website', 'center', 'admin')
  const north = editorDraftKey('person', 'brand', 'website', 'website', 'north', 'admin')
  device.setItem('legacy', JSON.stringify({ ...website, headline: 'Unscoped private copy' }))
  writeEditorDraft(device, center, { ...website, headline: 'Centro' }, 3)
  assert.equal(readWebsiteCopy(device, north, null), null)
  assert.equal(readWebsiteCopy(device, center, null)?.value.headline, 'Centro')
})
