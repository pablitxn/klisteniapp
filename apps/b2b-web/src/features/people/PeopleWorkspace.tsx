import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type FormEvent } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductAccess, ProductInput } from '@klisteniapp/b2b-contracts/product-v2'
import { Field } from '@klisteniapp/b2b-ui'
import { AuditDrawer } from '../audit/AuditDrawer'
import { PeopleController, type PeopleState } from './peopleController'
import { canManagePerson, creatableRoles, productRoleLabels } from './peopleCapabilities'
import {
  currentBranchGrants,
  invitationInput,
  lastVisibleSuperadmin,
  peopleContextAllowed,
  peopleContextKey,
  replaceCurrentBranchGrants,
  type PeopleContext,
  type Person,
} from './peopleModel'
import './people.css'

type ClientFactory = (signal?: AbortSignal) => ProductV2Client
export function PeopleWorkspace({
  context,
  accessKey,
  createClient,
  branchName,
}: {
  context: PeopleContext
  accessKey: string
  createClient: ClientFactory
  branchName?: string
}) {
  const key = `${accessKey}/${peopleContextKey(context)}`
  return peopleContextAllowed(context) ? (
    <ScopedPeople key={key} context={context} createClient={createClient} branchName={branchName} />
  ) : (
    <p role="status">Elegí una organización, sede y función autorizadas para ver personas.</p>
  )
}
function ScopedPeople({
  context,
  createClient,
  branchName,
}: {
  context: PeopleContext
  createClient: ClientFactory
  branchName?: string
}) {
  const factory = useRef(createClient)
  factory.current = createClient
  const controller = useMemo(
    () => new PeopleController(context, (signal) => factory.current(signal)),
    [context],
  )
  const state = useSyncExternalStore(
    controller.subscribe,
    controller.getSnapshot,
    controller.getSnapshot,
  )
  const [audit, setAudit] = useState<{ id: string; name?: string } | null>(null)
  let network: AbortSignal | null | undefined
  try {
    network = context.requestSignal?.()
  } catch {
    network = null
  }
  useEffect(() => {
    const disconnect = controller.connect()
    void controller.load()
    return disconnect
  }, [controller])
  useEffect(() => {
    if (network === null || network?.aborted) {
      controller.suspend()
      return
    }
    const abort = () => controller.suspend()
    network?.addEventListener('abort', abort, { once: true })
    return () => network?.removeEventListener('abort', abort)
  }, [controller, network])
  const combined = useMemo(
    () => AbortSignal.any([context.signal, ...(network ? [network] : [])]),
    [context.signal, network],
  )
  return (
    <>
      <PeopleView
        state={state}
        access={context.access!}
        branchId={context.branchId}
        branchName={branchName}
        onUpdate={(input) => controller.update(input)}
        onInvite={(input) => controller.invite(input)}
        onRefresh={() => void controller.load()}
        onRetry={() => void controller.retry()}
        onDismissInvitation={controller.dismissInvitation}
        onAudit={(id, name) => setAudit({ id, name })}
      />
      {audit && !state.blocked && !combined.aborted && (
        <AuditDrawer
          key={audit.id}
          createClient={createClient}
          resourceId={audit.id}
          resourceName={audit.name}
          actors={state.people}
          signal={combined}
          close={() => setAudit(null)}
        />
      )}
    </>
  )
}

type ViewProps = {
  state: PeopleState
  access: ProductAccess
  branchId: string
  branchName?: string
  onUpdate: (input: Omit<ProductInput<'updateMember'>, 'operationId'>) => Promise<Person | null>
  onInvite: (input: ProductInput<'inviteMember'>) => Promise<unknown>
  onRefresh: () => void
  onRetry: () => void
  onDismissInvitation: () => void
  onAudit: (id: string, name?: string) => void
}
export function PeopleView({
  state,
  access,
  branchId,
  branchName,
  onUpdate,
  onInvite,
  onRefresh,
  onRetry,
  onDismissInvitation,
  onAudit,
}: ViewProps) {
  const [query, setQuery] = useState(''),
    [resource, setResource] = useState('')
  const disabled = state.busy || state.retry || state.blocked || state.loading
  const roles = creatableRoles(access),
    filtered = state.people.filter((p) =>
      `${p.name} ${p.email}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    )
  function lookup(event: FormEvent) {
    event.preventDefault()
    if (resource.trim()) onAudit(resource.trim())
  }
  return (
    <section className="people-feature" aria-label="Personas del gimnasio">
      <h1>Personas del gimnasio</h1>
      <p>
        Sede actual: <strong>{branchName ?? branchId}</strong>. Función seleccionada:{' '}
        <strong>{productRoleLabels[access.role]}</strong>.
      </p>
      <p>
        El equipo autorizado puede acompañar a los socios de esta sede. El acompañamiento asignado
        es informativo.
      </p>
      {state.error && (
        <div role="alert">
          <p>{state.error}</p>
          {state.refresh && (
            <p>
              Recargar no reemplaza tus campos sin guardar. Revisá la versión actual antes de
              descartarlos.
            </p>
          )}
        </div>
      )}
      {state.message && <p role="status">{state.message}</p>}
      {state.loading && <p role="status">Cargando personas autorizadas…</p>}
      <div className="people-actions">
        <button className="button" disabled={state.busy || state.loading} onClick={onRefresh}>
          Recargar lista y validar acceso
        </button>
        {state.retry && (
          <button
            className="button primary"
            disabled={state.busy || state.blocked || state.loading}
            onClick={onRetry}
          >
            Reintentar la misma operación
          </button>
        )}
      </div>
      {!state.blocked && (
        <>
          <Field label="Buscar persona">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o email"
            />
          </Field>
          {!state.loading && !filtered.length && (
            <p role="status">
              {state.people.length
                ? 'No hay personas que coincidan con la búsqueda.'
                : 'No hay personas visibles en este contexto.'}
            </p>
          )}
          <div className="people-roster">
            {filtered.map((person) => (
              <article className="card people-card" key={person.userId}>
                <h2>{person.name}</h2>
                <p>{person.email}</p>
                <p>
                  {productRoleLabels[person.role]} ·{' '}
                  {person.active
                    ? 'Membresía activa'
                    : 'Membresía inactiva: el historial se conserva'}
                </p>
                <p>
                  Funciones en esta sede:{' '}
                  {Object.entries(currentBranchGrants(person, branchId))
                    .filter(([, active]) => active)
                    .map(([role]) => (role === 'coach' ? 'Entrenador' : 'Socio'))
                    .join(', ') || 'Sin funciones activas'}
                </p>
                {canManagePerson(access, person) && (
                  <PersonEditor
                    person={person}
                    branchId={branchId}
                    access={access}
                    disabled={disabled}
                    lastSuperadmin={lastVisibleSuperadmin(person, state.people)}
                    onUpdate={onUpdate}
                  />
                )}
                {access.capabilities.includes('edit-planning') && (
                  <button
                    className="button"
                    disabled={state.busy}
                    onClick={() => onAudit(person.userId, person.name)}
                  >
                    Ver cambios de {person.name}
                  </button>
                )}
              </article>
            ))}
          </div>
          {roles.length > 0 && (
            <InvitationEditor
              access={access}
              branchId={branchId}
              disabled={disabled}
              onInvite={onInvite}
              completedId={state.invitation?.id}
            />
          )}
          {state.invitation && (
            <section className="card people-card" aria-label="Invitación creada">
              <h2>Enlace privado de activación</h2>
              <p>
                Rol: {productRoleLabels[state.invitation.role]}. Vence:{' '}
                <time dateTime={state.invitation.expiresAt}>
                  {new Date(state.invitation.expiresAt).toLocaleString()}
                </time>
                .
              </p>
              <label>
                Enlace para compartir
                <input
                  readOnly
                  value={state.invitation.invitationUrl}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </label>
              <a className="code-link" href={state.invitation.invitationUrl}>
                Abrir invitación de la persona
              </a>
              <button className="button" onClick={onDismissInvitation}>
                Ocultar enlace privado
              </button>
            </section>
          )}
          {access.capabilities.includes('edit-planning') && (
            <form className="card people-card" onSubmit={lookup}>
              <h2>Consultar cambios de planificación</h2>
              <p>
                Usá el ID de una rutina, programa o inscripción. Solo se mostrarán cambios
                autorizados en la sede actual.
              </p>
              <Field label="ID del recurso de planificación">
                <input
                  value={resource}
                  onChange={(e) => setResource(e.target.value)}
                  required
                  maxLength={200}
                />
              </Field>
              <button className="button" disabled={!resource.trim() || state.busy}>
                Ver cambios del recurso
              </button>
            </form>
          )}
        </>
      )}
    </section>
  )
}

export function PersonEditor({
  person,
  branchId,
  access,
  disabled,
  lastSuperadmin,
  onUpdate,
}: {
  person: Person
  branchId: string
  access: ProductAccess
  disabled: boolean
  lastSuperadmin: boolean
  onUpdate: ViewProps['onUpdate']
}) {
  const [base, setBase] = useState(person),
    [role, setRole] = useState(person.role),
    [active, setActive] = useState(person.active)
  const [grants, setGrants] = useState(() => currentBranchGrants(person, branchId)),
    [dirty, setDirty] = useState(false)
  const stale = base.revision !== person.revision
  function reset(next: Person) {
    setBase(next)
    setRole(next.role)
    setActive(next.active)
    setGrants(currentBranchGrants(next, branchId))
    setDirty(false)
  }
  useEffect(() => {
    if (!dirty) {
      setBase(person)
      setRole(person.role)
      setActive(person.active)
      setGrants(currentBranchGrants(person, branchId))
    }
  }, [person, branchId, dirty])
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!dirty || disabled || stale || (lastSuperadmin && (!active || role !== 'superadmin')))
      return
    const input: Omit<ProductInput<'updateMember'>, 'operationId'> = {
      memberId: base.userId,
      expectedRevision: base.revision,
    }
    if (role !== base.role) input.role = role
    if (active !== base.active) input.active = active
    const previous = currentBranchGrants(base, branchId)
    if (previous.coach !== grants.coach || previous.member !== grants.member)
      input.branchGrants = replaceCurrentBranchGrants(base, branchId, grants)
    if (
      input.role === undefined &&
      input.active === undefined &&
      input.branchGrants === undefined
    ) {
      setDirty(false)
      return
    }
    const response = await onUpdate(input)
    if (response) reset(response)
  }
  return (
    <form className="people-editor" onSubmit={save} aria-label={`Editar acceso de ${person.name}`}>
      <p>
        Revisión actual: {person.revision}. El rol en la marca y las funciones por sede son permisos
        distintos.
      </p>
      {lastSuperadmin && (
        <p role="status">
          Es el último superadministrador activo visible. La marca debe conservar uno; el servidor
          vuelve a verificarlo al guardar.
        </p>
      )}
      {stale && dirty && (
        <p role="alert">
          Este acceso cambió mientras lo editabas. Tus campos siguen aquí. Revisá la versión actual
          y descartá este borrador para continuar.
        </p>
      )}
      <Field label={`Rol en la marca de ${person.name}`}>
        <select
          value={role}
          disabled={disabled || lastSuperadmin}
          onChange={(e) => {
            setRole(e.target.value as Person['role'])
            setDirty(true)
          }}
        >
          {creatableRoles(access).map((value) => (
            <option key={value} value={value}>
              {productRoleLabels[value]}
            </option>
          ))}
        </select>
      </Field>
      <label className="people-check">
        <input
          type="checkbox"
          checked={active}
          disabled={disabled || lastSuperadmin}
          onChange={(e) => {
            setActive(e.target.checked)
            setDirty(true)
          }}
        />
        Membresía activa de {person.name}
      </label>
      <p className="small">
        Desactivar revoca la salud compartida con esta marca. Reactivar conserva el historial y no
        restaura el consentimiento ni funciones revocadas.
      </p>
      <fieldset disabled={disabled}>
        <legend>Funciones de {person.name} en la sede actual</legend>
        <label className="people-check">
          <input
            type="checkbox"
            checked={grants.coach}
            onChange={(e) => {
              setGrants({ ...grants, coach: e.target.checked })
              setDirty(true)
            }}
          />
          Entrenador en esta sede
        </label>
        <label className="people-check">
          <input
            type="checkbox"
            checked={grants.member}
            onChange={(e) => {
              setGrants({ ...grants, member: e.target.checked })
              setDirty(true)
            }}
          />
          Socio en esta sede
        </label>
        <p className="small">
          Los permisos de otras sedes se conservan. Cambiar el rol no agrega sedes automáticamente.
        </p>
      </fieldset>
      <div className="people-actions">
        <button className="button primary" disabled={disabled || !dirty || stale}>
          Guardar acceso de {person.name}
        </button>
        {dirty && (
          <button
            className="button"
            type="button"
            disabled={disabled}
            onClick={() => reset(person)}
          >
            Descartar borrador y usar revisión actual
          </button>
        )}
      </div>
    </form>
  )
}

export function InvitationEditor({
  access,
  branchId,
  disabled,
  onInvite,
  completedId,
}: {
  access: ProductAccess
  branchId: string
  disabled: boolean
  onInvite: ViewProps['onInvite']
  completedId?: string
}) {
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [role, setRole] = useState<Person['role']>('member'),
    [error, setError] = useState('')
  useEffect(() => {
    if (completedId) {
      setName('')
      setEmail('')
    }
  }, [completedId])
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await onInvite(
        invitationInput(
          access,
          branchId,
          { name, email, role },
          { id: crypto.randomUUID(), operationId: crypto.randomUUID() },
        ),
      )
      if (result) {
        setName('')
        setEmail('')
      }
    } catch {
      setError('Revisá el nombre, email y rol permitido antes de crear la invitación.')
    }
  }
  return (
    <form className="card people-card" onSubmit={submit} aria-label="Invitar persona">
      <h2>Invitar persona</h2>
      <p>
        Entrenadores y socios reciben una sola función en esta sede. Administradores y
        superadministradores reciben el rol de marca sin funciones de sede adicionales. Las
        invitaciones con varias funciones o sedes todavía no están disponibles.
      </p>
      {error && <p role="alert">{error}</p>}
      <Field label="Nombre de la persona invitada">
        <input
          required
          value={name}
          maxLength={100}
          disabled={disabled}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
        />
      </Field>
      <Field label="Email de la persona invitada">
        <input
          required
          type="email"
          value={email}
          maxLength={254}
          disabled={disabled}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </Field>
      <Field label="Rol de la persona invitada">
        <select
          value={role}
          disabled={disabled}
          onChange={(e) => setRole(e.target.value as Person['role'])}
        >
          {creatableRoles(access).map((value) => (
            <option key={value} value={value}>
              {productRoleLabels[value]}
            </option>
          ))}
        </select>
      </Field>
      <button className="button primary" disabled={disabled || !branchId}>
        Crear invitación
      </button>
    </form>
  )
}
