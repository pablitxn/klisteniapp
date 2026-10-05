import type { MuscleId } from '@klisteniapp/scene-schema'

export type BodyRegion = 'upper' | 'core' | 'lower'

export const bodyRegions: { id: BodyRegion; title: string; description: string; muscles: MuscleId[] }[] = [
  { id: 'upper', title: 'Tren superior', description: 'Brazos, hombros y espalda: mover y acompañar el gesto.', muscles: ['pectorals', 'deltoids', 'triceps', 'lats', 'biceps', 'upper-back'] },
  { id: 'core', title: 'Centro', description: 'El tronco también trabaja cuando consigue quedarse quieto.', muscles: ['abdominals', 'obliques'] },
  { id: 'lower', title: 'Tren inferior', description: 'Cadera, rodillas y tobillos: distintos trabajos en cada paso.', muscles: ['glutes', 'quadriceps', 'hamstrings', 'calves'] },
]

export interface MuscleLesson {
  action: string
  location: string
  parts: string[]
  joints: string
  collaboration: string
  everyday: string
  observation: string
  exampleId: string
  sourceIds: BodyRegion[]
}

// Original educational copy: locations, groups and actions were cross-checked
// against the OpenStax sections below. Everyday examples and observation cues
// illustrate those actions; they do not infer activation, dose or clinical effects.
// The twelve IDs remain the catalogue/model's teaching regions, not an exhaustive
// list of every muscle or an assertion that each structure is separately visible.
export const muscleLessons: Record<MuscleId, MuscleLesson> = {
  pectorals: {
    action: 'Acercar los brazos y empujar.',
    location: 'En la parte anterior del pecho. El pectoral mayor va desde la clavícula y el esternón hacia el hueso del brazo, el húmero.',
    parts: ['Pectoral mayor: la capa amplia y superficial del pecho.', 'Pectoral menor: una capa más profunda que une costillas y escápula.'],
    joints: 'Hombro: el mayor acerca el brazo al cuerpo y lo lleva por delante del pecho. El menor actúa sobre la escápula, no sobre el codo.',
    collaboration: 'En un empuje, el pecho participa en el hombro y el tríceps extiende el codo. El deltoides anterior y los músculos que posicionan la escápula acompañan el gesto.',
    everyday: 'Empujar una puerta hacia adelante combina el trabajo del pecho, los hombros y los brazos.',
    observation: 'En una flexión, seguí el brazo desde el hombro y después mirá el codo: son dos articulaciones distintas dentro del mismo empuje.',
    exampleId: 'pushup', sourceIds: ['upper'],
  },
  deltoids: {
    action: 'Elevar y orientar el brazo.',
    location: 'Rodean el hombro como una capa sobre la parte superior del húmero. Se conectan con la clavícula y la escápula.',
    parts: ['Porción anterior: delante del hombro; ayuda a llevar el brazo hacia adelante.', 'Porción media: a un lado; ayuda a separar el brazo del cuerpo.', 'Porción posterior: detrás; ayuda a llevar el brazo hacia atrás.'],
    joints: 'Hombro: levantar el brazo hacia adelante, a un lado o hacia atrás según la porción que participa. El deltoides no es el único músculo que mueve esta articulación.',
    collaboration: 'La escápula aporta la base móvil del hombro. El manguito rotador, un grupo profundo diferente del deltoides, también ayuda a controlar la articulación.',
    everyday: 'Levantar el brazo para alcanzar un estante requiere movimiento en el hombro.',
    observation: 'En el modelo, girá desde la vista frontal hasta la espalda y ubicá las tres caras del hombro antes de seguir una elevación del brazo.',
    exampleId: 'pike-pushup', sourceIds: ['upper'],
  },
  triceps: {
    action: 'Extender el codo.',
    location: 'En la cara posterior del brazo, entre el hombro y el codo. Su tendón llega al olécranon, la punta ósea del codo.',
    parts: ['Cabeza larga: comienza en la escápula y cruza también el hombro.', 'Cabezas lateral y medial: comienzan en el húmero; las tres llegan al mismo tendón.'],
    joints: 'Codo: aumentar su ángulo para estirar el brazo. La cabeza larga también cruza el hombro; las otras dos no.',
    collaboration: 'En una flexión, el tríceps participa en el codo mientras pecho y hombro intervienen más arriba. Extender el codo y mover el brazo desde el hombro son tareas distintas.',
    everyday: 'Al alejar una puerta con la mano, el codo se extiende.',
    observation: 'Pausá una flexión con el codo doblado y comparala con el brazo más extendido. Buscá el cambio en el codo, no solamente cuánto sube el cuerpo.',
    exampleId: 'pushup', sourceIds: ['upper'],
  },
  lats: {
    action: 'Llevar el brazo hacia el cuerpo.',
    location: 'El dorsal ancho cubre buena parte de la espalda baja y lateral; se estrecha al acercarse a la axila y llega al húmero.',
    parts: ['Dorsal ancho derecho e izquierdo: músculos amplios que conectan el tronco con el brazo.'],
    joints: 'Hombro: acercar el brazo al tronco y llevarlo hacia atrás. El dorsal mueve el brazo; no es el músculo que flexiona directamente el codo.',
    collaboration: 'En un remo, el dorsal participa en el hombro, los flexores del codo doblan el brazo y los músculos escapulares acompañan la posición de la escápula.',
    everyday: 'Acercar un objeto tirando hacia vos combina movimientos de hombro y codo.',
    observation: 'En un remo, seguí el codo cuando se acerca al tronco y mirá también el hombro. No confundas doblar el codo con todo el gesto de tirar.',
    exampleId: 'row', sourceIds: ['upper'],
  },
  biceps: {
    action: 'Flexionar el codo y girar la palma.',
    location: 'En la cara anterior del brazo. Sus dos cabezas parten de la escápula y su tendón llega al radio, uno de los huesos del antebrazo.',
    parts: ['Cabeza larga y cabeza corta: dos puntos de origen que forman el bíceps braquial.'],
    joints: 'Codo: doblarlo. Antebrazo: girarlo para orientar la palma hacia arriba, llamado supinación. También cruza el hombro y ayuda a llevar el brazo hacia adelante.',
    collaboration: 'El braquial y el braquiorradial también flexionan el codo. Por eso doblar el brazo no demuestra que sólo esté trabajando el bíceps.',
    everyday: 'Acercar una taza a la boca requiere flexionar el codo; también colaboran otros músculos.',
    observation: 'Compará doblar el codo con girar el antebrazo: podés cambiar la orientación de la palma sin completar otra flexión del codo.',
    exampleId: 'bent-knee-row', sourceIds: ['upper'],
  },
  'upper-back': {
    action: 'Mover y controlar las escápulas.',
    location: 'Detrás del cuello y del tórax. El trapecio se extiende hacia clavícula y escápula; los romboides quedan más profundos, entre columna y borde interno de la escápula.',
    parts: ['Trapecio: porciones superior, media e inferior con distintas orientaciones.', 'Romboides mayor y menor: unen la columna con la escápula.'],
    joints: 'Cintura escapular: elevar, bajar y acercar las escápulas a la columna, con funciones distintas según el músculo. La escápula se desplaza sobre el tórax; no es una bisagra como el codo.',
    collaboration: 'Estos músculos comparten el control escapular con el serrato anterior y otros músculos del hombro. Posicionar la escápula da una base al movimiento del brazo.',
    everyday: 'Al mover los brazos, las escápulas acompañan el movimiento sobre la parte posterior del tórax.',
    observation: 'En una W en el suelo, mirá la relación entre escápulas, costillas y brazos. Después compará ese gesto con un remo: controlar la escápula y tirar con carga son trabajos diferentes.',
    exampleId: 'prone-w', sourceIds: ['upper'],
  },
  abdominals: {
    action: 'Controlar el tronco y la pelvis.',
    location: 'Entre las costillas y la pelvis. El recto abdominal está delante, a cada lado de la línea media; el transverso forma una capa profunda alrededor del abdomen.',
    parts: ['Recto abdominal: bandas largas que ayudan a flexionar el tronco.', 'Transverso abdominal: fibras transversales que comprimen la pared abdominal.'],
    joints: 'Columna y pelvis: el recto ayuda a acercar el tórax a la pelvis. El transverso comprime el abdomen; su trabajo no exige una gran flexión visible.',
    collaboration: 'La pared abdominal trabaja con los oblicuos y los músculos de la espalda para mover o controlar el tronco. Los músculos que mueven brazos y piernas tienen otras tareas.',
    everyday: 'Al incorporarte para salir de la cama, el tronco cambia de posición mientras brazos y cadera también pueden ayudar.',
    observation: 'En un dead bug, seguí la distancia entre costillas y pelvis mientras se mueven las extremidades. La pista es lo que el tronco mantiene, no sólo lo que se mueve.',
    exampleId: 'dead-bug', sourceIds: ['core'],
  },
  obliques: {
    action: 'Girar el tronco y controlar giros.',
    location: 'A los lados del abdomen, entre costillas y pelvis. El oblicuo externo es más superficial y el interno está debajo.',
    parts: ['Oblicuo externo: capa superficial con fibras diagonales.', 'Oblicuo interno: capa más profunda con otra orientación; ambos existen a derecha e izquierda.'],
    joints: 'Columna: girar e inclinar el tronco. Al actuar juntos también ayudan a flexionarlo y a comprimir el abdomen; la combinación de lados cambia el gesto.',
    collaboration: 'Cooperan con recto, transverso y músculos de la espalda. Pueden acompañar un giro o participar en el control de una postura cuando una carga tira hacia un lado.',
    everyday: 'Al llevar una bolsa de un solo lado, el tronco trabaja para controlar la inclinación.',
    observation: 'En los toques de hombro en plancha, mirá si pelvis y tórax giran cuando una mano deja el suelo. El cambio de apoyo ayuda a entender el trabajo de control.',
    exampleId: 'plank-shoulder-tap', sourceIds: ['core'],
  },
  glutes: {
    action: 'Extender la cadera y estabilizar la pelvis.',
    location: 'En la parte posterior y lateral de la cadera. El glúteo mayor es más superficial; el medio y el menor se encuentran hacia el lado de la pelvis, en capas más profundas.',
    parts: ['Glúteo mayor: destaca en llevar el muslo hacia atrás, extendiendo la cadera.', 'Glúteos medio y menor: forman parte del grupo lateral que mueve y sostiene la cadera.'],
    joints: 'Cadera: extenderla, separar el muslo del cuerpo y controlar su posición, con funciones distintas dentro del grupo. Extender la cadera no es lo mismo que arquear la espalda.',
    collaboration: 'Al levantarte de una silla, cadera y rodilla se extienden juntas. Glúteos, músculos del muslo y tronco colaboran; un solo grupo no explica todo el movimiento.',
    everyday: 'Levantarte de una silla combina extensión de cadera y de rodillas.',
    observation: 'En un puente, seguí cómo cambia la relación entre pelvis y muslos. Compará ese movimiento de cadera con la posición del tronco.',
    exampleId: 'glute-bridge', sourceIds: ['lower'],
  },
  quadriceps: {
    action: 'Extender la rodilla.',
    location: 'En la parte anterior y a los lados del muslo. Los cuatro músculos llegan a la rótula y transmiten fuerza hacia la tibia mediante el aparato tendinoso de la rodilla.',
    parts: ['Recto femoral: delante del muslo; cruza cadera y rodilla.', 'Vastos lateral, medial e intermedio: rodean el fémur; el intermedio queda debajo del recto.'],
    joints: 'Rodilla: extenderla, pasando de doblada a más recta. El recto femoral también ayuda a flexionar la cadera; los tres vastos actúan sobre la rodilla.',
    collaboration: 'En una sentadilla, el cuádriceps participa en la rodilla y los músculos de la cadera colaboran más arriba. Los apoyos del pie y el control del tronco también forman parte del gesto.',
    everyday: 'Subir un escalón requiere extender la rodilla de la pierna que te sostiene.',
    observation: 'En una sentadilla, seguí el ángulo de la rodilla al bajar y subir. Después mirá la cadera: una sentadilla combina ambas articulaciones.',
    exampleId: 'squat', sourceIds: ['lower'],
  },
  hamstrings: {
    action: 'Flexionar la rodilla y ayudar a extender la cadera.',
    location: 'En la parte posterior del muslo. La mayor parte del grupo une la pelvis con la pierna, cruzando cadera y rodilla.',
    parts: ['Bíceps femoral: cabezas larga y corta en el lado externo del muslo.', 'Semitendinoso y semimembranoso: hacia el lado interno.'],
    joints: 'Rodilla: flexionarla. Cadera: ayudar a extenderla. La cabeza corta del bíceps femoral sólo cruza la rodilla; no extiende directamente la cadera.',
    collaboration: 'Cooperan con los glúteos en gestos de extensión de cadera. En la rodilla tienen una acción distinta de la extensión del cuádriceps; las tareas se combinan según el movimiento.',
    everyday: 'Llevar el talón hacia atrás flexiona la rodilla; este grupo también participa en gestos de cadera.',
    observation: 'En una bisagra de cadera, mirá cuánto cambia la cadera y cuánto la rodilla. Comparala con llevar el talón hacia atrás para distinguir las dos acciones del grupo.',
    exampleId: 'single-leg-deadlift', sourceIds: ['lower'],
  },
  calves: {
    action: 'Elevar el talón.',
    location: 'En la parte posterior de la pierna, debajo de la rodilla. Gastrocnemio y sóleo llegan al talón por el tendón calcáneo, conocido como tendón de Aquiles.',
    parts: ['Gastrocnemio o gemelos: dos cabezas superficiales; cruza rodilla y tobillo.', 'Sóleo: capa más profunda; cruza el tobillo y no la rodilla.'],
    joints: 'Tobillo: apuntar el pie hacia abajo, llamado flexión plantar; con el pie apoyado se observa al elevar el talón. El gastrocnemio también ayuda a flexionar la rodilla.',
    collaboration: 'La elevación del talón combina pantorrilla, apoyo del pie y equilibrio. Otros músculos de la pierna y del pie ayudan a orientar y sostener el apoyo.',
    everyday: 'Ponerte en puntas de pie para alcanzar algo es una forma cotidiana de este movimiento.',
    observation: 'En una elevación de talones, ubicá el tobillo y seguí el talón al despegarse del suelo. No es el mismo gesto que extender la rodilla.',
    exampleId: 'calf-raise', sourceIds: ['lower'],
  },
}

export const bodySources: { id: BodyRegion; section: string; label: string; url: string; verifiedAt: string }[] = [
  { id: 'upper', section: '11.5', label: 'Hombros, brazos y espalda', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-5-muscles-of-the-pectoral-girdle-and-upper-limbs', verifiedAt: '2026-10-05' },
  { id: 'core', section: '11.4', label: 'Tronco y abdomen', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-4-axial-muscles-of-the-abdominal-wall-and-thorax', verifiedAt: '2026-10-05' },
  { id: 'lower', section: '11.6', label: 'Cadera y piernas', url: 'https://openstax.org/books/anatomy-and-physiology-2e/pages/11-6-appendicular-muscles-of-the-pelvic-girdle-and-lower-limbs', verifiedAt: '2026-10-05' },
]
