import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'
import { legacyAdoptionFixture } from './legacyAdoptionFixture.ts'

let vite: ViteDevServer
before(async () => {
  vite = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: 'custom',
    logLevel: 'error',
  })
})
after(async () => {
  await vite?.close()
})
async function component(name: string, exportName: string, props: Record<string, unknown>) {
  const module = await vite.ssrLoadModule(`/src/features/programs/legacy-adoption/${name}.tsx`)
  return renderToStaticMarkup(
    createElement(module[exportName] as ComponentType<Record<string, unknown>>, props),
  )
}
test('review labels all original scalars, manual provenance and hash while incomplete confirmation blocks submit', async () => {
  const { preview } = legacyAdoptionFixture()
  const html = await component('LegacyAdoptionReview', 'LegacyAdoptionReview', {
    preview,
    onSubmit: async () => {},
    onRefresh: () => {},
  })
  for (const label of [
    'Series originales',
    'Repeticiones originales',
    'Duración original',
    'Carga original',
    'Descanso original',
    'RPE original',
    'manual-variant',
    preview.sourceSnapshotHash,
  ])
    assert.ok(html.includes(label), label)
  assert.match(html, /disabled="">Guardar revisión explícita/)
  assert.equal([...html.matchAll(/value="" selected=""/g)].length, 5)
  assert.match(html, /No acreditan relaciones revisadas/)
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  assert.equal(new Set(ids).size, ids.length)
  for (const [, id] of html.matchAll(/\bfor="([^"]+)"/g)) assert.ok(ids.includes(id), id)
})
test('foreign or inactive access hides original source before any preview request', async () => {
  const { access, assignment } = legacyAdoptionFixture()
  let calls = 0
  const html = await component('LegacyAdoption', 'LegacyAdoption', {
    accountId: 'foreign',
    access,
    accessKey: 'scope',
    assignment,
    contextSignal: new AbortController().signal,
    createClient: () => {
      calls++
      throw new Error('Forbidden client call')
    },
    onAdopted: async () => {},
    onClose: () => {},
  })
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /Legacy routine|Original source notes/)
  assert.equal(calls, 0)
})
test('assignment picker refuses a revoked lifetime or member role without reading protected lists', async () => {
  const { access } = legacyAdoptionFixture()
  const controller = new AbortController()
  controller.abort()
  const html = await component('LegacyAdoptionAssignments', 'LegacyAdoptionAssignments', {
    accountId: 'coach',
    branchId: 'center',
    access,
    accessKey: 'scope',
    contextSignal: controller.signal,
    createClient: () => {
      throw new Error('Forbidden list call')
    },
    onClose: () => {},
  })
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /Persona de esta sede/)
})
