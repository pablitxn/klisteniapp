import { useState, type FormEvent } from 'react'
import { RoleSchema, type Member, type Organization, type Report } from '@klisteniapp/b2b-contracts'
import { useAccountClient, dateLabel, Empty, Field, Notice } from '@klisteniapp/b2b-ui'
import { Heading, useAction } from './shared'
import { MediaLibrary } from './MediaLibrary'

export function People({
  orgId,
  members,
  admin,
  active,
  reload,
}: {
  orgId: string
  members: Member[]
  admin: boolean
  active: boolean
  reload: () => void
}) {
  const client = useAccountClient()
  const [showInvite, setShowInvite] = useState(false),
    [inviteUrl, setInviteUrl] = useState(''),
    [query, setQuery] = useState('')
  const action = useAction()
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
    }, 'Profesional asignado. Ya puede acompañar a esta persona.')
  }
  return (
    <>
      <Heading
        title="Personas antes que números."
        description={
          admin
            ? 'Invitá a tu comunidad y asigná a cada socio el equipo que lo acompaña.'
            : 'Las personas que acompañás. Tus permisos se limitan a tus socios asignados.'
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
                <th>Rol</th>
                <th>Equipo</th>
                <th>Estado</th>
                {admin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {members
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
                          <option value="member">Socio</option>
                          <option value="coach">Entrenador</option>
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
                            members.find((item) => item.userId === id)?.name ??
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
                                ? 'Acceso al gimnasio pausado.'
                                : 'Acceso al gimnasio habilitado.',
                            )
                          }
                        >
                          {member.active ? 'Pausar acceso' : 'Habilitar acceso'}
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
export function BrandSettings({
  organization,
  active,
  onSaved,
}: {
  organization: Organization
  active: boolean
  onSaved: (organization: Organization) => void
}) {
  const client = useAccountClient()
  const action = useAction(),
    brand = organization.brand
  const [color, setColor] = useState(brand.color),
    [logoUrl, setLogoUrl] = useState(brand.logoUrl),
    [chooseLogo, setChooseLogo] = useState(false)
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    await action.run(async () => {
      const result = await client.brand.update(organization.id, {
        name: String(data.get('name') ?? ''),
        description: String(data.get('description') ?? ''),
        color,
        logoUrl,
        contact: String(data.get('contact') ?? ''),
        address: String(data.get('address') ?? ''),
      })
      onSaved(result.organization)
    }, 'Identidad guardada en la app. Revisá y publicá el website para actualizar su versión pública.')
  }
  return (
    <>
      <Heading
        title="Un espacio con tu identidad."
        description="La misma marca acompaña a tus socios en la web pública, su app y este espacio."
      >
        <a className="button" href={`/g/${organization.slug}`} target="_blank" rel="noreferrer">
          Ver web pública ↗
        </a>
      </Heading>
      <form className="card form-stack" onSubmit={save}>
        <div className="form-grid">
          <Field label="Nombre del gimnasio">
            <input name="name" required maxLength={100} defaultValue={brand.name} />
          </Field>
          <Field label="Color principal">
            <input type="color" value={color} onChange={(event) => setColor(event.target.value)} />
          </Field>
          <Field
            label="URL del logo"
            hint="Ruta local o HTTPS. Dejá vacío para usar la marca tipográfica."
          >
            <input
              name="logoUrl"
              value={logoUrl}
              onChange={(event) => setLogoUrl(event.target.value)}
              maxLength={2048}
            />
          </Field>
          <Field label="Contacto público">
            <input name="contact" defaultValue={brand.contact} maxLength={200} />
          </Field>
          <Field label="Dirección">
            <input name="address" defaultValue={brand.address} maxLength={300} />
          </Field>
        </div>
        <button
          type="button"
          className="button"
          onClick={() => setChooseLogo((current) => !current)}
        >
          {chooseLogo ? 'Cerrar biblioteca del logo' : 'Elegir o subir logo'}
        </button>
        {chooseLogo && (
          <MediaLibrary
            orgId={organization.id}
            imagesOnly
            disabled={!active || action.busy}
            onChoose={(asset) => {
              setLogoUrl(asset.url)
              setChooseLogo(false)
            }}
          />
        )}
        <Field label="Presentación del gimnasio">
          <textarea name="description" defaultValue={brand.description} maxLength={2000} />
        </Field>
        <div className="hero" style={{ background: color }}>
          <p className="eyebrow">UN ESPACIO PARA VOS</p>
          <h2>{brand.name}</h2>
          <p>Tu marca, en cada nuevo movimiento.</p>
        </div>
        {action.notices}
        <button className="button primary" disabled={!active || action.busy}>
          {action.busy ? 'Guardando…' : 'Guardar identidad'}
        </button>
      </form>
    </>
  )
}
export function Reports({ report }: { report: Report }) {
  const [memberId, setMemberId] = useState('')
  const executions = report.executions.filter(
    (execution) => !memberId || execution.memberId === memberId,
  )
  return (
    <>
      <Heading
        title="Acompañar también es observar."
        description="Compará la rutina asignada con lo realizado, incluyendo cambios, cargas y sesiones parciales."
      />
      <div className="grid three" style={{ marginBottom: 25 }}>
        <div className="card stat">
          <strong>{report.members.length}</strong>
          <span>Socios a tu cargo</span>
        </div>
        <div className="card stat">
          <strong>{report.members.reduce((sum, item) => sum + item.completed, 0)}</strong>
          <span>Sesiones completas</span>
        </div>
        <div className="card stat">
          <strong>{report.members.reduce((sum, item) => sum + item.partial, 0)}</strong>
          <span>Sesiones parciales</span>
        </div>
      </div>
      <Field label="Filtrar seguimiento por socio">
        <select value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          <option value="">Todas las personas autorizadas</option>
          {report.members.map((member) => (
            <option value={member.userId} key={member.userId}>
              {member.name}
            </option>
          ))}
        </select>
      </Field>
      <section className="card" style={{ marginTop: 24 }}>
        <h2>Un vistazo a cada recorrido</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Rutinas</th>
                <th>Completas</th>
                <th>Parciales</th>
                <th>Última actividad</th>
              </tr>
            </thead>
            <tbody>
              {report.members
                .filter((member) => !memberId || member.userId === memberId)
                .map((member) => (
                  <tr key={member.userId}>
                    <td>{member.name}</td>
                    <td>{member.assignments}</td>
                    <td>{member.completed}</td>
                    <td>{member.partial}</td>
                    <td>
                      {member.lastActivityAt
                        ? dateLabel(member.lastActivityAt)
                        : 'Todavía sin sesiones'}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      <h2 style={{ marginTop: 32 }}>Planificado y realizado</h2>
      {executions.length ? (
        <div className="list">
          {executions.map((execution) => (
            <article className="card" key={execution.id}>
              <div className="card-head">
                <div>
                  <p className="eyebrow">
                    {execution.memberName} · {dateLabel(execution.completedAt)}
                  </p>
                  <h2>{execution.program.name}</h2>
                </div>
                <span className={`pill ${execution.status === 'completed' ? 'done' : 'warning'}`}>
                  {execution.status === 'completed' ? 'Completada' : 'Parcial'}
                </span>
              </div>
              <p className="small muted">
                Versión asignada: {execution.program.version}. Los valores planificados pertenecen a
                esa versión.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Movimiento planificado</th>
                      <th>Serie</th>
                      <th>Objetivo</th>
                      <th>Realizado</th>
                      <th>Ejercicio realizado / motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execution.program.steps.flatMap((step) =>
                      Array.from({ length: step.sets }, (_, index) => {
                        const set = execution.sets.find(
                          (set) => set.stepId === step.id && set.set === index + 1,
                        )
                        const planned = execution.program.exercises.find(
                          (exercise) => exercise.id === step.exerciseId,
                        )
                        return (
                          <tr key={`${step.id}-${index}`}>
                            <td>{planned?.name ?? step.exerciseId}</td>
                            <td>{index + 1}</td>
                            <td>
                              {step.reps} reps{step.loadKg !== null ? ` · ${step.loadKg} kg` : ''}
                            </td>
                            <td>
                              {set ? (
                                `${set.reps} reps${set.loadKg !== null ? ` · ${set.loadKg} kg` : ''}`
                              ) : (
                                <span className="muted">Sin registrar</span>
                              )}
                            </td>
                            <td>
                              {set && set.exerciseId !== step.exerciseId ? (
                                <>
                                  {execution.program.exercises.find(
                                    (exercise) => exercise.id === set.exerciseId,
                                  )?.name ?? set.exerciseId}
                                  <br />
                                  <small>{set.reason}</small>
                                </>
                              ) : set ? (
                                'Según lo previsto'
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        )
                      }),
                    )}
                  </tbody>
                </table>
              </div>
              {execution.notes && <Notice>{execution.notes}</Notice>}
            </article>
          ))}
        </div>
      ) : (
        <Empty title="El recorrido se escribe entrenando">
          Los registros de tus socios aparecerán acá cuando confirmen sus sesiones.
        </Empty>
      )}
    </>
  )
}
