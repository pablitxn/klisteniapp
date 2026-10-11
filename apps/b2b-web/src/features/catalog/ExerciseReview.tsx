import type { Exercise } from '@klisteniapp/b2b-contracts'
import { Notice } from '@klisteniapp/b2b-ui'
import { ContentMedia, MovementViewer } from '@klisteniapp/b2b-ui/content'
import { Suspense } from 'react'

type ExerciseReviewProps = {
  exercise: Exercise
  active: boolean
  busy: boolean
  reviewAccepted: boolean
  onReviewAccepted: (accepted: boolean) => void
  onClose: () => void
  onReview: () => void
  onPublish: () => void
}

export function ExerciseReview({
  exercise,
  active,
  busy,
  reviewAccepted,
  onReviewAccepted,
  onClose,
  onReview,
  onPublish,
}: ExerciseReviewProps) {
  return (
    <section className="card review-panel">
      <div className="card-head">
        <div>
          <p className="eyebrow">
            {exercise.scope === 'organization' && exercise.status === 'draft'
              ? 'REVISIÓN DE CONTENIDO'
              : 'GUÍA DEL MOVIMIENTO'}
          </p>
          <h2>{exercise.name}</h2>
        </div>
        <button className="text-button" onClick={() => onClose()}>
          Cerrar vista
        </button>
      </div>
      {exercise.scope === 'base' && exercise.status !== 'published' && (
        <Notice>
          Esta plantilla necesita adaptarse a tu equipo y revisarse antes de usarse. Creá una
          variante para completar el contenido del gimnasio.
        </Notice>
      )}
      <p>{exercise.description}</p>
      <p className="small muted">
        {exercise.equipment} · {exercise.pattern}
      </p>
      {exercise.animationId ? (
        <Suspense fallback={<p role="status">Preparando visor…</p>}>
          <MovementViewer
            exerciseId={exercise.animationId}
            height={320}
            fallback={<p>Este movimiento se explica con instrucciones y recursos.</p>}
          />
        </Suspense>
      ) : (
        <p className="muted">
          Las instrucciones y los recursos del gimnasio guían este movimiento.
        </p>
      )}
      <ol>
        {exercise.instructions.map((instruction, i) => (
          <li key={i}>{instruction}</li>
        ))}
      </ol>
      <div className="review-media">
        <ContentMedia assets={exercise.assets} />
      </div>
      {exercise.scope === 'organization' && exercise.status === 'draft' && (
        <>
          <label className="check" style={{ marginTop: 20 }}>
            <input
              type="checkbox"
              checked={reviewAccepted}
              onChange={(event) => onReviewAccepted(event.target.checked)}
            />
            Revisé las instrucciones, el equipo compatible y los recursos de este ejercicio.
          </label>
          <button
            className="button primary"
            style={{ marginTop: 18 }}
            disabled={!active || busy || !reviewAccepted}
            onClick={() => onReview()}
          >
            Confirmar revisión del ejercicio
          </button>
        </>
      )}
      {exercise.scope === 'organization' && exercise.status === 'reviewed' && (
        <button
          className="button primary"
          style={{ marginTop: 18 }}
          disabled={!active || busy}
          onClick={() => onPublish()}
        >
          Publicar ejercicio revisado
        </button>
      )}
    </section>
  )
}
