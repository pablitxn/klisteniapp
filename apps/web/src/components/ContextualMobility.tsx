import { useTranslation } from 'react-i18next'
import type { MuscleId, YogaAsanaId } from '@klisteniapp/scene-schema'
import { relatedAsanas } from '../lib/learning-library'
import Icon from './Icon'
import './contextual-mobility.css'

/** Browsing never creates a practice or changes the user's training plan. */
export default function ContextualMobility({ muscleIds, onOpenAsana, collapsible = true }: {
  collapsible?: boolean
  muscleIds: readonly MuscleId[]
  onOpenAsana: (id: YogaAsanaId) => void
}) {
  const { t } = useTranslation('body')
  const asanas = relatedAsanas(muscleIds)
  if (!asanas.length) return null
  const Container = collapsible ? 'details' : 'section'
  const Heading = collapsible ? 'summary' : 'h4'
  return <Container className="contextual-mobility">
    <Heading><Icon name="yoga" size={18} />{t('Explorar elongación y movilidad')}</Heading>
    <p>{t('Opciones de lectura relacionadas por región corporal. Elegí según tu comodidad y revisá los cuidados de cada postura; no se agregan a tu rutina.')}</p>
    <div className="contextual-mobility-links">
      {asanas.map(asana => <button key={asana.id} type="button" onClick={() => onOpenAsana(asana.id)}>
        <strong>{asana.name}</strong><span>{asana.description}</span><small>{t('Explorar ficha de yoga')} <Icon name="arrow" size={14} /></small>
      </button>)}
    </div>
  </Container>
}
