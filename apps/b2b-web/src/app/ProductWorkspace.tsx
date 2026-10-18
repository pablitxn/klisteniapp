import { lazy, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createProductV2Client, type ProductV2Client } from '@klisteniapp/b2b-client'
import type { OrganizationRoleV2 } from '@klisteniapp/b2b-contracts/product-v2'
import { AccountProvider, useLoad } from '@klisteniapp/b2b-react'
import { Shell } from '@klisteniapp/b2b-ui'
import { doseLabel } from '../features/alternatives/alternativePresentation'
import type { SelectedRecovery } from './ProductWorkout'
import { IndexedDBWorkoutStore } from '../features/training/storage/workoutStore'
import type { WorkoutDocument } from '../features/training/storage/workoutStore'
import { useSelectedWorkoutRecovery } from '../features/training/storage/useSelectedWorkoutRecovery'
import type { WorkoutRecoveryContext } from '../features/training/storage/selectedWorkoutRecovery'
import { useProductStream } from './productStream'
import { useApplication } from './ApplicationProvider'
import { MembershipAccessBoundary } from '../features/membership/RestrictedMembership'
import { personalExportDownload } from '../features/membership/trainingInterchange'
import type { RoutineReference } from '../features/training/routine-history/model'
import type { HealthAccess } from '../features/health/healthAccess'
import type { FlushLocalWorkout } from '../features/training/sync/localWorkoutFlush'
import { registerNavigationGuard } from './navigation'
import { WorkspaceFeatureBoundary } from './WorkspaceFeatureBoundary'

const PeopleWorkspace = lazy(() =>
  import('../features/people/PeopleWorkspace').then((module) => ({
    default: module.PeopleWorkspace,
  })),
)
const ProductWorkoutHistory = lazy(() =>
  import('./ProductWorkout').then((module) => ({ default: module.ProductWorkoutHistory })),
)
const TrainerHealthView = lazy(() =>
  import('../features/health/TrainerHealthView').then((module) => ({
    default: module.TrainerHealthView,
  })),
)
const ProgrammingPage = lazy(() =>
  import('../features/programs/product/ProgrammingPage').then((module) => ({
    default: module.ProgrammingPage,
  })),
)
const LegacyAdoptionAssignments = lazy(() =>
  import('../features/programs/legacy-adoption/LegacyAdoptionAssignments').then((module) => ({
    default: module.LegacyAdoptionAssignments,
  })),
)
const ProductHistoryReportsPage = lazy(() =>
  import('../features/reports/ProductReportsPage').then((module) => ({
    default: module.ProductHistoryReportsPage,
  })),
)
const HealthSettings = lazy(() =>
  import('../features/health/HealthSettings').then((module) => ({
    default: module.HealthSettings,
  })),
)

export default function ProductWorkspace({ publicContent }: { publicContent?: ReactNode }) {
  const { session, href, navigate } = useApplication()
  const [store] = useState(() => new IndexedDBWorkoutStore())
  const boot = session.bootstrap
  const recoveryContext = useMemo<WorkoutRecoveryContext | null>(
    () =>
      boot && session.productAccess
        ? {
            origin: location.origin,
            bootstrap: boot,
            access: session.productAccess,
            branchId: session.branchId,
            signal: session.contextSignal,
          }
        : null,
    [boot, session.productAccess, session.branchId, session.contextSignal],
  )
  const recovery = useSelectedWorkoutRecovery(store, recoveryContext)
  const membership = boot?.memberships.find((m) => m.organizationId === session.orgId)
  const refresh = useCallback(() => session.refresh(), [session.refresh])
  const streamContext = useMemo<HealthAccess | null>(
    () =>
      boot && session.productAccess
        ? {
            accountId: boot.user.id,
            organizationId: session.orgId,
            branchId: session.branchId,
            hostBinding: boot.realm.key,
            generation: session.workContextKey,
            access: session.productAccess,
            signal: session.contextSignal,
          }
        : null,
    [
      boot,
      session.orgId,
      session.branchId,
      session.workContextKey,
      session.productAccess,
      session.contextSignal,
    ],
  )
  const stream = useProductStream(streamContext, undefined, () => void refresh(), {
    revalidate: session.revalidateProduct,
  })
  const protectedContext = useMemo(
    () =>
      streamContext
        ? {
            ...streamContext,
            requestSignal: () => stream.guard.requestSignal(),
          }
        : null,
    [streamContext, stream.guard],
  )
  const createClient = useCallback(
    (signal?: AbortSignal): ProductV2Client => ({
      call: async (key, input) => {
        const network = stream.guard.requestSignal()
        return createProductV2Client(boot?.user.id ?? '', session.orgId, {
          branchId: session.branchId || undefined,
          role: session.productRole || undefined,
          contextSignal: AbortSignal.any([session.contextSignal, network]),
          signal,
          onAuthChange: () => void refresh(),
        }).call(key, input)
      },
    }),
    [
      boot?.user.id,
      session.orgId,
      session.branchId,
      session.productRole,
      session.contextSignal,
      stream.guard,
      refresh,
    ],
  )
  if (!boot) return null
  return (
    <Shell
      name={membership?.name}
      eyebrow="TU GIMNASIO"
      actions={
        <button className="text-button" onClick={() => void session.signOut()}>
          Salir
        </button>
      }
    >
      <label>
        Organización
        <select value={session.orgId} onChange={(e) => session.setOrgId(e.target.value)}>
          {boot.memberships.map((m) => (
            <option key={m.organizationId} value={m.organizationId}>
              {m.name}
              {m.accessMode === 'export-only' ? ' · Inactiva' : ''}
            </option>
          ))}
        </select>
      </label>
      {membership?.accessMode === 'active' && (
        <label>
          Sede y función
          <select
            value={JSON.stringify([session.branchId, session.productRole])}
            onChange={(e) => {
              const [branch, role] = JSON.parse(e.target.value) as [string, OrganizationRoleV2]
              void session.setProductWorkContext(session.orgId, branch, role)
            }}
          >
            <option value={JSON.stringify(['', ''])}>Elegí tu contexto</option>
            {membership.choices.map((c) => (
              <option
                key={JSON.stringify([c.branchId, c.role])}
                value={JSON.stringify([c.branchId, c.role])}
              >
                {c.name} ·{' '}
                {
                  {
                    superadmin: 'Superadministración',
                    admin: 'Administración',
                    coach: 'Entrenamiento',
                    member: 'Mi entrenamiento',
                  }[c.role]
                }
              </option>
            ))}
          </select>
        </label>
      )}
      {recovery.error && <p role="alert">{recovery.error}</p>}
      {session.error && (
        <p role="alert">
          {session.error}
          <button className="button" onClick={() => void refresh()}>
            Volver a validar
          </button>
        </p>
      )}
      {stream.validated && !stream.ready && (
        <p role="status">
          Conexión pendiente de validar. Conservamos el trabajo local; los envíos están suspendidos.
        </p>
      )}
      {publicContent &&
      membership?.accessMode === 'active' &&
      !session.productAccess &&
      !session.loading ? (
        publicContent
      ) : membership && !membership.activated ? (
        <p role="status">La nueva experiencia todavía no está activada en este gimnasio.</p>
      ) : membership && session.productAccess ? (
        <MembershipAccessBoundary
          identity={{ userId: boot.user.id, organizationId: membership.organizationId }}
          access={session.productAccess}
          revalidating={
            session.loading ||
            !stream.validated ||
            (session.productAccess.accessMode === 'export-only' && !stream.ready)
          }
          client={createClient()}
          contextSignal={session.contextSignal}
          currentOrigin={location.origin}
          refreshAccess={refresh}
          localExport={
            recovery.selected ? { exportOwnPending: recovery.exportOwnPending } : undefined
          }
        >
          {publicContent ?? (
            <AccountProvider
              userId={boot.user.id}
              branchId={session.branchId}
              contextKey={session.workContextKey}
            >
              <ProductViews
                key={session.workContextKey}
                createClient={createClient}
                accessKey={session.workContextKey}
                context={protectedContext!}
                workspaceReady={stream.ready}
                store={store}
                recoveryContext={recoveryContext!}
                recoverable={recovery.canResume ? recovery.selected!.document : null}
                onSelected={recovery.remember}
                organizationName={membership.name}
                branchName={
                  membership.choices.find((c) => c.branchId === session.branchId)?.name ?? ''
                }
                href={href}
                navigate={navigate}
              />
            </AccountProvider>
          )}
        </MembershipAccessBoundary>
      ) : (
        <p role="status">
          {session.loading
            ? 'Validando acceso actual…'
            : membership?.choices.length
              ? 'Elegí una sede y función para continuar.'
              : 'No tenés permisos vigentes de sede. Tus registros se conservan.'}
        </p>
      )}
    </Shell>
  )
}
export function ProductViews({
  createClient,
  accessKey,
  context,
  workspaceReady,
  organizationName,
  branchName,
  href,
  navigate,
  store,
  onSelected,
  recoveryContext,
  recoverable,
}: {
  store: IndexedDBWorkoutStore
  onSelected: (selection: SelectedRecovery) => void | Promise<void>
  recoveryContext: WorkoutRecoveryContext
  recoverable: WorkoutDocument | null
  createClient: (signal?: AbortSignal) => ProductV2Client
  accessKey: string
  context: HealthAccess
  workspaceReady: boolean
  organizationName: string
  branchName: string
  href: string
  navigate: (href: string, replace?: boolean, options?: { resetView?: boolean }) => void
}) {
  const page =
    new URL(href, location.origin).searchParams.get('view') ??
    (context.access?.role === 'member' ? 'history' : 'planning')
  const [reference, setReference] = useState<RoutineReference | null>(null)
  const [message, setMessage] = useState('')
  const [navigationError, setNavigationError] = useState('')
  const [workoutVisit, setWorkoutVisit] = useState(0)
  const localFlush = useRef<FlushLocalWorkout | null>(null)
  const registerLocalFlush = useCallback((flush: FlushLocalWorkout) => {
    localFlush.current = flush
    return () => {
      if (localFlush.current === flush) localFlush.current = null
    }
  }, [])
  useEffect(
    () =>
      registerNavigationGuard({
        signal: context.signal,
        beforeLeave: async () => {
          const flush = localFlush.current
          await flush?.()
          if (localFlush.current !== flush)
            throw new DOMException('Departed workout editor', 'AbortError')
        },
        departed: () => {
          setReference(null)
          setWorkoutVisit((value) => value + 1)
          setNavigationError('')
        },
        failed: () =>
          setNavigationError(
            'No pudimos conservar todos los cambios locales. Reintentá desde la sesión o exportá tu trabajo.',
          ),
      }),
    [context.signal, context.generation],
  )
  const loadExercises = useCallback(
    (signal: AbortSignal) => createClient(signal).call('catalogExercises', {}),
    [createClient],
  )
  const loadChoices = useCallback(
    (signal: AbortSignal) => createClient(signal).call('routinePublications', {}),
    [createClient],
  )
  const staff = context.access?.role !== 'member'
  async function exportOwn() {
    setMessage('Preparando tus registros…')
    try {
      const file = personalExportDownload(await createClient().call('personalExport', {}), {
        userId: context.accountId,
        organizationId: context.organizationId,
      })
      if (context.signal.aborted) return
      const url = URL.createObjectURL(new Blob([file.json], { type: 'application/json' })),
        link = document.createElement('a')
      link.href = url
      link.download = file.filename
      link.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMessage('Archivo preparado.')
    } catch (error) {
      if (!context.signal.aborted)
        setMessage(error instanceof Error ? error.message : 'No pudimos exportar.')
    }
  }
  const route = staff ? '/manage' : '/app'
  return (
    <>
      <nav
        aria-label="Secciones del gimnasio"
        style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBlock: 20 }}
      >
        {(staff
          ? [
              ['planning', 'Programación'],
              ...(context.access?.capabilities.includes('edit-planning')
                ? [['legacy-review', 'Revisar rutinas anteriores']]
                : []),
              ['reports', 'Historial'],
              ['people', 'Personas'],
              ['health', 'Mi salud'],
              ...(context.access?.role === 'coach' ? [['shared-health', 'Salud compartida']] : []),
            ]
          : [
              ['history', 'Mi rutina e historial'],
              ['health', 'Mi salud'],
            ]
        ).map(([key, label]) => (
          <a
            key={key}
            href={`${route}?view=${key}`}
            aria-current={page === key ? 'page' : undefined}
            onClick={(e) => {
              e.preventDefault()
              navigate(`${route}?view=${key}`, false, { resetView: true })
            }}
          >
            {label}
          </a>
        ))}
        <button className="text-button" onClick={() => void exportOwn()}>
          Exportar mis registros
        </button>
      </nav>
      {message && <p role="status">{message}</p>}
      {navigationError && <p role="alert">{navigationError}</p>}
      {reference ? (
        <ImmutableRoutine
          reference={reference}
          createClient={createClient}
          onClose={() => setReference(null)}
        />
      ) : page === 'shared-health' && context.access?.role === 'coach' ? (
        <SharedHealth
          createClient={createClient}
          context={context}
          workspaceReady={workspaceReady}
          branchName={branchName}
        />
      ) : page === 'health' ? (
        <WorkspaceFeatureBoundary contextKey={accessKey} name="tu salud">
          <HealthSettings
            context={context}
            organizationName={organizationName}
            branchName={branchName}
            onExportOwnRecords={() => void exportOwn()}
          />
        </WorkspaceFeatureBoundary>
      ) : staff && page === 'planning' ? (
        <WorkspaceFeatureBoundary contextKey={accessKey} name="programación">
          <ProgrammingPage
            organizationId={context.organizationId}
            accessKey={accessKey}
            createClient={createClient}
            loadExercises={loadExercises}
            loadRoutineChoices={loadChoices}
          />
        </WorkspaceFeatureBoundary>
      ) : staff &&
        page === 'legacy-review' &&
        context.access?.capabilities.includes('edit-planning') ? (
        <WorkspaceFeatureBoundary contextKey={accessKey} name="las rutinas anteriores">
          <LegacyAdoptionAssignments
            accountId={context.accountId}
            branchId={context.branchId}
            access={context.access}
            accessKey={accessKey}
            contextSignal={context.signal}
            createClient={createClient}
            onClose={() => navigate(`${route}?view=planning`)}
          />
        </WorkspaceFeatureBoundary>
      ) : staff && page === 'reports' ? (
        <Reports
          createClient={createClient}
          accessKey={accessKey}
          context={context}
          onOpenRoutine={setReference}
        />
      ) : staff && page === 'people' ? (
        <People createClient={createClient} accessKey={accessKey} context={context} />
      ) : context.access?.role === 'member' ? (
        <WorkspaceFeatureBoundary contextKey={accessKey} name="tu rutina e historial">
          <ProductWorkoutHistory
            key={workoutVisit}
            registerLocalFlush={registerLocalFlush}
            context={context}
            createClient={createClient}
            store={store}
            onSelected={onSelected}
            recoveryContext={recoveryContext}
            recoverable={recoverable}
            onOpenRoutine={setReference}
          />
        </WorkspaceFeatureBoundary>
      ) : (
        <p role="status">Elegí una sección autorizada.</p>
      )}
    </>
  )
}
function ImmutableRoutine({
  reference,
  createClient,
  onClose,
}: {
  reference: RoutineReference
  createClient: (signal?: AbortSignal) => ProductV2Client
  onClose: () => void
}) {
  const loaded = useLoad(async (signal) => {
    const stored = await createClient(signal).call('routineVersion', {
      id: reference.programId,
      version: reference.version,
    })
    if (
      stored.schemaVersion !== reference.schemaVersion ||
      stored.snapshot.programId !== reference.programId ||
      stored.snapshot.version !== reference.version
    )
      throw new Error('La versión no coincide con la emitida.')
    return stored
  }, JSON.stringify(reference))
  return (
    <section>
      <button className="button" onClick={onClose}>
        Volver al historial
      </button>
      {loaded.error && <p role="alert">{loaded.error}</p>}
      {loaded.loading && <p role="status">Cargando versión original…</p>}
      {loaded.data && (
        <>
          <h1>{loaded.data.snapshot.name}</h1>
          <p>
            Versión original {loaded.data.snapshot.version} · formato {loaded.data.schemaVersion}
          </p>
          <p>{loaded.data.snapshot.description}</p>
          <ol>
            {loaded.data.schemaVersion === 2
              ? loaded.data.snapshot.steps.map((step) => (
                  <li key={step.id}>
                    <h2>
                      {loaded.data?.snapshot.exercises.find((e) => e.id === step.exerciseId)
                        ?.name ?? step.exerciseId}
                    </h2>
                    <p>{doseLabel(step.dose)}</p>
                  </li>
                ))
              : loaded.data.snapshot.steps.map((step) => (
                  <li key={step.id}>
                    <h2>
                      {loaded.data?.snapshot.exercises.find((e) => e.id === step.exerciseId)
                        ?.name ?? step.exerciseId}
                    </h2>
                    <p>
                      {step.sets} series · {step.reps ?? 'Sin repeticiones indicadas'} repeticiones
                      · descanso {step.restSeconds} segundos
                    </p>
                  </li>
                ))}
          </ol>
        </>
      )}
    </section>
  )
}
function Reports({
  createClient,
  accessKey,
  context,
  onOpenRoutine,
}: {
  createClient: (signal?: AbortSignal) => ProductV2Client
  accessKey: string
  context: HealthAccess
  onOpenRoutine: (r: RoutineReference) => void
}) {
  return (
    <WorkspaceFeatureBoundary contextKey={accessKey} name="el historial">
      <ProductHistoryReportsPage
        organizationId={context.organizationId}
        branchId={context.branchId}
        accessKey={accessKey}
        createClient={createClient}
        onOpenRoutine={onOpenRoutine}
      />
    </WorkspaceFeatureBoundary>
  )
}

function People({
  createClient,
  accessKey,
  context,
}: {
  createClient: (signal?: AbortSignal) => ProductV2Client
  accessKey: string
  context: HealthAccess
}) {
  return (
    <WorkspaceFeatureBoundary contextKey={accessKey} name="personas">
      <PeopleWorkspace createClient={createClient} accessKey={accessKey} context={context} />
    </WorkspaceFeatureBoundary>
  )
}

function SharedHealth({
  createClient,
  context,
  workspaceReady,
  branchName,
}: {
  createClient: (signal?: AbortSignal) => ProductV2Client
  context: HealthAccess
  workspaceReady: boolean
  branchName: string
}) {
  const roster = useLoad(
    (signal) => createClient(signal).call('historySubjects', {}),
    context.generation,
    { refreshKey: Number(workspaceReady) },
  )
  const [selected, setSelected] = useState('')
  const member = roster.data?.members.find((m) => m.userId === selected && m.active)
  return (
    <section>
      <h1>Salud compartida con tu función de entrenador</h1>
      {workspaceReady && roster.error && <p role="alert">{roster.error}</p>}
      <label>
        Persona
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Elegí una persona</option>
          {roster.data?.members
            .filter((m) => m.active)
            .map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
              </option>
            ))}
        </select>
      </label>
      {member && (
        <TrainerHealthGate
          key={JSON.stringify([context.generation, member.userId])}
          context={context}
          workspaceReady={workspaceReady}
          memberId={member.userId}
          memberName={member.name}
          branchName={branchName}
        />
      )}
    </section>
  )
}
function TrainerHealthGate({
  context,
  workspaceReady,
  memberId,
  memberName,
  branchName,
}: {
  context: HealthAccess
  workspaceReady: boolean
  memberId: string
  memberName: string
  branchName: string
}) {
  const [generation, setGeneration] = useState(0),
    [invalid, setInvalid] = useState(false)
  const scopedLifetime = useMemo(() => {
    const controller = new AbortController()
    return {
      controller,
      context: {
        ...context,
        signal: AbortSignal.any([context.signal, controller.signal]),
        generation: JSON.stringify([context.generation, generation]),
      },
    }
  }, [context, generation])
  const scoped = scopedLifetime.context
  const stream = useProductStream(invalid ? null : scoped, memberId, () => {
    scopedLifetime.controller.abort()
    setInvalid(true)
  })
  // A renewed consent stream can be ready while workspace admission is still
  // pending. Mount a fresh health controller only after both gates validate.
  if (!workspaceReady || !stream.ready)
    return (
      <section>
        <p role="status">
          {invalid
            ? 'El acceso o consentimiento cambió. Los datos compartidos están ocultos.'
            : 'Validando acceso y consentimiento actuales…'}
        </p>
        {invalid && (
          <button
            className="button"
            onClick={() => {
              setInvalid(false)
              setGeneration((g) => g + 1)
            }}
          >
            Volver a validar consentimiento
          </button>
        )}
      </section>
    )
  return (
    <WorkspaceFeatureBoundary contextKey={scoped.generation} name="la salud compartida">
      <TrainerHealthView
        context={scoped}
        memberId={memberId}
        memberName={memberName}
        branchName={branchName}
      />
    </WorkspaceFeatureBoundary>
  )
}
