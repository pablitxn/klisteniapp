import { useRef, useSyncExternalStore, type MouseEvent } from 'react'
import { analytics } from '../lib/analytics'
import Modal from './Modal'
import { useState } from 'react'

export default function PrivacyControls({ onOpenPrivacy }: {
  onOpenPrivacy: (event: MouseEvent<HTMLAnchorElement>) => void
}) {
  const state = useSyncExternalStore(analytics.subscribe, analytics.getSnapshot)
  const [open, setOpen] = useState(false)
  const preferences = useRef<HTMLButtonElement>(null)
  const status = state.reason === 'signals' ? 'Tu navegador pidió no ser rastreado. La medición permanece desactivada.'
    : state.reason === 'storage' ? 'No pudimos guardar tu elección. La medición permanece desactivada.'
    : state.reason === 'tracker' ? 'La medición no está disponible. Podés seguir usando la aplicación.'
    : state.reason === 'config' ? 'La medición está desactivada en esta versión o dirección.' : ''
  function choose(accept: boolean) {
    if (accept) analytics.accept()
    else analytics.reject()
    preferences.current?.focus()
  }
  return <section className="privacy-controls" aria-label="Privacidad">
    <div className="privacy-links">
      <button type="button" ref={preferences} className="text-button" data-testid="privacy-preferences" aria-haspopup="dialog" onClick={() => setOpen(true)}>Preferencias de privacidad</button>
      <a href="/privacy" data-testid="privacy-policy" onClick={onOpenPrivacy}>Privacidad</a>
    </div>
    {state.choice === 'pending' && state.reason !== 'config' && <section className="privacy-banner" aria-label="Medición opcional" data-testid="analytics-consent-banner">
      <div><h2>¿Nos ayudás a conocer las visitas?</h2><p>Con tu permiso, contamos visitas con Umami. No enviamos tus ejercicios, rutinas ni progreso. Podés usar Klisteni igual si rechazás y cambiar tu elección cuando quieras.</p>{status && <p role="status">{status}</p>}</div>
      <div className="privacy-choices"><button type="button" data-testid="analytics-accept" onClick={() => choose(true)}>Aceptar</button><button type="button" data-testid="analytics-reject" onClick={() => choose(false)}>Rechazar</button></div>
    </section>}
    {open && <Modal title="Preferencias de privacidad" onClose={() => setOpen(false)}>
      <div className="privacy-dialog" data-testid="privacy-dialog">
        <p role="status" data-testid="analytics-status">{state.choice === 'accepted' ? 'Permitiste la medición.' : state.choice === 'rejected' ? 'Rechazaste la medición.' : 'Todavía no elegiste.'} {state.enabled ? 'Está activada.' : 'Está desactivada.'} {status}</p>
        <p>Tu elección se guarda durante seis meses en este navegador. No se guardan identificadores de analytics junto a esa elección.</p>
        <div className="privacy-choices"><button type="button" data-testid="analytics-dialog-accept" onClick={() => analytics.accept()}>Aceptar</button><button type="button" data-testid="analytics-dialog-reject" onClick={() => analytics.reject()}>{state.choice === 'accepted' ? 'Retirar permiso' : 'Rechazar'}</button></div>
        <p>Al retirar el permiso, la medición se detiene. Las visitas ya recibidas no se borran automáticamente.</p>
        <a href="/privacy" onClick={event => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey && event.button === 0) setOpen(false); onOpenPrivacy(event) }}>Leer la política de privacidad</a>
      </div>
    </Modal>}
  </section>
}
