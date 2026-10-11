import { ExercisePreview } from '@klisteniapp/anatomy-viewer/preview'
import type { Exercise } from '@klisteniapp/b2b-contracts'

type ExerciseCardProps = {
  exercise: Exercise
  active: boolean
  busy: boolean
  onPreview: () => void
  onEdit: () => void
  onPublish: () => void
}

export function ExerciseCard({
  exercise,
  active,
  busy,
  onPreview,
  onEdit,
  onPublish,
}: ExerciseCardProps) {
  return (
    <article className="card">
      <div className="exercise-art">
        {exercise.animationId ? (
          <ExercisePreview exerciseId={exercise.animationId} alt={exercise.name} />
        ) : (
          <span aria-hidden="true">↗</span>
        )}
      </div>
      <div className="row spread">
        <span className={`pill ${exercise.status === 'draft' ? 'warning' : ''}`}>
          {exercise.scope === 'base'
            ? exercise.status === 'published'
              ? 'BASE · DISPONIBLE'
              : 'PLANTILLA PARA ADAPTAR'
            : exercise.status === 'draft'
              ? 'BORRADOR'
              : exercise.status === 'reviewed'
                ? 'REVISADO'
                : 'PUBLICADO'}
        </span>
        <small className="muted">v{exercise.version}</small>
      </div>
      <h3 style={{ marginTop: 16 }}>{exercise.name}</h3>
      <p className="small muted">{exercise.pattern || exercise.equipment}</p>
      {exercise.scope === 'base' && (
        <p className="small muted">
          {exercise.status === 'published'
            ? 'Usalo directamente en una rutina. La biblioteca conserva el original.'
            : 'Punto de partida: completá las instrucciones para la máquina de tu gimnasio.'}
        </p>
      )}
      <div className="row">
        <button className="text-button" onClick={() => onPreview()}>
          {exercise.scope === 'organization' && exercise.status === 'draft'
            ? 'Revisar contenido'
            : 'Ver movimiento'}
        </button>
        <button className="text-button" disabled={!active} onClick={() => onEdit()}>
          {exercise.scope === 'base'
            ? exercise.status === 'draft'
              ? 'Adaptar plantilla'
              : 'Crear variante'
            : 'Editar'}
        </button>
        {exercise.scope === 'organization' && exercise.status === 'reviewed' && (
          <button className="button small" disabled={!active || busy} onClick={() => onPublish()}>
            Publicar
          </button>
        )}
      </div>
    </article>
  )
}
