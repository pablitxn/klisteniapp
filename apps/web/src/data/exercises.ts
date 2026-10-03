import { ExerciseSchema, type Exercise, type ExerciseId, type Muscle, type MuscleId } from '@klisteniapp/scene-schema';

export const muscles: Record<MuscleId, Muscle> = {
  pectorals: { id: 'pectorals', name: 'Pectorales', region: 'Pecho', description: 'Acercan los brazos al centro y ayudan a empujar.' },
  deltoids: { id: 'deltoids', name: 'Deltoides', region: 'Hombros', description: 'Mueven el brazo. Su porción anterior participa en empujes; la posterior, en movimientos hacia atrás.' },
  triceps: { id: 'triceps', name: 'Tríceps', region: 'Parte posterior del brazo', description: 'Extienden el codo al empujar.' },
  lats: { id: 'lats', name: 'Dorsales', region: 'Laterales de la espalda', description: 'Llevan el brazo hacia el tronco y hacia atrás. Participan en remos y dominadas.' },
  biceps: { id: 'biceps', name: 'Bíceps', region: 'Parte anterior del brazo', description: 'Flexionan el codo y ayudan a girar la palma hacia arriba.' },
  'upper-back': { id: 'upper-back', name: 'Trapecios y romboides', region: 'Espalda alta', description: 'Controlan las escápulas: los huesos que se deslizan detrás del tórax al mover los brazos.' },
  abdominals: { id: 'abdominals', name: 'Abdominales', region: 'Centro del tronco', description: 'El recto y el transverso participan en el control del tronco y la pelvis.' },
  obliques: { id: 'obliques', name: 'Oblicuos', region: 'Laterales del abdomen', description: 'Ayudan a girar el tronco y a resistir giros o inclinaciones no deseados.' },
  glutes: { id: 'glutes', name: 'Glúteos', region: 'Cadera', description: 'Extienden la cadera y contribuyen a estabilizar la pelvis.' },
  quadriceps: { id: 'quadriceps', name: 'Cuádriceps', region: 'Parte anterior del muslo', description: 'Extienden las rodillas al levantarte de una sentadilla.' },
  hamstrings: { id: 'hamstrings', name: 'Isquiotibiales', region: 'Parte posterior del muslo', description: 'Flexionan la rodilla y ayudan a extender la cadera.' },
  calves: { id: 'calves', name: 'Gemelos y sóleo', region: 'Pantorrillas', description: 'Elevan el talón y contribuyen al impulso de cada paso.' },
};

const basic = { equipment: 'none', difficulty: 'Inicial', defaultSets: 2, reps: { min: 6, max: 10, perSide: false }, restSeconds: 60 } as const;
const ace = (path: string, title: string) => ({ title: `ACE · ${title}`, url: `https://www.acefitness.org/resources/everyone/exercise-library/${path}/` });

export const exercises: Exercise[] = [
  {
    ...basic, id: 'pushup', name: 'Flexiones con rodillas', shortName: 'Flexiones', englishName: 'Knee push-up', pattern: 'Empuje',
    description: 'Aprendé a empujar manteniendo el tronco firme. Apoyar las rodillas reduce la carga.',
    tempo: 'Bajá en 2 s · subí en 1 s',
    setup: ['Apoyá manos y rodillas en el suelo.', 'Manos a la altura de los hombros; alineá hombros, cadera y rodillas.'],
    steps: ['Flexioná los codos y acercá el pecho al suelo.', 'Mantené la cadera alineada y el cuello largo.', 'Empujá el suelo hasta extender los brazos.'],
    cues: ['Mové el tronco como una sola pieza.', 'Codos algo cerca del cuerpo; exhalá al subir.'],
    mistakes: ['Dejar caer la cintura.', 'Sacar la cabeza o abrir los codos hacia los lados.'],
    easier: { name: 'Contra la pared', description: 'Manos en una pared firme; alejás los pies solo lo necesario para controlar el gesto.' },
    harder: { name: 'Flexión completa', description: 'Pasá al apoyo en puntas de pie cuando puedas mantener la alineación.' },
    primaryMuscles: ['pectorals', 'triceps'], secondaryMuscles: ['deltoids', 'abdominals'],
    sources: [ace('13/bent-knee-push-up', 'Flexión con rodillas')],
  },
  {
    ...basic, id: 'squat', name: 'Sentadilla', shortName: 'Sentadilla', englishName: 'Bodyweight squat', pattern: 'Sentadilla',
    description: 'Entrená piernas y cadera con el patrón de sentarte y volver a ponerte de pie.',
    tempo: 'Bajá en 2 s · subí en 1 s',
    setup: ['Pies un poco más separados que las caderas.', 'Orientá las puntas ligeramente hacia afuera, según tu comodidad.'],
    steps: ['Llevá la cadera atrás y abajo flexionando rodillas.', 'Bajá hasta donde conserves el apoyo y el control.', 'Empujá el suelo y levantá cadera y pecho juntos.'],
    cues: ['Apoyá talón y base de los dedos.', 'Rodillas en la dirección de los pies.'],
    mistakes: ['Levantar los talones.', 'Juntar las rodillas hacia adentro o caer sin control.'],
    easier: { name: 'Menor profundidad', description: 'Practicá un recorrido más corto y aumentalo gradualmente.' },
    harder: { name: 'Pausa abajo', description: 'Agregá una pausa breve manteniendo el apoyo del pie.' },
    primaryMuscles: ['quadriceps', 'glutes'], secondaryMuscles: ['abdominals', 'calves'],
    sources: [ace('135/bodyweight-squat', 'Sentadilla sin carga')],
  },
  {
    ...basic, id: 'glute-bridge', name: 'Puente de glúteos', shortName: 'Puente', englishName: 'Glute bridge', pattern: 'Cadera',
    description: 'Extendé la cadera con los glúteos mientras el abdomen ayuda a controlar la pelvis.',
    tempo: 'Subí en 1 s · pausa 1 s · bajá en 2 s',
    setup: ['Boca arriba, rodillas flexionadas y plantas en el suelo.', 'Separá los pies al ancho de las caderas; brazos relajados a los lados.'],
    steps: ['Activá suavemente el abdomen y empujá con los pies.', 'Elevá la pelvis hasta alinear hombros, cadera y rodillas.', 'Bajá despacio hasta volver al suelo.'],
    cues: ['Terminá con los glúteos, sin arquear la cintura.', 'Mantené las rodillas orientadas hacia adelante.'],
    mistakes: ['Subir buscando la máxima altura.', 'Abrir las costillas y arquear la zona lumbar.'],
    easier: { name: 'Puente corto', description: 'Elevá la pelvis menos, conservando el movimiento sin molestias.' },
    harder: { name: 'Pausa de 3 segundos', description: 'Sostené arriba con la pelvis estable antes de bajar.' },
    primaryMuscles: ['glutes'], secondaryMuscles: ['hamstrings', 'abdominals'],
    sources: [ace('49/glute-bridge', 'Puente de glúteos')],
  },
  {
    ...basic, id: 'dead-bug', name: 'Dead bug alternado', shortName: 'Dead bug', englishName: 'Dead bug', pattern: 'Estabilidad',
    description: 'El abdomen mantiene estable el tronco mientras se mueven brazo y pierna contrarios.',
    reps: { min: 6, max: 10, perSide: true }, tempo: 'Extendé en 2 s · volvé en 2 s',
    setup: ['Boca arriba, brazos hacia el techo.', 'Elevá piernas con caderas y rodillas flexionadas a unos 90°.'],
    steps: ['Acercá lentamente un brazo y la pierna contraria al suelo.', 'Frená antes de que la cintura se arquee.', 'Volvé al centro y cambiá de lado.'],
    cues: ['Respirá durante todo el movimiento.', 'Elegí el recorrido que permita mantener la pelvis quieta.'],
    mistakes: ['Aguantar el aire.', 'Bajar demasiado y perder el control lumbar.'],
    easier: { name: 'Solo talones', description: 'Dejá los brazos quietos y alterná acercar un talón al suelo con rodilla flexionada.' },
    harder: { name: 'Más recorrido', description: 'Estirá más la pierna solo si el tronco permanece estable.' },
    primaryMuscles: ['abdominals'], secondaryMuscles: ['obliques'],
    sources: [ace('147/supine-dead-bug', 'Dead bug')],
    note: 'Una repetición por lado = un movimiento con cada diagonal. 6 por lado son 12 movimientos alternados.',
  },
  {
    ...basic, id: 'prone-w', name: 'Elevación en W', shortName: 'W en el suelo', englishName: 'Prone W raise', pattern: 'Escápulas',
    description: 'Explorá el control de las escápulas y la parte posterior de los hombros con una elevación pequeña.',
    tempo: 'Elevá en 1 s · pausa 2 s · bajá en 2 s',
    setup: ['Boca abajo, cuello cómodo y mirada al suelo.', 'Abrí los brazos y doblá los codos para formar una W.'],
    steps: ['Acercá suavemente las escápulas entre sí.', 'Despegá un poco brazos y manos, sin elevar los codos por encima del tronco.', 'Bajá despacio y relajá.'],
    cues: ['Mantené el pecho y la pelvis apoyados.', 'Alejá los hombros de las orejas.'],
    mistakes: ['Levantar el torso para ganar altura.', 'Encoger los hombros o forzar el cuello.'],
    easier: { name: 'Sin despegar los brazos', description: 'Practicá el movimiento de las escápulas con los brazos apoyados.' },
    harder: { name: 'Pausa más larga', description: 'Sostené hasta 5 segundos sin aumentar la altura ni tensar el cuello.' },
    primaryMuscles: ['upper-back'], secondaryMuscles: ['deltoids'],
    sources: [{ title: 'NHS · Prone W, página 3', url: 'https://www.wwl.nhs.uk/media/.leaflets/657835a18e50d7.90662950.pdf' }],
    note: 'Es un trabajo escapular ligero. No reemplaza una tracción con resistencia para dorsales y bíceps.',
  },
  {
    ...basic, id: 'calf-raise', name: 'Elevación de talones', shortName: 'Talones', englishName: 'Calf raise', pattern: 'Tobillo',
    description: 'Trabajá la pantorrilla al elevar el talón y controlar la vuelta al suelo.',
    reps: { min: 10, max: 15, perSide: false }, tempo: 'Subí en 1 s · pausa 1 s · bajá en 2 s',
    setup: ['De pie, pies paralelos al ancho de las caderas.', 'Si necesitás equilibrio, apoyá los dedos en una pared firme.'],
    steps: ['Elevá los talones lentamente.', 'Hacé una pausa sobre la base de los dedos.', 'Bajá ambos talones con control.'],
    cues: ['Subí recto, sin volcar los tobillos.', 'Conservá las rodillas extendidas sin forzarlas.'],
    mistakes: ['Rebotar para subir.', 'Cargar solo el borde externo del pie.'],
    easier: { name: 'Con apoyo de pared', description: 'Usá un apoyo ligero y un recorrido cómodo.' },
    harder: { name: 'Una pierna', description: 'Reducí repeticiones y usá la pared para mantener el equilibrio.' },
    primaryMuscles: ['calves'], secondaryMuscles: [],
    sources: [ace('73/standing-calf-raises-wall', 'Elevación de talones')],
  },
  {
    ...basic, id: 'row', name: 'Remo invertido', shortName: 'Remo', englishName: 'Inverted row', pattern: 'Tracción', equipment: 'bar-or-rings',
    description: 'Acercá el pecho a un agarre fijo para trabajar espalda y flexores del codo.',
    tempo: 'Subí en 1 s · pausa 1 s · bajá en 2 s',
    setup: ['Necesitás una barra o anillas instaladas para soportar tu peso.', 'Sujetate con brazos extendidos y elegí una inclinación fácil.'],
    steps: ['Mantené el cuerpo alineado con los pies apoyados.', 'Flexioná los codos y acercá el pecho al agarre.', 'Extendé los brazos lentamente sin dejar caer la cadera.'],
    cues: ['Guiá los codos hacia atrás.', 'Mové el pecho hacia el agarre, sin adelantar la cabeza.'],
    mistakes: ['Impulsarse con la cadera.', 'Usar mesas, puertas o anclajes improvisados.'],
    easier: { name: 'Más vertical', description: 'Con un montaje adecuado, reducí la inclinación para mover menos peso.' },
    harder: { name: 'Más horizontal', description: 'Aumentá la inclinación gradualmente manteniendo el control.' },
    primaryMuscles: ['lats', 'upper-back'], secondaryMuscles: ['biceps', 'deltoids', 'abdominals'],
    sources: [{ title: 'ACE · Investigación y técnica de remo', url: 'https://acefitnessmediastorage.blob.core.windows.net/webcontent/April2018/ACE_BackExerStudy.pdf' }],
    note: 'Fuera de tu rutina sin equipo. Para añadir tracción progresiva hace falta un agarre o una resistencia adecuados.',
  },
].map((exercise) => ExerciseSchema.parse(exercise));

export const starterRoutine = {
  id: 'first-foundations',
  name: 'Tu primera base',
  description: 'Seis movimientos para empezar a conocer tu cuerpo, sin equipamiento.',
  exerciseIds: ['pushup', 'squat', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise'] as ExerciseId[],
  sets: 2,
  daysPerWeek: 2,
  durationLabel: '20–25 min',
  frequency: '2 días por semana, dejando un día de descanso entre sesiones.',
  warmup: 'Empezá con 3–5 minutos de marcha suave y movimientos cómodos de hombros, cadera y tobillos.',
  effort: 'Empezá por el mínimo de repeticiones. Terminá cada serie sintiendo que podrías hacer 2–3 más con buena técnica; descansá más si lo necesitás.',
  balanceNote: 'Esta base cubre empuje, piernas, cadera y control del tronco y las escápulas. Queda pendiente una tracción con resistencia para dorsales y bíceps cuando tengas equipamiento adecuado.',
  progression: 'Cuando el extremo alto del rango resulte controlado, elegí una variante más exigente. La técnica manda; no hace falta entrenar al fallo.',
};

export function getExercise(id: string): Exercise | undefined {
  return exercises.find((candidate) => candidate.id === id);
}

export const cardioActivities = {
  walk: 'Caminata', run: 'Carrera', bike: 'Bicicleta', other: 'Otro',
} as const;

export const educationNotes = {
  anatomy: 'Mapa simplificado: los colores muestran participación habitual, no activación medida ni un porcentaje de esfuerzo.',
  safety: 'Movete sin dolor y con control. Si aparece dolor, detené el ejercicio y revisá la técnica o pedí orientación profesional.',
  cardio: 'Podés complementar con caminatas a un ritmo cómodo e ir aumentando gradualmente. Registramos minutos reales; la intensidad cambia qué objetivo aeróbico representan.',
  sources: [{ title: 'CDC · Actividad física para adultos', url: 'https://www.cdc.gov/physical-activity-basics/guidelines/adults.html' }],
};
