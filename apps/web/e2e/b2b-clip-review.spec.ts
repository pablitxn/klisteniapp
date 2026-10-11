import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Media } from '../../../packages/b2b-contracts/src/index.ts'

test('a private clip comparison recovers review notes and exports exact asset identities without publishing', async ({
  page,
}) => {
  // The UI contract is exercised with known metadata. This does not certify
  // video playback or the educational quality of any real generated clip.
  const reference: Media = {
    id: 'reference-video',
    kind: 'video',
    url: '/private/reference.mp4',
    label: 'Referencia con permiso',
    attribution: 'Grabación propia autorizada',
    mime: 'video/mp4',
    bytes: 2048,
    sha256: 'a'.repeat(64),
    createdAt: '2026-10-11T00:00:00Z',
  }
  const generated: Media = {
    ...reference,
    id: 'generated-video',
    url: '/private/generated.mp4',
    label: 'Candidato generado para comparar',
    sha256: 'b'.repeat(64),
  }
  await page.route('**/api/b2b/orgs/atlas-demo/media', async (route) => {
    if (route.request().method() !== 'GET') return route.continue()
    await route.fulfill({
      json: { media: [reference, generated], usage: { bytes: 4096, quotaBytes: 1_048_576 } },
    })
  })
  let writes = 0
  page.on('request', (request) => {
    if (
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
      request.url().includes('/orgs/')
    )
      writes += 1
  })
  await page.goto('/backoffice/')
  await page.getByLabel('Email', { exact: true }).fill('admin@atlas.example.test')
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await page.getByRole('button', { name: 'Archivos', exact: true }).click()
  await page.getByText('Comparar un clip de referencia y uno generado', { exact: true }).click()
  await page.getByLabel('Ejercicio de la comparación', { exact: true }).fill('Sentadilla revisada')
  await page
    .getByLabel('Persona que revisa los clips', { exact: true })
    .fill('Responsable de revisión')
  await page.getByLabel('Clip de referencia autorizado', { exact: true }).selectOption(reference.id)
  await page.getByLabel('Clip generado para evaluar', { exact: true }).selectOption(generated.id)
  await page
    .getByLabel('Procedencia del clip de referencia', { exact: true })
    .fill('Grabación original del gimnasio, 2026-10-11')
  await page
    .getByLabel('Permiso de uso de la referencia', { exact: true })
    .fill('Permiso escrito conservado por el gimnasio')
  await page
    .getByLabel('Cómo se produjo el clip generado', { exact: true })
    .fill('Modelo y versión de prueba; indicaciones de ejemplo; material de entrada propio')
  await page
    .getByLabel('Permiso de uso del clip generado', { exact: true })
    .fill('Condiciones de uso revisadas para la evaluación interna')
  await page
    .getByRole('checkbox', {
      name: 'Verifiqué el permiso de uso de ambos clips para esta evaluación.',
      exact: true,
    })
    .check()
  for (const label of [
    'Movimiento y apoyos',
    'Fidelidad visual',
    'Claridad para aprender',
    'Alternativa al audio',
  ]) {
    await page.getByLabel(`Resultado: ${label}`, { exact: true }).selectOption('concerns')
    await page
      .getByLabel(`Observaciones: ${label}`, { exact: true })
      .fill('00:04 — revisar contacto con el suelo y comparar con la referencia.')
  }
  await page
    .getByLabel('Conclusión de la comparación', { exact: true })
    .selectOption('inconclusive')
  await page
    .getByLabel('Evidencia y próximos pasos', { exact: true })
    .fill('Requiere una segunda revisión técnica antes de proponer contenido al catálogo.')
  await page.reload()
  await page.getByRole('button', { name: 'Archivos', exact: true }).click()
  await page.getByText('Comparar un clip de referencia y uno generado', { exact: true }).click()
  await expect(page.getByLabel('Ejercicio de la comparación', { exact: true })).toHaveValue(
    'Sentadilla revisada',
  )
  await expect(page.getByLabel('Observaciones: Movimiento y apoyos', { exact: true })).toHaveValue(
    '00:04 — revisar contacto con el suelo y comparar con la referencia.',
  )
  const downloadEvent = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Descargar evaluación', exact: true }).click()
  const download = await downloadEvent
  const path = await download.path()
  expect(path).toBeTruthy()
  const review = JSON.parse(await readFile(path!, 'utf8'))
  expect(review.reference.sha256).toBe(reference.sha256)
  expect(review.generated.sha256).toBe(generated.sha256)
  expect(review.review.outcome).toBe('inconclusive')
  expect(review.publicationStatus).toBe('unchanged')
  expect(writes).toBe(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})
