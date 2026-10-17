import { useEffect, useRef, useState, type FormEvent } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import {
  OrganizationRoleV2Schema,
  type ProductAccess,
  type ProductInput,
  type ProductOutput,
} from '@klisteniapp/b2b-contracts/product-v2'
import { Field } from '@klisteniapp/b2b-ui'
import { useLoad } from '@klisteniapp/b2b-react'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'
import { canManagePerson, creatableRoles, productRoleLabels } from './peopleCapabilities'

export function ProductPeople({
  client,
  access,
  branchId,
  people,
  active,
  reload,
}: {
  client: ProductV2Client
  access: ProductAccess
  branchId: string
  people: ProductOutput<'people'>
  active: boolean
  reload: () => void
}) {
  const [query, setQuery] = useState(''),
    [inviteUrl, setInviteUrl] = useState('')
  const [auditId, setAuditId] = useState<string | null>(null)
  const action = useAction(),
    roles = creatableRoles(access)
  const pending = useRef(new Map<string, { operationId: string; id: string }>())
  function operation(key: string) {
    let value = pending.current.get(key)
    if (!value) {
      value = { operationId: crypto.randomUUID(), id: crypto.randomUUID() }
      pending.current.set(key, value)
    }
    return value
  }
  async function update(input: Omit<ProductInput<'updateMember'>, 'operationId'>) {
    const key = `member:${JSON.stringify(input)}`
    await client.call('updateMember', { ...input, operationId: operation(key).operationId })
    pending.current.delete(key)
    reload()
  }
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const role = OrganizationRoleV2Schema.parse(data.get('role'))
    await action.run(async () => {
      const email = String(data.get('email')),
        name = String(data.get('name'))
      const key = `invitation:${JSON.stringify({ email, name, role })}`
      const invitation = await client.call('inviteMember', {
        ...operation(key),
        expectedRevision: 0,
        email,
        name,
        role,
        branchGrants:
          role === 'member' || role === 'coach' ? [{ branchId, role, active: true }] : [],
      })
      pending.current.delete(key)
      setInviteUrl(invitation.invitationUrl)
    }, 'Invitación creada. Compartí el enlace con la persona indicada.')
  }
  return (
    <>
      <Heading
        title="Personas antes que números."
        description="El equipo puede acompañar a todos los socios de la sede autorizada. Las asignaciones de acompañamiento son informativas."
      />
      {action.notices}
      <Field label="Buscar persona">
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
      </Field>
      <ul className="form-stack" style={{ listStyle: 'none', padding: 0 }}>
        {people
          .filter((p) =>
            `${p.name} ${p.email}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
          )
          .map((person) => (
            <li className="card form-stack" key={person.userId}>
              <h2 style={{ overflowWrap: 'anywhere' }}>{person.name}</h2>
              <p style={{ overflowWrap: 'anywhere' }}>{person.email}</p>
              <p>
                {productRoleLabels[person.role]} ·{' '}
                {person.active
                  ? 'Activo'
                  : 'Pausado: historial disponible para el equipo autorizado'}
              </p>
              {canManagePerson(access, person) && (
                <>
                  <Field label={`Rol de ${person.name}`}>
                    <select
                      value={person.role}
                      disabled={!active || action.busy}
                      onChange={(event) => {
                        const role = OrganizationRoleV2Schema.parse(event.target.value)
                        void action.run(async () => {
                          await update({
                            memberId: person.userId,
                            expectedRevision: person.revision,
                            role,
                          })
                        }, 'Rol actualizado.')
                      }}
                    >
                      {roles.map((role) => (
                        <option value={role} key={role}>
                          {productRoleLabels[role]}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <button
                    className="button"
                    disabled={!active || action.busy}
                    onClick={() =>
                      void action.run(
                        async () => {
                          await update({
                            memberId: person.userId,
                            expectedRevision: person.revision,
                            active: !person.active,
                          })
                        },
                        person.active
                          ? 'Acceso pausado.'
                          : 'Acceso habilitado. Los permisos revocados no se restauran automáticamente.',
                      )
                    }
                  >
                    {person.active ? 'Pausar' : 'Habilitar'} acceso de {person.name}
                  </button>
                </>
              )}
              {access.capabilities.includes('edit-planning') && (
                <button className="button" onClick={() => setAuditId(person.userId)}>
                  Ver cambios de {person.name}
                </button>
              )}
            </li>
          ))}
      </ul>
      {people.length === 0 && <p role="status">No hay personas en esta sede.</p>}
      {roles.length > 0 && !branchId && (
        <p role="status">Elegí una sede autorizada para invitar personas.</p>
      )}
      {roles.length > 0 && branchId && (
        <form className="card form-stack" onSubmit={invite}>
          <h2>Invitar persona</h2>
          <Field label="Nombre de la persona">
            <input name="name" required maxLength={100} />
          </Field>
          <Field label="Email de la persona">
            <input name="email" type="email" required maxLength={254} />
          </Field>
          <Field label="Rol en la marca">
            <select name="role">
              {roles.map((role) => (
                <option key={role} value={role}>
                  {productRoleLabels[role]}
                </option>
              ))}
            </select>
          </Field>
          <button className="button primary" disabled={!active || action.busy}>
            Crear invitación
          </button>
          {inviteUrl && (
            <a style={{ overflowWrap: 'anywhere' }} href={inviteUrl}>
              {inviteUrl}
            </a>
          )}
        </form>
      )}
      {auditId && (
        <ProductAudit client={client} resourceId={auditId} close={() => setAuditId(null)} />
      )}
    </>
  )
}

/** Can also be used by planning views with their immutable resource ID. */
export function ProductAudit({
  client,
  resourceId,
  close,
}: {
  client: ProductV2Client
  resourceId: string
  close: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const changes = useLoad(() => client.call('audit', { id: resourceId }), resourceId)
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialog.current?.showModal()
    return () => {
      previous?.focus()
    }
  }, [])
  return (
    <dialog
      ref={dialog}
      aria-labelledby="product-audit-title"
      onCancel={close}
      style={{ width: 'min(560px, calc(100% - 32px))', maxHeight: '85vh', overflow: 'auto' }}
    >
      <h2 id="product-audit-title">Cambios registrados</h2>
      <button autoFocus className="button" onClick={close}>
        Cerrar cambios
      </button>
      {changes.loading && <p role="status">Cargando cambios…</p>}
      {changes.error && <p role="alert">{changes.error}</p>}
      {changes.data?.length === 0 && (
        <p>No hay cambios visibles para este recurso en la sede actual.</p>
      )}
      <ol>
        {changes.data?.map((change) => (
          <li key={change.id} style={{ overflowWrap: 'anywhere' }}>
            <p>
              {change.action} · {change.actorId ?? 'Sistema'} ·{' '}
              <time dateTime={change.createdAt}>{new Date(change.createdAt).toLocaleString()}</time>
            </p>
            <p>
              {change.changedFields.length
                ? change.changedFields.join(', ')
                : 'El registro histórico no conserva el detalle del cambio.'}
            </p>
            {change.afterRevision !== null && (
              <p>
                Revisión {change.beforeRevision ?? 'desconocida'} → {change.afterRevision}
              </p>
            )}
          </li>
        ))}
      </ol>
    </dialog>
  )
}
