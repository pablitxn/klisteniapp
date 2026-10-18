import { expect, type Page, type Request, type Response, type TestInfo } from '@playwright/test'

/** Positive setup transitions have one shared budget. Content and denial assertions
 * keep their own predicates; neither an HTTP response nor a page heading is readiness. */
export async function observeReadiness(
  page: Page,
  info: TestInfo,
  phase: string,
  assertReady: (remaining: () => number) => Promise<void>,
) {
  const started = performance.now()
  const budgetMs = 30_000
  const events: Array<{ event: string; endpoint: string; elapsedMs: number; status?: number }> = []
  const endpoint = (url: string) => {
    const path = new URL(url).pathname
    if (/\/occurrences\/[^/]+$/.test(path)) return 'occurrence-context'
    if (/\/sessions\/[^/]+\/revisions$/.test(path)) return 'session-revision'
    return path.match(
      /\/(context|bootstrap\/v2|access|continuity|sessions|legacy-assignments|week|occurrences|events)$/,
    )?.[1]
  }
  const record = (event: string, url: string, status?: number) => {
    const name = endpoint(url)
    if (name)
      events.push({
        event,
        endpoint: name,
        elapsedMs: Math.round(performance.now() - started),
        ...(status === undefined ? {} : { status }),
      })
  }
  const response = (value: Response) => record('response', value.url(), value.status())
  const finished = (value: Request) => record('requestfinished', value.url())
  const failed = (value: Request) => record('requestfailed', value.url())
  page.on('response', response)
  page.on('requestfinished', finished)
  page.on('requestfailed', failed)
  let ready = false
  const remaining = () => {
    const value = budgetMs - (performance.now() - started)
    if (value <= 0) throw new Error(`Readiness phase ${phase} exceeded its ${budgetMs} ms budget`)
    return value
  }
  try {
    await assertReady(remaining)
    remaining()
    ready = true
  } finally {
    page.off('response', response)
    page.off('requestfinished', finished)
    page.off('requestfailed', failed)
    await info.attach(`product-readiness-${phase}`, {
      body: Buffer.from(
        JSON.stringify({
          phase,
          ready,
          budgetMs,
          elapsedMs: Math.round(performance.now() - started),
          events,
          qualification:
            'Response events do not imply body completion; requestfinished does not imply rendered UI. Only the named UI predicates establish readiness.',
        }),
      ),
      contentType: 'application/json',
    })
  }
}

/** For a fresh positive admission only; never use this to assert revocation or reconnect. */
export async function waitForWorkspaceReady(
  page: Page,
  info: TestInfo,
  selectContext?: (remaining: () => number) => Promise<void>,
) {
  await observeReadiness(page, info, 'workspace-admission', async (remaining) => {
    await selectContext?.(remaining)
    await expect(
      page.getByRole('navigation', { name: 'Secciones del gimnasio', exact: true }),
    ).toBeVisible({ timeout: remaining() })
    await expect(page.getByText('Verificando tu acceso actual…', { exact: true })).toHaveCount(0, {
      timeout: remaining(),
    })
  })
}

/** A history heading can render before every linked occurrence context has loaded. */
export async function waitForHistoryReady(page: Page, info: TestInfo) {
  await observeReadiness(page, info, 'history-data', async (remaining) => {
    await expect(
      page.getByRole('navigation', { name: 'Secciones del gimnasio', exact: true }),
    ).toBeVisible({ timeout: remaining() })
    await expect(
      page.getByRole('heading', { name: 'Mi rutina e historial', exact: true }),
    ).toBeVisible({ timeout: remaining() })
    await expect(
      page.getByRole('region', { name: 'Continuidad de la rutina', exact: true }),
    ).toBeVisible({ timeout: remaining() })
    await expect(
      page.getByRole('region', { name: 'Sesiones realizadas', exact: true }),
    ).toBeVisible({ timeout: remaining() })
    await expect(page.getByRole('status').filter({ hasText: 'Cargando historial…' })).toHaveCount(
      0,
      { timeout: remaining() },
    )
    await expect(page.locator('.routine-history [role="alert"]')).toHaveCount(0, {
      timeout: remaining(),
    })
  })
}

export async function reloadHistory(page: Page, info: TestInfo) {
  await page.reload()
  await waitForHistoryReady(page, info)
}

export async function waitForWeekReady(page: Page, info: TestInfo, week: string, zone: string) {
  await observeReadiness(page, info, 'selected-week-data', async (remaining) => {
    await expect(
      page.getByRole('combobox', { name: 'Zona horaria de la inscripción', exact: true }),
    ).toHaveValue(zone, { timeout: remaining() })
    await expect(
      page.getByRole('heading', { name: `Semana del ${week}`, exact: true }),
    ).toBeVisible({ timeout: remaining() })
    await expect(page.getByRole('status').filter({ hasText: 'Cargando calendario…' })).toHaveCount(
      0,
      { timeout: remaining() },
    )
    await expect(page.locator('.routine-history [role="alert"]')).toHaveCount(0, {
      timeout: remaining(),
    })
  })
}
