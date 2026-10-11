import { expect, test, type Page } from '@playwright/test'
import type { Exercise, Me, Program } from '../../../packages/b2b-contracts/src/index.ts'

async function login(page: Page, role: 'admin' | 'coach') {
  await page.goto('/backoffice/')
  await page.getByLabel('Email', { exact: true }).fill(`${role}@atlas.example.test`)
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}
async function orgRequest(page: Page, path: string, data?: unknown) {
  const me = await page.request.get('/api/b2b/me'), identity = await me.json() as Me
  const response = await page.request.fetch(`/api/b2b/orgs/atlas-demo${path}`, { method: data ? 'PUT' : 'GET', headers: { Origin: new URL(page.url()).origin, 'X-Klisteni-B2B-Account': identity.user.id }, ...(data ? { data } : {}) })
  expect(response.ok()).toBeTruthy()
  return response
}
async function createEditor(page: Page, section: 'Ejercicios' | 'Rutinas') {
  await page.getByRole('button', { name: section, exact: true }).click()
  await page.getByRole('button', { name: section === 'Ejercicios' ? '+ Crear ejercicio' : '+ Crear rutina', exact: true }).click()
}
async function recover(page: Page) {
  await expect(page.getByRole('button', { name: 'Recuperar borrador local', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Recuperar borrador local', exact: true }).click()
}

test('exercise drafts survive navigation and reload, clear on save/discard, and resolve a real 409 explicitly', async ({ page }) => {
  await login(page, 'admin')
  await createEditor(page, 'Ejercicios')
  await page.getByLabel('Nombre del ejercicio', { exact: true }).fill('Ejercicio recuperable')
  await page.getByLabel('Instrucciones paso a paso', { exact: true }).fill('Ajustar el asiento.\nMantener el recorrido controlado.')
  await page.getByLabel('Modelo de máquina principal', { exact: true }).selectOption('base-cable-station-v1')
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await createEditor(page, 'Ejercicios')
  await expect(page.getByLabel('Nombre del ejercicio', { exact: true })).toBeDisabled()
  await recover(page)
  await expect(page.getByLabel('Nombre del ejercicio', { exact: true })).toHaveValue('Ejercicio recuperable')
  await page.reload()
  await createEditor(page, 'Ejercicios')
  await recover(page)
  await expect(page.getByLabel('Instrucciones paso a paso', { exact: true })).toHaveValue('Ajustar el asiento.\nMantener el recorrido controlado.')
  await expect(page.getByLabel('Modelo de máquina principal', { exact: true })).toHaveValue('base-cable-station-v1')
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Borrador guardado')
  await page.getByRole('button', { name: 'Volver al catálogo', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear ejercicio', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Recuperar borrador local', exact: true })).not.toBeVisible()
  await page.getByLabel('Nombre del ejercicio', { exact: true }).fill('Copia descartable')
  await page.getByRole('button', { name: 'Volver al catálogo', exact: true }).click()
  await page.getByRole('button', { name: '+ Crear ejercicio', exact: true }).click()
  await page.getByRole('button', { name: 'Descartar copia local', exact: true }).click()
  await expect(page.getByLabel('Nombre del ejercicio', { exact: true })).toHaveValue('')
  await page.reload()
  await createEditor(page, 'Ejercicios')
  await expect(page.getByRole('button', { name: 'Recuperar borrador local', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: 'Volver al catálogo', exact: true }).click()
  await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Ejercicio recuperable', exact: true }) }).getByRole('button', { name: 'Editar', exact: true }).click()
  await page.getByLabel('Nombre del ejercicio', { exact: true }).fill('Mi edición conservada')
  const { exercises } = await (await orgRequest(page, '/exercises')).json() as { exercises: Exercise[] }
  const exercise = exercises.find(item => item.name === 'Ejercicio recuperable')!
  const { id, revision } = exercise
  const input = { name: exercise.name, description: exercise.description, instructions: exercise.instructions, equipment: exercise.equipment, machineId: exercise.machineId, compatibleMachineIds: exercise.compatibleMachineIds, pattern: exercise.pattern, muscles: exercise.muscles, animationId: exercise.animationId, assets: exercise.assets, baseExerciseId: exercise.baseExerciseId }
  await orgRequest(page, `/exercises/${id}`, { ...input, name: 'Edición de otra persona', description: 'Texto remoto para comparar', expectedRevision: revision })
  const rejected = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/exercises/${id}`) && response.status() === 409)
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  await rejected
  await expect(page.getByLabel('Nombre del ejercicio', { exact: true })).toHaveValue('Mi edición conservada')
  await expect(page.getByRole('button', { name: 'Continuar con mis cambios', exact: true })).toBeDisabled()
  await expect(page.getByText('Texto remoto para comparar', { exact: true })).toBeVisible()
  // Reload preserves the original revision as well as the text; recovery must still request conflict review.
  await page.reload()
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Edición de otra persona', exact: true }) }).getByRole('button', { name: 'Editar', exact: true }).click()
  await recover(page)
  await expect(page.getByLabel('Nombre del ejercicio', { exact: true })).toHaveValue('Mi edición conservada')
  await expect(page.getByRole('button', { name: 'Guardar borrador', exact: true })).toBeDisabled()
  await page.getByRole('checkbox', { name: 'Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.', exact: true }).check()
  await page.getByRole('button', { name: 'Continuar con mis cambios', exact: true }).click()
  await page.getByRole('button', { name: 'Guardar borrador', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Borrador guardado')
  const result = await (await orgRequest(page, '/exercises')).json() as { exercises: Exercise[] }
  expect(result.exercises.find(item => item.id === id)).toMatchObject({ name: 'Mi edición conservada', revision: revision + 2 })
  await page.reload()
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await page.locator('article').filter({ has: page.getByRole('heading', { name: 'Mi edición conservada', exact: true }) }).getByRole('button', { name: 'Editar', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Recuperar borrador local', exact: true })).not.toBeVisible()
})

test('routine drafts retain dosage and alternatives, isolate accounts, and preserve edits through a real conflict', async ({ page }) => {
  await login(page, 'coach')
  const { exercises } = await (await orgRequest(page, '/exercises')).json() as { exercises: Exercise[] }
  const alternative = exercises.find(item => item.id === 'row')!
  await createEditor(page, 'Rutinas')
  await page.getByLabel('Nombre de la rutina', { exact: true }).fill('Rutina recuperable del coach')
  await page.getByLabel('Objetivo o descripción', { exact: true }).fill('Texto del coach sin guardar')
  await page.getByLabel('Ejercicio para agregar', { exact: true }).selectOption('squat')
  await page.getByRole('button', { name: '+ Agregar movimiento', exact: true }).click()
  await page.getByLabel('Series · movimiento 1', { exact: true }).fill('4')
  await page.getByLabel('Repeticiones · movimiento 1', { exact: true }).fill('12')
  await page.getByLabel('Carga kg · movimiento 1', { exact: true }).fill('27.5')
  await page.getByLabel('Descanso segundos · movimiento 1', { exact: true }).fill('95')
  await page.getByLabel('Indicaciones · movimiento 1', { exact: true }).fill('Priorizar el control')
  await page.getByText('Alternativas autorizadas (0)', { exact: true }).click()
  await page.getByLabel(alternative.name, { exact: true }).check()
  await page.getByRole('button', { name: 'Ejercicios', exact: true }).click()
  await createEditor(page, 'Rutinas')
  await recover(page)
  await expect(page.getByLabel('Carga kg · movimiento 1', { exact: true })).toHaveValue('27.5')
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page, 'admin')
  await createEditor(page, 'Rutinas')
  await expect(page.getByRole('button', { name: 'Recuperar borrador local', exact: true })).not.toBeVisible()
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue('')
  await page.getByLabel('Nombre de la rutina', { exact: true }).fill('Copia independiente del admin')
  await page.getByRole('button', { name: 'Salir', exact: true }).click()
  await login(page, 'coach')
  await createEditor(page, 'Rutinas')
  await recover(page)
  await expect(page.getByLabel('Nombre de la rutina', { exact: true })).toHaveValue('Rutina recuperable del coach')
  await page.reload()
  await createEditor(page, 'Rutinas')
  await recover(page)
  await expect(page.getByLabel('Series · movimiento 1', { exact: true })).toHaveValue('4')
  await expect(page.getByLabel('Repeticiones · movimiento 1', { exact: true })).toHaveValue('12')
  await expect(page.getByLabel('Carga kg · movimiento 1', { exact: true })).toHaveValue('27.5')
  await expect(page.getByLabel('Descanso segundos · movimiento 1', { exact: true })).toHaveValue('95')
  await expect(page.getByLabel('Indicaciones · movimiento 1', { exact: true })).toHaveValue('Priorizar el control')
  await page.getByText('Alternativas autorizadas (1)', { exact: true }).click()
  await expect(page.getByLabel(alternative.name, { exact: true })).toBeChecked()
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Borrador guardado')
  await page.getByLabel('Series · movimiento 1', { exact: true }).fill('5')
  const { programs } = await (await orgRequest(page, '/programs')).json() as { programs: Program[] }
  const program = programs.find(item => item.name === 'Rutina recuperable del coach')!
  await orgRequest(page, `/programs/${program.id}`, { name: program.name, description: 'Descripción nueva del servidor', steps: program.steps, expectedRevision: program.revision })
  const rejected = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().endsWith(`/programs/${program.id}`) && response.status() === 409)
  await page.getByRole('button', { name: 'Guardar borrador de rutina', exact: true }).click()
  await rejected
  await expect(page.getByLabel('Series · movimiento 1', { exact: true })).toHaveValue('5')
  await expect(page.getByText('Descripción nueva del servidor', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Descartar mis cambios y cargar versión actual', exact: true }).click()
  await expect(page.getByLabel('Series · movimiento 1', { exact: true })).toHaveValue('4')
  await expect(page.getByLabel('Objetivo o descripción', { exact: true })).toHaveValue('Descripción nueva del servidor')
  await page.reload()
  await page.getByRole('button', { name: 'Rutinas', exact: true }).click()
  await page.locator('article').filter({ has: page.getByRole('heading', { name: program.name, exact: true }) }).getByRole('button', { name: 'Editar borrador', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Recuperar borrador local', exact: true })).not.toBeVisible()
})
