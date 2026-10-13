# QA e implementación: administrador de marca B2B — 13/10/2026

**Completado: 108 grupos UI únicos aprobados** (27 por perfil), mediante las pasadas y reejecuciones detalladas abajo. Lint, tipos, 587 tests (API B2B 77/77 incluida) y build B2B aprobados. Ocho problemas corregidos en commits locales; ningún bloqueo activo. La matriz conserva explícitamente lo no ejecutado.

Código final probado: `a87daf4f8460e6dd710defca8bea57b0f8bf9414`. Base: `7172041102a8a7029af5fb3e2527a1fa51611a86`; rama `qa/b2b-brand-admin-20261013`. Los commits de evidencia posteriores sólo completan este reporte y sus artefactos.

## Revisión y aislamiento

- Checkout inicial limpio, rama `work`, HEAD `7172041102a8a7029af5fb3e2527a1fa51611a86`.
- `git fetch origin` y `git merge --ff-only origin/main`: ya actualizado; no reset ni descarte. Rama propia `qa/b2b-brand-admin-20261013`.
- Atlas: `/workspace/sysadmin-workspace`, HEAD `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, rama inicial `work`, limpio y actualizado mediante fetch/fast-forward. Sin ediciones.
- Leídas las instrucciones de ambos repos y `atlas/AGENTS.md`; skill local `.agents/skills/atlas-navigate/SKILL.md`, política de autoridad, wiki/retrospectiva y catálogo de Klisteniapp. Leídos `docs/roadmap-implementacion.md`, producto B2B y decisiones de marca blanca.
- Fixtures `seedWhiteLabelDemo`: Atlas y Sur; Centro/Norte y Centro/Oeste. Cada proyecto usa PostgreSQL, schema aleatorio, sesiones y medios propios. El runner agrega un cuarto contexto para WebKit mediante `B2B_QA_EXTRA_PROXY=true`; aquí WebKit se ejecutó después de Chromium con un servidor nuevo. El runner rechaza bases cuyo nombre no contenga B2B/test y URLs con `options`; aquí todas las conexiones son loopback a bases desechables.
- No producción, DNS, pagos, correos, modelos/autoría 3D ni previews modificados. Sin merge, deploy, push o PR.

## Motores y límites del entorno

| Proyecto | Motor | Viewport CSS | Móvil/touch | Resultado final |
| --- | --- | --- | --- | --- |
| admin-chromium-narrow | Chromium sistema 154.0.8037.57 | 320 × 740 | sí/sí | PASS 27/27, agregado de pasadas |
| admin-chromium-wide | Chromium sistema 154.0.8037.57 | 412 × 915 | sí/sí | PASS 27/27, agregado de pasadas |
| admin-chromium-desktop | Chromium sistema 154.0.8037.57 | 1440 × 1000 | no/no | PASS 27/27, agregado de pasadas |
| admin-webkit-touch | Playwright WebKit 26.6, build 2359, WPE en Linux | 390 × 844 | sí/sí | PASS 27/27, agregado de pasadas |

Son pruebas de motores con emulación, no dispositivos físicos iPhone/Android ni Safari de iOS. Locale `es-AR`, zona UTC, movimiento reducido. Las capturas cubren pantallas reales servidas por Vite build/gateway/API/PostgreSQL.

Playwright 1.63.0; Node 24.19.0; pnpm 12.7.0 (el pnpm del PATH general era 11.25.0; se usó el instalado en `/workspace/.onboarding/tools/node_modules/.bin`). La descarga de Chromium de Playwright recibió 403; se usó el Chromium disponible. WebKit y FFmpeg se descargaron por el mirror alternativo oficial. Faltaban librerías: se descargaron paquetes Debian y se extrajeron en `/workspace/.cache/webkit-deps`, sin instalación del sistema. El launcher local conserva las rutas del bundle y añade esa carpeta de librerías. El smoke real del motor mostró `26.6 Engine ready`.

Los orígenes HTTPS de prueba se resuelven mediante un proxy CONNECT loopback. `ignoreHTTPSErrors: true` limita esta batería a UI, permisos, cookies y persistencia; **no acredita confianza TLS de un dispositivo ni del sistema**. No se modificó el trust store. Hay suites WL anteriores de TLS estricto, que tienen evidencia separada.

## Inventario previo de rutas y acciones

Fuente: `apps/b2b-web/src/routes.ts`, `app/Workspace.tsx`, `app/ManagementWorkspace.tsx` y las features. La API verifica permisos independientemente de la navegación.

| Ruta | Acciones accesibles al administrador | Alcance |
| --- | --- | --- |
| `/manage` | Elegir sede y función, salir; entrada a preparación/seguimiento | marca y contexto |
| `/manage/whiteLabel` | Sedes y accesos; diseño publicado; módulos; catálogo y traslados; exportar historial de marca | marca y sede explícita |
| `/manage/preparation` | Estado de preparación, abrir las secciones pendientes | sede |
| `/manage/reports` | Filtrar socios, leer prescripción y ejecución guardadas | sede |
| `/manage/people` | Buscar, invitar, copiar enlace, cambiar rol/membresía, pausar/reactivar, asignar acompañamiento | membresía de marca y acompañamiento por sede |
| `/manage/programs` | Crear/editar/recuperar, movimientos/dosis, publicar versión, abrir/cancelar/asignar | sede; snapshots inmutables |
| `/manage/catalog` | Buscar/filtrar, crear/adaptar/editar, recuperar, revisar y publicar ejercicios | catálogo según disponibilidad y propietario |
| `/manage/equipment` | Unidades/lotes, ajustes/recursos, recuperar/conflictos, publicación, retirar/restaurar, QR | sede |
| `/manage/media` | Subir, buscar, elegir/abrir archivos, reintentar carga; comparación privada de clips opcional | biblioteca de sede y recursos autorizados |
| `/manage/website` | Textos, actividades, horarios, galería; guardar/recuperar/comparar/revisar/publicar/despublicar; plano opcional | sede |
| `/manage/qr` | Diagnóstico, seleccionar/limpiar, generar, abrir fichas, imprimir y descargar | unidades públicas elegibles |
| `/manage/brand` | Identidad legacy por URL; no aparece en la navegación WL | ruta compatible, render verificado; edición legacy NOT RUN |
| `/login`, `/backoffice/*` | Login común y compatibilidad de enlaces | la ruta legacy se canoniza a `/manage/*` |
| `/`, `/sedes/:slug`, `/g/:slug/units/:id` | Entrada y lectura del contenido publicado/QR | lectura pública de marca/sede |
| `/app/invite#token=…` | Activación de persona ficticia, uso único; cuenta existente | invitación de marca y sede |

La UI muestra biblioteca de modelos y visor opcional; su edición/autoría queda excluida por la instrucción del usuario. Herramientas de dominio, bootstrap, servicio y otras operaciones exclusivas del operador CLI no se implementaron en UI.

## Bugs reproducidos y corregidos

| ID | Antes | Corrección | Regresión/evidencia |
| --- | --- | --- | --- |
| ADMIN-01 | Personas mostraba concesiones de sede, omitía administradores y cambiaba membresías globales con roles visibles incoherentes | roster de marca para el admin; lista separada y scoped para acompañamiento; texto explícito de alcance | baseline `people`; E2E de administrador visible, último admin, promoción/reversión, pausa/reactivación y selección scoped |
| ADMIN-02 | Slug duplicado al crear sede terminaba en error 500 genérico | inserción atómica `ON CONFLICT`, HTTP 409 `BRANCH_SLUG_TAKEN`; no se sobrescribe ni duplica | E2E de validación/duplicado y test HTTP con conteo real en DB |
| ADMIN-03 | Editor de diseño perdía cambios al navegar; conflicto sin recuperación; campos seguían editables durante el envío | copia local por cuenta/contexto, revisión original, comparación/rebase explícito, controles bloqueados durante envío y guardia de componente vigente | baseline `theme`; regresiones de recarga/navegación, conflicto/publicación/restauración y respuesta tardía |
| ADMIN-04 | Editor de sede perdía dirección sin guardar al recargar; 409 sin forma de comparar/continuar | copia local, campos controlados, última revisión y comparación/rebase explícito; no remontar el editor por cada revisión | baseline `branch`; E2E de recarga y conflicto con actualización real concurrente |
| ADMIN-06 | Selectores de rol móvil mostraban sólo la flecha; el roster de marca no resolvía nombres de coach de otra sede | ancho mínimo legible y lookup sobre el roster de marca | captura baseline `role-layout`, medida de texto real y reejecución UI en tres perfiles Chromium |
| ADMIN-07 | WebKit desbordaba la cabecera 44 px al seleccionar una sede con nombre largo | contención local del campo del selector, límites de flex y foco visible en el contenedor; no se oculta overflow de body/html | diagnóstico geométrico 434/390, fixture de sede larga y reejecución real en cuatro perfiles |
| ADMIN-08 | Volver desde ejercicio/rutina antes del ACK desmontaba el editor y dejaba el listado anterior pese a que el guardado persistía | botón de vuelta deshabilitado mientras guarda; navegación general conserva su recuperación existente | dos regresiones con PUT realmente confirmado y respuesta retenida; cuatro perfiles |
| ADMIN-05 | Reabrir una invitación por fragmento en la misma pestaña conservaba el éxito anterior sin volver a validar | token como estado, sincronización hashchange/popstate y limpieza tras aceptación | baseline `invitation`; activación ficticia seguida por rechazo del enlace usado en el mismo documento |

Código corregido en commits locales `94c9eb8`, `a889a4c` y `a87daf4`; checkpoint de QA `49459ab`. El commit de cierre guarda el informe definitivo y el manifiesto. No se cambiaron contratos ni controles de autorización. La copia local no vuelve válidos campos incompletos; servidor y publicación siguen validándolos. La clave conserva cuenta, marca, sede y función. Un diseño es de marca, pero su copia local conserva el contexto operativo en que se abrió: volver a esa sede permite recuperarla.

## Matriz de flujos

PASS se refiere al último resultado por flujo/proyecto, no a una única corrida limpia de toda la suite. El manifiesto conserva cada intento anterior, incluidos los fallos y su diagnóstico. PASS exige interacción UI más verificación persistida cuando hay escritura. Las API se usan también para preparar fixtures, producir conflictos/errores y comprobar efectos; no sustituyen la inspección de pantallas.

| Flujo | Fixture/condición | Chromium 320 | Chromium 412 | Desktop | WebKit 390 | Comprobación |
| --- | --- | --- | --- | --- | --- | --- |
| 11 rutas en ambas sedes de Atlas | datos iniciales Atlas | PASS | PASS | PASS | PASS | 22 pantallas por proyecto, sin overflow/alertas/errores JS |
| 11 rutas en ambas sedes de Sur | datos iniciales Sur | PASS | PASS | PASS | PASS | 22 pantallas por proyecto |
| Back/forward y recarga | Personas → Website, ambas marcas y sedes | PASS | PASS | PASS | PASS | URL y contexto conservados |
| Personas y roles de marca | admin + multicontexto | PASS | PASS | PASS | PASS | último admin protegido, rol conservado al recargar |
| Pausa/reactivación y acompañamiento | miembro de marca y socio/coach de Centro | PASS | PASS | PASS | PASS | estado real y selector excluye Norte |
| Buscar persona sin coincidencias | query ficticia | PASS | PASS | PASS | PASS | tabla vacía |
| Crear sede y validación | campos vacíos, zona inválida, slug repetido | PASS | PASS | PASS | PASS | una única fila de sede y error recuperable |
| Conceder/retirar acceso | socio en sede nueva sin actividad | PASS | PASS | PASS | PASS | grant aparece/desaparece |
| Guardar sede, recargar, conflicto | dirección local + actualización concurrente real | PASS | PASS | PASS | PASS | comparación, rebase y dirección persistida |
| Archivo con actividad | Centro con asignaciones activas | PASS | PASS | PASS | PASS | rechazo, historial intacto |
| Archivo/restauración sin actividad | sede vacía propia de cada proyecto | PASS | PASS | PASS | PASS | selector/estado/metadata persistidos |
| Inventario vacío y rutina vacía | sede recién creada | PASS | PASS | PASS | PASS | estados vacíos y arrays vacíos reales |
| Lote de dos unidades y doble submit | labels numerados, clicks en el mismo frame | PASS | PASS | PASS | PASS | un POST inicial |
| Pérdida de respuesta y recuperación de lote | POST realmente confirmado, respuesta abortada | PASS | PASS | PASS | PASS | reintento tras reload, exactamente dos filas |
| Cerrar y recuperar editor | lote aún sin enviar | PASS | PASS | PASS | PASS | no se pierde el borrador |
| Conflicto de unidad, publicación/retiro/restauración | unidad seed y revisión concurrente | PASS | PASS | PASS | PASS | review obligatorio, revisión y visibilidad |
| QR generado y ficha correcta | unidad publicada de Atlas Centro | PASS | PASS | PASS | PASS | imagen de QR, URL absoluta y pantalla pública |
| Diseño: borrador, conflicto y recuperación | título ficticio + otro editor | PASS | PASS | PASS | PASS | no publicar borrador implícitamente; compare explícito |
| Publicar/restaurar diseño | historial publicado de la marca | PASS | PASS | PASS | PASS | contexto público cambia y vuelve por nueva versión |
| Respuesta de diseño tardía | PUT confirmado y retenido; navegar y editar una copia nueva | PASS | PASS | PASS | PASS | campos bloqueados; copia posterior sobrevive recarga |
| Branding/logo y contraste | PNG propio, contraste inválido | PASS | PASS | PASS | PASS | rechazo sin alterar público, logo publicado/restaurado |
| Website: validación, conflicto y recarga | Sur Oeste, actividad incompleta, edición concurrente | PASS | PASS | PASS | PASS | comparar, conservar/rebase y persistir |
| Website: revisión/publicación | contenido ficticio guardado | PASS | PASS | PASS | PASS | confirmación requerida y website público renderizado |
| Despublicar y conservar cambios locales | título sin guardar al retirar | PASS | PASS | PASS | PASS | público retirado, servidor conserva borrador previo y copia se recupera |
| Biblioteca: vacío, formato y errores | SVG, PNG vacío, contenido falsificado y PNG válido | PASS | PASS | PASS | PASS | rechazos y bytes/hash reales; imagen decodificada |
| Biblioteca: búsqueda y reintento | sin coincidencias y 503 interceptado | PASS | PASS | PASS | PASS | vacío, error visible y recuperación |
| Biblioteca: aislamiento | Atlas Centro → Norte → Sur | PASS | PASS | PASS | PASS | no aparece la imagen ajena; medio cruzado 404 |
| Ejercicio: validación y recuperación | texto ficticio, sin animación/modelo nuevo | PASS | PASS | PASS | PASS | instrucciones requeridas y copia recuperada |
| Ejercicio: revisión/publicación/edición | ejercicio local Norte | PASS | PASS | PASS | PASS | publicar requiere revisar; editar vuelve a borrador |
| Conflicto de programa | edición concurrente real + reload + copia local | PASS | PASS | PASS | PASS | comparación/rebase explícito y prescripción persistida |
| Vuelta durante guardado de ejercicio/rutina | respuestas retenidas tras commit real | PASS | PASS | PASS | PASS | botón bloqueado hasta ACK y listado actualizado |
| Sede larga en cabecera | nombre largo creado por UI | PASS | PASS | PASS | PASS | sin desborde horizontal y control/foco conservados |
| Programas en cuatro sedes | rutina por tiempo/RPE, socio scoped | PASS | PASS | PASS | PASS | recuperar, guardar, publicar V1, asignar, V2 conserva snapshot V1 |
| Módulos de sede y marca | equipment Centro; website marca | PASS | PASS | PASS | PASS | rutas directas/POST bloqueados; otras sedes correctas; datos conservados |
| Disponibilidad de catálogo | ocultar/habilitar ejercicio base en Sur Centro | PASS | PASS | PASS | PASS | configuración persistida y reversión UI |
| Traslado de unidad | Sur Centro → Oeste, actividad inicial | PASS | PASS | PASS | PASS | primero rechazo; finalizar asignaciones; unidad cambia de sede y queda privada |
| Sesión expirada durante escritura | cookie retirada del contexto ficticio | PASS | PASS | PASS | PASS | POST rechazado, login y recuperación de la misma cuenta |
| Aislamiento de borradores | Centro/Norte y admin/coach | PASS | PASS | PASS | PASS | cuenta/contexto diferente no recibe copia |
| Logout entre pestañas y marcas | dos tabs Atlas y sesión separada Sur | PASS | PASS | PASS | PASS | tabs Atlas pierden UI privada; Sur conserva sesión |
| IDs y URL de otra marca | unidad real Sur desde Atlas | PASS | PASS | PASS | PASS | rechazo real y comparación de datos Sur antes/después |
| Invitación y uso único | nuevo email ficticio en Sur Oeste | PASS | PASS | PASS | PASS | activación; grant sólo Oeste; reabrir usado rechaza |
| Seguimiento y exportación | ejecución parcial ficticia en Norte guardada por API de fixture | PASS | PASS | PASS | PASS | filtro real, parcial/snapshot visibles, JSON con ID y sede exactos |
| Copiar invitación al portapapeles | permiso clipboard de navegador | NOT RUN | NOT RUN | NOT RUN | NOT RUN | crear/activar sí; clipboard no ejecutado |
| Impresión/PDF y lectura física de QR | dispositivo e impresora reales | NOT RUN | NOT RUN | NOT RUN | NOT RUN | imagen/enlace/ficha sí; impresión/escaneo físicos pendientes |
| Edición de identidad legacy y operadores | rutas compatibles/CLI | NOT RUN | NOT RUN | NOT RUN | NOT RUN | render legacy sí; flujo WL usa Diseño publicado |
| Plano, archivos de video/GLB, reproducción/comparación de clips | contenido y revisión correspondientes | NOT RUN | NOT RUN | NOT RUN | NOT RUN | no certificar contenido, modelos ni previews |
| Todos los módulos individualmente y todas las opciones del editor de dosis | variantes adicionales | NOT RUN | NOT RUN | NOT RUN | NOT RUN | se probaron equipment/website y dosis tiempo/RPE |
| Pérdida de respuesta en nuevas rutinas, ejercicios e invitaciones | creación no idempotente | NOT RUN | NOT RUN | NOT RUN | NOT RUN | la recuperación exacta ejercitada es lote de unidades; no extrapolar |
| Servicios externos, producción y emails | fuera de alcance | NOT RUN | NOT RUN | NOT RUN | NOT RUN | no se operaron |

## Checks de cierre

| Comando | Resultado |
| --- | --- |
| `pnpm lint` | PASS; boundaries, 14 paquetes y formato B2B |
| `pnpm typecheck` | PASS; 14 paquetes |
| `pnpm test` con ambas URLs de bases desechables | PASS 587/587, cero skips; 14 paquetes + 25 tests raíz; integración B2B incluida |
| `pnpm test:b2b:api` con base desechable | PASS 77/77; cero skips |
| `pnpm build:b2b` | PASS; warning existente de chunks >500 kB |
| suite UI de administrador Chromium | PASS 81/81 grupos únicos por agregación: inicial 68/72; rechecks 9/9, rutina concurrente 3/3 y cierre de afectados 12/12 en Chromium |
| suite UI de administrador WebKit | PASS 27/27 grupos únicos por agregación: inicial 23/25; diagnóstico y cierre focalizado 4/4 |
| `git diff --check` | PASS |
| `pnpm check` / release / previews | NOT RUN; previews diferidas por instrucción explícita; no se alteraron gates ni snapshots |

Los tres fallos de retiro de asignaciones de la primera pasada completa se debían a `first()` apuntando a la fila siguiente; el cuarto era una imagen lazy aún sin decodificar. Las reejecuciones esperan el cambio real de filas y la carga de imagen, con fixtures de varias asignaciones. No se ocultaron fallos ni se rebajó una aserción de producto.

Se respetó el rate limit: el helper espera `retry-after` cuando aparece 429. No se apagó ni rebajó el límite. Los intentos de desarrollo tuvieron errores de selectores/fixtures que se corrigieron (nombres de unidades con dos dígitos, forma del snapshot de asignación, botón de comparación del website, tipo de PNG y actualización asíncrona de módulos); no son bugs del producto. Un intento concurrente del runner falló por puerto ocupado y afectó artefactos intermedios; se repitió la evidencia definitiva en serie. Los baselines de bugs y el reporte final se conservan separados. El último cierre incluye también el arreglo de campo de cabecera y de botones de vuelta; todos sus recorridos afectados se repitieron. No hay bugs reproducidos de esta tanda pendientes de corrección. Las variantes NOT RUN siguen abiertas para otra tanda.

## Reproducir y preparar la revisión manual

1. Instalar Node 24 y la versión pnpm declarada; `pnpm install --frozen-lockfile --ignore-scripts`. Preparar PostgreSQL local de desarrollo con `pnpm setup:dev` y `docker compose up -d`. Crear una base **nueva desechable** con nombre `klisteni_b2b_test`; exportar `B2B_TEST_DATABASE_URL` con conexión local y permiso de crear schemas. Ninguna credencial de producción es necesaria.
2. Instalar los navegadores de Playwright o definir `QA_CHROMIUM_PATH` al Chromium disponible. En este Cloud WebKit usa `PLAYWRIGHT_BROWSERS_PATH=/workspace/.cache/ms-playwright` y `QA_WEBKIT_PATH=/workspace/.cache/webkit-deps/webkit-local.sh`.
3. Ejecutar desde la raíz, en serie:

   ```sh
   QA_ARTIFACT_GROUP=chromium pnpm --filter @klisteniapp/b2c-web exec playwright test \
     --config playwright.brand-admin.config.ts \
     --project admin-chromium-narrow --project admin-chromium-wide \
     --project admin-chromium-desktop
   # Reporte separado, sin pisar capturas ni traces de Chromium.
   QA_ARTIFACT_GROUP=webkit pnpm --filter @klisteniapp/b2c-web exec playwright test \
     --config playwright.brand-admin.config.ts --project admin-webkit-touch
   ```

4. Para mantener el escenario abierto: `pnpm build:b2b`, luego `node scripts/b2b-wl-e2e-server.mjs` con esa URL de DB exportada. Los schemas y medios se crean de cero y se eliminan al Ctrl-C. Se puede abrir Chromium con un perfil separado y proxy `http://127.0.0.1:4342`. Usar `https://atlas.b2b.test/manage` y `https://sur.b2b.test/manage`; no dominios reales. Para confianza TLS, el certificado de fixture tiene un SPKI imprimible con `whiteLabelTLS().spki`; limitar la excepción a ese certificado en ese perfil, sin cambios de trust store.
5. Usuarios ficticios: `admin@atlas.example.test`, `admin@sur.example.test`; coaches y miembros están en `seedWhiteLabelDemo`. Contraseña exclusiva del fixture: `browser-tests-only-password-2026`. No corresponde a ninguna cuenta real. No reutilizarla fuera de esta demo.
6. Los reportes están en `.cache/brand-admin/<grupo>/report/index.html`; `playwright show-trace /ruta/trace.zip` permite reproducir DOM, interacciones y red. Traces incluyen credenciales/tokens **sintéticos**; conservarlos como evidencia de pruebas locales, no mezclarlos con capturas de producción.

Checklist manual breve:

- En las tablas móviles, desplazarse horizontalmente para leer y usar todas las columnas.
- En 320/412 px y escritorio, entrar como admin Atlas; cambiar Centro/Norte y comprobar el contexto visible en cada sección.
- Personas: comprobar administrador y personas de ambas sedes; cambiar membresía de una persona ficticia, pausarla/reactivarla y revisar que el acompañamiento use sólo la sede actual.
- Marca y sedes: crear una sede; repetir slug; editar dirección, recargar y recuperar; provocar cambio en otra pestaña, comparar y continuar o descartar.
- Unidades: registrar dos con un modelo existente; cerrar/recuperar; revisar publicación; abrir QR y ficha correcta; retirar/restaurar. La impresión y el escaneo físico necesitan una instalación accesible desde el teléfono.
- Diseño: editar, navegar/recuperar, guardar sin publicar, publicar y restaurar. Website de Sur Oeste: guardar/revisar/publicar y despublicar conservando una edición pendiente.
- Subir una imagen ficticia válida; probar archivo inválido; cambiar sede/marca y confirmar aislamiento.
- Crear programa por tiempo/RPE en cada sede; publicar V1 y asignar al socio correcto; publicar V2 y confirmar que el asignado sigue en V1.
- Quitar sesión mientras hay un editor abierto; guardar, volver a entrar y recuperar sólo en la misma cuenta/contexto. Cerrar sesión en una pestaña y comprobar otra.

## Integración y retorno para Atlas

Archivos compartidos que requieren coordinar integración con otros roles:

- `features/organization/WhiteLabelSettings.tsx`: editores de diseño/sede y claves estables; UI de marca compartida.
- `features/people/People.tsx`, `PeoplePage.tsx`: roster administrativo; conserva vista/acompañamiento scoped del coach.
- `features/catalog/ExerciseEditor.tsx`, `features/programs/ProgramEditor.tsx`: sólo guardia de botón de vuelta mientras guarda, compartida con coach.
- `packages/b2b-ui/src/white-label.css`: cabecera/contexto compartido por administrador, coach y socio; contención de campo y foco.
- `features/invitations/Invitation.tsx`: estado de token para todos los roles que aceptan invitación.
- `shared/editor/editorDraftStorage.ts`, `useEditorDraft.tsx`: se agregan tipos `theme` y `branch`; no cambia la forma o semántica de las claves existentes.
- `apps/b2b-api/src/white-label-service.ts`: sólo creación de sede con slug duplicado.
- Runner compartido `scripts/b2b-wl-e2e-server.mjs`: un cuarto contexto opcional, desactivado para las suites anteriores. Test HTTP compartido `white-label-http.test.ts`; helpers, configuración y specs nuevos bajo prefijo `brand-admin` sin modificar suites ni snapshots existentes.

Resumen para un intake posterior de Atlas: nueva evidencia **local de implementación y QA del admin B2B**, sobre base `7172041`, en rama propia. Marca blanca permanece implementada; se corrigieron coherencia/lectura de Personas, slug duplicado, recuperación/concurrencia de editores de marca/sede, navegación de invitaciones, cabecera con sede larga y vuelta de editores durante guardado. Nueva evidencia: 108 grupos UI únicos aprobados por agregación y 587 tests, con límites físicos/TLS y variantes pendientes declarados. Preservar la separación entre código, pruebas locales, emulación y despliegue histórico. No hay nuevo deploy, pruebas físicas, generación de modelos/previews, respaldo recurrente ni nueva verificación de dominios/TLS público. Los pendientes de previews, contenido y backups históricos de Atlas no cambian. La KB no fue escrita.

## Evidencia seleccionada

Las capturas estables de revisión se conservan en [la carpeta de evidencia](b2b-brand-admin-2026-10-13-evidence/). [Manifiesto con hashes y resultados por flujo](b2b-brand-admin-2026-10-13-evidence/manifest.json). Los resultados JSON, traces y logs completos permanecen en `.cache/brand-admin` y en el paquete local `.cache/brand-admin-evidence-2026-10-13.tar.gz`.

Pasadas principales conservadas:

| Grupo | Resultado bruto | Propósito |
| --- | --- | --- |
| `final-chromium-initial` | 68/72 | Suite inicial completa; tres errores de selector dinámico y una espera de imagen lazy |
| `final-chromium-recheck` | 9/9 | Personas, biblioteca y traslado en los tres perfiles, fixtures de varias asignaciones |
| `final-chromium-program` | 3/3 | Conflicto/recuperación de rutina en los tres perfiles |
| `final-webkit` | 23/25 | Suite WPE completa; detectó desborde y vuelta prematura de editor |
| `webkit-overflow-diagnostic` | 1/2 | Reproducción y geometría de desborde |
| `editor-pending-baseline` | 0/2 | Reproducciones de vuelta antes de ACK |
| `final-webkit-recheck` | 2/4 | Diagnóstico intermedio; contención aún insuficiente y ambigüedad entre ejercicio y plantilla homónima |
| `closeout-affected` | 16/16 | Cuatro recorridos afectados en los cuatro perfiles, sobre el cierre de código |

El conteo final toma **sólo el último resultado de cada par flujo/proyecto**. No transforma una corrida fallida en verde ni oculta sus archivos. Browser schemas restantes después del cierre: **0**, verificados mediante una consulta read-only sobre la base local de test. No se conservaron datos de esos schemas; el escenario manual se vuelve a sembrar con el runner.
