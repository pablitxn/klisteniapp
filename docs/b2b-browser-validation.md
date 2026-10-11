# Validación de navegador B2B

La suite usa el producto real contra PostgreSQL desechable. Cada proyecto recibe un schema aleatorio, un servidor API, un directorio de medios y un origen independiente; una publicación, retiro de unidad o registro de sesión en un motor no cambia el escenario del siguiente. Los casos de cada proyecto se ejecutan en serie y las repeticiones automáticas están deshabilitadas para hacer visibles los fallos.

| Proyecto | Motor y entrada | Origen de prueba |
| --- | --- | --- |
| `chromium-desktop` | Chromium, 1440 × 1000, teclado/ratón | `http://127.0.0.1:4202` |
| `chromium-touch` | Chromium, perfil Pixel 7, pantalla táctil | `http://127.0.0.1:4204` |
| `webkit-touch` | WebKit, perfil iPhone 13, pantalla táctil | `http://127.0.0.1:4206` |

Los tres proyectos ejecutan **todos** los casos `b2b*.spec.ts`: preparación/publicación, etiquetas, permisos, catálogo, prescripción, ejecución, sustitución, borradores, conflictos, pérdida de respuesta y cancelación entre sesiones. Las pruebas de QR además usan `tap()` cuando el dispositivo es táctil. El PDF se exporta sólo en Chromium; WebKit verifica las etiquetas y sus destinos con los estilos de impresión.

## Escenario de referencia

Atlas y Sur tienen las mismas posibilidades, con identidades y contenido aislados:

- Administrador, profesor asignado a un socio y otro profesor sin socios asignados.
- Dos unidades `*-cable-01` y `*-cable-02` del modelo compartido `base-cable-station-v1`, con ajustes independientes y un nombre largo en la segunda.
- Ejercicio propio `*-cable-row`, publicado y sin animación, y borrador `*-cable-row-draft` que no aparece en la ficha pública.
- Rutina asignada `*-starter`, con alternativas explícitas `quarter-squat` y `row` y snapshot publicado.

El seed es idempotente y conserva las identidades existentes. Para obtener nuevamente un escenario vacío hay que usar el reset explícito de la demo o iniciar la suite, que siempre crea schemas nuevos. Las cuentas de desarrollo se consultan en el archivo privado generado por `pnpm dev:b2b`; no se copian credenciales en documentación ni capturas.

## Ejecutar y revisar

Requisitos: Node 24 o posterior, dependencias instaladas con el lockfile y PostgreSQL en una base desechable cuyo nombre contenga `b2b` y `test`. El usuario de la conexión debe poder crear y eliminar schemas. Se requiere espacio para los builds, motores y trazas.

```sh
pnpm --filter @klisteniapp/web exec playwright install --with-deps chromium webkit
# Configurar B2B_TEST_DATABASE_URL con una base de pruebas desechable.
pnpm test:b2b:e2e
```

El runner rechaza conexiones con un schema impuesto en `options` o nombres de base que no indiquen su uso de prueba. El cierre elimina únicamente sus schemas y medios. No hay endpoint de reset disponible en el producto.

Para repetir un proyecto o un archivo:

```sh
pnpm test:b2b:e2e --project=webkit-touch
pnpm test:b2b:e2e b2b-accessibility.spec.ts
```

La comparación visual se limita a dos superficies estables por proyecto: entrada del socio vacía y encabezado público de una unidad con nombre largo. Las referencias están en `apps/web/e2e/snapshots/b2b/`. No contienen fechas, registros ni credenciales. El renderer se estabiliza con locale `es-AR`, UTC, tema claro y movimiento reducido. Las diferencias pequeñas de antialiasing tienen una tolerancia de 0,2 % de píxeles; el contenido y el tamaño se siguen comparando.

```sh
# Sólo después de revisar un cambio visual intencional:
pnpm test:b2b:e2e b2b-accessibility.spec.ts --update-snapshots
# Después confirmar la comparación sin actualizar referencias:
pnpm test:b2b:e2e b2b-accessibility.spec.ts
```

Localmente, el informe HTML y los resultados quedan en `.cache/b2b/browser-report` y `.cache/b2b/browser-results`. En GitLab se conservan el informe y los artefactos de `b2b-integration-tests` durante siete días, incluso si pasa la suite. Las trazas se guardan al fallar. El job usa la imagen oficial de Playwright de la misma versión que el lockfile.

## Ejecuciones verificadas del 11 de octubre de 2026

La matriz completa terminó con **84/84 casos aprobados** en Chromium escritorio, Chromium táctil y WebKit táctil, según `.cache/roadmap-b2b-matrix-verified.log`. Después de corregir el estado de carga de los visores, los dos recorridos afectados se repitieron en los tres proyectos: **6/6 aprobados**, según `.cache/roadmap-b2b-viewer-final.log`. Esa segunda ejecución es una regresión focalizada; no se suma como seis casos distintos de la matriz.

El [estado de verificación de la entrega](b2b-release.md#estado-de-verificación-al-11-de-octubre-de-2026) distingue también la corrida B2C inicial de sus retestes, registra las comprobaciones finales aprobadas de código, builds y publicación, y registra los ocho grupos aprobados del smoke de producción sobre la revisión limpia `508e9e1`. La generación y validación completa de previews queda diferida por decisión del usuario hasta terminar los modelos 3D; no condiciona ese cierre de código. Los logs mencionados son evidencia local de trabajo; no se publican credenciales ni trazas privadas junto a este resumen.

## Alcance de la evidencia

La suite verifica interacción táctil emulada, teclado, foco, movimiento reducido, ausencia de WebGL y ambos motores. También verifica los destinos exactos de los QR de cada unidad y los permisos al retirar contenido. Eso permite reproducir las regresiones del código.

El escaneo con cámara de una etiqueta impresa, Safari/iOS real, el rendimiento de un modelo definitivo y la revisión técnica de sus movimientos requieren el teléfono, el recurso y el origen HTTPS del piloto. El entorno local usa loopback: esos QR no sirven desde otro teléfono. La producción de modelos en Blender queda fuera de esta entrega de código.
