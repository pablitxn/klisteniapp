import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createServer, type ViteDevServer } from 'vite'
import { blankStep } from '../src/features/programs/product/programmingModel.ts'

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
async function render(file: string, name: string, props: Record<string, unknown>) {
  const module = await vite.ssrLoadModule(`/src/features/programs/product/${file}.tsx`)
  return renderToStaticMarkup(
    createElement(module[name] as ComponentType<Record<string, unknown>>, props),
  )
}
function labelsHaveControls(html: string) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1])
  assert.equal(new Set(ids).size, ids.length, 'generated IDs must be unique')
  for (const [, id] of html.matchAll(/\bfor="([^"]+)"/g))
    assert.ok(ids.includes(id), `label ${id} must resolve`)
}
const noop = () => {}

test('prescription component labels fixed/range inputs and hides inapplicable measurements', async () => {
  const step = blankStep('step')
  step.dose.mode = 'duration'
  step.dose.durationSeconds = { kind: 'range', min: 15, max: 45 }
  step.dose.load = { mode: 'bodyweight' }
  const html = await render('PrescriptionEditor', 'PrescriptionEditor', {
    step,
    index: 0,
    count: 1,
    exercises: [],
    onChange: noop,
    onMove: noop,
    onRemove: noop,
  })
  labelsHaveControls(html)
  assert.match(html, /Duración \(segundos\).*mínimo/)
  assert.match(html, /Duración \(segundos\).*máximo/)
  assert.doesNotMatch(html, /Repeticiones · movimiento 1 · formato/)
  assert.doesNotMatch(html, /Carga externa \(kg\).*formato/)
  assert.match(html, /Bloquear alternativas/)
  assert.doesNotMatch(html, /required=""/)
})

test('blocked substitutions have an announced notice and range errors remain visible', async () => {
  const step = blankStep('blocked')
  step.substitutionPolicy = 'blocked'
  const html = await render('PrescriptionEditor', 'PrescriptionEditor', {
    step,
    index: 1,
    count: 2,
    exercises: [],
    onChange: noop,
    onMove: noop,
    onRemove: noop,
  })
  assert.match(html, /role="status">Las alternativas están bloqueadas/)
  const range = await render('NumericTargetEditor', 'NumericTargetEditor', {
    label: 'Series',
    value: { kind: 'range', min: 5, max: 2 },
    min: 1,
    max: 30,
    integer: true,
    onChange: noop,
  })
  assert.match(range, /role="alert">El mínimo/)
  labelsHaveControls(range)
})

test('stage date/day/routine controls have unique keyboard labels and preserved version options', async () => {
  const content = {
    name: '',
    goal: 'Continuity',
    timeZone: null,
    stages: [
      {
        id: 'stage',
        name: '',
        startDate: null,
        endDate: null,
        slots: [
          { id: 'one', weekday: 1, routine: { programId: 'old', version: 1, schemaVersion: 1 } },
          { id: 'two', weekday: 1, routine: null },
        ],
      },
    ],
  }
  const html = await render('StageScheduleEditor', 'StageScheduleEditor', {
    content,
    choices: [],
    onChange: noop,
  })
  labelsHaveControls(html)
  assert.equal([...html.matchAll(/type="date"/g)].length, 2)
  assert.match(html, /Versión conservada: old v1/)
  assert.match(html, /Zona sin confirmar/)
  assert.match(html, /No se toma la zona del dispositivo/)
  assert.match(html, /sesión 1/)
  assert.match(html, /sesión 2/)
})

test('feedback announces rejection and links exact step issues without losing revision context', async () => {
  const html = await render('EditorFeedback', 'EditorFeedback', {
    error: 'Revision conflict',
    message: '',
    issues: [
      {
        code: 'required',
        path: ['steps', 0, 'dose', 'sets'],
        stepId: 'step',
        message: 'Set target is missing',
      },
    ],
  })
  assert.match(html, /role="alert"/)
  assert.match(html, /href="#step-step"/)
  assert.match(html, /steps → 0 → dose → sets/)
  assert.match(html, /Tus cambios se conservan/)
})

test('blank routine editor allows server draft save and exposes no publish/assignment shortcuts', async () => {
  const account = await vite.ssrLoadModule('@klisteniapp/b2b-react')
  const module = await vite.ssrLoadModule('/src/features/programs/product/RoutineEditorV2.tsx')
  const html = renderToStaticMarkup(
    createElement(
      account.AccountProvider,
      { userId: 'coach', branchId: 'center', role: 'coach' },
      createElement(module.RoutineEditorV2, {
        orgId: 'brand',
        client: {
          call: async () => {
            throw new Error('SSR must not call API')
          },
        },
        exercises: [],
        onSaved: noop,
        onPublished: noop,
        onClose: noop,
      }),
    ),
  )
  labelsHaveControls(html)
  assert.match(html, /<button class="button primary">Guardar borrador incompleto<\/button>/)
  assert.match(html, /disabled="">Publicar versión para asignar/)
  assert.doesNotMatch(html, /required=""/)
})

test('workspace denies stale foreign account capabilities before rendering routines', async () => {
  const account = await vite.ssrLoadModule('@klisteniapp/b2b-react')
  const module = await vite.ssrLoadModule('/src/features/programs/product/ProgrammingPage.tsx')
  const html = renderToStaticMarkup(
    createElement(
      account.AccountProvider,
      { userId: 'other-account', branchId: 'center', role: 'coach' },
      createElement(module.ProgrammingWorkspace, {
        orgId: 'brand',
        client: { call: noop },
        initial: {
          access: {
            schemaVersion: 2,
            userId: 'coach',
            organizationId: 'brand',
            role: 'coach',
            accessMode: 'active',
            accessRevision: 1,
            branches: [{ branchId: 'center', role: 'coach' }],
            capabilities: ['edit-planning'],
          },
          routines: [{ id: 'private', name: 'Protected draft' }],
          people: [],
          exercises: [],
          choices: [],
        },
      }),
    ),
  )
  assert.match(html, /role="alert"/)
  assert.doesNotMatch(html, /Protected draft/)
})
