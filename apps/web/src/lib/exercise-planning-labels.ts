import type {
  BalanceDemand, ExercisePosition, ExerciseSupport, MovementFamily,
  PlanningRelationCondition, PlanningRole, TechnicalCapability,
} from '@klisteniapp/scene-schema'

export const movementFamilyLabels: Record<MovementFamily, string> = {
  'horizontal-push': 'Empuje horizontal',
  'overhead-push': 'Empuje orientado hacia arriba',
  'bilateral-squat': 'Sentadilla con ambos pies apoyados',
  'reverse-lunge': 'Zancada con paso atrás',
  'forward-lunge': 'Zancada con paso adelante',
  'lateral-lunge': 'Zancada lateral',
  'supine-hip-extension': 'Extensión de cadera boca arriba',
  'prone-hip-extension': 'Extensión de cadera boca abajo',
  'standing-hip-hinge': 'Bisagra de cadera de pie',
  'supine-limb-control': 'Control del tronco boca arriba',
  'quadruped-limb-control': 'Control del tronco en cuatro apoyos',
  'split-squat': 'Sentadilla en posición de zancada fija',
  'high-plank-knee-drive': 'Acercamiento de rodilla en plancha alta',
  'high-plank-shoulder-tap': 'Toque de hombro en plancha alta',
  'trunk-curl': 'Flexión del tronco',
  'prone-scapular-raise': 'Elevación escapular boca abajo',
  'standing-calf-raise': 'Elevación de talones de pie',
  'horizontal-pull': 'Tracción horizontal',
}

export const planningRoleLabels: Record<PlanningRole, string> = {
  'horizontal-push': 'Empuje horizontal', 'overhead-push': 'Empuje hacia arriba',
  'knee-dominant': 'Piernas: trabajo dominante de rodilla', 'hip-extension': 'Extensión de cadera',
  'hip-hinge-practice': 'Práctica de bisagra de cadera', 'trunk-stability': 'Estabilidad del tronco',
  'trunk-flexion': 'Flexión del tronco', 'scapular-accessory': 'Control escapular accesorio',
  'ankle-strength': 'Trabajo de pantorrillas', 'horizontal-pull': 'Tracción horizontal',
}

export const positionLabels: Record<ExercisePosition, string> = {
  standing: 'De pie', supine: 'Boca arriba', prone: 'Boca abajo', quadruped: 'Cuatro apoyos',
  'kneeling-plank': 'Plancha con rodillas apoyadas', 'high-plank': 'Plancha alta',
  pike: 'Cadera elevada en V', 'inclined-supine': 'Cuerpo inclinado, boca arriba',
}

export const supportLabels: Record<ExerciseSupport, string> = {
  palms: 'manos', knees: 'rodillas', forefeet: 'puntas de los pies', feet: 'pies',
  pelvis: 'pelvis', 'upper-back': 'espalda alta', back: 'espalda', chest: 'pecho', grip: 'agarre fijo',
}

export const balanceLabels: Record<BalanceDemand, string> = {
  'stable-base': 'Base estable', 'weight-shift': 'Desplazamiento del peso', 'reduced-support': 'Apoyos reducidos',
}

export const capabilityLabels: Record<TechnicalCapability, string> = {
  'controlled-knee-pushup': 'Controlar la flexión con rodillas',
  'controlled-full-pushup': 'Controlar la flexión completa',
  'high-plank-control': 'Mantener el tronco alineado en plancha alta',
  'high-plank-weight-shift-control': 'Mantener la pelvis estable al retirar una mano en plancha alta',
  'pike-support-control': 'Controlar el apoyo con la cadera elevada',
  'standing-weight-shift-control': 'Controlar el equilibrio al desplazar el peso',
  'hip-hinge-control': 'Controlar la bisagra de cadera',
  'supine-trunk-control': 'Mantener la pelvis estable boca arriba',
  'quadruped-trunk-control': 'Mantener el tronco estable en cuatro apoyos',
  'secure-bodyweight-grip': 'Disponer de un agarre instalado para soportar el peso corporal',
  'controlled-bodyweight-squat': 'Controlar la sentadilla sin peso',
  'controlled-glute-bridge': 'Controlar el puente con ambos pies apoyados',
  'single-leg-balance': 'Mantener el equilibrio sobre una pierna',
  'single-leg-pelvis-control': 'Mantener la pelvis estable al retirar un apoyo',
  'scapular-overhead-control': 'Controlar las escápulas con los brazos elevados',
}

export const relationConditionLabels: Record<PlanningRelationCondition, string> = {
  'target-requirements-confirmed': 'Revisar los requisitos de la nueva opción',
  'use-target-dose': 'Usar sus propias series, repeticiones y descansos',
  'accept-higher-demand': 'Elegir conscientemente una demanda mayor',
  'accept-lower-demand': 'Elegir una demanda menor',
  'accept-different-supports': 'Comprobar el cambio de apoyos',
  'accept-different-balance': 'Comprobar la nueva demanda de equilibrio',
  'accept-different-laterality': 'Adaptar el conteo y el trabajo de cada lado',
  'accept-different-emphasis': 'Aceptar el cambio de énfasis del movimiento',
}
