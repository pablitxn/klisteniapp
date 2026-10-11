import assert from 'node:assert/strict'
import test from 'node:test'
import type { Media } from '@klisteniapp/b2b-contracts'
import {
  CLIP_CRITERIA,
  clipReviewKey,
  emptyClipReview,
  isClipReview,
  prepareClipReview,
  readClipReview,
  selectReviewClip,
} from '../src/features/media/clipReview.ts'

const reference: Media = {
  id: 'reference',
  kind: 'video',
  url: '/private/reference.mp4',
  label: 'Reference video',
  attribution: 'Authorized gym footage',
  mime: 'video/mp4',
  bytes: 1000,
  sha256: 'a'.repeat(64),
  createdAt: '2026-10-11T00:00:00Z',
}
const generated: Media = {
  ...reference,
  id: 'generated',
  url: '/private/generated.mp4',
  label: 'Generated video',
  sha256: 'b'.repeat(64),
}
const context = { orgId: 'atlas', accountId: 'reviewer', exportedAt: '2026-10-11T12:00:00Z' }
function completedReview() {
  const review = {
    ...emptyClipReview(),
    referenceId: reference.id,
    generatedId: generated.id,
    exercise: 'Squat',
    reviewer: 'Coach',
    referenceSource: 'Original filming session',
    referencePermission: 'Written permission held by gym',
    generatedProcess: 'Tool and model version, prompt, date',
    generatedPermission: 'Allowed by tool terms; own input footage',
    permissionsConfirmed: true,
    outcome: 'inconclusive' as const,
    summary: 'A second reviewer must verify the contact at 00:04.',
  }
  for (const { id } of CLIP_CRITERIA)
    review.criteria[id] = {
      rating: 'concerns',
      notes: 'At 00:04 verify contact between foot and floor.',
    }
  return review
}

test('clip comparisons select distinct authorized videos, never missing or foreign library assets', () => {
  const review = completedReview()
  assert.equal(prepareClipReview(review, [reference, generated], context).ok, true)
  for (const library of [
    [],
    [reference],
    [generated],
    [reference, { ...generated, kind: 'image' as const }],
    [reference, { ...generated, sha256: reference.sha256 }],
  ]) {
    assert.equal(prepareClipReview(review, library, context).ok, false)
  }
  assert.equal(
    prepareClipReview({ ...review, generatedId: reference.id }, [reference, generated], context).ok,
    false,
  )
})

test('review export requires documented rights, human evidence and conclusion; it never changes publication', () => {
  const review = completedReview()
  for (const patch of [
    { exercise: '' },
    { reviewer: '' },
    { referenceSource: '' },
    { generatedProcess: '' },
    { referencePermission: '' },
    { generatedPermission: '' },
    { permissionsConfirmed: false },
    { summary: '' },
    { outcome: 'pending' as const },
  ]) {
    assert.equal(
      prepareClipReview({ ...review, ...patch }, [reference, generated], context).ok,
      false,
    )
  }
  assert.equal(
    prepareClipReview(
      { ...review, criteria: emptyClipReview().criteria },
      [reference, generated],
      context,
    ).ok,
    false,
  )
  const result = prepareClipReview(review, [reference, generated], context)
  if (!result.ok) assert.fail(result.error)
  assert.equal(result.document.publicationStatus, 'unchanged')
  assert.equal(result.document.reference.sha256, reference.sha256)
  assert.equal(result.document.generated.sha256, generated.sha256)
  assert.equal(result.document.reviewerAccountId, context.accountId)
  assert.equal('url' in result.document.reference, false)
  assert.equal(reference.url, '/private/reference.mp4')
})

test('clip review drafts isolate accounts and gyms and reject malformed or oversized local data', () => {
  const values = new Map<string, string>()
  const storage = { getItem: (key: string) => values.get(key) ?? null }
  const key = clipReviewKey('reviewer', 'atlas')
  const review = completedReview()
  values.set(key, JSON.stringify(review))
  assert.deepEqual(readClipReview(storage, key), review)
  assert.equal(readClipReview(storage, clipReviewKey('reviewer', 'sur')), null)
  assert.equal(readClipReview(storage, clipReviewKey('other', 'atlas')), null)
  assert.notEqual(clipReviewKey('a.b', 'c'), clipReviewKey('a', 'b.c'))
  for (const raw of [
    '{',
    'null',
    '{}',
    JSON.stringify({ ...review, version: 2 }),
    JSON.stringify({ ...review, summary: 'x'.repeat(2001) }),
    JSON.stringify({ ...review, criteria: {} }),
    'x'.repeat(50_001),
  ]) {
    values.set(key, raw)
    assert.equal(readClipReview(storage, key), null)
  }
  assert.equal(isClipReview({ ...review, outcome: 'toString' }), false)
  assert.equal(
    readClipReview(
      {
        getItem: () => {
          throw new Error('Disabled')
        },
      },
      key,
    ),
    null,
  )
})

test('changing a clip preserves observations but invalidates prior judgments and permission claims', () => {
  const reviewed = completedReview()
  const replacement = { ...generated, id: 'replacement', sha256: 'c'.repeat(64) }
  const changed = selectReviewClip(reviewed, 'generatedId', replacement.id)
  assert.equal(changed.generatedProcess, '')
  assert.equal(changed.generatedPermission, '')
  assert.equal(changed.referenceSource, reviewed.referenceSource)
  assert.equal(changed.permissionsConfirmed, false)
  assert.equal(changed.outcome, 'pending')
  assert.equal(changed.criteria.movement.notes, reviewed.criteria.movement.notes)
  assert.equal(changed.criteria.movement.rating, 'pending')
  assert.equal(reviewed.criteria.movement.rating, 'concerns')
  assert.equal(prepareClipReview(changed, [reference, replacement], context).ok, false)
})
