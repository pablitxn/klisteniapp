import { useEffect, useRef, useState } from 'react'
import { ApiError, type ProductV2Client } from '@klisteniapp/b2b-client'
import type { ProductAccess } from '@klisteniapp/b2b-contracts/product-v2'
import { LegacyAdoptionReview } from './LegacyAdoptionReview'
import {
  adoptionFailure,
  adoptionMatchesPreview,
  canReviewLegacy,
  previewMatchesAssignment,
  type Adoption,
  type AdoptionInput,
  type AdoptionPreview,
  type LegacyAssignment,
} from './legacyAdoptionModel'
import './legacyAdoption.css'

export type LegacyAdoptionProps = {
  accountId: string
  access: ProductAccess
  accessKey: string
  contextSignal: AbortSignal
  assignment: LegacyAssignment
  createClient: (signal?: AbortSignal) => ProductV2Client
  /** Refresh immutable version/assignment data after the accepted supplement; never rewrite history. */
  onAdopted: (adoption: Adoption) => Promise<void>
  onClose: () => void
}

/** Root supplies an actually selected legacy assignment and the current authenticated scope. */
export function LegacyAdoption(props: LegacyAdoptionProps) {
  if (
    props.contextSignal.aborted ||
    !canReviewLegacy(props.access, props.accountId, props.assignment)
  )
    return (
      <section className="legacy-adoption">
        <p role="alert">
          No tenés permiso vigente para revisar esta versión anterior en esta sede.
        </p>
        <button type="button" className="button" onClick={props.onClose}>
          Volver al historial
        </button>
      </section>
    )
  return (
    <LegacyAdoptionLoader
      key={JSON.stringify([
        props.accessKey,
        props.accountId,
        props.access.accessRevision,
        props.assignment.scope,
        props.assignment.id,
        props.assignment.routine,
      ])}
      {...props}
    />
  )
}
function LegacyAdoptionLoader({
  assignment,
  createClient,
  contextSignal,
  onAdopted,
  onClose,
}: LegacyAdoptionProps) {
  const [preview, setPreview] = useState<AdoptionPreview | null>(null)
  const [revision, setRevision] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [revoked, setRevoked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState<Adoption | null>(null)
  const [refreshError, setRefreshError] = useState('')
  const current = useRef(false)
  const pending = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    current.current = true
    const revoke = () => {
      current.current = false
      controller.abort()
      setPreview(null)
      setAccepted(null)
      setRevoked(true)
      setLoading(false)
    }
    contextSignal.addEventListener('abort', revoke, { once: true })
    if (contextSignal.aborted) revoke()
    return () => {
      current.current = false
      controller.abort()
      contextSignal.removeEventListener('abort', revoke)
    }
  }, [contextSignal])
  useEffect(() => {
    let valid = true
    const controller = new AbortController()
    const signal = AbortSignal.any([contextSignal, controller.signal])
    setPreview(null)
    setLoading(true)
    setError('')
    Promise.resolve()
      .then(() => createClient(signal).call('legacySupplementPreview', { id: assignment.id }))
      .then((result) => {
        if (!valid || signal.aborted) return
        if (
          !previewMatchesAssignment(result, assignment) ||
          (result.supplement && !adoptionMatchesPreview(result.supplement, result))
        )
          throw new ApiError(
            'La revisión no corresponde a la asignación y la dosis originales seleccionadas.',
            502,
            'INVALID_RESPONSE',
          )
        setPreview(result)
      })
      .catch((error: unknown) => {
        if (!valid || signal.aborted) return
        setError(
          error instanceof Error ? error.message : 'No pudimos consultar la versión anterior.',
        )
        if (adoptionFailure(error) === 'revoked') {
          setPreview(null)
          setAccepted(null)
          setRevoked(true)
        }
      })
      .finally(() => {
        if (valid && !signal.aborted) setLoading(false)
      })
    return () => {
      valid = false
      controller.abort()
    }
  }, [assignment, createClient, contextSignal, revision])
  function refreshPreview() {
    setPreview(null)
    setAccepted(null)
    setError('')
    setRevision((value) => value + 1)
  }
  async function refreshVersion(result: Adoption) {
    setRefreshError('')
    try {
      await onAdopted(result)
    } catch (error) {
      if (current.current && !contextSignal.aborted && adoptionFailure(error) === 'revoked') {
        setPreview(null)
        setAccepted(null)
        setRevoked(true)
      } else if (current.current && !contextSignal.aborted)
        setRefreshError(
          error instanceof Error
            ? error.message
            : 'La revisión está guardada; falta actualizar la vista de versión.',
        )
    }
  }
  async function submit(input: AdoptionInput) {
    if (pending.current || !preview || revoked || !current.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const signal = AbortSignal.any([contextSignal, lifetime.current!.signal])
      const result = await createClient(signal).call('adoptLegacySupplement', input)
      if (!current.current || signal.aborted) return
      if (!adoptionMatchesPreview(result, preview))
        throw new ApiError(
          'La respuesta no corresponde a la versión revisada.',
          502,
          'INVALID_RESPONSE',
        )
      setAccepted(result)
      await refreshVersion(result)
    } catch (error) {
      if (!current.current || contextSignal.aborted) return
      const message = error instanceof Error ? error.message : 'No pudimos guardar la revisión.'
      const failure = adoptionFailure(error)
      if (failure === 'revoked') {
        setPreview(null)
        setAccepted(null)
        setRevoked(true)
        setError(message)
      } else if (failure === 'refresh') {
        setNotice(
          'La versión, las propuestas o su estado cambiaron. Volvimos a consultar: revisá otra vez todas las decisiones y confirmaciones.',
        )
        refreshPreview()
      } else
        setError(
          `${message} Tus decisiones siguen en pantalla. Si reintentás sin cambiarlas se conserva la misma solicitud.`,
        )
    } finally {
      pending.current = false
      if (current.current) setBusy(false)
    }
  }
  if (revoked || contextSignal.aborted)
    return (
      <section className="legacy-adoption">
        <p role="alert">
          El acceso cambió. Ocultamos la revisión anterior. Volvé a validar tu contexto antes de
          continuar.
        </p>
        <button type="button" className="button" onClick={onClose}>
          Volver al historial
        </button>
      </section>
    )
  const saved = accepted ?? preview?.supplement
  return (
    <section className="legacy-adoption">
      <button type="button" className="button" disabled={busy} onClick={onClose}>
        Volver al historial
      </button>
      {notice && <p role="status">{notice}</p>}
      {loading && (
        <p role="status">Consultando la versión original y todas sus propuestas elegibles…</p>
      )}
      {saved ? (
        <section className="card">
          <h1>Esta versión ya tiene una revisión explícita</h1>
          <p role="status">
            La revisión está guardada. No se volvió a convertir ni se modificaron las instantáneas o
            registros originales.
          </p>
          <p>
            Rutina {saved.programId} · versión {saved.version}
          </p>
          <p>
            Hash original: <code>{saved.sourceSnapshotHash}</code>
          </p>
          {refreshError && <p role="alert">La revisión se guardó. {refreshError}</p>}
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={async () => {
              if (pending.current) return
              pending.current = true
              setBusy(true)
              try {
                await refreshVersion(saved)
              } finally {
                pending.current = false
                if (current.current) setBusy(false)
              }
            }}
          >
            Actualizar datos de esta versión
          </button>
        </section>
      ) : preview ? (
        <LegacyAdoptionReview
          key={revision}
          preview={preview}
          busy={busy}
          error={error}
          onSubmit={submit}
          onRefresh={() => {
            setNotice('Consultamos de nuevo. Todas las confirmaciones deben renovarse.')
            refreshPreview()
          }}
        />
      ) : (
        error && (
          <>
            <p role="alert">{error}</p>
            <button type="button" className="button" onClick={refreshPreview}>
              Volver a consultar
            </button>
          </>
        )
      )}
    </section>
  )
}
