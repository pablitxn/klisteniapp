import { cloudWriteAllowed, type AccountAccess } from './account-api'

export function accessLabel(access: AccountAccess | null) {
  if (!access) return 'Consultando tu acceso a la nube'
  if (access.status === 'lifetime') return 'Acceso vitalicio'
  if (!cloudWriteAllowed(access)) return 'Guardado en la nube pausado'
  if (access.status === 'trial') {
    const days = Math.max(0, Math.ceil((Date.parse(access.trialEndsAt ?? '') - Date.now()) / 86_400_000))
    return `Prueba de la nube · ${days} ${days === 1 ? 'día restante' : 'días restantes'}`
  }
  return 'Suscripción activa'
}
