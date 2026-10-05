import { lazy, Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Exercise, MuscleId } from '@klisteniapp/scene-schema'
import { getExercise, muscles } from '../data/exercises'
import { bodyRegions, bodySources, muscleLessons, type BodyRegion } from '../data/body-guide'
import { posteriorMuscles } from '../lib/body-preview-config'
import { selectAnatomicalModel, useAppStore } from '../lib/store'
import Icon from './Icon'
import Modal from './Modal'
import './body-guide.css'

const AnatomyViewer = lazy(() => import('./AnatomyViewer'))

interface BodyGuideProps {
  routine: Exercise[]
  onOpenExercise: (id: string) => void
}

function MuscleThumbnail({ id }: { id: MuscleId }) {
  const modelVariant = useAppStore(selectAnatomicalModel)
  const source = `/previews/${modelVariant === 'female' ? 'female/' : ''}body/${id}.webp`
  const [failedSource, setFailedSource] = useState<string | null>(null)
  const failed = failedSource === source
  useEffect(() => setFailedSource(null), [source])
  return <span className={`body-muscle-thumbnail${failed ? ' body-muscle-thumbnail--fallback' : ''}`} data-model={modelVariant} aria-hidden="true">
    {failed ? <Icon name="body" size={28} /> : <img key={source} src={source} alt="" loading="lazy" width={88} height={96} onError={() => setFailedSource(source)} />}
  </span>
}

export default function BodyGuide({ routine, onOpenExercise }: BodyGuideProps) {
  const { t } = useTranslation('body')
  const { t: core } = useTranslation('core')
  const [region, setRegion] = useState<BodyRegion | 'all'>('all')
  const [explorer, setExplorer] = useState<MuscleId | null>(null)
  const [modelSelection, setModelSelection] = useState<MuscleId | null>(null)
  const uniqueRoutine = routine.filter((exercise, index) => routine.findIndex(item => item.id === exercise.id) === index)
  const displayedMuscle = modelSelection ?? explorer
  const relatedExercises = displayedMuscle ? uniqueRoutine.filter(exercise => exercise.primaryMuscles.includes(displayedMuscle) || exercise.secondaryMuscles.includes(displayedMuscle)) : []
  const openMovement = (id: string) => { setExplorer(null); onOpenExercise(id) }
  const openModel = (id: MuscleId) => { setModelSelection(id); setExplorer(id) }
  const exerciseLinks = (items: Exercise[]) => (
    <div className="body-exercise-links">
      {items.map(exercise => <button key={exercise.id} type="button" onClick={() => openMovement(exercise.id)}>
        {core(exercise.shortName)}<Icon name="arrow" size={14} />
      </button>)}
    </div>
  )
  const renderMuscle = (id: MuscleId) => {
    const muscle = muscles[id]
    const lesson = muscleLessons[id]
    const primary = uniqueRoutine.filter(exercise => exercise.primaryMuscles.includes(id))
    const secondary = uniqueRoutine.filter(exercise => exercise.secondaryMuscles.includes(id) && !exercise.primaryMuscles.includes(id))
    const example = primary[0] ?? secondary[0] ?? getExercise(lesson.exampleId)!
    return <details className="body-muscle" key={id}>
      <summary>
        <MuscleThumbnail id={id} />
        <span className="body-muscle-heading">
          <strong>{core(muscle.name)}</strong>
          <span>{t(lesson.action)}</span>
        </span>
        <span className="body-expand"><Icon name="plus" size={18} /></span>
      </summary>
      <div className="body-muscle-content">
        <button className="body-open-model" type="button" aria-label={t('Ver {{muscle}} en 3D', { muscle: core(muscle.name) })} onClick={() => openModel(id)}>
          <Icon name="body" size={20} /><span>{t('Explorar {{muscle}} en 3D', { muscle: core(muscle.name) })}</span><Icon name="arrow" size={16} />
        </button>
        <dl className="body-muscle-facts">
          <div><dt>{t('Dónde está')}</dt><dd>{t(lesson.location)}</dd></div>
          <div><dt>{t('Partes de esta región')}</dt><dd><ul className="body-muscle-parts">{lesson.parts.map(part => <li key={part}>{t(part)}</li>)}</ul></dd></div>
          <div><dt>{t('Qué hace')}</dt><dd>{t(muscle.description)}</dd></div>
          <div><dt>{t('Articulaciones y movimientos')}</dt><dd>{t(lesson.joints)}</dd></div>
          <div><dt>{t('Cómo colabora')}</dt><dd>{t(lesson.collaboration)}</dd></div>
          <div><dt>{t('Conectalo con un gesto')}</dt><dd>{t(lesson.everyday)}</dd></div>
          <div><dt>{t('Una pista para observar')}</dt><dd>{t(lesson.observation)}</dd></div>
        </dl>
        <div className="body-routine-roles">
          <h4>{t('Su papel en tu rutina')}</h4>
          <div><span className="body-role-label">{t('Principal')}</span>
            {primary.length ? exerciseLinks(primary) : <p>{t('No hay un ejercicio con este papel en tu selección.')}</p>}
          </div>
          <div><span className="body-role-label">{t('Apoyo y control')}</span>
            {secondary.length ? exerciseLinks(secondary) : <p>{t('No está señalado como apoyo en tu selección.')}</p>}
          </div>
          {secondary.length > 0 && <small>{t('Participar como apoyo no equivale a recibir el mismo estímulo que en un trabajo principal.')}</small>}
          <p className="body-routine-note">{t('Estos papeles describen los ejercicios del catálogo. No indican cuánto entrenaste una región ni si tu rutina tiene un volumen suficiente.')}</p>
        </div>
        <div className="body-practice-cue">
          <Icon name="target" size={18} />
          <div><strong>{t('Una pista para observar')} · {core(example.shortName)}</strong>
            <p>{core(example.cues[0] ?? '')}</p>
            <button className="text-button" type="button" onClick={() => openMovement(example.id)}>{t('Ver el movimiento')}<Icon name="arrow" size={16} /></button>
          </div>
        </div>
        <div className="body-fiche-sources">
          <h4>{t('Fuentes de esta ficha')}</h4>
          {bodySources.filter(source => lesson.sourceIds.includes(source.id)).map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{t(source.label)}<Icon name="arrow" size={13} /></a>)}
        </div>
      </div>
    </details>
  }

  return <div className="body-guide">
    <section className="body-atlas" aria-label={t('Tu atlas, explicado sin vueltas.')}>
      <div className="body-region-filter" role="group" aria-label={t('Filtrar regiones del cuerpo')}>
        <button type="button" aria-pressed={region === 'all'} onClick={() => setRegion('all')}>{t('Todo el cuerpo')}</button>
        {bodyRegions.map(item => <button key={item.id} type="button" aria-pressed={region === item.id} onClick={() => setRegion(item.id)}>{t(item.title)}</button>)}
      </div>
      {bodyRegions.filter(item => region === 'all' || region === item.id).map(item => <div className="body-region" key={item.id}>
        <div className="body-region-heading"><h3>{t(item.title)}</h3><p>{t(item.description)}</p></div>
        <div className="body-muscle-list">{item.muscles.map(renderMuscle)}</div>
      </div>)}
    </section>

    <aside className="body-sources" aria-label={t('Fuentes para seguir aprendiendo')}>
      <strong>{t('Para seguir aprendiendo')}</strong><p>{t('Anatomía funcional: OpenStax, Anatomy and Physiology 2e. Cada ejercicio incluye además sus propias fuentes y su técnica.')}</p>
      <div>{bodySources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{t(source.label)}<Icon name="arrow" size={13} /></a>)}</div>
    </aside>
    {explorer && displayedMuscle && <Modal title={core(muscles[displayedMuscle].name)} wide onClose={() => setExplorer(null)}>
      <section className="body-muscle-explorer" data-testid="muscle-explorer" aria-label={t('Ver {{muscle}} en 3D', { muscle: core(muscles[displayedMuscle].name) })}>
        <div className="body-explorer-intro"><span className="eyebrow">{t('MODELO ANATÓMICO')}</span><p>{t('Vista educativa de esta región. Girá el cuerpo y cambiá de capa para ubicarla.')}</p></div>
        <Suspense fallback={<p role="status" className="body-model-loading">{t('Cargando el modelo anatómico…')}</p>}>
          <AnatomyViewer
            key={explorer}
            exerciseId={muscleLessons[displayedMuscle].exampleId}
            initialMode="anatomical"
            initialView={posteriorMuscles.includes(explorer) ? 'back' : 'front'}
            reducedMotion
            primaryMuscles={[displayedMuscle]}
            secondaryMuscles={[]}
            selectedMuscle={modelSelection}
            onSelectMuscle={id => setModelSelection(id && id in muscles ? id as MuscleId : null)}
          />
        </Suspense>
        {modelSelection && <p className="body-model-selection">{t('Región seleccionada')}: <strong>{core(muscles[modelSelection].name)}</strong></p>}
        <dl className="body-muscle-facts body-explorer-facts">
          <div><dt>{t('Dónde está')}</dt><dd>{t(muscleLessons[displayedMuscle].location)}</dd></div>
          <div><dt>{t('Conectalo con un gesto')}</dt><dd>{t(muscleLessons[displayedMuscle].everyday)}</dd></div>
        </dl>
        <div className="body-explorer-movements"><h3>{t('Movimientos relacionados')}</h3>{exerciseLinks(relatedExercises.length ? relatedExercises : [getExercise(muscleLessons[displayedMuscle].exampleId)!])}</div>
        <p className="body-model-limit">{t('El modelo agrupa estructuras para aprender a orientarte; no muestra cada inserción ni mide activación.')}</p>
      </section>
    </Modal>}
  </div>
}
