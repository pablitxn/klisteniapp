import { useMemo } from 'react'
import { createRoot } from 'react-dom/client'
import { AccountProvider } from '@klisteniapp/b2b-react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import {
  ProductEndpoints,
  type ProductEndpoint,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import '@klisteniapp/b2b-ui/styles.css'
import '../src/features/programs/product/programming.css'
import { GoalProgramEditor } from '../src/features/programs/product/GoalProgramEditor'
import { PeriodImpactEditor } from '../src/features/programs/product/PeriodImpactEditor'
import type { RoutineChoice } from '../src/features/programs/product/StageScheduleEditor'

// Parent diagnostic values remain intact, with one additional legitimate 150-character publication.
export const gridRoutine = {
  programId: '20256214-75e7-46e4-bd4b-c85e5157c58d',
  version: 1,
  schemaVersion: 2 as const,
}
export const gridLongName =
  'Published routine with a complete descriptive name and exact provenance '.repeat(3).slice(0, 150)
export const gridChoices: RoutineChoice[] = [
  {
    name: 'SYNTHETIC TEST ONLY: repetitions-to-duration prescription',
    reference: { ...gridRoutine, programId: 'synthetic' },
  },
  {
    name: 'WP12 875c04c7-b653-409a-a888-cdaf4c9e1bbc',
    reference: { ...gridRoutine, programId: 'other' },
  },
  { name: 'WP12 20256214-75e7-46e4-bd4b-c85e5157c58d', reference: gridRoutine },
  { name: 'Inicio · fuerza y técnica', reference: { ...gridRoutine, programId: 'demo' } },
  { name: gridLongName, reference: { ...gridRoutine, programId: 'long-publication' } },
]
type FixtureState = {
  calls: { key: string; input: unknown }[]
  saved: number
  enrolled: number
  applied: number
  linkedSession: string
}
declare global {
  interface Window {
    programmingGridFixture: {
      state: () => FixtureState
      longName: string
      choices: RoutineChoice[]
    }
  }
}
function Fixture() {
  const fixture = useMemo(() => {
    const params = new URL(location.href).searchParams
    const goalMode = params.get('mode') === 'goal'
    const content: ProductInput<'saveGoal'>['content'] = {
      name: goalMode
        ? 'WP12 invalid dates 4d69b128-00ae-4cb8-8b0b-ec672dcf8923'
        : 'WP12 goal 0a2f5b29-917b-49c2-b115-c691eaf22713',
      goal: 'Preserve routine, occurrence and actual links',
      timeZone: 'UTC',
      stages: [
        {
          id: 'stage1',
          name: 'Synthetic stage',
          startDate: '2026-04-13',
          endDate: '2026-04-19',
          slots: [{ id: 'monday', weekday: 1, routine: gridRoutine }],
        },
        ...(goalMode
          ? [
              {
                id: 'stage2',
                name: 'Reject overlapping and out-of-order stage',
                startDate: '2026-10-26',
                endDate: null,
                slots: [{ id: 'monday2', weekday: 1, routine: gridRoutine }],
              },
            ]
          : []),
      ],
    }
    const scope = { organizationId: 'org', branchId: 'main', memberId: 'member' }
    let goal: ProductOutput<'saveGoal'> = {
      ...structuredClone(content),
      schemaVersion: 2,
      id: 'goal',
      scope,
      revision: 1,
      status: 'draft',
      archivedAt: null,
    }
    let enrollment: ProductOutput<'applyPeriod'> = ProductEndpoints.applyPeriod.output.parse({
      schemaVersion: 2,
      id: '2752a5c9-566a-4788-b13d-53a441572a0a',
      scope,
      goalProgramId: 'goal',
      issuedGoalRevision: 1,
      revision: 2,
      status: 'active',
      content: { ...content, stages: content.stages.slice(0, 1) },
      createdAt: '2026-10-17T12:00:00Z',
    })
    const state: FixtureState = {
      calls: [],
      saved: 0,
      enrolled: 0,
      applied: 0,
      linkedSession: 'unchanged-original-session',
    }
    const client: ProductV2Client = {
      call: async <K extends ProductEndpoint>(
        key: K,
        raw: ProductInput<K>,
      ): Promise<ProductOutput<K>> => {
        const parsed = ProductEndpoints[key].input.parse(raw)
        state.calls.push({ key, input: structuredClone(parsed) })
        let result: unknown
        switch (key) {
          case 'saveGoal': {
            const input = ProductEndpoints.saveGoal.input.parse(raw)
            goal = { ...goal, ...structuredClone(input.content), revision: goal.revision + 1 }
            result = goal
            break
          }
          case 'goals':
            result = [goal]
            break
          case 'enroll': {
            const input = ProductEndpoints.enroll.input.parse(raw)
            result = {
              ...enrollment,
              id: input.id,
              issuedGoalRevision: input.issuedGoalRevision,
              revision: 1,
              content: structuredClone(input.content),
            }
            break
          }
          case 'periodPreview': {
            const input = ProductEndpoints.periodPreview.input.parse(raw)
            result = {
              schemaVersion: 2,
              enrollmentId: input.id,
              expectedRevision: input.expectedRevision,
              proposed: structuredClone(input.proposed),
              impacts: [
                {
                  occurrenceId: 'original-occurrence',
                  expectedRevision: 4,
                  beforeDate: '2026-04-13',
                  afterDate: '2026-04-14',
                  beforeEligibility: 'required',
                  afterEligibility: 'required',
                  linkedSessionIds: [state.linkedSession],
                  reason: 'Original routine, actual date and values retained',
                },
              ],
              previewHash: 'a'.repeat(64),
              expiresAt: '2099-01-01T00:00:00Z',
            }
            break
          }
          case 'applyPeriod': {
            const input = ProductEndpoints.applyPeriod.input.parse(raw)
            enrollment = {
              ...enrollment,
              content: structuredClone(input.proposed),
              revision: enrollment.revision + 1,
            }
            result = enrollment
            break
          }
          case 'audit':
            result = [
              {
                id: 'audit-planning',
                organizationId: 'org',
                branchId: 'main',
                actorId: 'synthetic-coach',
                action: 'period.apply',
                resourceId: enrollment.id,
                operationId: 'accepted-operation',
                beforeRevision: 2,
                afterRevision: 3,
                changedFields: ['stages'],
                createdAt: '2026-10-17T12:00:00Z',
              },
            ]
            break
          default:
            throw new Error(`Unexpected component dependency call: ${key}`)
        }
        return ProductEndpoints[key].output.parse(result) as ProductOutput<K>
      },
    }
    const available = params.has('long')
      ? gridChoices
      : gridChoices.filter((choice) => choice.reference.programId !== 'long-publication')
    const choices = params.has('preserved')
      ? available.filter((choice) => choice.reference.programId !== gridRoutine.programId)
      : available
    window.programmingGridFixture = {
      state: () => structuredClone(state),
      longName: gridLongName,
      choices,
    }
    return { goalMode, goal, enrollment, choices, client, state }
  }, [])
  return (
    <AccountProvider userId="coach" branchId="main" role="coach">
      <main className="main-content programming">
        {fixture.goalMode ? (
          <GoalProgramEditor
            orgId="org"
            memberId="member"
            client={fixture.client}
            goal={fixture.goal}
            choices={fixture.choices}
            onSaved={() => {
              fixture.state.saved++
            }}
            onEnrolled={() => {
              fixture.state.enrolled++
            }}
            onClose={() => {}}
          />
        ) : (
          <PeriodImpactEditor
            orgId="org"
            client={fixture.client}
            enrollment={fixture.enrollment}
            choices={fixture.choices}
            onSaved={() => {
              fixture.state.applied++
            }}
            onClose={() => {}}
          />
        )}
      </main>
    </AccountProvider>
  )
}
createRoot(document.getElementById('root')!).render(<Fixture />)
