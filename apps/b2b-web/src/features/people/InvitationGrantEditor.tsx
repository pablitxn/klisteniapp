import { Field } from '@klisteniapp/b2b-ui'
import {
  selectInvitationGrant,
  type InvitationBranch,
  type InvitationGrant,
} from './invitationGrants'

export function InvitationGrantEditor({
  branches,
  grants,
  disabled,
  onChange,
}: {
  branches: readonly InvitationBranch[]
  grants: readonly InvitationGrant[]
  disabled: boolean
  onChange: (grants: InvitationGrant[]) => void
}) {
  const unavailable = grants.filter(
    (grant) => !branches.some((branch) => branch.branchId === grant.branchId),
  )
  return (
    <fieldset disabled={disabled} className="invitation-grants">
      <legend>Funciones explícitas por sede</legend>
      <p>
        El rol en la marca y las funciones de entrenador/socio son independientes. Ninguna sede o
        función se agrega automáticamente. Inactiva conserva el permiso deshabilitado.
      </p>
      {branches.map((branch) => (
        <section className="invitation-branch" key={branch.branchId}>
          <h3>{branch.name}</h3>
          <p className="small">
            {branch.branchId}
            {branch.status === 'archived' ? ' · Archivada' : ''}
          </p>
          {(['coach', 'member'] as const).map((role) => {
            const grant = grants.find(
              (item) => item.branchId === branch.branchId && item.role === role,
            )
            const value = grant ? (grant.active ? 'active' : 'inactive') : 'none'
            return (
              <Field
                key={role}
                label={`${role === 'coach' ? 'Entrenador' : 'Socio'} en ${branch.name} (${branch.branchId})`}
              >
                <select
                  value={value}
                  onChange={(event) =>
                    onChange(
                      selectInvitationGrant(
                        grants,
                        branch.branchId,
                        role,
                        event.target.value as 'none' | 'active' | 'inactive',
                      ),
                    )
                  }
                >
                  <option value="none">No incluir esta función</option>
                  <option value="active" disabled={branch.status !== 'active'}>
                    Incluir activa{branch.status === 'archived' ? ' · no disponible' : ''}
                  </option>
                  <option value="inactive">Incluir inactiva</option>
                </select>
              </Field>
            )
          })}
        </section>
      ))}
      {unavailable.map((grant) => (
        <div role="alert" key={`${grant.branchId}/${grant.role}`}>
          <p>
            La sede {grant.branchId} ya no está disponible para esta selección. Se conserva tu
            función {grant.role === 'coach' ? 'Entrenador' : 'Socio'}{' '}
            {grant.active ? 'activa' : 'inactiva'}; no se enviará sin validarla.
          </p>
          <button
            className="button"
            type="button"
            onClick={() =>
              onChange(selectInvitationGrant(grants, grant.branchId, grant.role, 'none'))
            }
          >
            Quitar explícitamente {grant.role === 'coach' ? 'Entrenador' : 'Socio'} de{' '}
            {grant.branchId}
          </button>
        </div>
      ))}
      <p role="status">
        {grants.length
          ? `${grants.length} funciones seleccionadas: ${grants.filter((g) => g.active).length} activas y ${grants.filter((g) => !g.active).length} inactivas.`
          : 'Sin funciones por sede: se enviará exactamente una lista vacía.'}
      </p>
      <p className="small">
        Ninguna función autoriza por sí sola datos de salud. Compartir salud requiere el
        consentimiento vigente de la persona.
      </p>
    </fieldset>
  )
}
