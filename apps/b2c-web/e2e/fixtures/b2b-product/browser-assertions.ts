import { expect, type Page, type TestInfo } from '@playwright/test'
import { readFileSync } from 'node:fs'

type Scenario = { id: string; layer: string; target: string; testTitle: string }
const inventory = JSON.parse(
  readFileSync(new URL('./scenarios.json', import.meta.url), 'utf8'),
) as {
  scenarios: Scenario[]
}

/** Final specs use the reserved ID/title so evidence cannot drift from the plan. */
export function scenarioTitle(id: string): string {
  const scenario = inventory.scenarios.find((candidate) => candidate.id === id)
  if (!scenario || scenario.layer !== 'browser') throw new Error(`Unknown browser scenario ${id}`)
  return scenario.testTitle
}

/** Call after every meaningful route/state transition, alongside semantic assertions. */
export async function assertProductViewport(page: Page, info: TestInfo) {
  const viewport = page.viewportSize()
  expect([
    { width: 320, height: 740 },
    { width: 430, height: 932 },
    { width: 1440, height: 1000 },
  ]).toContainEqual(viewport)
  expect(['chromium', 'webkit']).toContain(info.project.use.browserName)
  if (viewport!.width < 1440) {
    expect(info.project.use.hasTouch).toBe(true)
    expect(info.project.use.isMobile).toBe(true)
  }
  try {
    await expect
      .poll(async () =>
        page.evaluate(
          (width) =>
            innerWidth === width &&
            document.documentElement.scrollWidth <= width &&
            document.body.scrollWidth <= width,
          viewport!.width,
        ),
      )
      .toBe(true)
  } catch (error) {
    if (!page.isClosed()) {
      const measured = await page
        .evaluate(() => ({
          innerWidth,
          scrollX,
          visualViewport: visualViewport
            ? {
                width: visualViewport.width,
                offsetLeft: visualViewport.offsetLeft,
                pageLeft: visualViewport.pageLeft,
                scale: visualViewport.scale,
              }
            : null,
          documentWidth: document.documentElement.scrollWidth,
          documentClientWidth: document.documentElement.clientWidth,
          bodyWidth: document.body.scrollWidth,
          bodyClientWidth: document.body.clientWidth,
          internalOverflow: Array.from(document.querySelectorAll('body *'))
            .filter((node) => node.scrollWidth > node.clientWidth + 0.5)
            .slice(0, 30)
            .map((node) => ({
              tag: node.tagName,
              id: node.id,
              role: node.getAttribute('role'),
              clientWidth: node.clientWidth,
              scrollWidth: node.scrollWidth,
              width: node.getBoundingClientRect().width,
              overflowX: getComputedStyle(node).overflowX,
              minWidth: getComputedStyle(node).minWidth,
            })),
          overflowing: Array.from(document.querySelectorAll('body *'))
            .flatMap((node) => {
              const bounds = node.getBoundingClientRect()
              return bounds.right > innerWidth + 0.5
                ? [
                    {
                      tag: node.tagName,
                      id: node.id,
                      role: node.getAttribute('role'),
                      right: bounds.right,
                      width: bounds.width,
                      minWidth: getComputedStyle(node).minWidth,
                      text: node.textContent?.slice(0, 100),
                    },
                  ]
                : []
            })
            .slice(0, 20),
        }))
        .catch(() => ({ unavailable: 'Page departed while collecting diagnostic measurements' }))
      await info.attach('actual-viewport-measurements', {
        body: JSON.stringify(measured, null, 2),
        contentType: 'application/json',
      })
    }
    throw error
  }
}

/** Screenshots supplement assertions and contain only task-owned synthetic data. */
export async function captureProductState(page: Page, info: TestInfo, id: string) {
  scenarioTitle(id)
  await assertProductViewport(page, info)
  const path = info.outputPath(`${id}.png`)
  await page.screenshot({ path, fullPage: true, animations: 'disabled' })
  await info.attach(id, { path, contentType: 'image/png' })
}
