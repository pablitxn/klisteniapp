import { useTranslation } from 'react-i18next'
import { useSyncExternalStore, type MouseEvent } from 'react'
import { analytics } from '../lib/analytics'
import { instanceMode } from '../lib/deployment'

type PrivacyControlsVariant = 'banner' | 'settings' | 'full'

export default function PrivacyControls({ onOpenPrivacy, variant = 'full' }: {
  onOpenPrivacy: (event: MouseEvent<HTMLAnchorElement>) => void
  variant?: PrivacyControlsVariant
}) {
  const { t } = useTranslation('core')
  const state = useSyncExternalStore(analytics.subscribe, analytics.getSnapshot)
  const status = state.reason === 'signals' ? t('Tu navegador pidió no ser rastreado. La medición permanece desactivada.')
    : state.reason === 'storage' ? t('No pudimos guardar tu elección. La medición permanece desactivada.')
    : state.reason === 'tracker' ? t('La medición no está disponible. Podés seguir usando la aplicación.')
    : state.reason === 'config' ? t('La medición está desactivada en esta versión o dirección.') : ''
  function choose(accept: boolean) {
    if (accept) analytics.accept()
    else analytics.reject()
    if (variant === 'banner' && analytics.getSnapshot().choice !== 'pending') document.getElementById('open-settings')?.focus()
  }
  if (variant === 'banner') {
    if (!instanceMode || state.choice !== 'pending' || state.reason === 'config' || state.reason === 'signals') return null
    return <section className="privacy-controls privacy-controls--banner" aria-label={t('Privacidad')}>
      <section className="privacy-banner" aria-label={t('Medición opcional')} data-testid="analytics-consent-banner">
        <div><h2>{t('¿Nos ayudás a conocer las visitas?')}</h2><p>{t('Con tu permiso, contamos visitas con Umami. No enviamos tus ejercicios, rutinas ni progreso. Podés usar Klisteni igual si rechazás y cambiar tu elección cuando quieras.')}</p>{status && <p role="status">{status}</p>}</div>
        <div className="privacy-choices"><button type="button" data-testid="analytics-accept" onClick={() => choose(true)}>{t('Aceptar')}</button><button type="button" data-testid="analytics-reject" onClick={() => choose(false)}>{t('Rechazar')}</button></div>
      </section>
    </section>
  }
  return <section className={`privacy-controls privacy-controls--${variant}`} aria-label={t('Privacidad')}>
    <div className="privacy-dialog" data-testid="privacy-dialog">
      {variant === 'full' && <h2>{t('Preferencias de privacidad')}</h2>}
      {!instanceMode ? <p>{t('Datos en este dispositivo · Sin analytics')}</p> : <>
        <p role="status" data-testid="analytics-status">{state.choice === 'accepted' ? t('Permitiste la medición.') : state.choice === 'rejected' ? t('Rechazaste la medición.') : t('Todavía no elegiste.')} {state.enabled ? t('Está activada.') : t('Está desactivada.')} {status}</p>
        <p>{t('Con tu permiso, contamos visitas con Umami. No enviamos tus ejercicios, rutinas ni progreso. Podés usar Klisteni igual si rechazás y cambiar tu elección cuando quieras.')}</p>
        <p>{t('Tu elección se guarda durante seis meses en este navegador. No se guardan identificadores de analytics junto a esa elección.')}</p>
        <div className="privacy-choices"><button type="button" data-testid="analytics-dialog-accept" onClick={() => choose(true)}>{t('Aceptar')}</button><button type="button" data-testid="analytics-dialog-reject" onClick={() => choose(false)}>{state.choice === 'accepted' ? t('Retirar permiso') : t('Rechazar')}</button></div>
        <p>{t('Al retirar el permiso, la medición se detiene. Las visitas ya recibidas no se borran automáticamente.')}</p>
      </>}
      <a className="privacy-policy-link" href="/privacy" data-testid="privacy-policy" onClick={onOpenPrivacy}>{t('Leer la política de privacidad')}</a>
    </div>
  </section>
}
