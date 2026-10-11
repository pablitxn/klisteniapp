import { Suspense, useState } from 'react'
import type { Exercise } from '@klisteniapp/b2b-contracts'
import { exercisePreviewUrls } from '@klisteniapp/model-assets'
import { ContentMedia, MovementViewer } from '@klisteniapp/b2b-ui/content'

export function ExerciseDetails({
  exercise,
  previewAlreadyShown = false,
}: {
  exercise: Exercise
  previewAlreadyShown?: boolean
}) {
  const [open, setOpen] = useState(false)
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
        {exercise.animationId && open && (
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
        <ContentMedia assets={assets} />
      </div>
    </details>
  )
}
