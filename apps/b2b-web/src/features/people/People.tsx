import { RoleSchema, type Member } from '@klisteniapp/b2b-contracts'
import { useAccountClient } from '@klisteniapp/b2b-react'
import { Field } from '@klisteniapp/b2b-ui'
import { useState, type FormEvent } from 'react'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'

export function People({
  orgId,
  members,
  brandMembers,
  admin,
  active,
  reload,
}: {
  orgId: string
  members: Member[]
  brandMembers?: Member[]
  admin: boolean
  active: boolean
  reload: () => void
}) {
  const client = useAccountClient()
  const [showInvite, setShowInvite] = useState(false),
    [inviteUrl, setInviteUrl] = useState(''),
    [query, setQuery] = useState('')
  const action = useAction()
  const brandWide = Boolean(brandMembers)
  const roster = brandMembers ?? members
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await action.run(async () => {
      const result = await client.members.invite(orgId, {
        name: String(data.get('name') ?? ''),
        email: String(data.get('email') ?? ''),
        role: RoleSchema.parse(data.get('role')),
      })
      setInviteUrl(result.url)
    }, 'Invitación creada. Compartí este enlace con la persona indicada.')
  }
  async function assign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await action.run(async () => {
      await client.members.assignCoach(orgId, {
        coachId: String(data.get('coachId') ?? ''),
        memberId: String(data.get('memberId') ?? ''),
      })
      reload()
    }, 'Acompañamiento registrado. El equipo autorizado de la sede conserva el acceso.')
  }
  return (
    <>
      <Heading
        title="Personas antes que números."
        description={
          admin
            ? 'Invitá a tu comunidad y asigná a cada socio el equipo que lo acompaña.'
            : 'Podés acompañar a todos los socios de la sede autorizada. Las asignaciones de acompañamiento son informativas.'
        }
      >
        {admin && (
          <button
            className="button primary"
            disabled={!active}
            onClick={() => {
              setShowInvite((value) => !value)
              setInviteUrl('')
              action.clear()
            }}
          >
            {showInvite ? 'Cerrar invitación' : '+ Invitar persona'}
          </button>
        )}
      </Heading>
      {action.notices}
      {brandWide && (
        <p className="small muted">
          Los roles y las pausas de esta tabla se aplican a toda la marca. Administrá las funciones
          por sede desde Marca y sedes. El acompañamiento se asigna en la sede actual.
        </p>
      )}
      {showInvite && (
        <form className="card form-stack" style={{ marginBottom: 22 }} onSubmit={invite}>
          <h2>Una invitación al movimiento</h2>
          <div className="form-grid">
            <Field label="Nombre de la persona">
              <input name="name" required maxLength={100} />
            </Field>
            <Field label="Email de la persona">
              <input name="email" type="email" required maxLength={254} />
            </Field>
            <Field label="Rol en el gimnasio">
              <select name="role">
                <option value="member">Socio</option>
                <option value="coach">Entrenador</option>
                <option value="admin">Administrador</option>
              </select>
            </Field>
          </div>
          <button className="button primary" disabled={action.busy || !active}>
            Crear invitación
          </button>
          {inviteUrl && (
            <div>
              <p className="small muted">Enlace privado de activación:</p>
              <a className="code-link" style={{ display: 'block' }} href={inviteUrl}>
                {inviteUrl}
              </a>
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  void action.run(async () => {
                    await navigator.clipboard.writeText(inviteUrl)
                  }, 'Enlace copiado.')
                }
              >
                Copiar enlace
              </button>
            </div>
          )}
        </form>
      )}
      <Field label="Buscar persona">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Nombre o email"
        />
      </Field>
      <section className="card" style={{ marginTop: 22 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>{brandWide ? 'Rol en la marca' : 'Rol'}</th>
                <th>Equipo</th>
                <th>Estado</th>
                {admin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {roster
                .filter((member) =>
                  `${member.name} ${member.email}`
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((member) => (
                  <tr key={member.userId}>
                    <td>
                      <strong>{member.name}</strong>
                      <br />
                      <span className="small muted">{member.email}</span>
                    </td>
                    <td>
                      {admin ? (
                        <select
                          aria-label={`Rol de ${member.name}`}
                          style={{ minWidth: brandWide ? 230 : 170 }}
                          value={member.role}
                          disabled={action.busy || !active}
                          onChange={(event) =>
                            void action.run(async () => {
                              await client.members.update(orgId, member.userId, {
                                role: RoleSchema.parse(event.target.value),
                              })
                              reload()
                            }, 'Rol actualizado.')
                          }
                        >
                          <option value="member">{brandWide ? 'Persona' : 'Socio'}</option>
                          <option value="coach">
                            {brandWide ? 'Persona (rol heredado)' : 'Entrenador'}
                          </option>
                          <option value="admin">Administrador</option>
                        </select>
                      ) : (
                        { member: 'Socio', coach: 'Entrenador', admin: 'Administrador' }[
                          member.role
                        ]
                      )}
                    </td>
                    <td>
                      {member.coachIds
                        .map(
                          (id) =>
                            roster.find((item) => item.userId === id)?.name ??
                            'Profesional asignado',
                        )
                        .join(', ') || '—'}
                    </td>
                    <td>
                      <span className={`pill ${member.active ? '' : 'warning'}`}>
                        {member.active ? 'Activo' : 'Pausado'}
                      </span>
                    </td>
                    {admin && (
                      <td>
                        <button
                          className="text-button"
                          disabled={action.busy || !active}
                          onClick={() =>
                            void action.run(
                              async () => {
                                await client.members.update(orgId, member.userId, {
                                  active: !member.active,
                                })
                                reload()
                              },
                              member.active
                                ? brandWide
                                  ? 'Acceso a la marca pausado.'
                                  : 'Acceso al gimnasio pausado.'
                                : brandWide
                                  ? 'Acceso a la marca habilitado.'
                                  : 'Acceso al gimnasio habilitado.',
                            )
                          }
                        >
                          {member.active ? 'Pausar acceso' : 'Habilitar acceso'}
                          {brandWide ? ' a la marca' : ''}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {admin && (
        <form className="card form-stack" style={{ marginTop: 24 }} onSubmit={assign}>
          <h2>Asignar acompañamiento</h2>
          <div className="form-grid">
            <Field label="Socio">
              <select name="memberId" required>
                <option value="">Elegí un socio</option>
                {members
                  .filter((member) => member.role === 'member' && member.active)
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Entrenador">
              <select name="coachId" required>
                <option value="">Elegí un profesional</option>
                {members
                  .filter(
                    (member) =>
                      (member.role === 'coach' || member.role === 'admin') && member.active,
                  )
                  .map((member) => (
                    <option key={member.userId} value={member.userId}>
                      {member.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <button className="button primary" disabled={action.busy || !active}>
            Asignar entrenador
          </button>
        </form>
      )}
    </>
  )
}
