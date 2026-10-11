import type { Me, Membership } from '@klisteniapp/b2b-contracts'
import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { Notice, Shell } from '@klisteniapp/b2b-ui'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useApplication } from './ApplicationProvider'
import { VoiceCapability } from '../features/voice/voiceCapability'
import '../member.css'
import { memberPath } from '../routes'
import { MovementCatalog } from '../features/catalog/MovementCatalog'
import { AssignedRoutines } from '../features/training/AssignedRoutines'
import { ExecutionHistory } from '../features/training/ExecutionHistory'
import { Session } from '../features/training/Session'

const PAGES = {
  routine: {
    icon: '↗',
    label: 'Mi rutina',
    title: 'Tu próximo movimiento.',
    description: 'Tu equipo prepara el camino. Vos ponés el movimiento.',
  },
  catalog: {
    icon: '▤',
    label: 'Movimientos',
    title: 'Conocé cada movimiento.',
    description: 'Instrucciones para entrenar con más confianza.',
  },
  history: {
    icon: '◷',
    label: 'Mi progreso',
    title: 'Lo que cuenta es volver.',
    description: 'Cada sesión forma parte de tu recorrido.',
  },
}
type Page = keyof typeof PAGES
const PAGE_IDS: Page[] = ['routine', 'catalog', 'history']

type MemberWorkspaceProps = {
  me: Me
  membership: Membership
  dataRefresh: number
  onSignOut: () => void
  onOrganization: (id: string) => void
  contextUI?: ReactNode
  branchName?: string
  whiteLabel?: boolean
}

export function MemberWorkspace({
  me,
  membership,
  dataRefresh,
  onSignOut,
  onOrganization,
  contextUI,
  branchName,
  whiteLabel,
}: MemberWorkspaceProps) {
  const client = useAccountClient()
  const org = membership.organization
  const capabilities = useLoad(
    (signal) =>
      whiteLabel ? client.withSignal(signal).modules.get(org.id) : Promise.resolve(null),
    org.id,
    { refreshKey: dataRefresh },
  )
  const { route, navigate: navigateTo } = useApplication()
  const page: Page =
    route.kind === 'member' && route.page && route.page !== 'allHistory' ? route.page : 'routine'
  const setPage = (next: Page) => navigateTo(memberPath(next))
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const pageHeading = useRef<HTMLHeadingElement>(null)
  const { data, error, loading, reload } = useLoad(
    async (signal) => {
      const api = client.withSignal(signal)
      const [assignments, executions, exercises] = await Promise.all([
        api.assignments.list(org.id),
        whiteLabel ? api.executions.history() : api.executions.list(org.id),
        api.catalog.listExercises(org.id),
      ])
      return { ...assignments, ...executions, ...exercises }
    },
    org.id,
    { refreshKey: dataRefresh },
  )

  const ownAssignments =
    data?.assignments.filter((item) => item.memberId === me.user.id && item.active !== false) ?? []
  const ownExecutions = data?.executions.filter((item) => item.memberId === me.user.id) ?? []
  const currentSession =
    page === 'routine'
      ? ownAssignments.find((assignment) => assignment.id === sessionId)
      : undefined
  const machineContext = new URLSearchParams(location.search).get('machine')

  useEffect(() => {
    if (!sessionId) pageHeading.current?.focus()
  }, [page, sessionId])

  function navigate(next: Page) {
    setPage(next)
    setSessionId(null)
    setMessage('')
  }

  function savedSession() {
    setSessionId(null)
    setPage('history')
    setMessage('Tu sesión quedó guardada.')
    reload()
  }

  const navigation = (
    <>
      {PAGE_IDS.map((id) => (
        <button
          key={id}
          aria-current={page === id ? 'page' : undefined}
          onClick={() => navigate(id)}
        >
          <span aria-hidden="true">{PAGES[id].icon}</span>
          {PAGES[id].label}
        </button>
      ))}
      <a href={whiteLabel ? '/' : `/g/${org.slug}`}>◇ Mi gimnasio</a>
    </>
  )
  const actions = (
    <>
      <span className="muted small">
        {me.user.name}
        {branchName ? ` · ${branchName}` : ''}
      </span>
      {contextUI}
      {me.memberships.length > 1 && (
        <select
          aria-label="Gimnasio"
          value={org.id}
          onChange={(event) => onOrganization(event.target.value)}
        >
          {me.memberships.map((item) => (
            <option key={item.organization.id} value={item.organization.id}>
              {item.organization.brand.name}
            </option>
          ))}
        </select>
      )}
      <button className="text-button small" onClick={onSignOut}>
        Salir
      </button>
    </>
  )

  return (
    <VoiceCapability.Provider value={capabilities.data?.modules.voice ?? !whiteLabel}>
      <Shell
        name={org.brand.name}
        logoUrl={org.brand.logoUrl}
        color={org.brand.color}
        eyebrow="TU ESPACIO"
        navigation={navigation}
        actions={actions}
      >
        {whiteLabel && (
          <p className="small muted">
            Tus borradores se conservan por sede. Al cambiar de sede podés retomarlos cuando
            vuelvas.
          </p>
        )}
        {machineContext && (
          <Notice>
            Estás consultando el equipo que abriste desde su ficha. Mostramos las rutinas asignadas
            que lo usan; ninguna serie se registra automáticamente.{' '}
            <a href="/app">Ver todas mis rutinas</a>
          </Notice>
        )}
        {!org.serviceActive && (
          <Notice>
            El gimnasio tiene pausado el registro de nuevos cambios. Tu historial sigue disponible.
          </Notice>
        )}
        {currentSession ? (
          <Session
            key={currentSession.id}
            assignment={currentSession}
            orgId={org.id}
            userId={me.user.id}
            active={org.serviceActive}
            onClose={() => setSessionId(null)}
            onSaved={savedSession}
          />
        ) : (
          <>
            <div className="page-heading">
              <div>
                <p className="eyebrow">
                  {page === 'routine'
                    ? `HOLA, ${me.user.name.split(' ')[0].toUpperCase()}`
                    : 'A TU RITMO'}
                </p>
                <h1 ref={pageHeading} tabIndex={-1} className="member-page-heading">
                  {PAGES[page].title}
                </h1>
                <p className="muted">{PAGES[page].description}</p>
              </div>
            </div>
            <Notice>{message}</Notice>
            <Notice error>{error}</Notice>
            {error && (
              <button className="button" onClick={reload}>
                Reintentar
              </button>
            )}
            {loading && (
              <p className="loading" role="status">
                Cargando tu espacio…
              </p>
            )}
            {data && (
              <>
                {page === 'routine' && (
                  <AssignedRoutines
                    assignments={ownAssignments}
                    executions={ownExecutions}
                    machineId={machineContext}
                    canStart={org.serviceActive && membership.role === 'member'}
                    onStart={setSessionId}
                  />
                )}
                {page === 'catalog' && (
                  <MovementCatalog exercises={data.exercises} query={query} onQuery={setQuery} />
                )}
                {page === 'history' && (
                  <ExecutionHistory
                    executions={ownExecutions}
                    branchNames={Object.fromEntries(
                      me.whiteLabel?.branches.map((item) => [item.branch.id, item.branch.name]) ??
                        [],
                    )}
                  />
                )}
              </>
            )}
          </>
        )}
      </Shell>
    </VoiceCapability.Provider>
  )
}
