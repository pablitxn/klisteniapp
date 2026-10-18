import { readFile } from 'node:fs/promises'
import type { EventEmitter } from 'node:events'
import { expect, test, type Page, type TestInfo } from '@playwright/test'
import {
  observeReadiness,
  waitForHistoryReady,
  waitForWorkspaceReady,
} from '../fixtures/b2b-product/readiness'

const observedEvents = ['response', 'requestfinished', 'requestfailed'] as const

// Observe the real Page emitter without replacing the helper's event methods.
function listeners(page: Page) {
  const emitter = page as Page & Pick<EventEmitter, 'listeners'>
  return observedEvents.map((event) => emitter.listeners(event))
}

async function observation(info: TestInfo, phase: string) {
  const attachments = info.attachments.filter(
    (attachment) => attachment.name === `product-readiness-${phase}`,
  )
  expect(attachments).toHaveLength(1)
  const attachment = attachments[0]!
  const body = attachment.body ?? (await readFile(attachment.path!))
  return JSON.parse(body.toString()) as {
    phase: string
    ready: boolean
    budgetMs: number
    elapsedMs: number
  }
}

test('positive workspace admission accepts navigation rendered after five seconds', async ({
  page,
}, info) => {
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <p id="checking">Verificando tu acceso actual…</p>
    <button id="admit">Begin delayed admission</button>
    <script>
      document.getElementById('admit').onclick = () => {
        setTimeout(() => {
          document.body.insertAdjacentHTML('beforeend',
            '<nav aria-label="Secciones del gimnasio">Synthetic navigation</nav>');
        }, 5300);
        setTimeout(() => document.getElementById('checking').remove(), 5600);
      };
    </script>`)
  const before = listeners(page)
  const ready = waitForWorkspaceReady(page, info)
  void ready.catch(() => {})
  await page.getByRole('button', { name: 'Begin delayed admission', exact: true }).click()
  await ready
  expect(listeners(page)).toEqual(before)
  await expect(page.getByRole('navigation', { name: 'Secciones del gimnasio' })).toBeVisible()
  await expect(page.getByText('Verificando tu acceso actual…', { exact: true })).toHaveCount(0)
  const receipt = await observation(info, 'workspace-admission')
  expect(receipt).toMatchObject({
    phase: 'workspace-admission',
    ready: true,
    budgetMs: 30_000,
  })
  expect(receipt.elapsedMs).toBeGreaterThan(5000)
})

test('history waits for semantic regions, loading completion and absence of alerts', async ({
  page,
}, info) => {
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <nav aria-label="Secciones del gimnasio">Synthetic navigation</nav>
    <main class="routine-history">
      <h1>Mi rutina e historial</h1>
      <p id="loading" role="status">Cargando historial…</p>
      <p id="problem" role="alert">Synthetic pending history error</p>
    </main>
    <button id="continuity">Render continuity</button>
    <button id="sessions">Render sessions</button>
    <button id="loaded">Finish history load</button>
    <button id="clear">Clear history error</button>
    <script>
      const main = document.querySelector('main');
      document.getElementById('continuity').onclick = () => setTimeout(() =>
        main.insertAdjacentHTML('beforeend',
          '<section aria-label="Continuidad de la rutina">Synthetic continuity</section>'), 50);
      document.getElementById('sessions').onclick = () => setTimeout(() =>
        main.insertAdjacentHTML('beforeend',
          '<section aria-label="Sesiones realizadas">Synthetic sessions</section>'), 50);
      document.getElementById('loaded').onclick = () => setTimeout(() =>
        document.getElementById('loading').remove(), 50);
      document.getElementById('clear').onclick = () => setTimeout(() =>
        document.getElementById('problem').remove(), 50);
    </script>`)
  const before = listeners(page)
  let settled = false
  const ready = waitForHistoryReady(page, info).finally(() => {
    settled = true
  })
  void ready.catch(() => {}) // Preserve rejection for the awaited assertion below.
  await expect(page.getByRole('heading', { name: 'Mi rutina e historial' })).toBeVisible()
  expect(settled, 'A heading alone does not establish history readiness').toBe(false)
  await page.getByRole('button', { name: 'Render continuity', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Continuidad de la rutina' })).toBeVisible()
  expect(settled, 'Both semantic regions are required').toBe(false)
  await page.getByRole('button', { name: 'Render sessions', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toBeVisible()
  expect(settled, 'Rendered regions with history still loading are insufficient').toBe(false)
  await page.getByRole('button', { name: 'Finish history load', exact: true }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
  expect(settled, 'A history error must not be treated as positive readiness').toBe(false)
  await page.getByRole('button', { name: 'Clear history error', exact: true }).click()
  await ready
  expect(listeners(page)).toEqual(before)
  expect(await observation(info, 'history-data')).toMatchObject({ ready: true, budgetMs: 30_000 })
})

test('a predicate failure propagates unchanged and removes its observation listeners', async ({
  page,
}, info) => {
  const before = listeners(page)
  const failure = new Error('Synthetic readiness predicate failure')
  let caught: unknown
  try {
    await observeReadiness(page, info, 'predicate-failure', async () => {
      throw failure
    })
  } catch (error) {
    caught = error
  }
  expect(caught).toBe(failure)
  expect(listeners(page)).toEqual(before)
  expect(await observation(info, 'predicate-failure')).toMatchObject({
    ready: false,
    budgetMs: 30_000,
  })
})

test('history has one thirty-second budget across delayed predicates and retains timeout failure', async ({
  page,
}, info) => {
  await page.setContent(`<!doctype html><meta charset="utf-8">
    <main class="routine-history"><p role="status">Cargando historial…</p></main>
    <script>
      setTimeout(() => document.body.insertAdjacentHTML('afterbegin',
        '<nav aria-label="Secciones del gimnasio">Synthetic navigation</nav>'), 8000);
      setTimeout(() => document.querySelector('main').insertAdjacentHTML('afterbegin',
        '<h1>Mi rutina e historial</h1>'), 16000);
      setTimeout(() => document.querySelector('main').insertAdjacentHTML('beforeend',
        '<section aria-label="Continuidad de la rutina">Synthetic continuity</section>' +
        '<section aria-label="Sesiones realizadas">Synthetic sessions</section>'), 24000);
    </script>`)
  const before = listeners(page)
  let caught: unknown
  try {
    await waitForHistoryReady(page, info)
  } catch (error) {
    caught = error
  }
  expect(caught).toBeInstanceOf(Error)
  expect(String(caught)).toContain('Cargando historial')
  expect(listeners(page)).toEqual(before)
  const receipt = await observation(info, 'history-data')
  expect(receipt).toMatchObject({ ready: false, budgetMs: 30_000 })
  expect(receipt.elapsedMs).toBeGreaterThanOrEqual(29_000)
  expect(receipt.elapsedMs).toBeLessThan(36_000)
})
