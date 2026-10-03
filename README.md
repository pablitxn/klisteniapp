# Klisteni

**Aprendé el movimiento. Conocé tu cuerpo. Construí tu hábito.**

Una aplicación de calistenia educativa, pensada primero para el teléfono y con una vista de escritorio. Explorá ejercicios en 3D, reconocé las regiones musculares que participan y registrá tu práctica de fuerza y actividad aeróbica.

La primera versión parte de una situación concreta: principiante, sin molestias actuales y sin equipamiento. Mantiene la base de T3 Designer —React, Three.js y paquetes de dominio separados— aplicada a un nuevo modelo de movimiento.

## Empezar

Requisitos: **Node.js 24 o superior**, **pnpm 12.7.0** y un navegador moderno con WebGL 2 para el visor 3D.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abrí la dirección que muestre Vite, normalmente [localhost:5173](http://localhost:5173). No hacen falta claves de API, base de datos ni Blender.

Para ver la compilación de producción:

```sh
pnpm build
pnpm --filter @klisteniapp/web preview --host 127.0.0.1
```

El resultado estático queda en `apps/web/dist`. La publicación usa [klisteniapp.orchid-labs.xyz](https://klisteniapp.orchid-labs.xyz), con una imagen estática Nginx, GitLab CI y promoción por digest desde Mycelium. El estado de la primera activación se verifica en el registro de despliegue; ver [operación y publicación](docs/deployment.md).

## Una primera vuelta

1. En **Mi rutina**, elegí un ejercicio. Pausá la demostración, mové la línea de tiempo y compará las vistas 3D, frente, perfil y espalda.
2. Alterná **Piel**, **Músculos** y **Huesos**. Activá **Trabajo muscular** y tocá una estructura o un nombre para explorar su ubicación; el modo **Anatomía** muestra el cuerpo de pie en su posición de referencia.
3. Leé **Cómo se hace**, **Claves de técnica** y **A tu nivel** antes de practicar. Las fuentes están dentro de cada ficha.
4. Iniciá una sesión y registrá las repeticiones que efectivamente hiciste en cada serie. Guardá la sesión al terminar para incorporarla al historial.
5. Sumá una caminata, un trote o una salida en bicicleta con **Registrar actividad**. En **Mi progreso** aparecen tus registros, semana, racha y XP.

En **Personalizar** podés reordenar o quitar movimientos y elegir entre una y tres series. En **Ajustes** se configura el objetivo semanal, se reduce la animación y se exporta o importa el historial.

## La base inicial

| Ejercicio | Lo que permite aprender | Propuesta inicial |
| --- | --- | --- |
| Flexiones con rodillas | Empuje y control del tronco | 2 × 6–10 |
| Sentadilla | Coordinación de cadera y rodillas | 2 × 6–10 |
| Puente de glúteos | Extensión de cadera | 2 × 6–10 |
| Dead bug alternado | Estabilidad con brazos y piernas en movimiento | 2 × 6–10 por lado |
| Elevación en W | Control ligero de las escápulas | 2 × 6–10 |
| Elevación de talones | Control del tobillo y pantorrillas | 2 × 10–15 |

La referencia inicial es dos sesiones semanales en días no consecutivos, con descanso orientativo de 60 segundos entre series. Los rangos son un punto de partida editable; la técnica, el recorrido cómodo y la recuperación guían el ajuste. El catálogo ofrece variantes más fáciles y más exigentes.

**La tracción con resistencia queda pendiente sin equipo.** La W boca abajo no reemplaza un remo o una dominada para dorsales y bíceps. El remo invertido aparece en la biblioteca para entender esa diferencia, y requiere una barra o anillas con anclaje adecuado; no forma parte de la rutina inicial.

Las referencias técnicas y las decisiones editoriales están explicadas en [Criterio educativo y fuentes](docs/exercise-sources.md). El visor representa un esquema educativo: los colores no son porcentajes medidos de activación, y el avatar no evalúa tu postura.

## Datos y progreso

El historial empieza vacío. Se suman **10 XP por serie de fuerza registrada** y **1 XP por minuto de cardio registrado**; cada 100 XP se alcanza un nivel. La racha cuenta días locales consecutivos con actividad guardada. Descansar no descuenta XP, y sostener una racha no es una indicación de entrenar fuerza todos los días.

Los registros viven en `localStorage`, solo en ese navegador y origen. No hay cuenta, servidor de progreso ni sincronización entre dispositivos. Borrar datos del navegador, cambiar de dominio o usar otro navegador no traslada el historial. El progreso es autodeclarado y no mide calorías, esfuerzo o capacidad física.

- **Exportar progreso** descarga sesiones y cardio en JSON. Las preferencias de rutina y visualización se guardan aparte y no están incluidas en esa copia.
- **Importar una copia** valida el formato y solicita confirmar el reemplazo del historial existente. No mezcla registros automáticamente.
- Las series de una **sesión en curso** viven en memoria de la pestaña hasta guardarlas; recargar o salir sin guardar las descarta.
- Si el navegador rechaza el almacenamiento, aparece un aviso. Exportá la información disponible antes de cerrar.
- Si el historial guardado no se puede leer, el original se conserva. Al registrar actividad nueva, se guarda antes una copia de recuperación que podés descargar desde **Ajustes**.
- No hay coordinación entre pestañas: usá una sola pestaña para registrar actividad.

La medición de visitas con Umami es opcional y requiere aceptar primero. Solo envía una visita con nombre y dirección fijos del sitio: no registra ejercicios, rutinas, notas, progreso ni datos de salud. Podés rechazar o retirar permiso desde **Preferencias de privacidad**, sin perder la práctica. La [política de privacidad](https://klisteniapp.orchid-labs.xyz/privacy) distingue esa medición del historial local, logs operativos y proveedores.

La aplicación carga las tipografías desde Google Fonts; no es una PWA ni garantiza disponibilidad completa sin conexión. Los enlaces de fuentes abren sitios externos. El historial no se envía a esos sitios desde la aplicación.

## Cómo está construido

| Área | Responsabilidad |
| --- | --- |
| `apps/web` | Interfaz móvil/escritorio, visor React Three Fiber, formularios y estado Zustand |
| `packages/scene-schema` | Identificadores, catálogo y registros validados con Zod |
| `packages/geometry` | Poses y cinemática del avatar, sin dependencia de React o del navegador |
| `apps/web/public/models` | Modelo anatómico GLB, manifiesto, referencias articulares y licencia de las mallas |
| `assets/blender` y `scripts/blender` | Escena editable y conversión de las fuentes anatómicas |
| `docs` | Criterio de ejercicios, arquitectura y límites de esta iteración |

El monorepo usa **pnpm workspaces y Turborepo**, con **Vite, React 19, TypeScript, Three.js, React Three Fiber, Drei, Zustand y Zod**, siguiendo la separación de T3 Designer. Las versiones exactas están en los manifiestos y `pnpm-lock.yaml`. Las pruebas de dominio usan el test runner de Node; las de navegador, Playwright. `i18next` y `react-i18next` están disponibles como base para una futura traducción, pero la interfaz actual está escrita en español.

La anatomía usa **mallas de Z-Anatomy / BodyParts3D**: superficie corporal, músculos y huesos de una misma fuente, con nombres de estructuras y coordenadas compartidas. La escena editable de Blender y el GLB conservan su procedencia; las optimizaciones y las licencias están documentadas. Blender se utiliza para preparar los recursos y puede ejecutarse en segundo plano; no hace falta tenerlo abierto ni instalado para usar la aplicación o construir la web con los recursos ya generados.

Las poses de ejercicio siguen calculándose en TypeScript. La geometría detallada y el movimiento tienen alcances distintos: las deformaciones son educativas, sin simulación biomecánica ni validación clínica. La altura de visualización es una normalización gráfica y los colores representan la clasificación del catálogo, no activación muscular medida. Consultá [procedencia y límites del modelo](docs/anatomy-model-sources.md) y [créditos y licencia de los assets](apps/web/public/models/NOTICE.md). Las mallas adaptadas son **CC BY-SA 4.0**; la licencia MIT del código no las reemplaza.

Más detalle en [Arquitectura](docs/architecture.md).

## Verificación

```sh
# Lint, tipos, pruebas de dominio y build
pnpm check

# Recorridos de escritorio y móvil
pnpm test:e2e

# Ambas capas
pnpm check:all
```

Playwright levanta su propio servidor en `127.0.0.1:4174`; ese puerto debe estar libre. Si Chromium no está instalado para Playwright:

```sh
pnpm --filter @klisteniapp/web exec playwright install chromium
```

Los recorridos de navegador se ejecutan contra una compilación de producción. `pnpm test:analytics` agrega pruebas aisladas de consentimiento, rechazo, retirada, privacidad, señales del navegador y sanitización con el tracker oficial de Umami 3.4.0 interceptado localmente; no manda visitas de prueba al collector real.

Las pruebas verifican fechas locales y cambios de horario, rachas, validación de registros, ausencia de historia ficticia, cinemática y los flujos de registro, preferencias y navegación. Un test que detecta un canvas no certifica la corrección biomecánica: también revisá visualmente cada ejercicio en sus extremos, a mitad del recorrido y desde perfil.

Para comprobar el asset anatómico ya incluido, ejecutá `node scripts/validate-anatomy.mjs`. Verifica inventario, lateralidad, normales, colores, dimensiones y coherencia con el informe de optimización; también comprueba los hashes de las fuentes si están en la caché local.

Para reconstruirlo, ejecutá `node scripts/build-anatomy.mjs`. Descarga las tres fuentes públicas fijadas por commit y SHA-256, y ejecuta Blender en segundo plano. Usa la instalación habitual de macOS o `blender` en el `PATH`; podés indicar otra ruta con `BLENDER_BIN`. Regenera el GLB, la escena `.blend`, las referencias articulares y los informes. Los originales descargados quedan en `.cache/anatomy`, fuera de Git. Después, volvé a ejecutar el validador y revisá las capas y movimientos en el navegador.

## Próximas iteraciones

El primer objetivo es hacer revisable el circuito **ver → entender → practicar → registrar**. Las próximas decisiones pueden partir del uso real: revisar profesionalmente las trayectorias y deformaciones, ampliar la navegación anatómica, guardar sesiones parciales o recuperarlas tras una recarga, incorporar sensaciones y progresiones, mejorar las métricas de constancia y sumar equipo cuando exista. Nuevas lenguas, sincronización y una PWA son posibilidades futuras, no funciones ya implementadas.
