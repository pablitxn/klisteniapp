import { ExercisePlanningSchema, type ExerciseId, type ExercisePlanning } from '@klisteniapp/scene-schema';

const review = (sourceUrl: string, adaptationNote?: string): ExercisePlanning['review'] => ({
  basis: 'editorial', reviewedOn: '2026-10-04', sourceUrls: [sourceUrl],
  scope: 'movement-classification-not-effect-equivalence',
  ...(adaptationNote ? { adaptationNote } : {}),
});
const ace = (path: string) => `https://www.acefitness.org/resources/everyone/exercise-library/${path}/`;

/** Requirements describe the demonstrated version, never clinical clearance or measured ability. */
const definitions = {
  pushup: {
    movementFamily: 'horizontal-push', planningRoles: ['horizontal-push'], laterality: 'bilateral',
    requirements: { position: 'kneeling-plank', supports: ['palms', 'knees'], balance: 'stable-base', capabilities: [] },
    relations: [{
      targetId: 'full-pushup', type: 'progression', preservesRole: 'horizontal-push',
      conditions: ['target-requirements-confirmed', 'use-target-dose', 'accept-higher-demand', 'accept-different-supports'],
      rationale: 'Conserva el empuje horizontal, pero pasar de rodillas a puntas de pie exige controlar una palanca mayor.',
    }],
    review: review(ace('13/bent-knee-push-up')),
  },
  squat: {
    movementFamily: 'bilateral-squat', planningRoles: ['knee-dominant'], laterality: 'bilateral',
    requirements: { position: 'standing', supports: ['feet'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review(ace('135/bodyweight-squat')),
  },
  'glute-bridge': {
    movementFamily: 'supine-hip-extension', planningRoles: ['hip-extension'], laterality: 'bilateral',
    requirements: { position: 'supine', supports: ['feet', 'upper-back'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review(ace('49/glute-bridge')),
  },
  'dead-bug': {
    movementFamily: 'supine-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'supine', supports: ['back', 'pelvis'], balance: 'stable-base', capabilities: ['supine-trunk-control'] },
    relations: [], review: review(ace('147/supine-dead-bug')),
  },
  'prone-w': {
    movementFamily: 'prone-scapular-raise', planningRoles: ['scapular-accessory'], laterality: 'bilateral',
    requirements: { position: 'prone', supports: ['chest', 'pelvis'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review('https://www.wwl.nhs.uk/media/.leaflets/657835a18e50d7.90662950.pdf'),
  },
  'calf-raise': {
    movementFamily: 'standing-calf-raise', planningRoles: ['ankle-strength'], laterality: 'bilateral',
    requirements: { position: 'standing', supports: ['forefeet'], balance: 'reduced-support', capabilities: ['standing-weight-shift-control'] },
    relations: [], review: review(ace('73/standing-calf-raises-wall'), 'La fuente permite apoyo opcional de pared. Los requisitos describen la demostración de pie sin ese apoyo adicional.'),
  },
  row: {
    movementFamily: 'horizontal-pull', planningRoles: ['horizontal-pull'], laterality: 'bilateral',
    requirements: { position: 'inclined-supine', supports: ['grip', 'feet'], balance: 'stable-base', capabilities: ['secure-bodyweight-grip'] },
    relations: [], review: review('https://acefitnessmediastorage.blob.core.windows.net/webcontent/April2018/ACE_BackExerStudy.pdf'),
  },
  'full-pushup': {
    movementFamily: 'horizontal-push', planningRoles: ['horizontal-push'], laterality: 'bilateral',
    requirements: { position: 'high-plank', supports: ['palms', 'forefeet'], balance: 'stable-base', capabilities: ['controlled-knee-pushup', 'high-plank-control'] },
    relations: [{
      targetId: 'pushup', type: 'regression', preservesRole: 'horizontal-push',
      conditions: ['target-requirements-confirmed', 'use-target-dose', 'accept-lower-demand', 'accept-different-supports'],
      rationale: 'Conserva el empuje horizontal con rodillas apoyadas; se acepta reducir la demanda, sin prometer igual estímulo.',
    }],
    review: review(ace('41/push-up')),
  },
  'pike-pushup': {
    movementFamily: 'overhead-push', planningRoles: ['overhead-push'], laterality: 'bilateral',
    requirements: { position: 'pike', supports: ['palms', 'forefeet'], balance: 'stable-base', capabilities: ['controlled-full-pushup', 'pike-support-control'] },
    relations: [], review: review('https://www.nasm.org/resource-center/exercise-library/pike-push-up'),
  },
  'reverse-lunge': {
    movementFamily: 'reverse-lunge', planningRoles: ['knee-dominant'], laterality: 'alternating',
    requirements: { position: 'standing', supports: ['feet', 'forefeet'], balance: 'weight-shift', capabilities: ['standing-weight-shift-control'] },
    relations: [], review: review('https://www.nasm.org/resource-center/blog/squat-alternatives'),
  },
  'lateral-lunge': {
    movementFamily: 'lateral-lunge', planningRoles: ['knee-dominant'], laterality: 'alternating',
    requirements: { position: 'standing', supports: ['feet'], balance: 'weight-shift', capabilities: ['standing-weight-shift-control'] },
    relations: [], review: review(ace('50/side-lunge'), 'La fuente realiza un paso lateral; la demostración alterna desde una base amplia con los pies fijos.'),
  },
  'good-morning': {
    movementFamily: 'standing-hip-hinge', planningRoles: ['hip-extension', 'hip-hinge-practice'], laterality: 'bilateral',
    requirements: { position: 'standing', supports: ['feet'], balance: 'stable-base', capabilities: ['hip-hinge-control'] },
    relations: [], review: review('https://www.nasm.org/resource-center/exercise-library/good-mornings', 'Adaptación sin la barra de la fuente para practicar la bisagra; no se trasladan sus cargas ni resultados de entrenamiento.'),
  },
  'bird-dog': {
    movementFamily: 'quadruped-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'quadruped', supports: ['palms', 'knees'], balance: 'reduced-support', capabilities: ['quadruped-trunk-control'] },
    relations: [], review: review(ace('14/bird-dog')),
  },
  'mountain-climber': {
    movementFamily: 'high-plank-knee-drive', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'high-plank', supports: ['palms', 'forefeet'], balance: 'reduced-support', capabilities: ['high-plank-control'] },
    relations: [], review: review(ace('258/mountain-climbers'), 'Adaptación lenta y sin salto de la versión dinámica de la fuente; cada pie regresa atrás antes de mover el otro.'),
  },
  crunch: {
    movementFamily: 'trunk-curl', planningRoles: ['trunk-flexion'], laterality: 'bilateral',
    requirements: { position: 'supine', supports: ['feet', 'pelvis', 'back'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review(ace('52/crunch'), 'La demostración cruza los brazos en el pecho en lugar de colocar las manos detrás de la cabeza.'),
  },
  'quarter-squat': {
    movementFamily: 'bilateral-squat', planningRoles: ['knee-dominant'], laterality: 'bilateral',
    requirements: { position: 'standing', supports: ['feet'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review('https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/functional-fitness-exercise-pack', 'Recorrido corto para practicar; no se traslada un protocolo de rehabilitación ni se fija un ángulo obligatorio.'),
  },
  'paused-squat': {
    movementFamily: 'bilateral-squat', planningRoles: ['knee-dominant'], laterality: 'bilateral',
    requirements: { position: 'standing', supports: ['feet'], balance: 'stable-base', capabilities: ['controlled-bodyweight-squat'] },
    relations: [], review: review('https://www.acefitness.org/resources/everyone/blog/4998/lower-body-circuit-workout-try-this-leg-circuit-workout/', 'La pausa forma parte de cada repetición; rango y dosis elegidos para la app.'),
  },
  'knee-narrow-pushup': {
    movementFamily: 'horizontal-push', planningRoles: ['horizontal-push'], laterality: 'bilateral',
    requirements: { position: 'kneeling-plank', supports: ['palms', 'knees'], balance: 'stable-base', capabilities: ['controlled-knee-pushup'] },
    relations: [], review: review('https://www.acefitness.org/certifiednewsarticle/3008/ace-study-identifies-best-triceps-exercises/', 'Se usa la adaptación con rodillas y manos cercanas, sin exigir triángulo ni trasladar porcentajes EMG de la fuente.'),
  },
  'narrow-pushup': {
    movementFamily: 'horizontal-push', planningRoles: ['horizontal-push'], laterality: 'bilateral',
    requirements: { position: 'high-plank', supports: ['palms', 'forefeet'], balance: 'stable-base', capabilities: ['controlled-full-pushup', 'high-plank-control'] },
    relations: [], review: review('https://www.acefitness.org/resources/pros/expert-articles/5854/how-to-create-a-movement-training-matrix/', 'Manos algo más cerradas que los hombros; no se exige juntar dedos ni se asume el mismo efecto que otras flexiones.'),
  },
  'dead-bug-heel-tap': {
    movementFamily: 'supine-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'supine', supports: ['back', 'pelvis'], balance: 'stable-base', capabilities: ['supine-trunk-control'] },
    relations: [], review: review('https://www.leicspart.nhs.uk/wp-content/uploads/2024/08/608-Physio-based-pilates.pdf', 'Variante con ambas piernas en tabletop y brazos quietos. Se toma el gesto, no una prescripción clínica.'),
  },
  'quadruped-leg-extension': {
    movementFamily: 'quadruped-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'quadruped', supports: ['palms', 'knees'], balance: 'reduced-support', capabilities: ['quadruped-trunk-control'] },
    relations: [], review: review('https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/functional-fitness-exercise-pack', 'Se conserva el gesto alternado de extensión de pierna; no las indicaciones posoperatorias del documento.'),
  },
  'prone-t-raise': {
    movementFamily: 'prone-scapular-raise', planningRoles: ['scapular-accessory'], laterality: 'bilateral',
    requirements: { position: 'prone', supports: ['chest', 'pelvis'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review('https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/', 'Se selecciona la variante en T boca abajo y sin mancuernas, con elevaciones pequeñas por repetición.'),
  },
  'prone-y-raise': {
    movementFamily: 'prone-scapular-raise', planningRoles: ['scapular-accessory'], laterality: 'bilateral',
    requirements: { position: 'prone', supports: ['chest', 'pelvis'], balance: 'stable-base', capabilities: ['scapular-overhead-control'] },
    relations: [], review: review('https://www.acefitness.org/resources/pros/expert-articles/3718/total-body-dumbbell-workout/', 'Se selecciona la variante en Y boca abajo y sin mancuernas. El ángulo representado no es una exigencia de movilidad.'),
  },
  'split-squat': {
    movementFamily: 'split-squat', planningRoles: ['knee-dominant'], laterality: 'unilateral',
    requirements: { position: 'standing', supports: ['feet', 'forefeet'], balance: 'weight-shift', capabilities: ['standing-weight-shift-control'] },
    relations: [], review: review('https://www.rnoh.nhs.uk/patients-and-visitors/patient-information-guides/functional-fitness-exercise-pack', 'Zancada fija sin cambio de pies dentro de la serie; se cambia de lado al completarla. No se traslada el protocolo clínico.'),
  },
  'single-leg-calf-raise': {
    movementFamily: 'standing-calf-raise', planningRoles: ['ankle-strength'], laterality: 'unilateral',
    requirements: { position: 'standing', supports: ['forefeet'], balance: 'reduced-support', capabilities: ['single-leg-balance'] },
    relations: [], review: review('https://www.cuh.nhs.uk/patient-information/general-stability-exercises1/', 'Se muestra la progresión sin apoyo de manos; el documento incluye ayuda estable y retirarla gradualmente.'),
  },
  'bridge-march': {
    movementFamily: 'supine-hip-extension', planningRoles: ['hip-extension'], laterality: 'alternating',
    requirements: { position: 'supine', supports: ['feet', 'upper-back'], balance: 'reduced-support', capabilities: ['controlled-glute-bridge', 'single-leg-pelvis-control'] },
    relations: [], review: review('https://www.wwl.nhs.uk/pdfreader/accessiblePDF/cnv-wwl-68ca8bcf6ded33.07836789', 'Marcha con pelvis elevada. Cada elevación de pie es una repetición; la fuente muestra una clase por tiempo que no se reproduce aquí.'),
  },
  'single-leg-glute-bridge': {
    movementFamily: 'supine-hip-extension', planningRoles: ['hip-extension'], laterality: 'unilateral',
    requirements: { position: 'supine', supports: ['feet', 'upper-back'], balance: 'reduced-support', capabilities: ['controlled-glute-bridge', 'single-leg-pelvis-control'] },
    relations: [], review: review('https://www.newcastle-hospitals.nhs.uk/services/injury-prevention-advice-for-runners/', 'Cada repetición sube y baja la pelvis manteniendo la otra pierna elevada; la dosis editorial no es un protocolo de tratamiento.'),
  },
  'bent-knee-row': {
    movementFamily: 'horizontal-pull', planningRoles: ['horizontal-pull'], laterality: 'bilateral',
    requirements: { position: 'inclined-supine', supports: ['grip', 'feet'], balance: 'stable-base', capabilities: ['secure-bodyweight-grip'] },
    relations: [], review: review('https://www.acefitness.org/continuing-education/certified/june-2018/7010/branch-out-with-strength-equipment/', 'La fuente usa barras portátiles con rodillas flexionadas y pies planos. Aquí se conserva esa posición con una barra o anillas instaladas para soportar el peso corporal; no se reproduce el circuito por tiempo.'),
  },
  'dead-bug-arm-only': {
    movementFamily: 'supine-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'supine', supports: ['back', 'pelvis'], balance: 'stable-base', capabilities: ['supine-trunk-control'] },
    relations: [], review: review('https://dvphysiotherapy.com/aiovg_videos/103-dead-bug-progression/', 'Se selecciona la variante de brazos con piernas quietas en tabletop; las repeticiones y descansos son editoriales, sin indicaciones de tratamiento.'),
  },
  'sumo-squat': {
    movementFamily: 'bilateral-squat', planningRoles: ['knee-dominant'], laterality: 'bilateral',
    requirements: { position: 'standing', supports: ['feet'], balance: 'stable-base', capabilities: ['controlled-bodyweight-squat'] },
    relations: [], review: review('https://www.acefitness.org/continuing-education/certified/september-2024/8711/body-weight-interval-training-equipment-free-and-highly-versatile/', 'Sentadilla de base amplia sin carga. El recorrido se limita al control individual; no se exige llegar al paralelo ni se adopta el entrenamiento por intervalos de la fuente.'),
  },
  'single-leg-deadlift': {
    movementFamily: 'standing-hip-hinge', planningRoles: ['hip-extension', 'hip-hinge-practice'], laterality: 'unilateral',
    requirements: { position: 'standing', supports: ['feet'], balance: 'reduced-support', capabilities: ['hip-hinge-control', 'single-leg-balance', 'single-leg-pelvis-control'] },
    relations: [], review: review('https://www.acefitness.org/resources/pros/expert-articles/6295/lower-body-exercises-for-dynamic-balance/', 'Se usa la versión sin mancuerna y recorrido moderado. En lugar de alternar en cada repetición, la app completa un lado antes del otro; los brazos se mantienen cerca del tronco.'),
  },
  'forward-lunge': {
    movementFamily: 'forward-lunge', planningRoles: ['knee-dominant'], laterality: 'alternating',
    requirements: { position: 'standing', supports: ['feet', 'forefeet'], balance: 'weight-shift', capabilities: ['standing-weight-shift-control', 'single-leg-balance'] },
    relations: [], review: review(ace('94/forward-lunge'), 'Se vuelve a la posición inicial antes de cambiar de pierna. La profundidad es cómoda y no exige que el muslo llegue al paralelo.'),
  },
  'quadruped-arm-raise': {
    movementFamily: 'quadruped-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'quadruped', supports: ['palms', 'knees'], balance: 'reduced-support', capabilities: ['quadruped-trunk-control'] },
    relations: [], review: review('https://www.southtees.nhs.uk/resources/arm-raise-in-four-point-kneeling/', 'Se conserva la elevación alternada de un brazo con ambas rodillas apoyadas; el cuello se mantiene alineado como en la referencia ACE de bird dog en lugar de seguir la mano con la mirada.'),
  },
  'prone-hip-extension': {
    movementFamily: 'prone-hip-extension', planningRoles: ['hip-extension'], laterality: 'unilateral',
    requirements: { position: 'prone', supports: ['chest', 'pelvis'], balance: 'stable-base', capabilities: [] },
    relations: [], review: review('https://www.kentcht.nhs.uk/leaflet/lower-limb-strengthening-activities/', 'Se toma Active hip extensions con rodilla extendida, pelvis apoyada y elevación pequeña. Se completa un lado antes del otro, sin trasladar la dosis o la progresión clínica del folleto.'),
  },
  'supine-march': {
    movementFamily: 'supine-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'supine', supports: ['back', 'pelvis', 'feet'], balance: 'stable-base', capabilities: ['supine-trunk-control'] },
    relations: [], review: review('https://www.leicspart.nhs.uk/wp-content/uploads/2024/08/608-Physio-based-pilates.pdf', 'Página 10: primera versión de Table top/heel taps, desde pies apoyados. Cada pie vuelve al suelo antes de elevar el otro; no es la progresión con ambas piernas elevadas.'),
  },
  'supine-heel-slide': {
    movementFamily: 'supine-limb-control', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'supine', supports: ['back', 'pelvis', 'feet'], balance: 'stable-base', capabilities: ['supine-trunk-control'] },
    relations: [], review: review('https://www.leicspart.nhs.uk/wp-content/uploads/2024/08/608-Physio-based-pilates.pdf', 'Página 10: Leg slides con el talón en contacto con el suelo durante todo el recorrido. La app alterna lados y cuenta la ida y vuelta de un talón como una repetición de ese lado.'),
  },
  'plank-shoulder-tap': {
    movementFamily: 'high-plank-shoulder-tap', planningRoles: ['trunk-stability'], laterality: 'alternating',
    requirements: { position: 'high-plank', supports: ['palms', 'forefeet'], balance: 'reduced-support', capabilities: ['high-plank-control', 'high-plank-weight-shift-control'] },
    relations: [], review: review('https://www.nasm.org/resource-center/blog/training/the-plank-coaching-progressions-and-variations-for-every-client', 'Se seleccionan los toques alternados de hombro lentos en plancha alta. La app cuenta cada toque y retorno por lado, sin convertir la serie en una plancha cronometrada.'),
  },
} satisfies Record<ExerciseId, ExercisePlanning>;

type Relation = ExercisePlanning['relations'][number];
const relation = (targetId: ExerciseId, type: Relation['type'], preservesRole: Relation['preservesRole'], rationale: string, conditions: Relation['conditions'] = []): Relation => ({
  targetId, type, preservesRole, rationale,
  conditions: [
    'target-requirements-confirmed', 'use-target-dose',
    ...(type === 'progression' ? ['accept-higher-demand' as const] : type === 'regression' ? ['accept-lower-demand' as const] : []),
    ...conditions,
  ],
});

/** Every direction is curated explicitly; never infer links through muscle overlap. */
const additionalRelations: Partial<Record<ExerciseId, Relation[]>> = {
  pushup: [relation('knee-narrow-pushup', 'alternative', 'horizontal-push', 'Conserva el empuje con rodillas y cambia la separación de manos; revisá comodidad y control.', ['accept-different-emphasis'])],
  'full-pushup': [relation('narrow-pushup', 'alternative', 'horizontal-push', 'Mismo patrón horizontal, con apoyo de manos más cerrado y dosis propia.', ['accept-different-emphasis'])],
  'knee-narrow-pushup': [
    relation('pushup', 'alternative', 'horizontal-push', 'Recupera el apoyo habitual de manos, manteniendo las rodillas en el suelo.', ['accept-different-emphasis']),
    relation('narrow-pushup', 'progression', 'horizontal-push', 'Pasar a puntas de pie aumenta la palanca y requiere control previo.', ['accept-different-supports']),
  ],
  'narrow-pushup': [
    relation('full-pushup', 'alternative', 'horizontal-push', 'Amplía el apoyo de manos dentro del patrón horizontal; no presupone la misma demanda.', ['accept-different-emphasis']),
    relation('knee-narrow-pushup', 'regression', 'horizontal-push', 'Apoyar rodillas reduce la palanca, con un esquema de repeticiones propio.', ['accept-different-supports']),
  ],
  squat: [
    relation('quarter-squat', 'regression', 'knee-dominant', 'Reduce el recorrido de una sentadilla bilateral.'),
    relation('paused-squat', 'progression', 'knee-dominant', 'Añade una pausa dentro de cada repetición y reduce el rango propuesto de repeticiones.'),
    relation('sumo-squat', 'alternative', 'knee-dominant', 'Amplía la base y modifica la orientación de los pies; conservá un recorrido controlado sin asumir igual estímulo.', ['accept-different-emphasis']),
  ],
  'quarter-squat': [relation('squat', 'progression', 'knee-dominant', 'Amplía el recorrido solo cuando el apoyo y la vuelta sean controlados.')],
  'paused-squat': [relation('squat', 'regression', 'knee-dominant', 'Retira la pausa y vuelve al ritmo continuo de la ficha.')],
  'dead-bug': [
    relation('dead-bug-heel-tap', 'regression', 'trunk-stability', 'Mantiene la práctica de control supino con brazos quietos y rodilla flexionada.'),
    relation('dead-bug-arm-only', 'regression', 'trunk-stability', 'Deja las piernas quietas en tabletop y mueve solo un brazo por repetición; se mantiene el control supino.', ['accept-different-emphasis']),
  ],
  'dead-bug-heel-tap': [
    relation('dead-bug', 'progression', 'trunk-stability', 'Añade el brazo contrario y mayor extensión de la pierna sin perder el control del tronco.'),
    relation('supine-march', 'regression', 'trunk-stability', 'Parte de pies en el suelo y conserva uno apoyado mientras mueve el otro, con menos demanda al sostener las piernas.', ['accept-different-supports']),
  ],
  'bird-dog': [
    relation('quadruped-leg-extension', 'regression', 'trunk-stability', 'Mantiene las dos manos apoyadas al extender solo una pierna.', ['accept-different-supports']),
    relation('quadruped-arm-raise', 'regression', 'trunk-stability', 'Mantiene ambas rodillas apoyadas mientras se mueve un brazo, sin elevar la pierna contraria.', ['accept-different-supports']),
  ],
  'quadruped-leg-extension': [
    relation('bird-dog', 'progression', 'trunk-stability', 'Añade el brazo contrario y reduce los apoyos simultáneos.', ['accept-different-supports']),
    relation('quadruped-arm-raise', 'alternative', 'trunk-stability', 'Conserva la práctica de control en cuadrupedia, pero mueve un brazo en lugar de una pierna y cambia qué apoyo se retira.', ['accept-different-supports', 'accept-different-emphasis']),
  ],
  'prone-w': [relation('prone-t-raise', 'progression', 'scapular-accessory', 'Extender los codos alarga la palanca manteniendo el trabajo escapular ligero.', ['accept-different-emphasis'])],
  'prone-t-raise': [
    relation('prone-w', 'regression', 'scapular-accessory', 'Flexiona los codos para acortar la palanca.', ['accept-different-emphasis']),
    relation('prone-y-raise', 'progression', 'scapular-accessory', 'Requiere controlar una posición de brazos más cercana a la cabeza; no implica más eficacia.', ['accept-different-emphasis']),
  ],
  'prone-y-raise': [relation('prone-t-raise', 'regression', 'scapular-accessory', 'Retira la posición por encima de la cabeza conservando la elevación escapular ligera.', ['accept-different-emphasis'])],
  'calf-raise': [relation('single-leg-calf-raise', 'progression', 'ankle-strength', 'Pasa de dos pies a una sola pierna: cambia carga, equilibrio y conteo.', ['accept-different-supports', 'accept-different-balance', 'accept-different-laterality'])],
  'single-leg-calf-raise': [relation('calf-raise', 'regression', 'ankle-strength', 'Vuelve a dos apoyos y a repeticiones conjuntas.', ['accept-different-supports', 'accept-different-balance', 'accept-different-laterality'])],
  'glute-bridge': [
    relation('bridge-march', 'progression', 'hip-extension', 'Sostiene la cadera elevada mientras alterna pies; las repeticiones cuentan pasos, no elevaciones de pelvis.', ['accept-different-balance', 'accept-different-laterality', 'accept-different-supports', 'accept-different-emphasis']),
    relation('single-leg-glute-bridge', 'progression', 'hip-extension', 'Sube y baja la pelvis usando una pierna por serie.', ['accept-different-balance', 'accept-different-laterality', 'accept-different-supports']),
  ],
  'bridge-march': [relation('glute-bridge', 'regression', 'hip-extension', 'Recupera ambos pies apoyados y cuenta elevaciones de pelvis, no pasos.', ['accept-different-balance', 'accept-different-laterality', 'accept-different-supports', 'accept-different-emphasis'])],
  'single-leg-glute-bridge': [relation('glute-bridge', 'regression', 'hip-extension', 'Reparte el apoyo entre ambos pies y vuelve al conteo bilateral.', ['accept-different-balance', 'accept-different-laterality', 'accept-different-supports'])],
  row: [relation('bent-knee-row', 'regression', 'horizontal-pull', 'Acerca los pies y flexiona las rodillas para acortar la palanca, conservando el agarre instalado y el control de la cadera.', ['accept-different-emphasis'])],
  'bent-knee-row': [relation('row', 'progression', 'horizontal-pull', 'Aleja los pies y extiende las piernas para alargar la palanca dentro de la tracción horizontal.', ['accept-different-emphasis'])],
  'sumo-squat': [relation('squat', 'alternative', 'knee-dominant', 'Vuelve a una base menos amplia dentro de la sentadilla bilateral; revisá orientación de pies y recorrido.', ['accept-different-emphasis'])],
  'good-morning': [relation('single-leg-deadlift', 'progression', 'hip-hinge-practice', 'Retira un apoyo de la bisagra y exige equilibrio y control de pelvis sobre una pierna; la cantidad pasa a ser por lado.', ['accept-different-supports', 'accept-different-balance', 'accept-different-laterality', 'accept-different-emphasis'])],
  'single-leg-deadlift': [relation('good-morning', 'regression', 'hip-hinge-practice', 'Recupera ambos pies apoyados para practicar la bisagra y vuelve a repeticiones conjuntas.', ['accept-different-supports', 'accept-different-balance', 'accept-different-laterality', 'accept-different-emphasis'])],
  'dead-bug-arm-only': [relation('dead-bug', 'progression', 'trunk-stability', 'Añade movimiento de la pierna contraria al brazo, manteniendo la pelvis estable.', ['accept-different-emphasis'])],
  'quadruped-arm-raise': [
    relation('bird-dog', 'progression', 'trunk-stability', 'Añade la pierna contraria al brazo y reduce los apoyos simultáneos.', ['accept-different-supports']),
    relation('quadruped-leg-extension', 'alternative', 'trunk-stability', 'Conserva el control en cuadrupedia y mueve una pierna en lugar de un brazo; no equipara la demanda de hombro o cadera.', ['accept-different-supports', 'accept-different-emphasis']),
  ],
  'supine-march': [
    relation('supine-heel-slide', 'regression', 'trunk-stability', 'Mantiene el talón de la pierna móvil en el suelo para practicar el control supino con apoyo continuo.', ['accept-different-supports', 'accept-different-emphasis']),
    relation('dead-bug-heel-tap', 'progression', 'trunk-stability', 'Parte con ambas piernas elevadas en vez de conservar un pie apoyado; usá la dosis propia del destino.', ['accept-different-supports']),
  ],
  'supine-heel-slide': [relation('supine-march', 'progression', 'trunk-stability', 'Retira del suelo el pie que se mueve mientras el otro queda apoyado; requiere controlar la pelvis durante la elevación.', ['accept-different-supports', 'accept-different-emphasis'])],
};

export const exercisePlanning = Object.fromEntries(
  Object.entries(definitions).map(([id, planning]) => [id, ExercisePlanningSchema.parse({
    ...planning, relations: [...planning.relations, ...(additionalRelations[id as ExerciseId] ?? [])],
  })]),
) as Record<ExerciseId, ExercisePlanning>;
