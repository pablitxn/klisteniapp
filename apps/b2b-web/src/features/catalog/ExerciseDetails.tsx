import type { Exercise } from '@klisteniapp/b2b-contracts'
import { ContentMedia, MovementViewer } from '@klisteniapp/b2b-ui/content'
import { exercisePreviewUrls } from '@klisteniapp/model-assets'
import { Suspense, useState } from 'react'
import '../../member.css'
import { VoiceGuide } from '../voice/VoiceGuide'

export function ExerciseDetails({
  exercise,
  previewAlreadyShown = false,
}: {
  exercise: Exercise
  previewAlreadyShown?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [showMovement, setShowMovement] = useState(false)
  const displayedPoster =
    previewAlreadyShown && exercise.animationId
      ? exercisePreviewUrls(exercise.animationId).poster
      : null
  const assets = exercise.assets.filter((asset) => asset.url !== displayedPoster)

  return (
    <details className="exercise-details" onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>Cómo hacer {exercise.name}</summary>
      <div className="exercise-step">
        <p>{exercise.description}</p>
        {exercise.animationId && !showMovement && (
          <button type="button" className="button small" onClick={() => setShowMovement(true)}>
            Ver movimiento animado
          </button>
        )}
        {exercise.animationId && open && showMovement && (
          <Suspense fallback={<p role="status">Preparando movimiento…</p>}>
            <MovementViewer
              exerciseId={exercise.animationId}
              height={280}
              fallback={<p>Consultá las instrucciones para este movimiento.</p>}
            />
          </Suspense>
        )}
        <ol>
          {exercise.instructions.map((step, index) => (
            <li key={index}>{step}</li>
          ))}
        </ol>
        {open && (
          <VoiceGuide
            key={JSON.stringify([exercise.name, exercise.instructions])}
            name={exercise.name}
            instructions={exercise.instructions}
          />
        )}
        <ContentMedia assets={assets} />
      </div>
    </details>
  )
}
