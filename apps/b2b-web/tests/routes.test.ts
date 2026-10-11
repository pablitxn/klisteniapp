import assert from 'node:assert/strict'
import test from 'node:test'
import { compatiblePath, managementPageAllowed, resolveRoute } from '../src/routes.ts'

test('gym management URLs migrate without claiming the owner console name', () => {
  assert.equal(compatiblePath('/backoffice/people'), '/manage/people')
  assert.deepEqual(resolveRoute('/backoffice/people'), { kind: 'management', page: 'people' })
  assert.equal(resolveRoute('/backoffice-other').kind, 'notFound')
})

test('direct section routes distinguish public, member and professional views', () => {
  assert.deepEqual(resolveRoute('/app/catalog'), { kind: 'member', page: 'catalog' })
  assert.deepEqual(resolveRoute('/manage/catalog/'), { kind: 'management', page: 'catalog' })
  assert.deepEqual(resolveRoute('/g/atlas/units/cable-01'), {
    kind: 'gym',
    slug: 'atlas',
    unitId: 'cable-01',
  })
  assert.equal(resolveRoute('/app/invite').kind, 'invitation')
  for (const path of ['/manage/nope', '/app/nope', '/app/toString', '/g/%ZZ', '/owner'])
    assert.equal(resolveRoute(path).kind, 'notFound')
})

test('direct URLs cannot grant professional or administrator capabilities', () => {
  assert.equal(managementPageAllowed('programs', 'coach'), true)
  assert.equal(managementPageAllowed('whiteLabel', 'coach'), false)
  assert.equal(managementPageAllowed('website', 'member'), false)
  assert.equal(managementPageAllowed('whiteLabel', 'admin'), true)
})
