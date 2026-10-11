import { useRef, useState } from 'react'
import type { Media } from '@klisteniapp/b2b-contracts'
import { Field, Notice } from '@klisteniapp/b2b-ui'
import { useAccountId } from '@klisteniapp/b2b-react'
import {
  CLIP_CRITERIA,
  CLIP_OUTCOMES,
  CLIP_RATINGS,
  clipReviewKey,
  emptyClipReview,
  prepareClipReview,
  readClipReview,
  selectReviewClip,
} from './clipReview'
import type { ClipOutcome, ClipRating, ClipReviewDraft } from './clipReview'

function VideoPreview({ media, label }: { media: Media | undefined; label: string }) {
  const [failed, setFailed] = useState(false)
  if (!media) return null
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      <figcaption style={{ marginBottom: 8 }}>
        <strong>
          {label}: {media.label}
        </strong>
      </figcaption>
      <video
        key={media.id}
        className="media"
        controls
        preload="none"
        playsInline
        aria-label={label}
        src={media.url}
        onError={() => setFailed(true)}
      />
      {failed && (
        <Notice error>
          No pudimos abrir este clip. Conservá las notas y revisá el archivo de la biblioteca.
        </Notice>
      )}
      <p className="small muted">
        {media.attribution || 'Sin atribución cargada en la biblioteca.'}
      </p>
    </figure>
  )
}

export function ClipComparison({
  orgId,
  library,
  disabled,
}: {
  orgId: string
  library: Media[]
  disabled: boolean
}) {
  const accountId = useAccountId()
  const key = clipReviewKey(accountId, orgId)
  return (
    <ClipComparisonEditor
      key={key}
      orgId={orgId}
      accountId={accountId}
      storageKey={key}
      library={library}
      disabled={disabled}
    />
  )
}

function ClipComparisonEditor({
  orgId,
  accountId,
  storageKey,
  library,
  disabled,
}: {
  orgId: string
  accountId: string
  storageKey: string
  library: Media[]
  disabled: boolean
}) {
  const [initial] = useState(() => {
    try {
      return readClipReview(sessionStorage, storageKey)
    } catch {
      return null
    }
  })
  const [draft, setDraft] = useState(initial ?? emptyClipReview())
  const [error, setError] = useState('')
  const [storageError, setStorageError] = useState('')
  const [message, setMessage] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDetailsElement>(null)
  const videos = library.filter((media) => media.kind === 'video')

  function change(patch: Partial<ClipReviewDraft>) {
    if (disabled) return
    const next = { ...draft, ...patch }
    setDraft(next)
    setMessage('')
    setError('')
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(next))
      setStorageError('')
    } catch {
      setStorageError(
        'No pudimos conservar el borrador en esta pestaña. Mantenela abierta hasta descargar la evaluación.',
      )
    }
  }

  function download() {
    const result = prepareClipReview(draft, library, {
      orgId,
      accountId,
      exportedAt: new Date().toISOString(),
    })
    if (!result.ok) {
      setError(result.error)
      errorRef.current?.focus()
      return
    }
    const blob = new Blob([JSON.stringify(result.document, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `evaluacion-clips-${orgId}-${new Date().toISOString().slice(0, 10)}.json`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    setError('')
    setMessage(
      'Evaluación descargada con las notas y huellas de los archivos. La publicación del catálogo sigue siendo un paso aparte.',
    )
  }

  function chooseClip(field: 'referenceId' | 'generatedId', id: string) {
    change(selectReviewClip(draft, field, id))
    setMessage(
      'Cambió un clip. Conservamos las observaciones para que puedas revisarlas; volvé a evaluar los resultados y la procedencia del archivo elegido.',
    )
  }

  const textField = (
    field: 'referenceSource' | 'referencePermission' | 'generatedProcess' | 'generatedPermission',
    label: string,
    hint: string,
  ) => (
    <Field label={label} hint={hint}>
      <textarea
        value={draft[field]}
        maxLength={2000}
        onChange={(event) => change({ [field]: event.target.value })}
      />
    </Field>
  )

  return (
    <details
      ref={panelRef}
      className="card"
      style={{ margin: '22px 0' }}
      onToggle={(event) => {
        if (!event.currentTarget.open)
          panelRef.current?.querySelectorAll('video').forEach((video) => video.pause())
      }}
    >
      <summary style={{ cursor: 'pointer', minHeight: 44 }}>
        Comparar un clip de referencia y uno generado
      </summary>
      <p className="muted">
        Revisá dos videos de tu biblioteca antes de decidir qué contenido proponer. Esta evaluación
        conserva tus observaciones; la revisión y publicación del ejercicio se hacen desde el
        catálogo.
      </p>
      {initial && <Notice>Recuperamos tu evaluación de esta pestaña.</Notice>}
      {videos.length < 2 && (
        <Notice>
          Subí primero dos videos distintos a la biblioteca. Documentá su procedencia y los permisos
          de uso antes de evaluarlos.
        </Notice>
      )}
      <fieldset disabled={disabled} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <legend className="eyebrow">Evaluación de clips</legend>
        <div className="form-grid">
          <Field label="Ejercicio de la comparación">
            <input
              value={draft.exercise}
              maxLength={200}
              onChange={(event) => change({ exercise: event.target.value })}
            />
          </Field>
          <Field label="Persona que revisa los clips">
            <input
              value={draft.reviewer}
              maxLength={200}
              onChange={(event) => change({ reviewer: event.target.value })}
            />
          </Field>
          {(['referenceId', 'generatedId'] as const).map((field) => (
            <Field
              key={field}
              label={
                field === 'referenceId'
                  ? 'Clip de referencia autorizado'
                  : 'Clip generado para evaluar'
              }
            >
              <select
                value={draft[field]}
                onChange={(event) => chooseClip(field, event.target.value)}
              >
                <option value="">Elegí un video de la biblioteca</option>
                {draft[field] && !videos.some((media) => media.id === draft[field]) && (
                  <option value={draft[field]}>Archivo ya no disponible en esta biblioteca</option>
                )}
                {videos.map((media) => (
                  <option key={media.id} value={media.id}>
                    {media.label}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className="grid two" style={{ margin: '22px 0' }}>
          <VideoPreview
            key={`reference-${draft.referenceId}`}
            media={videos.find((media) => media.id === draft.referenceId)}
            label="Referencia"
          />
          <VideoPreview
            key={`generated-${draft.generatedId}`}
            media={videos.find((media) => media.id === draft.generatedId)}
            label="Generado"
          />
        </div>
        <div className="form-grid">
          {textField(
            'referenceSource',
            'Procedencia del clip de referencia',
            'Autor, fuente, fecha y versión del archivo, cuando se conozcan.',
          )}
          {textField(
            'referencePermission',
            'Permiso de uso de la referencia',
            'Licencia o autorización, titular, alcance y dónde conservar su evidencia.',
          )}
          {textField(
            'generatedProcess',
            'Cómo se produjo el clip generado',
            'Herramienta, modelo o versión, indicaciones y fecha; incluí qué recursos se usaron como entrada.',
          )}
          {textField(
            'generatedPermission',
            'Permiso de uso del clip generado',
            'Condiciones de la herramienta y autorización de los recursos de entrada; no se infieren a partir del archivo.',
          )}
        </div>
        <label className="check" style={{ minHeight: 44, margin: '16px 0' }}>
          <input
            type="checkbox"
            checked={draft.permissionsConfirmed}
            onChange={(event) => change({ permissionsConfirmed: event.target.checked })}
          />
          Verifiqué el permiso de uso de ambos clips para esta evaluación.
        </label>
        {CLIP_CRITERIA.map(({ id, label, hint }) => (
          <fieldset className="content-row" key={id}>
            <legend>{label}</legend>
            <div className="form-grid">
              <Field label={`Resultado: ${label}`} hint={hint}>
                <select
                  value={draft.criteria[id].rating}
                  onChange={(event) =>
                    change({
                      criteria: {
                        ...draft.criteria,
                        [id]: { ...draft.criteria[id], rating: event.target.value as ClipRating },
                      },
                    })
                  }
                >
                  {Object.entries(CLIP_RATINGS).map(([value, caption]) => (
                    <option key={value} value={value}>
                      {caption}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label={`Observaciones: ${label}`}
                hint="Describí lo observado e incluí marcas de tiempo para volver al mismo momento."
              >
                <textarea
                  value={draft.criteria[id].notes}
                  maxLength={2000}
                  onChange={(event) =>
                    change({
                      criteria: {
                        ...draft.criteria,
                        [id]: { ...draft.criteria[id], notes: event.target.value },
                      },
                    })
                  }
                />
              </Field>
            </div>
          </fieldset>
        ))}
        <div className="form-stack">
          <Field label="Conclusión de la comparación">
            <select
              value={draft.outcome}
              onChange={(event) => change({ outcome: event.target.value as ClipOutcome })}
            >
              {Object.entries(CLIP_OUTCOMES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Evidencia y próximos pasos">
            <textarea
              value={draft.summary}
              maxLength={2000}
              onChange={(event) => change({ summary: event.target.value })}
            />
          </Field>
        </div>
      </fieldset>
      <p className="small muted">
        Borrador privado de esta cuenta y gimnasio, guardado en esta pestaña. La descarga incluye
        identificadores y SHA-256 para reconocer exactamente los archivos revisados.
      </p>
      <Notice error>{storageError}</Notice>
      <div ref={errorRef} tabIndex={-1}>
        <Notice error>{error}</Notice>
      </div>
      <Notice>{message}</Notice>
      <button type="button" className="button" onClick={download}>
        Descargar evaluación
      </button>
    </details>
  )
}
