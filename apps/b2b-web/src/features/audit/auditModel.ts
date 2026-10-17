import type { ProductOutput } from '@klisteniapp/b2b-contracts/product-v2'
export type AuditChange = ProductOutput<'audit'>[number]
const actions: Record<string, string> = {
  'membership.update': 'Acceso de la persona actualizado',
  'invitation.create': 'Invitación creada',
  'program.create': 'Rutina creada',
  'program.update': 'Rutina editada',
  'program.publish': 'Rutina publicada',
  'program.assign': 'Rutina asignada',
  'routine.create': 'Rutina creada',
  'routine.update': 'Rutina editada',
  'routine.publish': 'Rutina publicada',
  'goal.create': 'Programa creado',
  'goal.update': 'Programa editado',
  'enrollment.create': 'Inscripción creada',
  'period.apply': 'Períodos actualizados',
  'occurrence.move': 'Sesión reprogramada',
}
const fields: Record<string, string> = {
  role: 'Rol en la marca',
  active: 'Estado de la membresía',
  branchGrants: 'Funciones por sede',
  stages: 'Etapas',
  objective: 'Objetivo',
  goal: 'Objetivo',
  steps: 'Movimientos',
  name: 'Nombre',
  content: 'Contenido',
  scheduledDate: 'Fecha programada',
}
export function auditDescription(
  change: AuditChange,
  actors: readonly { userId: string; name: string }[],
) {
  return {
    action: actions[change.action] ?? change.action,
    actor:
      change.actorId === null
        ? 'Sistema'
        : (actors.find((a) => a.userId === change.actorId)?.name ?? `Actor ${change.actorId}`),
    fields: change.changedFields.map((field) => fields[field] ?? field),
    revision:
      change.beforeRevision === null && change.afterRevision === null
        ? null
        : `${change.beforeRevision ?? 'desconocida'} → ${change.afterRevision ?? 'desconocida'}`,
  }
}
