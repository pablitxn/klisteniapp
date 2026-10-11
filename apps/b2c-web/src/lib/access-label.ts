import type { AccountAccess } from './account-api'
import { cloudWriteAllowed } from './cloud-access'

type TranslateAccessLabel = (key: string, values?: { count: number }) => string
const spanishLabel: TranslateAccessLabel = (key, values) => values ? key.replace('{{count}}', String(values.count)) : key

export function accessLabel(access: AccountAccess | null, translate: TranslateAccessLabel = spanishLabel) {
  if (!access) return translate('Consultando tu acceso a la nube')
  if (access.status === 'lifetime') return translate('Acceso vitalicio')
  if (!cloudWriteAllowed(access)) return translate('Guardado en la nube pausado')
  if (access.status === 'trial') {
    const days = Math.max(0, Math.ceil((Date.parse(access.trialEndsAt ?? '') - Date.now()) / 86_400_000))
    return translate(days === 1 ? 'Prueba de la nube · {{count}} día restante' : 'Prueba de la nube · {{count}} días restantes', { count: days })
  }
  return translate('Suscripción activa')
}
