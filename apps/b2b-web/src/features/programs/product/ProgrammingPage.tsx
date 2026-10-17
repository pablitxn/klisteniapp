import { useEffect, useMemo, useState } from 'react'
import { type ProductV2Client } from '@klisteniapp/b2b-client'
import type { Exercise } from '@klisteniapp/b2b-contracts'
import type {
  Enrollment,
  ProductAccess,
  ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { useAccountScope } from '@klisteniapp/b2b-react'
import { Field } from '@klisteniapp/b2b-ui'
import { GoalProgramEditor } from './GoalProgramEditor'
import { PeriodImpactEditor } from './PeriodImpactEditor'
import { RoutineEditorV2 } from './RoutineEditorV2'
import { canEditPlanning, type Goal, type Routine } from './programmingModel'
import type { RoutineChoice } from './StageScheduleEditor'
import './programming.css'

type Loaded = {
  access: ProductAccess
  routines: Routine[]
  exercises: Exercise[]
  people: ProductOutput<'people'>
  choices: RoutineChoice[]
}

/** The integration owner selects this page only for the product-v2 programming route. */
export function ProgrammingPage({
  organizationId,
  accessKey,
  createClient,
  loadExercises,
  loadRoutineChoices,
}: {
  organizationId: string
  accessKey: string
  createClient: (signal?: AbortSignal) => ProductV2Client
  loadExercises: (signal: AbortSignal) => Promise<Exercise[]>
  loadRoutineChoices: (signal: AbortSignal) => Promise<RoutineChoice[]>
}) {
  return (
    <ScopedProgrammingPage
      key={accessKey}
      orgId={organizationId}
      createClient={createClient}
      loadExercises={loadExercises}
      loadRoutineChoices={loadRoutineChoices}
    />
  )
}
function ScopedProgrammingPage({
  orgId,
  createClient,
  loadExercises,
  loadRoutineChoices,
}: {
  orgId: string
  createClient: (signal?: AbortSignal) => ProductV2Client
  loadExercises: (signal: AbortSignal) => Promise<Exercise[]>
  loadRoutineChoices: (signal: AbortSignal) => Promise<RoutineChoice[]>
}) {
  const account = useAccountScope()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const client = useMemo(() => createClient(), [createClient])
  useEffect(() => {
    let current = true
    const abort = new AbortController()
    const scoped = createClient(abort.signal)
    async function load() {
      setLoaded(null)
      setError('')
      try {
        const capabilities = await scoped.call('capabilities', {})
        if (!capabilities.activated)
          throw new Error('La programación nueva todavía no está habilitada en este gimnasio.')
        const access = await scoped.call('access', {})
        if (!canEditPlanning(access, account.userId, orgId, account.branchId))
          throw new Error('No tenés permiso para editar programación en esta sede.')
        const [routines, people, catalog, choices] = await Promise.all([
          scoped.call('routines', {}),
          scoped.call('people', {}),
          loadExercises(abort.signal),
          loadRoutineChoices(abort.signal),
        ])
        if (current) setLoaded({ access, routines, people, exercises: catalog, choices })
      } catch (error) {
        if (current)
          setError(error instanceof Error ? error.message : 'No pudimos cargar la programación.')
      }
    }
    void load()
    return () => {
      current = false
      abort.abort()
    }
  }, [
    account.userId,
    account.branchId,
    account.role,
    orgId,
    loadExercises,
    loadRoutineChoices,
    retry,
    createClient,
  ])
  if (!account.branchId) return <p role="status">Seleccioná una sede para editar programación.</p>
  if (error)
    return (
      <section>
        <p role="alert">{error}</p>
        <button className="button" onClick={() => setRetry((r) => r + 1)}>
          Volver a consultar
        </button>
      </section>
    )
  if (!loaded) return <p role="status">Cargando programación y permisos…</p>
  return <ProgrammingWorkspace client={client} orgId={orgId} initial={loaded} />
}

export function ProgrammingWorkspace({
  client,
  orgId,
  initial,
}: {
  client: ProductV2Client
  orgId: string
  initial: Loaded
}) {
  const account = useAccountScope()
  const [routines, setRoutines] = useState(initial.routines)
  const [choices, setChoices] = useState(initial.choices)
  const [memberId, setMemberId] = useState('')
  const [goals, setGoals] = useState<Goal[]>([])
  const [enrollments, setEnrollments] = useState<Enrollment[]>([])
  const [editingRoutine, setEditingRoutine] = useState<Routine | 'new' | null>(null)
  const [editingGoal, setEditingGoal] = useState<Goal | 'new' | null>(null)
  const [editingPeriod, setEditingPeriod] = useState<Enrollment | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [refresh, setRefresh] = useState(0)
  const allowed = canEditPlanning(initial.access, account.userId, orgId, account.branchId)
  useEffect(() => {
    let current = true
    setGoals([])
    setEnrollments([])
    setEditingGoal(null)
    setEditingPeriod(null)
    setError('')
    if (!memberId || !allowed) return
    setLoading(true)
    Promise.all([client.call('goals', { memberId }), client.call('continuity', { memberId })])
      .then(([goals, continuity]) => {
        if (!current) return
        setGoals(goals)
        setEnrollments(
          [...continuity.current, ...continuity.past, ...continuity.future].filter(
            (e, i, all) => all.findIndex((x) => x.id === e.id) === i,
          ),
        )
      })
      .catch((error: unknown) => {
        if (current)
          setError(error instanceof Error ? error.message : 'No pudimos cargar los programas.')
      })
      .finally(() => {
        if (current) setLoading(false)
      })
    return () => {
      current = false
    }
  }, [memberId, client, allowed, refresh])
  if (!allowed)
    return <p role="alert">El permiso de programación no está disponible en esta sede.</p>
  const updateRoutine = (saved: Routine) =>
    setRoutines((rows) => [...rows.filter((r) => r.id !== saved.id), saved])
  const updateGoal = (saved: Goal) =>
    setGoals((rows) => [...rows.filter((r) => r.id !== saved.id), saved])
  if (editingRoutine)
    return (
      <main className="programming">
        <RoutineEditorV2
          orgId={orgId}
          client={client}
          routine={editingRoutine === 'new' ? undefined : editingRoutine}
          exercises={initial.exercises}
          onPublished={(published) =>
            setChoices((rows) => [
              ...rows.filter((r) => r.reference.programId !== published.programId),
              {
                name: published.name,
                reference: {
                  programId: published.programId,
                  version: published.version,
                  schemaVersion: published.schemaVersion,
                },
              },
            ])
          }
          onSaved={updateRoutine}
          onClose={() => setEditingRoutine(null)}
        />
      </main>
    )
  if (editingGoal)
    return (
      <main className="programming">
        <GoalProgramEditor
          orgId={orgId}
          client={client}
          memberId={memberId}
          goal={editingGoal === 'new' ? undefined : editingGoal}
          choices={choices}
          onSaved={updateGoal}
          onEnrolled={() => {
            setEditingGoal(null)
            setRefresh((r) => r + 1)
          }}
          onClose={() => setEditingGoal(null)}
        />
      </main>
    )
  if (editingPeriod)
    return (
      <main className="programming">
        <PeriodImpactEditor
          orgId={orgId}
          client={client}
          enrollment={editingPeriod}
          choices={choices}
          onSaved={(saved) => {
            setEditingPeriod(saved)
            setEnrollments((rows) => rows.map((e) => (e.id === saved.id ? saved : e)))
          }}
          onClose={() => setEditingPeriod(null)}
        />
      </main>
    )
  return (
    <main className="programming form-stack">
      <h1>Rutinas y programas por objetivo</h1>
      <section className="card">
        <h2>Rutinas reutilizables</h2>
        <button className="button primary" onClick={() => setEditingRoutine('new')}>
          Crear rutina
        </button>
        {routines.length ? (
          <ul>
            {routines.map((r) => (
              <li key={r.id}>
                <p>
                  {r.name || 'Borrador sin nombre'} · revisión {r.revision} ·{' '}
                  {r.publishedVersion ? `Publicación v${r.publishedVersion}` : 'Sin publicar'}
                </p>
                {!r.archivedAt && (
                  <button className="button" onClick={() => setEditingRoutine(r)}>
                    Editar {r.name || 'borrador'}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>Creá una rutina. Podés guardar el trabajo antes de completar los movimientos.</p>
        )}
      </section>
      <section className="card form-stack">
        <h2>Programación de una persona</h2>
        <Field label="Persona de esta sede">
          <select
            value={memberId}
            onChange={(e) => {
              setGoals([])
              setEnrollments([])
              setEditingGoal(null)
              setEditingPeriod(null)
              setError('')
              setLoading(Boolean(e.target.value))
              setMemberId(e.target.value)
            }}
          >
            <option value="">Seleccioná una persona</option>
            {initial.people
              .filter(
                (p) =>
                  p.active &&
                  p.branchGrants.some(
                    (g) => g.branchId === account.branchId && g.role === 'member' && g.active,
                  ),
              )
              .map((p) => (
                <option value={p.userId} key={p.userId}>
                  {p.name}
                </option>
              ))}
          </select>
        </Field>
        {loading && <p role="status">Cargando programas…</p>}
        {error && (
          <>
            <p role="alert">{error}</p>
            <button className="button" onClick={() => setRefresh((r) => r + 1)}>
              Reintentar
            </button>
          </>
        )}
        {memberId && !loading && !error && (
          <>
            <button className="button primary" onClick={() => setEditingGoal('new')}>
              Crear programa por objetivo
            </button>
            {goals.length ? (
              <ul>
                {goals.map((g) => (
                  <li key={g.id}>
                    <p>
                      {g.name || 'Programa sin nombre'} · {g.goal} · revisión {g.revision}
                    </p>
                    {g.status !== 'archived' && (
                      <button className="button" onClick={() => setEditingGoal(g)}>
                        Editar {g.name || 'programa'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No hay programas por objetivo para esta persona.</p>
            )}
            <h3>Inscripciones y períodos</h3>
            {enrollments.length ? (
              <ul>
                {enrollments.map((e) => (
                  <li key={e.id}>
                    <p>
                      {e.content.name} · revisión {e.revision} · {e.content.timeZone}
                    </p>
                    {e.status === 'active' && (
                      <button className="button" onClick={() => setEditingPeriod(e)}>
                        Revisar períodos de {e.content.name}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p>No hay inscripciones. Asigná un programa completo para crear su calendario.</p>
            )}
          </>
        )}
      </section>
    </main>
  )
}
