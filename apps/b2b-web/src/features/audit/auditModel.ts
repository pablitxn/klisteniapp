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
  'routine.save': 'Rutina guardada',
  'routine.archive': 'Rutina archivada',
  'goal.create': 'Programa creado',
  'goal.update': 'Programa editado',
  'goal.save': 'Programa guardado',
  'goal.archive': 'Programa archivado',
  'goal.activate': 'Programa activado',
  'enrollment.create': 'Inscripción creada',
  'enrollment.period': 'Períodos de la inscripción actualizados',
  'enrollment.end': 'Inscripción finalizada',
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
  revision: 'Revisión',
  draft: 'Borrador',
  publishedVersion: 'Versión publicada',
  archivedAt: 'Fecha de archivo',
  status: 'Estado',
  timeZone: 'Zona horaria',
  goalProgramId: 'Programa de origen',
  issuedGoalRevision: 'Revisión original del programa',
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
