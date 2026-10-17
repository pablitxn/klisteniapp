import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import {
  createActionScope,
  invitationDestination,
  membershipKey,
  membershipMode,
  type MembershipIdentity,
} from './restrictedAccess.ts'
import { personalExportDownload } from './trainingInterchange.ts'
import { ownerLocalDownload, type OwnerLocalExportAdapter } from './localExport.ts'
import './membership.css'

type Download = { filename: string; json: string }
type Props = {
  identity: MembershipIdentity
  access: ProductAccess
  client: Pick<ProductV2Client, 'call'>
  /** INTEGRATION aborts synchronously on account/organization/access changes. */
  contextSignal: AbortSignal
  currentOrigin: string
  refreshAccess: () => Promise<void>
  localExport?: OwnerLocalExportAdapter
  download?: (file: Download) => void
}

function downloadJson(file: Download) {
  const href = URL.createObjectURL(new Blob([file.json], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = href
  link.download = file.filename
  link.click()
  // Allow the browser to consume the URL before releasing the private bytes.
  setTimeout(() => URL.revokeObjectURL(href), 1000)
}

function useTask(signal: AbortSignal) {
  const scope = useRef(createActionScope(signal))
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle')
  useEffect(() => {
    const current = createActionScope(signal)
    scope.current = current
    return () => current.dispose()
  }, [signal])
  async function run<T>(work: () => Promise<T>, publish: (value: T) => void) {
    if (signal.aborted) return
    setStatus('pending')
    await scope.current.run(
      async () => {
        try {
          return { ok: true as const, value: await work() }
        } catch {
          return { ok: false as const }
        }
      },
      (result) => {
        if (!result.ok) return setStatus('error')
        try {
          publish(result.value)
          setStatus('done')
        } catch {
          setStatus('error')
        }
      },
    )
  }
  return { status, run }
}

/** Mount above every route, including public/deep-link/back destinations. The
 * integration owner controls freshness; this component never creates grants. */
export function MembershipAccessBoundary({
  children,
  revalidating = false,
  ...props
}: Omit<Props, 'access'> & {
  access: ProductAccess | null
  revalidating?: boolean
  children: ReactNode
}) {
  const mode = props.contextSignal.aborted
    ? 'checking'
    : membershipMode(props.identity, props.access, revalidating)
  if (mode === 'active') return children
  if (mode === 'restricted' && props.access)
    return (
      <RestrictedMembership
        key={membershipKey(props.identity, props.access)}
        {...props}
        access={props.access}
      />
    )
  return (
    <main className="membership-screen" aria-labelledby="membership-access-title">
      <h1 id="membership-access-title">Acceso al gimnasio</h1>
      <p role={mode === 'denied' ? 'alert' : 'status'}>
        {mode === 'denied'
          ? 'No pudimos verificar tu acceso. Volvé a iniciar sesión.'
          : 'Verificando tu acceso actual…'}
      </p>
    </main>
  )
}

export function RestrictedMembership(props: Props) {
  const { identity, client, contextSignal, currentOrigin, localExport, refreshAccess } = props
  const server = useTask(contextSignal)
  const device = useTask(contextSignal)
  const invitation = useTask(contextSignal)
  const refresh = useTask(contextSignal)
  const [destination, setDestination] = useState<string | null>(null)
  const [localEmpty, setLocalEmpty] = useState(false)
  // Direct mounting must also fail closed, without issuing requests.
  if (contextSignal.aborted || membershipMode(identity, props.access) !== 'restricted')
    return <p role="status">Verificando tu acceso actual…</p>
  const save = props.download ?? downloadJson
  return (
    <main className="membership-screen" aria-labelledby="membership-title">
      <header>
        <p>MI CUENTA</p>
        <h1 id="membership-title">Tu membresía está inactiva</h1>
        <p>
          Podés exportar tus registros. Las funciones del gimnasio no están disponibles con esta
          membresía. Tus registros anteriores se conservan.
        </p>
      </header>
      <section aria-labelledby="membership-export-title">
        <h2 id="membership-export-title">Exportar mis registros aceptados</h2>
        <p>
          Archivo JSON personal, versión 2. Solo datos aceptados por el servidor de la organización
          seleccionada y tu salud B2B actual.
        </p>
        <h3>Qué incluye</h3>
        <ul>
          <li>Tus rutinas emitidas y versiones originales, con sus suplementos.</li>
          <li>
            Todas las revisiones aceptadas de tus programas, períodos, sesiones previstas y
            registros realizados, incluidos los originales anteriores. Incluye tus sedes anteriores
            aunque ya no tengas acceso a ellas.
          </li>
          <li>Tu salud B2B actual, independientemente del consentimiento para compartirla.</li>
        </ul>
        <h3>Qué queda fuera</h3>
        <ul>
          <li>Trabajo sin sincronizar de este u otros dispositivos.</li>
          <li>Otras organizaciones, otras personas y borradores del equipo sin emitir.</li>
          <li>Auditoría y contactos privados del equipo.</li>
          <li>
            Archivos multimedia y permisos temporales. Las referencias históricas se conservan, pero
            no dan nuevo acceso a esos archivos.
          </li>
          <li>Cuentas, pagos y salud del producto B2C separado.</li>
          <li>Ediciones históricas y comprobantes de operaciones de salud.</li>
        </ul>
        <button
          className="button"
          disabled={server.status === 'pending'}
          onClick={() =>
            void server.run(
              async () => personalExportDownload(await client.call('personalExport', {}), identity),
              save,
            )
          }
        >
          {server.status === 'error' ? 'Reintentar exportación' : 'Descargar mis registros'}
        </button>
        <p role="status" aria-live="polite">
          {server.status === 'pending' && 'Preparando el archivo completo…'}
          {server.status === 'done' && 'Archivo preparado. Revisá las descargas del navegador.'}
        </p>
        {server.status === 'error' && (
          <p role="alert">No pudimos descargar tus registros. Podés volver a intentarlo.</p>
        )}
      </section>
      {localExport && (
        <section aria-labelledby="membership-device-title">
          <h2 id="membership-device-title">Trabajo sin sincronizar de este dispositivo</h2>
          <p>
            Descarga separada de trabajo local de tu cuenta. No está confirmado por el servidor y no
            se enviará al gimnasio ni al producto B2C. No incluye otros dispositivos. Es una copia
            local seleccionada, no una lista completa de todas tus sesiones.
          </p>
          <button
            className="button secondary"
            disabled={device.status === 'pending'}
            onClick={() =>
              void device.run(
                () => ownerLocalDownload(localExport, identity, props.access, contextSignal),
                (file) => {
                  setLocalEmpty(file === null)
                  if (file) save(file)
                },
              )
            }
          >
            {device.status === 'error' ? 'Reintentar descarga local' : 'Descargar trabajo local'}
          </button>
          <p role="status">
            {device.status === 'pending' && 'Preparando trabajo sin sincronizar…'}
            {device.status === 'done' &&
              (localEmpty
                ? 'No hay trabajo local pendiente en la copia seleccionada.'
                : 'Archivo local preparado; sigue sin sincronizar.')}
          </p>
          {device.status === 'error' && <p role="alert">No pudimos recuperar el trabajo local.</p>}
        </section>
      )}
      <section aria-labelledby="membership-b2c-title">
        <h2 id="membership-b2c-title">Un producto personal separado</h2>
        <p>
          B2C es un producto de pago separado para gestionar tus propias rutinas. Continuar es tu
          elección. No convierte tu cuenta del gimnasio, no cambia tu facturación ni transfiere
          datos automáticamente. El archivo conserva los campos de entrenamiento; la compatibilidad
          de importación debe confirmarse en el producto de destino.
        </p>
        {destination ? (
          <a
            className="button secondary"
            href={destination}
            target="_blank"
            rel="noopener noreferrer external"
            referrerPolicy="no-referrer"
          >
            Conocer B2C en otro sitio
          </a>
        ) : (
          <button
            className="button secondary"
            disabled={invitation.status === 'pending'}
            onClick={() =>
              void invitation.run(
                async () =>
                  invitationDestination(await client.call('b2cInvitation', {}), currentOrigin),
                setDestination,
              )
            }
          >
            {invitation.status === 'error' ? 'Reintentar consulta B2C' : 'Consultar invitación B2C'}
          </button>
        )}
        <p role="status">
          {invitation.status === 'pending' && 'Consultando si hay una invitación disponible…'}
          {invitation.status === 'done' && !destination && 'No hay una invitación B2C configurada.'}
        </p>
        {invitation.status === 'error' && <p role="alert">No pudimos consultar la invitación.</p>}
      </section>
      <section aria-labelledby="membership-refresh-title">
        <h2 id="membership-refresh-title">Comprobar reactivación</h2>
        <p>
          Al reactivarse, se recuperan tus registros y los permisos vigentes. Los permisos de sede y
          consentimientos de salud revocados no se restauran automáticamente.
        </p>
        <button
          className="button secondary"
          disabled={refresh.status === 'pending'}
          onClick={() => void refresh.run(refreshAccess, () => undefined)}
        >
          {refresh.status === 'error' ? 'Reintentar comprobación' : 'Actualizar mi acceso'}
        </button>
        <p role="status">
          {refresh.status === 'pending' && 'Comprobando tu membresía actual…'}
          {refresh.status === 'done' && 'Acceso actualizado. Si sigue inactiva, podés exportar.'}
        </p>
        {refresh.status === 'error' && <p role="alert">No pudimos comprobar tu acceso actual.</p>}
      </section>
    </main>
  )
}
