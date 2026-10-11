import type { MuscleId, YogaAsanaId } from '@klisteniapp/scene-schema'
import { bodyRegions, muscleLessons, type BodyRegion } from '../data/body-guide.ts'
import { muscles } from '../data/exercises.ts'
import { asanas, getAsana, type Asana } from '../data/yoga.ts'

export function learningSearch(value: string): string {
  return value.toLocaleLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
}

/** Educational cross-links by body region, grounded in the existing asana copy.
 * They do not prescribe a cooldown, infer activation, or add exercise technique.
 * Upper/core: the existing cat/cow/child entries discuss the back and torso.
 * Lower: supported leg, bound angle and low lunge discuss legs and hips.
 */
export const regionAsanas: Readonly<Record<BodyRegion, readonly YogaAsanaId[]>> = {
  upper: ['marjaryasana', 'bitilasana', 'balasana'],
  core: ['marjaryasana', 'bitilasana', 'balasana'],
  lower: ['supta-padangusthasana', 'baddha-konasana', 'anjaneyasana'],
}

export function relatedAsanas(muscleIds: readonly MuscleId[], limit = 3): Asana[] {
  const ids = bodyRegions
    .filter(region => region.muscles.some(id => muscleIds.includes(id)))
    .flatMap(region => regionAsanas[region.id])
  return [...new Set(ids)].map(id => getAsana(id)).filter((asana): asana is Asana => Boolean(asana)).slice(0, limit)
}

export function searchMuscles(query: string, translate: (text: string) => string = text => text): MuscleId[] {
  const needle = learningSearch(query)
  return bodyRegions.flatMap(region => region.muscles).filter(id => {
    const lesson = muscleLessons[id]
    const region = bodyRegions.find(region => region.muscles.includes(id))!
    const fields = [id, muscles[id].name, muscles[id].description, region.title, lesson.action, lesson.location, ...lesson.parts, lesson.joints, lesson.everyday]
    return learningSearch(fields.flatMap(text => [text, translate(text)]).join(' ')).includes(needle)
  })
}

export function searchLearningAsanas(query: string): Asana[] {
  const needle = learningSearch(query)
  // Yoga's reviewed learning content is currently Spanish; retain English and
  // Sanskrit names/aliases as entry points without fabricating translations.
  return asanas.filter(asana => learningSearch([
    asana.name, asana.sanskritName, asana.englishName, ...asana.aliases,
    asana.family, asana.description, ...asana.sensations,
  ].join(' ')).includes(needle))
}
