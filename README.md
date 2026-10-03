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

El resultado estático queda en `apps/web/dist`. Este repositorio todavía no incluye un despliegue público configurado.

## Una primera vuelta

1. En **Mi rutina**, elegí un ejercicio. Pausá la demostración, mové la línea de tiempo y compará las vistas 3D, frente y perfil.
2. Tocá los músculos destacados o sus nombres para aprender dónde están y qué hacen. El modo **Anatomía** permite explorar el cuerpo de pie.
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

La aplicación carga las tipografías desde Google Fonts; no es una PWA ni garantiza disponibilidad completa sin conexión. Los enlaces de fuentes abren sitios externos. El historial no se envía a esos sitios desde la aplicación.

## Cómo está construido

| Área | Responsabilidad |
| --- | --- |
| `apps/web` | Interfaz móvil/escritorio, visor React Three Fiber, formularios y estado Zustand |
| `packages/scene-schema` | Identificadores, catálogo y registros validados con Zod |
| `packages/geometry` | Poses y cinemática del avatar, sin dependencia de React o del navegador |
| `docs` | Criterio de ejercicios, arquitectura y límites de esta iteración |

El monorepo usa **pnpm workspaces y Turborepo**, con **Vite, React 19, TypeScript, Three.js, React Three Fiber, Drei, Zustand y Zod**, siguiendo la separación de T3 Designer. Las versiones exactas están en los manifiestos y `pnpm-lock.yaml`. Las pruebas de dominio usan el test runner de Node; las de navegador, Playwright. `i18next` y `react-i18next` están disponibles como base para una futura traducción, pero la interfaz actual está escrita en español.

El modelo 3D es **procedural**: primitivas y regiones musculares siguen poses calculadas en TypeScript. No usa todavía un personaje riggeado, captura de movimiento ni archivos `.blend` o `.glb`. Blender puede sumarse más adelante para autoría y exportación; no necesita estar abierto ni instalado para ejecutar esta versión.

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

Las pruebas verifican fechas locales y cambios de horario, rachas, validación de registros, ausencia de historia ficticia, cinemática y los flujos de registro, preferencias y navegación. Un test que detecta un canvas no certifica la corrección biomecánica: también revisá visualmente cada ejercicio en sus extremos, a mitad del recorrido y desde perfil.

## Próximas iteraciones

El primer objetivo es hacer revisable el circuito **ver → entender → practicar → registrar**. Las próximas decisiones pueden partir del uso real: refinar las trayectorias y la anatomía del avatar, guardar sesiones parciales o recuperarlas tras una recarga, incorporar sensaciones y progresiones, mejorar las métricas de constancia y sumar equipo cuando exista. Un personaje de Blender, nuevas lenguas, sincronización y una PWA son posibilidades futuras, no funciones ya implementadas.
