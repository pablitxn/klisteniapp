import type {
  Dose,
  ReviewedRelation,
  RoutineVersionV2,
} from '@klisteniapp/b2b-contracts/product-v2'

export const conditionLabels: Record<ReviewedRelation['conditions'][number], string> = {
  'target-requirements-confirmed': 'Confirmo los requisitos del ejercicio elegido.',
  'use-target-dose': 'Voy a usar las series, cantidad y descanso del ejercicio elegido.',
  'accept-higher-demand': 'Acepto una mayor demanda.',
  'accept-lower-demand': 'Acepto una menor demanda.',
  'accept-different-supports': 'Acepto el cambio de apoyos.',
  'accept-different-balance': 'Acepto el cambio de equilibrio.',
  'accept-different-laterality': 'Acepto el cambio de lado y conteo.',
  'accept-different-emphasis': 'Acepto el cambio de énfasis.',
}
const range = (value: Dose['sets']) =>
  value.kind === 'fixed' ? String(value.value) : `${value.min}–${value.max}`
export function doseLabel(dose: Dose): string {
  const quantity =
    dose.mode === 'repetitions'
      ? `${range(dose.repetitions!)} repeticiones`
      : `${range(dose.durationSeconds!)} segundos`
  const side =
    dose.laterality === 'bilateral'
      ? ''
      : dose.laterality === 'alternating'
        ? ' por lado, alternando'
        : ' por lado'
  const load =
    dose.load.mode === 'bodyweight'
      ? 'peso corporal'
      : dose.load.mode === 'external'
        ? `${range(dose.load.kilograms)} kg`
        : 'carga sin confirmar'
  return `${range(dose.sets)} series · ${quantity}${side} · ${load} · descanso ${range(dose.restSeconds)} s`
}
export function alternativePresentation(
  step: RoutineVersionV2['steps'][number],
  relations: readonly ReviewedRelation[],
) {
  if (step.substitutionPolicy === 'blocked')
    return {
      kind: 'blocked' as const,
      message: 'Las alternativas están bloqueadas para este ejercicio en esta rutina.',
      options: [],
    }
  const options = relations.filter((r) => r.sourceExerciseId === step.exerciseId)
  return options.length
    ? {
        kind: 'reviewed' as const,
        message:
          'Cada ejercicio usa su propia dosis. No se presume la misma carga ni el mismo efecto.',
        options,
      }
    : {
        kind: 'empty' as const,
        message: 'No hay alternativas revisadas disponibles para este ejercicio.',
        options: [],
      }
}
export function legacyAuthorizationLabel(ids: readonly string[]): string | null {
  return ids.length
    ? 'Autorizaciones anteriores del entrenador; no acreditan una revisión del catálogo.'
    : null
}

const requirementValues: Record<string, string> = {
  standing: 'de pie',
  supine: 'boca arriba',
  prone: 'boca abajo',
  quadruped: 'en cuatro apoyos',
  'kneeling-plank': 'plancha con rodillas',
  'high-plank': 'plancha alta',
  pike: 'cadera elevada',
  'inclined-supine': 'boca arriba, con inclinación',
  palms: 'palmas',
  knees: 'rodillas',
  forefeet: 'puntas de los pies',
  feet: 'pies',
  pelvis: 'pelvis',
  'upper-back': 'espalda alta',
  back: 'espalda',
  chest: 'pecho',
  grip: 'agarre seguro',
  'stable-base': 'base estable',
  'weight-shift': 'desplazamiento del peso',
  'reduced-support': 'apoyos reducidos',
  bilateral: 'ambos lados juntos',
  alternating: 'lados alternados',
  unilateral: 'un lado a la vez',
  'per-side': 'por cada lado',
  together: 'ambos lados juntos',
  'controlled-knee-pushup': 'flexión con rodillas controlada',
  'controlled-full-pushup': 'flexión completa controlada',
  'high-plank-control': 'control en plancha alta',
  'pike-support-control': 'control de apoyos con cadera elevada',
  'standing-weight-shift-control': 'control del peso al cambiar de apoyo de pie',
  'hip-hinge-control': 'control de la bisagra de cadera',
  'supine-trunk-control': 'control del tronco boca arriba',
  'quadruped-trunk-control': 'control del tronco en cuatro apoyos',
  'secure-bodyweight-grip': 'agarre instalado para sostener el peso corporal',
  'controlled-bodyweight-squat': 'sentadilla controlada con peso corporal',
  'controlled-glute-bridge': 'puente de glúteos controlado',
  'single-leg-balance': 'equilibrio sobre una pierna',
  'single-leg-pelvis-control': 'control de pelvis sobre una pierna',
  'scapular-overhead-control': 'control escapular con brazos elevados',
  'high-plank-weight-shift-control': 'control del cambio de apoyo en plancha alta',
  'horizontal-push': 'empuje horizontal',
  'overhead-push': 'empuje por encima de la cabeza',
  'knee-dominant': 'trabajo dominante de rodilla',
  'hip-extension': 'extensión de cadera',
  'hip-hinge-practice': 'práctica de bisagra de cadera',
  'trunk-stability': 'estabilidad del tronco',
  'trunk-flexion': 'flexión del tronco',
  'scapular-accessory': 'trabajo escapular',
  'ankle-strength': 'trabajo de tobillo',
  'horizontal-pull': 'tracción horizontal',
}
const requirementPrefixes: Record<string, string> = {
  position: 'Posición',
  support: 'Apoyo',
  balance: 'Equilibrio',
  capability: 'Control requerido',
  laterality: 'Lados',
  count: 'Conteo',
  'preserves-role': 'Patrón conservado',
  'reviewed-on': 'Revisión editorial',
  source: 'Fuente',
}
export function requirementLabel(requirement: string): string {
  const colon = requirement.indexOf(':')
  const prefix = requirement.slice(0, colon)
  const value = requirement.slice(colon + 1)
  return colon > 0 && requirementPrefixes[prefix]
    ? `${requirementPrefixes[prefix]}: ${requirementValues[value] ?? value}`
    : requirement
}
