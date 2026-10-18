import { useEffect, useId, useState } from 'react'
import type { HealthCategory } from '@klisteniapp/b2b-contracts/product-v2'
import { hasHealthCapability, healthAccessKey, type HealthAccess } from './healthAccess.ts'
import {
  healthCategories,
  healthCategoryLabels,
  type HealthController,
  type HealthState,
} from './healthState.ts'
import { useHealthController } from './useHealthController.ts'
import './health.css'

function HealthImport({ controller, state }: { controller: HealthController; state: HealthState }) {
  const fileId = useId()
  const [, tick] = useState(0)
  useEffect(() => {
    if (!state.preview) return
    const timer = window.setInterval(() => tick((value) => value + 1), 1000)
    return () => window.clearInterval(timer)
  }, [state.preview])
  const busy =
    state.status !== 'ready' || ['reading', 'previewing', 'applying'].includes(state.importStatus)
  return (
    <section className="card health-panel" aria-labelledby={`${fileId}-heading`}>
      <h2 id={`${fileId}-heading`}>Importar un archivo de salud</h2>
      <p>
        Elegí manualmente un JSON klisteniapp.health versión 1, de hasta 2 MiB y 10.000 registros.
        CSV de Samsung, ZIP de Health Connect y otros formatos no son compatibles. No hay conexión
        automática con proveedores.
      </p>
      <p>
        Importar no autoriza a entrenadores ni cambia los permisos que ya elegiste. Revisá tus
        permisos en esta página.
      </p>
      <label htmlFor={fileId}>Archivo JSON</label>
      <input
        id={fileId}
        type="file"
        accept=".json,application/json"
        disabled={busy}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (!file) return
          // A mobile picker may hide the page before returning a selection.
          controller.setEnvironment(navigator.onLine, document.visibilityState === 'visible')
          if (controller.getSnapshot().status !== 'ready') await controller.loadOwner()
          await controller.previewFile(file)
        }}
      />
      {state.importStatus === 'reading' && <p role="status">Leyendo el archivo…</p>}
      {state.importStatus === 'previewing' && (
        <p role="status">Validando la vista previa en el servidor…</p>
      )}
      {state.preview && (
        <div className="health-preview" aria-live="polite">
          <h3>Vista previa de importación</h3>
          <ul>
            {healthCategories.map((category) => (
              <li key={category}>
                {healthCategoryLabels[category]}: {state.preview!.additions[category]} nuevos
              </li>
            ))}
          </ul>
          <p>Duplicados sin cambios: {state.preview.duplicates}. No se vuelven a agregar.</p>
          {!!state.preview.issues.length && (
            <div role="alert">
              <p>El archivo fue rechazado. No se importó ningún registro.</p>
              <ul>
                {state.preview.issues.map((issue, index) => (
                  <li key={index}>
                    {issue.path}: {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!!state.preview.conflicts.length && (
            <p role="alert">
              Hay {state.preview.conflicts.length} conflictos. Revisá el archivo; no se reemplazará
              ningún registro.
            </p>
          )}
          {!controller.canConfirmImport() &&
            !busy &&
            !state.preview.issues.length &&
            !state.preview.conflicts.length && (
              <p role="status">La vista previa venció. Elegí el archivo otra vez para revisarlo.</p>
            )}
          {state.retryImport && (
            <p role="status">
              La respuesta no llegó. Reintentar envía exactamente la misma importación para
              comprobar si fue aceptada.
            </p>
          )}
          <button
            className="button"
            disabled={busy || !controller.canConfirmImport()}
            onClick={() => void controller.confirmImport()}
          >
            {state.importStatus === 'applying'
              ? 'Confirmando…'
              : state.retryImport
                ? 'Reintentar importación'
                : 'Confirmar importación'}
          </button>
        </div>
      )}
    </section>
  )
}

function ConsentSettings({
  controller,
  state,
  organizationName,
  branchName,
}: {
  controller: HealthController
  state: HealthState
  organizationName: string
  branchName: string
}) {
  const [categories, setCategories] = useState<HealthCategory[]>([])
  const [acknowledged, setAcknowledged] = useState(false)
  const confirmationId = useId()
  const consent = controller.selectedConsent()
  const busy = state.status !== 'ready'
  return (
    <section className="card health-panel" aria-labelledby={`${confirmationId}-heading`}>
      <h2 id={`${confirmationId}-heading`}>Permisos de salud</h2>
      {state.status === 'ready' && (
        <p role="status">
          {consent
            ? `Compartís en esta sede: ${consent.categories.map((c) => healthCategoryLabels[c]).join(', ')}.`
            : 'Privado: no compartís datos de salud con entrenadores de esta sede.'}
        </p>
      )}
      <p>
        <strong>
          Marca: {organizationName}. Sede: {branchName}.
        </strong>
      </p>
      <p>
        La autorización permite ver las categorías seleccionadas a todos los entrenadores con acceso
        vigente a esta sede, incluidos quienes obtengan ese acceso en el futuro. No se limita a tu
        entrenador asignado. Ser administrador no habilita este acceso.
      </p>
      <p>
        Solo lectura en línea, sin exportación masiva para entrenadores. Perfil y objetivos
        personales no se comparten. La autorización es específica para esta marca y sede; otras
        sedes requieren su propio permiso.
      </p>
      <p>
        Podés revocar el permiso. Las vistas de la aplicación se ocultan al recibir la revocación y
        deben validar el acceso otra vez. No podemos recuperar datos que alguien ya haya visto o
        copiado. Al inactivar tu membresía se revocan los permisos de esta marca; reactivarla
        requiere una autorización nueva.
      </p>
      {state.status === 'ready' &&
        state.consents.some(
          (c) => c.status === 'active' && c.scope.branchId !== controller.context.branchId,
        ) && (
          <p>
            Tenés permisos activos en otras sedes de esta marca. Seleccioná cada sede para
            revisarlos o revocarlos.
          </p>
        )}
      <fieldset disabled={busy}>
        <legend>Categorías que autorizás compartir</legend>
        {healthCategories.map((category) => (
          <label className="health-check" key={category}>
            <input
              type="checkbox"
              checked={categories.includes(category)}
              onChange={(event) => {
                setAcknowledged(false)
                setCategories(
                  event.target.checked
                    ? [...categories, category]
                    : categories.filter((c) => c !== category),
                )
              }}
            />
            {healthCategoryLabels[category]}
          </label>
        ))}
        <p>
          Selección a confirmar:{' '}
          {categories.length
            ? categories.map((c) => healthCategoryLabels[c]).join(', ')
            : 'ninguna'}
          .
        </p>
        <label className="health-check" htmlFor={confirmationId}>
          <input
            id={confirmationId}
            type="checkbox"
            checked={acknowledged}
            onChange={(event) => setAcknowledged(event.target.checked)}
          />
          Entiendo el público dinámico, las categorías y el alcance indicados para{' '}
          {organizationName}, {branchName}. Confirmo esta autorización (versión 1).
        </label>
        <button
          className="button"
          disabled={!acknowledged || !categories.length}
          onClick={() => {
            setAcknowledged(false)
            void controller.grant(categories, acknowledged)
          }}
        >
          {consent ? 'Reemplazar categorías autorizadas' : 'Autorizar estas categorías'}
        </button>
      </fieldset>
      {consent && (
        <button
          className="button danger"
          disabled={busy}
          onClick={() => {
            setAcknowledged(false)
            void controller.revoke()
          }}
        >
          Revocar permiso en esta sede
        </button>
      )}
      <p className="small muted">
        Cambiar la selección no guarda permisos. Solo el botón de autorización los modifica.
      </p>
    </section>
  )
}

export function HealthSettings({
  context,
  organizationName,
  branchName,
  onExportOwnRecords,
}: {
  context: HealthAccess
  organizationName: string
  branchName: string
  onExportOwnRecords: () => void
}) {
  const { controller, state } = useHealthController(context)
  const manage = hasHealthCapability(context, 'manage-own-health')
  return (
    <section className="health-feature" aria-label="Salud y privacidad de la cuenta">
      <h1>Mi salud y privacidad</h1>
      <p>Tus datos pertenecen a tu identidad B2B. No se transfieren automáticamente a B2C.</p>
      {hasHealthCapability(context, 'export-own-records') && (
        <button className="button" onClick={onExportOwnRecords}>
          Exportar mis registros, incluidos mis datos de salud
        </button>
      )}
      {!manage ? (
        <p role="status">
          El acceso operativo de salud no está disponible. Una membresía inactiva conserva solo la
          exportación; sus permisos de salud en esta marca se revocan y no se restauran
          automáticamente.
        </p>
      ) : (
        <>
          {state.message && (
            <p role={state.status === 'error' ? 'alert' : 'status'}>{state.message}</p>
          )}
          {state.status === 'loading' && (
            <p role="status">Validando los datos y permisos vigentes…</p>
          )}
          <button
            className="button secondary"
            disabled={state.status === 'loading'}
            onClick={() => void controller.loadOwner()}
          >
            Actualizar datos y permisos
          </button>
          {state.own && (
            <p>
              Revisión de tus datos: {state.own.revision}.{' '}
              {healthCategories.reduce((sum, c) => sum + state.own!.data[c].length, 0)} registros
              guardados.
            </p>
          )}
          <HealthImport controller={controller} state={state} />
          <ConsentSettings
            key={`${healthAccessKey(context)}:${state.consents.map((c) => `${c.id}:${c.revision}`).join(',')}`}
            controller={controller}
            state={state}
            organizationName={organizationName}
            branchName={branchName}
          />
        </>
      )}
    </section>
  )
}
