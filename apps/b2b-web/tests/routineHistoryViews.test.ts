import { loadHistoryViews } from './routineHistoryRender.ts'
import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  enrollment,
  legacy,
  occurrence,
  scope,
  session,
  summary,
} from './routineHistoryFixtures.ts'
const {
  RoutineContinuity,
  OriginalRoutines,
  SessionHistory,
  SessionActuals,
  WeekCalendar,
  ProductReportsPage,
} = await loadHistoryViews()
const noClient = () => {
  throw new Error('No network expected while rendering')
}

test('continuity renders current stage in enrollment timezone and tells gaps truthfully', () => {
  const continuity = {
    schemaVersion: 2 as const,
    scope,
    current: [enrollment()],
    past: [],
    future: [],
    unscheduledLegacyAssignmentIds: ['legacy-assignment'],
  }
  const current = renderToStaticMarkup(
    createElement(RoutineContinuity, { continuity, now: '2026-10-15T02:00:00Z' }),
  )
  assert.match(current, /Hoy 2026-10-14/)
  assert.match(current, /aria-current="step"/)
  assert.match(current, /Progress consistently/)
  const gap = renderToStaticMarkup(
    createElement(RoutineContinuity, { continuity, now: '2026-10-17T12:00:00Z' }),
  )
  assert.match(gap, /Hoy no hay una etapa prescrita/)
  assert.match(gap, /No generan ausencias semanales/)
  assert.doesNotMatch(gap, /aria-current="step"/)
})
test('routine and dated actual rendering have both directions of stable original links after period removal', () => {
  const record = session()
  const routines = renderToStaticMarkup(
    createElement(OriginalRoutines, { enrollments: [], records: [record] }),
  )
  assert.match(routines, /id="original-routine-routine-v2-s2"/)
  assert.match(routines, /href="#actual-session-session"/)
  const actuals = renderToStaticMarkup(
    createElement(SessionHistory, {
      records: [record],
      scope,
      occurrences: [occurrence('occurrence', { eligibility: 'cancelled' })],
      enrollments: [],
      createClient: noClient,
      accessKey: 'member',
      timeZone: 'America/New_York',
    }),
  )
  assert.match(actuals, /href="#original-routine-routine-v2-s2"/)
  assert.match(actuals, /excluido del seguimiento vigente/)
  assert.match(actuals, /4 rep/)
  assert.match(actuals, /2026-10-12/)
})
test('actual detail retains unused segments, units and correction attribution without substitution metrics', () => {
  const record = session('corrected', { revision: 2 })
  record.content.correctionReason = 'Corrected repetitions'
  record.content.segments.push({
    ...record.content.segments[0]!,
    segmentId: 'old-segment',
    exerciseId: 'old-target',
  })
  const html = renderToStaticMarkup(createElement(SessionActuals, { record }))
  assert.match(html, /Trabajo adicional conservado/)
  assert.match(html, /Prescripción seleccionada/)
  assert.match(html, /Corrected repetitions/)
  assert.match(html, /actor member-a/)
  assert.match(html, /5–8 rep/)
  assert.doesNotMatch(html, /substitution.count|cantidad de sustituciones/i)
})
test('legacy actual rendering preserves ID, values, notes and unplanned status', () => {
  const record = legacy()
  const html = renderToStaticMarkup(
    createElement(SessionHistory, {
      records: [record],
      scope,
      occurrences: [],
      enrollments: [],
      createClient: noClient,
      accessKey: 'member',
      timeZone: null,
    }),
  )
  assert.match(html, /actual-session-old-log/)
  assert.match(html, /Registro anterior sin turno prescrito/)
  assert.match(html, /Legacy snapshot/)
  assert.match(html, /Original reason/)
  assert.match(html, /6 rep/)
})
test('calendar renders four/three/one, same-day slots and keyboard form with seven same-week options', () => {
  const first = occurrence('one'),
    second = occurrence('two', { slotId: 'other-slot' })
  const html = renderToStaticMarkup(
    createElement(WeekCalendar, {
      summary: summary(true),
      occurrences: [first, second],
      sessions: [],
      enrollments: [enrollment()],
      now: '2026-10-12T15:00:00Z',
      canReschedule: true,
      onMove: async () => {},
    }),
  )
  assert.match(html, /<dt>Prescritas<\/dt><dd>4<\/dd>/)
  assert.match(html, /<dt>Completadas<\/dt><dd>3<\/dd>/)
  assert.match(html, /<dt>Ausentes<\/dt><dd>1<\/dd>/)
  assert.match(html, /aria-current="date"/)
  assert.match(html, /Turno one/)
  assert.match(html, /Turno two/)
  assert.equal((html.match(/Confirmar cambio de día/g) ?? []).length, 2)
  assert.equal((html.match(/<option /g) ?? []).length, 14)
  assert.match(html, /2026-10-18/)
  assert.doesNotMatch(html, /2026-10-19|draggable/)
})
test('read-only report calendar has no move form and lists inactive people', () => {
  const html = renderToStaticMarkup(
    createElement(WeekCalendar, {
      summary: summary(),
      occurrences: [occurrence()],
      sessions: [],
      enrollments: [enrollment()],
      now: '2026-10-12T15:00:00Z',
      canReschedule: false,
      onMove: async () => {
        throw new Error('must not move')
      },
    }),
  )
  assert.doesNotMatch(html, /<form|Confirmar cambio/)
  const report = renderToStaticMarkup(
    createElement(ProductReportsPage, {
      members: [
        {
          schemaVersion: 2,
          userId: 'inactive',
          name: 'Inactive member',
          email: 'inactive@example.test',
          role: 'member',
          active: false,
          revision: 1,
          branchGrants: [],
          coachIds: [],
        },
      ],
      organizationId: scope.organizationId,
      branchId: scope.branchId,
      accessKey: 'staff',
      createClient: noClient,
    }),
  )
  assert.match(report, /Inactive member · Inactiva/)
  assert.doesNotMatch(report, /health|consent|watch/i)
})
