import { readFileSync } from 'node:fs'
import {
  api,
  operation,
  expect,
  open,
  type Principal,
  type Page,
  type ProductFixture,
  type TestInfo,
} from './app-fixture'
export function healthFile() {
  const file = JSON.parse(
    readFileSync(new URL('./health/synthetic-v1.json', import.meta.url), 'utf8'),
  )
  const suffix = operation()
  for (const records of Object.values(file.records) as Array<
    Array<{ id: string; source: { externalId: string } }>
  >) {
    for (const record of records) {
      record.id += suffix
      record.source.externalId += suffix
    }
  }
  return {
    raw: JSON.stringify(file),
    marker: file.records.measurements[0].source.externalId as string,
  }
}
export async function privateHealth(page: Page, owner: Principal) {
  const consents = await api(page, owner, 'healthConsents', {})
  for (const consent of consents.filter(
    (item) => item.status === 'active' && item.scope.branchId === owner.branchId,
  )) {
    await api(page, owner, 'revokeHealthConsent', {
      id: consent.id,
      expectedRevision: consent.revision,
      operationId: operation(),
    })
  }
}
export async function importThroughUi(
  page: Page,
  product: ProductFixture,
  info: TestInfo,
  owner: Principal,
) {
  await privateHealth(page, owner)
  await open(page, product, info, 'health')
  // Bounded outer-stream readmission can outlast the default assertion window.
  await expect(page.getByRole('heading', { name: 'Mi salud y privacidad' })).toBeVisible({
    timeout: 30_000,
  })
  const file = healthFile()
  await expect(page.getByLabel('Archivo JSON', { exact: true })).toBeEnabled()
  await page.getByLabel('Archivo JSON', { exact: true }).setInputFiles({
    name: 'synthetic.json',
    mimeType: 'application/json',
    buffer: Buffer.from(file.raw),
  })
  await expect(page.getByRole('heading', { name: 'Vista previa de importación' })).toBeVisible()
  const confirm = page.getByRole('button', { name: 'Confirmar importación', exact: true })
  await expect(confirm).toBeEnabled()
  const write = page.waitForRequest(
    (r) => r.method() === 'POST' && new URL(r.url()).pathname.endsWith('/health/import'),
  )
  await confirm.click()
  expect((await write).postDataJSON()).toMatchObject({
    format: 'klisteniapp.health',
    version: 1,
    raw: file.raw,
  })
  await expect
    .poll(async () => JSON.stringify((await api(page, owner, 'ownHealth', {})).data))
    .toContain(file.marker)
  const accepted = await api(page, owner, 'ownHealth', {})
  await expect(
    page.getByText(new RegExp(`Revisión de tus datos: ${accepted.revision}\\.`)),
  ).toBeVisible()
  return file
}
export async function grantThroughUi(page: Page, owner: Principal) {
  const panel = page.getByRole('heading', { name: 'Permisos de salud', exact: true }).locator('..')
  await panel.getByRole('checkbox', { name: 'Medidas', exact: true }).check()
  await panel.getByRole('checkbox', { name: /Entiendo el público dinámico/ }).check()
  const submitted = page.waitForRequest(
    (r) => r.method() === 'POST' && /\/health\/consents\/[^/]+$/.test(new URL(r.url()).pathname),
  )
  await panel
    .getByRole('button', { name: /Autorizar estas categorías|Reemplazar categorías autorizadas/ })
    .click()
  const input = (await submitted).postDataJSON()
  expect(input).toMatchObject({
    categories: ['measurements'],
    audience: 'current-authorized-branch-trainers',
    disclosureVersion: 1,
  })
  // A committed consent notification may cancel its own guarded response.
  // Require both real server state and the actual UI after revalidation.
  await expect
    .poll(async () => (await api(page, owner, 'healthConsents', {})).find((c) => c.id === input.id))
    .toMatchObject({
      status: 'active',
      categories: ['measurements'],
      scope: { organizationId: owner.organization.id, branchId: owner.branchId },
    })
  await expect(
    page.getByRole('status').filter({ hasText: 'Compartís en esta sede: Medidas.' }),
  ).toBeVisible()
}
