# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: b2b-product-history.spec.ts >> B2BP-HISTORY-002 Routine continuity shows objective/stages/period revisions with no substitution-count metric
- Location: e2e/b2b-product-history.spec.ts:22:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: getByRole('region', { name: 'Continuidad de la rutina' })
Expected substring: "WP12 goal 65d959da-e526-4027-930c-5dce39abaeb1"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" getByRole('region', { name: 'Continuidad de la rutina' }) with timeout 5000ms
  - waiting for getByRole('region', { name: 'Continuidad de la rutina' })

```

```yaml
- link "Ir al contenido":
  - /url: "#main"
- banner:
  - link "Atlas Demo":
    - /url: /app
  - button "Salir"
- main:
  - text: Organización
  - combobox "Organización":
    - option "Atlas Demo" [selected]
  - text: Sede y función
  - combobox "Sede y función":
    - option "Elegí tu contexto"
    - option "Centro · Mi entrenamiento" [selected]
  - main "Acceso al gimnasio":
    - heading "Acceso al gimnasio" [level=1]
    - status: Verificando tu acceso actual…
- contentinfo: Atlas Demo Tu espacio para moverte mejor.
```

# Test source

```ts
  1   | import {
  2   |   test,
  3   |   expect,
  4   |   principal,
  5   |   login,
  6   |   open,
  7   |   api,
  8   |   prescribe,
  9   |   record,
  10  |   staffSession,
  11  |   operation,
  12  |   updateActive,
  13  |   newPage,
  14  |   raw,
  15  |   addDays,
  16  |   publish,
  17  |   monday,
  18  |   date,
  19  | } from './fixtures/b2b-product/app-fixture'
  20  | import { scenarioTitle, assertProductViewport } from './fixtures/b2b-product/browser-assertions'
  21  | 
  22  | test(scenarioTitle('B2BP-HISTORY-002'), async ({ page, context, product }, info) => {
  23  |   const member = principal(product),
  24  |     staff = await staffSession(context, product, info)
  25  |   try {
  26  |     const plan = await prescribe(staff.page, staff.who, member)
  27  |     await login(page, member, info)
  28  |     await open(page, product, info, 'history')
  29  |     const continuity = page.getByRole('region', { name: 'Continuidad de la rutina' })
> 30  |     await expect(continuity).toContainText(plan.enrollment.content.name)
      |                              ^ Error: expect(locator).toContainText(expected) failed
  31  |     await expect(continuity).toContainText(plan.enrollment.content.goal)
  32  |     await expect(continuity).toContainText(plan.enrollment.content.stages[0]!.name)
  33  |     await expect(continuity.getByText(/cantidad de sustituciones|substitution count/i)).toHaveCount(
  34  |       0,
  35  |     )
  36  |     const enrolled = continuity.locator(':scope > div').filter({
  37  |       has: page.getByRole('heading', { name: plan.enrollment.content.name, exact: true }),
  38  |     })
  39  |     await enrolled
  40  |       .getByRole('button', {
  41  |         name: `Ver detalle del período vigente r${plan.enrollment.revision}`,
  42  |         exact: true,
  43  |       })
  44  |       .click()
  45  |     const detail = enrolled.getByRole('region', {
  46  |       name: `Período registrado r${plan.enrollment.revision}`,
  47  |       exact: true,
  48  |     })
  49  |     await expect(detail).toContainText(plan.enrollment.content.goal)
  50  |     await expect(detail).toContainText(plan.enrollment.content.timeZone)
  51  |     await expect(detail).toContainText(plan.enrollment.content.stages[0]!.startDate)
  52  |     await expect(detail).toContainText(staff.who.actor.id)
  53  |     await assertProductViewport(page, info)
  54  |   } finally {
  55  |     await staff.context.close()
  56  |   }
  57  | })
  58  | 
  59  | test(scenarioTitle('B2BP-HISTORY-003'), async ({ page, context, product }, info) => {
  60  |   const member = principal(product),
  61  |     staff = await staffSession(context, product, info)
  62  |   try {
  63  |     const plan = await prescribe(staff.page, staff.who, member, { weekdays: [1] })
  64  |     await login(page, member, info)
  65  |     const saved = await record(page, member, plan.routine, plan.occurrences[0]!)
  66  |     await open(page, product, info, 'history')
  67  |     const history = page.getByRole('region', { name: 'Sesiones realizadas' })
  68  |     await expect(history).toContainText(saved.session.id)
  69  |     const original = history
  70  |       .getByRole('link', { name: /rutina original/i })
  71  |       .filter({ hasText: plan.routine.programId })
  72  |     await expect(original).toHaveCount(1)
  73  |     const target = await original.getAttribute('href')
  74  |     expect(target).toMatch(/^#original-routine-/)
  75  |     await original.click()
  76  |     await expect(page.locator(`[id="${target!.slice(1)}"]`)).toContainText(
  77  |       plan.enrollment.content.goal,
  78  |     )
  79  |     await page.getByRole('link', { name: `Ver sesión ${saved.session.id}`, exact: true }).click()
  80  |     expect(new URL(page.url()).hash).toContain(saved.session.id)
  81  |     const session = history.locator(`[id="actual-session-${saved.session.id}"]`)
  82  |     await session
  83  |       .getByRole('button', {
  84  |         name: `Ver período original emitido r${plan.enrollment.revision}`,
  85  |         exact: true,
  86  |       })
  87  |       .click()
  88  |     const issued = session.getByRole('region', {
  89  |       name: `Período registrado r${plan.enrollment.revision}`,
  90  |       exact: true,
  91  |     })
  92  |     await expect(issued).toContainText(plan.enrollment.content.goal)
  93  |     await expect(issued).toContainText(plan.enrollment.content.stages[0]!.startDate)
  94  |     await expect(issued).toContainText('Etapa original de este registro')
  95  |     await expect(issued).toContainText(staff.who.actor.id)
  96  |     await session.getByRole('button', { name: 'Ver registro original y correcciones' }).click()
  97  |     await expect(session.getByText(/Revisión 1/)).not.toHaveCount(0)
  98  |     await assertProductViewport(page, info)
  99  |   } finally {
  100 |     await staff.context.close()
  101 |   }
  102 | })
  103 | 
  104 | test(scenarioTitle('B2BP-HISTORY-008'), async ({ page, context, product }, info) => {
  105 |   const staff = principal(product, 'superadmin'),
  106 |     member = principal(product)
  107 |   const peer = await newPage(context, info)
  108 |   let paused = false
  109 |   try {
  110 |     await login(page, staff, info)
  111 |     const plan = await prescribe(page, staff, member, { weekdays: [1] })
  112 |     await login(peer.page, member, info)
  113 |     const saved = await record(peer.page, member, plan.routine, plan.occurrences[0]!)
  114 |     await updateActive(page, staff, member, false)
  115 |     paused = true
  116 |     const disclosures: string[] = []
  117 |     page.on('request', (r) => {
  118 |       if (new URL(r.url()).pathname.endsWith(`/members/${member.actor.id}/health`))
  119 |         disclosures.push(r.url())
  120 |     })
  121 |     await open(page, product, info, 'reports')
  122 |     await page.getByLabel('Persona', { exact: true }).selectOption(member.actor.id)
  123 |     await expect(page.getByRole('heading').filter({ hasText: 'Membresía inactiva' })).toBeVisible()
  124 |     await expect(page.getByRole('region', { name: 'Sesiones realizadas' })).toContainText(
  125 |       saved.session.id,
  126 |     )
  127 |     await expect(page.getByLabel('Mover dentro de esta semana')).toHaveCount(0)
  128 |     expect(disclosures).toEqual([])
  129 |     expect(
  130 |       (
```