import { useEffect, useState } from 'react'
import { accountApi, cloudWriteAllowed, type AccountBilling } from '../lib/account-api'
import { accessLabel } from '../lib/access-label'
import { useAppStore } from '../lib/store'

const dateLabel = (value: string) => new Date(value).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
export function FreeCloudComparison() {
  return <details className="feature-comparison"><summary>Qué incluye cada modalidad</summary><div className="feature-comparison-grid">
    <div><h4>En este dispositivo · Gratis</h4><p>Catálogo, rutinas, entrenamientos, progreso, metas, dashboard e importación manual de salud. Guardado local y exportación de tus datos.</p><p className="fine-print">Cada navegador conserva su propia copia. Exportala para llevarla a otro dispositivo.</p></div>
    <div><h4>Con cuenta · Nube</h4><p>Tu información guardada en el servidor y disponible entre dispositivos, con una sesión persistente. Prueba de 15 días por invitación o acceso vitalicio.</p><p className="fine-print">La conexión automática con Google Health todavía no está disponible. Podés importar archivos de salud manualmente.</p></div>
  </div></details>
}
function downloadAccount() {
  const url = URL.createObjectURL(new Blob([useAppStore.getState().exportData()], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = 'klisteni-mi-cuenta.json'; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function checkoutDestination(raw: string) {
  const url = new URL(raw)
  if (url.protocol !== 'https:' || url.username || url.password || !['mercadopago.com', 'mercadopago.com.ar'].some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`))) throw new Error('No pudimos verificar el enlace de Mercado Pago.')
  return url.href
}
const subscriptionStatus: Record<string, string> = { creating: 'Alta pendiente de confirmar', pending: 'Pendiente de autorización', authorized: 'Autorizada; el acceso depende del pago confirmado', active: 'Activa', paused: 'Pausada', cancelled: 'Cancelada', canceled: 'Cancelada' }
export default function BillingPanel({ userId }: { userId: string }) {
  const access = useAppStore(s => s.access)
  const canExport = useAppStore(s => Boolean(s.personalData && !s.accountLoading))
  const [billing, setBilling] = useState<AccountBilling | null>(null)
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let active = true
    setLoading(true)
    void accountApi.billing(userId).then(result => {
      if (!active || useAppStore.getState().user?.id !== userId) return
      setBilling(result); useAppStore.getState().setAccess(result.access); setError('')
    }).catch(reason => { if (active) setError(reason instanceof Error ? reason.message : 'No pudimos consultar tu suscripción.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [userId, attempt])
  async function refresh(cancel = false) {
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await (cancel ? accountApi.cancelBilling(userId) : billing?.mode === 'disabled' ? accountApi.billing(userId) : accountApi.refreshBilling(userId))
      if (useAppStore.getState().user?.id !== userId) return
      setBilling(result); useAppStore.getState().setAccess(result.access); setConfirmCancel(false)
      setNotice(cancel ? 'Suscripción cancelada. El acceso ya abonado se mantiene hasta su vencimiento.' : 'Estado consultado en el servidor. Solo un pago confirmado habilita el acceso de la suscripción.')
      if (result.access.cloudWrite) await useAppStore.getState().refreshState()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos confirmar el cambio.') }
    finally { setBusy(false) }
  }
  async function checkout(plan: 'monthly' | 'yearly') {
    setBusy(true); setError('')
    try {
      const result = await accountApi.checkout(plan, userId)
      if (useAppStore.getState().user?.id === userId) window.location.assign(checkoutDestination(result.checkoutUrl))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No pudimos abrir Mercado Pago.') }
    finally { setBusy(false) }
  }
  const expired = access && !cloudWriteAllowed(access)
  return <section className={`account-section billing-panel ${expired ? 'billing-expired' : ''}`} aria-label="Acceso y suscripción">
    <span className="eyebrow">TU CUENTA</span><h3>{accessLabel(access)}</h3>
    {access?.status === 'lifetime' ? <p>Tu invitación incluye la nube sin vencimiento. No necesitás una suscripción. Este acceso es independiente de los permisos de administrador.</p> : <>
      {access?.status === 'trial' && access.trialEndsAt && !expired && <p>Tu prueba gratuita termina el {dateLabel(access.trialEndsAt)}. No se convierte automáticamente en una suscripción.</p>}
      {access?.paidThrough && <p>Acceso abonado hasta el {dateLabel(access.paidThrough)}.</p>}
      {expired && <p>Podés consultar y descargar tus datos. Para guardar nuevos cambios en el servidor necesitás renovar el acceso. Tus envíos pendientes se conservan.</p>}
    </>}
    {loading && <p role="status">Consultando los planes…</p>}
    {billing?.mode === 'disabled' && access?.status !== 'lifetime' && <p className="billing-notice">Los planes mensual y anual en ARS están en preparación. Los precios todavía no están definidos y los pagos no están habilitados. Podés seguir gratis en modo local.</p>}
    {billing?.mode === 'sandbox' && access?.status !== 'lifetime' && <>
      <p className="billing-notice"><strong>Pagos de prueba</strong> · Este entorno usa Mercado Pago de desarrollo y tarjetas de prueba. Los importes configurados son para pruebas y no representan el precio definitivo.</p>
      <div className="billing-plans">{billing.plans.map(plan => <div className="billing-plan" key={plan.id}><h4>{plan.id === 'monthly' ? 'Mensual' : 'Anual'}</h4><p><strong>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(plan.amount)}</strong><small>ARS / {plan.id === 'monthly' ? 'mes' : 'año'} · prueba</small></p><button className="secondary-button" disabled={busy || Boolean(billing.subscription && !['cancelled', 'canceled'].includes(billing.subscription.status))} onClick={() => void checkout(plan.id)}>Probar plan {plan.id === 'monthly' ? 'mensual' : 'anual'}</button></div>)}</div>
      <p className="fine-print">Volver del checkout no confirma un pago. Consultá el estado para verificar lo que informó Mercado Pago.</p>
    </>}
    {billing?.subscription && <div className="billing-subscription"><p>Suscripción {billing.subscription.plan === 'monthly' ? 'mensual' : 'anual'} · {subscriptionStatus[billing.subscription.status] ?? billing.subscription.status}</p>
      {billing.subscription.status === 'creating' && <button className="secondary-button" disabled={busy} onClick={() => void checkout(billing.subscription!.plan)}>Recuperar checkout de prueba</button>}
      {billing.subscription.checkoutUrl && billing.subscription.status === 'pending' && <button className="secondary-button" disabled={busy} onClick={() => { try { window.location.assign(checkoutDestination(billing.subscription!.checkoutUrl!)) } catch (reason) { setError(reason instanceof Error ? reason.message : 'Enlace inválido.') } }}>Continuar checkout de prueba</button>}
      {!['cancelled', 'canceled'].includes(billing.subscription.status) && (confirmCancel ? <div className="form-stack"><p>¿Cancelar las próximas renovaciones de esta suscripción?</p><button className="secondary-button" disabled={busy} onClick={() => void refresh(true)}>Confirmar cancelación</button><button className="text-button" disabled={busy} onClick={() => setConfirmCancel(false)}>Volver</button></div> : <button className="text-button" disabled={busy} onClick={() => setConfirmCancel(true)}>Cancelar suscripción</button>)}
    </div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="billing-actions"><button className="text-button" disabled={busy || loading} onClick={() => billing ? void refresh() : setAttempt(value => value + 1)}>{busy ? 'Consultando…' : 'Actualizar estado de acceso'}</button><button className="text-button" disabled={!canExport} onClick={downloadAccount}>Descargar mis datos</button></div>
    <FreeCloudComparison />
  </section>
}
