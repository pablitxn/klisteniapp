# Metadatos para organizar ejercicios

La primera fase clasificó y validó los quince ejercicios existentes antes de ampliar la galería. La segunda añadió doce variantes y la tercera diez fichas completas: el catálogo actual tiene treinta y siete ejercicios con metadatos y relaciones revisables. No genera semanas, asigna sesiones, decide la aptitud de una persona ni modifica rutinas o registros existentes.

El contrato vive en `packages/scene-schema/src/exercise-planning.ts`, se expone desde `@klisteniapp/scene-schema` y es obligatorio en `ExerciseSchema.planning`. Los datos se mantienen en `packages/catalog-base/src/exercise-planning.ts` y se incorporan al catálogo desde `exercises.ts`. La ficha muestra esta información en «Cómo encaja en tu rutina»; explorar una relación abre el ejercicio destino, sin reemplazarlo en una rutina.

## Campos

| Campo | Significado | Límite |
| --- | --- | --- |
| `movementFamily` | Familia específica del gesto representado: empuje horizontal, bisagra de pie, extensión de cadera tumbado, etc. | No se deduce de compartir músculos ni del patrón general visible. |
| `planningRoles` | Funciones editoriales para describir qué lugar podría ocupar el ejercicio. Una bisagra puede tener los roles de extensión de cadera y práctica de bisagra. | Compartir un rol no autoriza una sustitución. No representa una cantidad de estímulo. |
| `requirements.position` | Posición de la versión demostrada. | No incluye todas las variantes mencionadas en la ficha. |
| `requirements.supports` | Contactos que sostienen el cuerpo durante el gesto. `feet` significa pie apoyado; `forefeet`, apoyo sobre el antepié; `grip`, agarre que sostiene peso corporal. | No mide fuerza, presión o porcentaje de carga. Puede variar el contacto a lo largo de la repetición. |
| `requirements.balance` | Base estable, transferencia de peso o base de apoyo reducida. | Son descriptores cualitativos, sin puntuación de riesgo. |
| `requirements.capabilities` | Controles técnicos que requieren atención: plancha alta, control de pelvis en cuadrupedia, agarre, etc. | No son requisitos clínicos ni capacidades inferidas de XP, nivel o cantidad de sesiones. Una lista vacía no certifica aptitud. |
| `laterality` | `bilateral`: repetición conjunta; `alternating`: cambia de lado dentro del ciclo; `unilateral`: una serie trabaja un lado antes de cambiar. | `alternating` y `unilateral` cuentan repeticiones por lado. La reproducción y el registro deben conservar esa distinción. |
| `relations` | Relaciones dirigidas y explícitamente revisadas hacia IDs existentes. | Una lista vacía significa «sin relación compatible revisada», no que nunca pueda existir una variante. |
| `review` | Clasificación `editorial`, fecha, URLs de referencia y alcance `movement-classification-not-effect-equivalence`; `adaptationNote` aclara cambios respecto de la fuente. | La fuente puede describir el gesto sin respaldar una equivalencia de entrenamiento. La fecha es de revisión editorial de los metadatos. |

Equipo, dificultad, músculos, series, repeticiones y descanso siguen en la ficha original; no se duplican en `planning`. Tampoco se interpreta el tempo de texto como una duración exacta, ni se agregan coeficientes de activación muscular o fatiga.

## Relaciones y condiciones

Cada relación contiene `targetId`, `type`, `preservesRole`, `conditions` y una explicación `rationale`. Los tipos son `alternative`, `regression` y `progression`. Se almacenan por dirección; no se presupone reciprocidad ni transitividad.

Todas las relaciones exigen `target-requirements-confirmed` y `use-target-dose`: antes de ofrecer el cambio debe comprobarse el equipo, nivel y requisitos del destino, y usar su propia dosis. Una progresión exige además `accept-higher-demand`; una regresión, `accept-lower-demand`. Si cambia la posición o los apoyos, se exige `accept-different-supports`; si cambian balance o lateralidad, `accept-different-balance` o `accept-different-laterality`. La condición `accept-different-emphasis` explicita cambios de técnica o énfasis que la revisión considera relevantes, como separar más las manos o contar pasos con la pelvis elevada en lugar de subirla y bajarla. Las condiciones se declaran, pero esta fase no guarda su confirmación por el usuario ni ejecuta cambios.

La política inicial es conservadora: toda relación debe conservar la misma familia específica y un rol presente en ambos ejercicios. El término `alternative` señala una opción editorial para ese papel, no igualdad de carga, eficacia o resultado. Las progresiones/regresiones expresan una dirección elegida por la revisión; el validador no puede demostrarla a partir de músculos o etiquetas.

La fase inicial revisó la pareja flexión con rodillas ↔ flexión completa. La segunda ampliación llegó a veintiséis relaciones dirigidas y la tercera agrega dieciséis: el total es **cuarenta y dos relaciones**. Además de empuje, recorrido y pausa de sentadilla, control supino, cuadrupedia, elevaciones escapulares, talones y puentes, ahora se revisan la base amplia de sentadilla, el remo con rodillas y la bisagra a una pierna. Cada dirección tiene sus propias condiciones. Las familias `supine-limb-control` y `quadruped-limb-control` incluyen versiones de una extremidad y versiones contralaterales sin describir erróneamente todas como contralaterales.

Nueve fichas mantienen `relations: []`: pike, zancada atrás, zancada lateral, escalador, crunch, zancada fija, zancada adelante, extensión de cadera boca abajo y toques de hombro. La W no sustituye al remo, pike no sustituye automáticamente al empuje horizontal y crunch no sustituye al control del tronco de dead bug. Sentadilla y las distintas zancadas comparten un rol amplio, pero permanecen en familias distintas. Puente, buenos días y extensión de cadera boca abajo también mantienen familias diferentes.

El conjunto actual contiene veinte ejercicios Inicial sin equipo: dos de empuje, tres de sentadilla, tres de cadera, nueve de estabilidad, dos escapulares y uno de tobillo. Sigue sin ofrecer tracción con resistencia sin equipamiento ni una segunda elevación de talones Inicial. Las tres fichas de cadera Inicial —puente, buenos días y extensión boca abajo— tampoco se presentan como sustitutos automáticos. Un futuro organizador debe poder informar que no dispone de una alternativa, conservar ejercicios entre semanas y señalar cobertura ausente. No debe inventar variedad o presentar W/T/Y como solución al hueco de tracción.

La tercera ampliación incorpora tres familias explícitas: `forward-lunge`, `prone-hip-extension` y `high-plank-shoulder-tap`. Conservan respectivamente los roles de trabajo dominante de rodilla, extensión de cadera y estabilidad del tronco, sin convertir esas coincidencias de rol en relaciones automáticas. La familia de bisagra de pie sí admite la versión bilateral y la unilateral, con aceptación explícita de la diferencia de equilibrio y conteo. Las relaciones entre marcha supina, deslizamiento de talón y toque de talón aclaran qué pie permanece apoyado: compartir una posición boca arriba no hace idéntico el gesto.

## Validación

`ExercisePlanningSchema` valida enums, listas sin duplicados, fechas reales, URLs, condiciones obligatorias y compatibilidad entre familia y roles según `MOVEMENT_PLANNING_ROLES`. El ID de destino usa el mismo `ExerciseIdSchema` del catálogo. La fábrica recibe ese esquema para evitar un registro duplicado de IDs y ciclos de importación.

`validateExercisePlanningCatalog(catalog)` devuelve una lista de incidencias con `exerciseId`, `code` y `message`; una lista vacía confirma las invariantes de datos. Comprueba IDs duplicados, destino existente, autorrelaciones, metadatos inválidos, rol preservado en ambos extremos, misma familia, aceptación de cambios de apoyo/equilibrio/lateralidad, lateralidad coherente con `reps.perSide` y fuentes incluidas en la ficha. El catálogo ejecuta esta validación al cargar y falla ante inconsistencias.

Pasar esas verificaciones no prueba que la clasificación editorial sea correcta, que el avatar reproduzca medidas anatómicas exactas o que un ejercicio sea apropiado para una persona. La revisión del contenido, la demostración y las fuentes sigue siendo necesaria.

## Incorporar o revisar un ejercicio

1. Verificar la referencia y describir la variante exacta que representa el modelo. Registrar cualquier adaptación y mantener una URL coincidente en `sources` y `review.sourceUrls`.
2. Asignar la familia más específica, sus roles permitidos, posición, apoyos, balance y controles técnicos. Si hace falta un concepto nuevo, ampliar el enum, la política de roles y las etiquetas de interfaz de forma explícita.
3. Elegir `bilateral`, `alternating` o `unilateral`, y comprobar tanto `reps.perSide` como el ciclo de animación.
4. Empezar sin relaciones. Agregar cada enlace solo después de revisar destino, dirección, papel conservado, cambios de requisitos y dosis; no generar enlaces por intersección de músculos.
5. Revisar ficha, modelo y previsualización juntos. Actualizar `reviewedOn` y explicar la adaptación cuando corresponda.
6. Ejecutar las pruebas del catálogo y planificación, las de `scene-schema`, lint y typecheck. Regenerar/verificar previsualizaciones si cambian las fuentes incluidas por su manifiesto.

Las rutinas semanales, preferencias/exclusiones, confirmaciones de requisitos, historial de variaciones y sustituciones de una sesión requieren contratos adicionales. Esos datos deben distinguir el plan original de lo realizado y no forman parte de esta fase.
