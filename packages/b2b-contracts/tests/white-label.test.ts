import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BranchInputSchema,
  BranchGrantInputSchema,
  ThemeInputSchema,
  withHistoricalBranch,
} from '@klisteniapp/b2b-contracts/white-label'

test('WL branch grants have an explicit scope and never accept brand administration', () => {
  assert.equal(
    BranchGrantInputSchema.safeParse({
      userId: 'user',
      branchId: 'north',
      role: 'admin',
      active: true,
    }).success,
    false,
  )
  assert.equal(
    BranchGrantInputSchema.safeParse({
      userId: 'user',
      branchId: 'north',
      role: 'coach',
      active: true,
    }).success,
    true,
  )
  assert.equal(
    BranchGrantInputSchema.safeParse({
      userId: 'user',
      role: 'coach',
      active: true,
    }).success,
    false,
  )
})

test('WL theme and branch input allow only supported values and safe media', () => {
  assert.equal(
    BranchInputSchema.safeParse({
      name: 'North',
      slug: 'north',
      timezone: 'not-a-timezone',
    }).success,
    false,
  )
  assert.equal(BranchInputSchema.parse({ name: 'North', slug: 'north' }).timezone, 'UTC')
  const theme = ThemeInputSchema.parse({ brand: { name: 'Atlas' } })
  assert.equal(theme.layout, 'editorial')
  assert.equal(ThemeInputSchema.safeParse({ ...theme, css: 'body{display:none}' }).success, false)
  assert.equal(
    ThemeInputSchema.safeParse({
      ...theme,
      heroImageUrl: 'javascript:alert(1)',
    }).success,
    false,
  )
  assert.equal(
    ThemeInputSchema.safeParse({
      ...theme,
      font: 'https://untrusted.test/font.css',
    }).success,
    false,
  )
})

test('WL historical branch adapter copies relational context without modifying original JSON', () => {
  const snapshot = Object.freeze({
    name: 'Historical prescription',
    publicPath: '/g/atlas/units/u',
  })
  const result = withHistoricalBranch(snapshot, 'atlas-principal')
  assert.equal(result.branchId, 'atlas-principal')
  assert.deepEqual(snapshot, {
    name: 'Historical prescription',
    publicPath: '/g/atlas/units/u',
  })
  assert.throws(() => withHistoricalBranch(snapshot, '../sur'))
})
