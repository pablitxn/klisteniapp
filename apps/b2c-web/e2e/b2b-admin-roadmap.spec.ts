import { expect, test, type Page } from '@playwright/test'
import type {
  Assignment,
  Machine,
  Me,
  Member,
  Program,
  Unit,
} from '../../../packages/b2b-contracts/src/index.ts'

async function login(page: Page, role: 'admin' | 'coach') {
  await page.goto('/backoffice/')
  await page.getByLabel('Email', { exact: true }).fill(`${role}@atlas.example.test`)
  await page.getByLabel('Contraseña', { exact: true }).fill('browser-tests-only-password-2026')
  await page.getByRole('button', { name: 'Iniciar sesión', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Salir', exact: true })).toBeVisible()
}
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true })
const card = (page: Page, name: string) =>
  page.locator('article').filter({ has: page.getByRole('heading', { name, exact: true }) })
async function request(page: Page, path: string, data?: unknown) {
  const identity = (await (await page.request.get('/api/b2b/me')).json()) as Me
  const response = await page.request.fetch(`/api/b2b/orgs/atlas-demo${path}`, {
    method: data ? 'PUT' : 'GET',
    headers: { Origin: new URL(page.url()).origin, 'X-Klisteni-B2B-Account': identity.user.id },
    ...(data ? { data } : {}),
  })
  expect(response.ok()).toBeTruthy()
  return response
}
async function createModel(page: Page) {
  await button(page, 'Equipamiento').click()
  await button(page, 'Biblioteca de modelos').click()
  await button(page, '+ Crear modelo').click()
}

test('machine drafts survive reload and preserve local work through a concurrent edit', async ({
  page,
}) => {
  const name = 'Polea de referencia · estación de tracción con agarres intercambiables'
  await login(page, 'admin')
  await createModel(page)
  await page.getByLabel('Nombre del modelo', { exact: true }).fill(name)
  await page.getByLabel('Tipo de máquina', { exact: true }).fill('Polea')
  await page
    .getByLabel('Instrucciones del modelo', { exact: true })
    .fill('Comprobá el pasador y el agarre con el instructor antes de comenzar.')
  await page.reload()
  await createModel(page)
  await expect(page.getByLabel('Nombre del modelo', { exact: true })).toBeDisabled()
  await button(page, 'Recuperar borrador local').click()
  await expect(page.getByLabel('Nombre del modelo', { exact: true })).toHaveValue(name)
  await button(page, 'Guardar modelo').click()
  await expect(page.getByRole('status')).toContainText('Modelo guardado como borrador')
  await card(page, name).getByRole('button', { name: 'Editar modelo', exact: true }).click()
  await page
    .getByLabel('Instrucciones del modelo', { exact: true })
    .fill('Mi revisión local: regular el asiento antes de seleccionar la carga.')
  const { machines } = (await (await request(page, '/machines')).json()) as { machines: Machine[] }
  const machine = machines.find((item) => item.name === name)!
  await request(page, `/machines/${machine.id}`, {
    name: machine.name,
    type: machine.type,
    manufacturer: machine.manufacturer,
    model: machine.model,
    instructions: 'Otra persona verificó los agarres.',
    assets: machine.assets,
    derivedFromId: machine.derivedFromId,
    derivedFromVersion: machine.derivedFromVersion,
    expectedRevision: machine.revision,
  })
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith(`/machines/${machine.id}`) &&
      response.status() === 409,
  )
  await button(page, 'Guardar modelo').click()
  await rejected
  await expect(page.getByLabel('Instrucciones del modelo', { exact: true })).toHaveValue(
    'Mi revisión local: regular el asiento antes de seleccionar la carga.',
  )
  await expect(page.getByText('Otra persona verificó los agarres.', { exact: true })).toBeVisible()
  await expect(button(page, 'Continuar con mis cambios')).toBeDisabled()
  await page.reload()
  await button(page, 'Equipamiento').click()
  await button(page, 'Biblioteca de modelos').click()
  await card(page, name).getByRole('button', { name: 'Editar modelo', exact: true }).click()
  await button(page, 'Recuperar borrador local').click()
  await expect(button(page, 'Guardar modelo')).toBeDisabled()
  await page
    .getByRole('checkbox', {
      name: 'Revisé la versión actual. Al guardar mis cambios reemplazaré este borrador del gimnasio.',
      exact: true,
    })
    .check()
  await button(page, 'Continuar con mis cambios').click()
  await button(page, 'Guardar modelo').click()
  await expect(page.getByRole('status')).toContainText('Modelo guardado como borrador')
  const updated = (
    (await (await request(page, '/machines')).json()) as { machines: Machine[] }
  ).machines.find((item) => item.id === machine.id)!
  expect(updated.instructions).toBe(
    'Mi revisión local: regular el asiento antes de seleccionar la carga.',
  )
  expect(updated.revision).toBe(machine.revision + 2)
  await card(page, name).getByRole('button', { name: 'Editar modelo', exact: true }).click()
  await expect(button(page, 'Recuperar borrador local')).toHaveCount(0)
})

test('unit drafts recover two physical labels and QR preparation explains publication and origin', async ({
  page,
}) => {
  await login(page, 'admin')
  await button(page, 'Equipamiento').click()
  await button(page, '+ Registrar equipo').click()
  await page.getByLabel('Modelo de máquina', { exact: true }).selectOption('base-cable-station-v1')
  await page.getByLabel('Nombre de esta unidad', { exact: true }).fill('Polea de referencia')
  await page.getByLabel('Cantidad de unidades', { exact: true }).fill('2')
  await page.getByLabel('Número inicial', { exact: true }).fill('11')
  await page.getByLabel('Ubicación', { exact: true }).fill('Sala principal · sector de tracción')
  await page
    .getByLabel('Ajustes y particularidades de esta unidad', { exact: true })
    .fill('Solicitá al instructor el ajuste inicial del asiento.')
  await page.reload()
  await button(page, 'Equipamiento').click()
  await button(page, '+ Registrar equipo').click()
  await button(page, 'Recuperar borrador local').click()
  await expect(page.getByLabel('Cantidad de unidades', { exact: true })).toHaveValue('2')
  await expect(page.getByLabel('Número inicial', { exact: true })).toHaveValue('11')
  await button(page, 'Registrar 2 equipos').click()
  await expect(page.getByRole('status')).toContainText('2 equipos guardados')
  const units = ((await (await request(page, '/units')).json()) as { units: Unit[] }).units.filter(
    (item) => item.label.startsWith('Polea de referencia'),
  )
  expect(units.map((unit) => unit.label).sort()).toEqual([
    'Polea de referencia 11',
    'Polea de referencia 12',
  ])
  await button(page, 'Etiquetas QR').click()
  await expect(
    page.getByRole('heading', { name: 'Estas etiquetas son de prueba', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(/al escanearlo, el teléfono buscará la ficha en el propio teléfono/),
  ).toBeVisible()
  const pending = page.locator('.list-row').filter({ hasText: 'Polea de referencia 11' })
  await expect(pending).toContainText('Revisar la unidad y habilitar su ficha pública.')
  await pending.getByRole('button', { name: 'Preparar equipo', exact: true }).click()
  await card(page, 'Polea de referencia 11')
    .getByRole('button', { name: 'Editar equipo', exact: true })
    .click()
  await page
    .getByLabel('Ajustes y particularidades de esta unidad', { exact: true })
    .fill('Mi ajuste sin guardar')
  const unit = units.find((item) => item.label.endsWith('11'))!
  await request(page, `/units/${unit.id}`, {
    machineId: unit.machineId,
    label: unit.label,
    location: unit.location,
    assets: unit.assets,
    adjustments: 'Versión del instructor: asiento en posición 3.',
    public: unit.public,
    archived: unit.archived,
    expectedRevision: unit.revision,
  })
  const rejected = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response.url().endsWith(`/units/${unit.id}`) &&
      response.status() === 409,
  )
  await button(page, 'Guardar equipo').click()
  await rejected
  await expect(
    page.getByLabel('Ajustes y particularidades de esta unidad', { exact: true }),
  ).toHaveValue('Mi ajuste sin guardar')
  await expect(
    page.getByText('Versión del instructor: asiento en posición 3.', { exact: true }),
  ).toBeVisible()
  await button(page, 'Descartar mis cambios y cargar versión actual').click()
  await expect(
    page.getByLabel('Ajustes y particularidades de esta unidad', { exact: true }),
  ).toHaveValue('Versión del instructor: asiento en posición 3.')
  await page
    .getByRole('checkbox', {
      name: 'Mostrar ficha y recursos en la web pública del gimnasio',
      exact: true,
    })
    .check()
  await expect(button(page, 'Guardar equipo')).toBeDisabled()
  await page
    .getByRole('checkbox', {
      name: 'Revisé el nombre, la ubicación, los ajustes y los recursos de estas unidades.',
      exact: true,
    })
    .check()
  await button(page, 'Guardar equipo').click()
  await expect(page.getByRole('status')).toContainText('Equipo guardado')
  await button(page, 'Etiquetas QR').click()
  await page
    .getByRole('checkbox', {
      name: 'Polea de referencia 11 Sala principal · sector de tracción',
      exact: true,
    })
    .check()
  await expect(button(page, 'Imprimir 1 etiquetas')).toBeEnabled()
  await expect(page.locator('.qr-label')).toContainText('ETIQUETA DE PRUEBA')
  const url = new URL(units.find((unit) => unit.label.endsWith('11'))!.publicPath, page.url()).href
  await expect(page.locator('.qr-absolute-url')).toHaveAttribute('href', url)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('coach publishes a timed prescription with target effort and assignment retains that version', async ({
  page,
}) => {
  await login(page, 'coach')
  await button(page, 'Rutinas').click()
  await button(page, '+ Crear rutina').click()
  const name = 'Control por tiempo · rutina de referencia'
  await page.getByLabel('Nombre de la rutina', { exact: true }).fill(name)
  await page.getByLabel('Ejercicio para agregar', { exact: true }).selectOption('dead-bug')
  await button(page, '+ Agregar movimiento').click()
  await page.getByLabel('Tipo de objetivo · movimiento 1', { exact: true }).selectOption('duration')
  await page.getByLabel('Series · movimiento 1', { exact: true }).fill('2')
  await page.getByLabel('Duración segundos · movimiento 1', { exact: true }).fill('45')
  await page.getByLabel('Esfuerzo objetivo RPE · movimiento 1', { exact: true }).fill('7.25')
  await page.getByLabel('Carga kg · movimiento 1', { exact: true }).fill('0.25')
  await page.reload()
  await button(page, 'Rutinas').click()
  await button(page, '+ Crear rutina').click()
  await button(page, 'Recuperar borrador local').click()
  await expect(page.getByLabel('Tipo de objetivo · movimiento 1', { exact: true })).toHaveValue(
    'duration',
  )
  await expect(page.getByLabel('Duración segundos · movimiento 1', { exact: true })).toHaveValue(
    '45',
  )
  await expect(
    page.getByLabel('Esfuerzo objetivo RPE · movimiento 1', { exact: true }),
  ).toHaveValue('7.25')
  await expect(page.getByLabel('Carga kg · movimiento 1', { exact: true })).toHaveValue('0.25')
  expect(
    await page.locator('form').evaluate((form) => (form as HTMLFormElement).checkValidity()),
  ).toBe(true)
  await button(page, 'Guardar borrador de rutina').click()
  await expect(page.getByRole('status')).toContainText('Borrador guardado')
  await button(page, 'Volver a rutinas').click()
  const programCard = card(page, name)
  await expect(programCard).toContainText('2 × 45 s · 0.25 kg · RPE 7.25/10')
  await programCard.getByRole('button', { name: 'Publicar versión', exact: true }).click()
  await expect(programCard).toContainText('V1')
  await programCard.getByRole('button', { name: 'Asignar a socio', exact: true }).click()
  await expect(page.locator('form')).toContainText('2 × 45 s · 0.25 kg · RPE 7.25/10')
  const members = ((await (await request(page, '/members')).json()) as { members: Member[] })
    .members
  const member = members.find((item) => item.email === 'member@atlas.example.test')!
  await page.getByLabel('Socio destinatario', { exact: true }).selectOption(member.userId)
  await button(page, 'Confirmar asignación').click()
  await expect(page.getByRole('status')).toContainText('Rutina asignada')
  const program = (
    (await (await request(page, '/programs')).json()) as { programs: Program[] }
  ).programs.find((item) => item.name === name)!
  await request(page, `/programs/${program.id}`, {
    name: program.name,
    description: program.description,
    steps: [{ ...program.steps[0], durationSeconds: 60, targetRpe: 7, loadKg: 0.5 }],
    expectedRevision: program.revision,
  })
  const assignment = (
    (await (await request(page, '/assignments')).json()) as { assignments: Assignment[] }
  ).assignments.find((item) => item.program.programId === program.id)!
  expect(assignment.program.steps[0]).toMatchObject({
    reps: null,
    durationSeconds: 45,
    targetRpe: 7.25,
    loadKg: 0.25,
  })
})
