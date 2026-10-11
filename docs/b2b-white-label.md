# Marca blanca B2B: dominios, marcas y múltiples sedes

Fecha de definición e implementación: **11 de octubre de 2026**. Estado: **WL-0 a WL-8 implementados y verificados localmente** en `codex/b2b-white-label`. El [roadmap](roadmap-implementacion.md#checkpoints-de-marca-blanca-nueva-evidencia) registra checkpoints y la [validación nueva](b2b-white-label-validation.md) distingue pruebas automatizadas, runtime local y aceptación física. No se publicaron dominios de clientes ni se desplegó producción.

## 1. Objetivo y decisiones de producto

Una misma aplicación B2B debe servir a varias empresas con su propio dominio, identidad, diseño, contenido y módulos habilitados. **Cada marca puede tener varias sedes desde la primera entrega**, según la decisión explícita del usuario. El dominio identifica la marca antes del login; la sesión, los permisos y la sede elegida determinan el espacio de trabajo.

- **Marca/empresa = organización B2B:** es el límite entre clientes. Atlas y Sur siguen siendo organizaciones independientes, cada una con varias sedes.
- **Sede = establecimiento de esa organización:** tiene dirección, horarios, equipo físico, personas autorizadas y actividad propia. No equivale a otra organización ni al texto de ubicación de una máquina.
- **Un despliegue compartido:** los dominios registrados llegan al mismo servicio web/API y PostgreSQL B2B. Los datos se aíslan por organización y, cuando corresponde, por sede. B2C mantiene su API, DB, cuentas y suscripciones independientes.
- **Una identidad B2B por persona:** una cuenta puede pertenecer a varias marcas y sedes. Los permisos dependen de la marca y sede actuales; ser entrenador o administrador en otro contexto no concede acceso.
- **Una entrada de login por marca:** muestra su identidad antes de autenticarse. Después abre el espacio autorizado del socio, entrenador o administrador; si hay varias sedes o funciones posibles, permite elegirlas explícitamente.
- **Personalización compartida:** temas, plantillas y módulos configurables; las variantes utilizan la misma base de código y actualización. Ejercicios, medios, programas e inventario tienen propiedad y disponibilidad explícitas.

Se mantiene fuera de esta entrega: SSO entre dominios, identidades B2C compartidas, repositorios o builds por cliente, CSS/JavaScript arbitrario del gimnasio, nuevas aplicaciones nativas, facturación automática y autoría de nuevos modelos Blender. El trabajo remoto con la Mac apagada no incorpora funcionamiento offline a la app.

## 2. Recorrido esperado

Los siguientes dominios son **fixtures HTTPS locales** de la suite automatizada, no destinos públicos:

| Entrada | Experiencia esperada |
| --- | --- |
| `https://atlas.b2b.test/` | Website de Atlas y presentación de sus sedes |
| `/sedes/centro` en Atlas | Horarios, actividades, contacto y equipo público de Atlas Centro |
| `/login` en Atlas | Identidad publicada de Atlas, antes de conocer a la persona |
| `/app` en Atlas | Entrenamiento del socio en una sede a la que tiene acceso |
| `/backoffice/` en Atlas | Trabajo del entrenador o administración según permisos y sede |
| `https://sur.b2b.test/` | La misma aplicación presenta Sur y sus sedes |

Historia de aceptación: un administrador de Atlas configura Centro y Norte, asigna entrenadores y socios, prepara máquinas, publica marca/website/contenido y genera QRs. Un entrenador de Centro prescribe una rutina con equipo de Centro. El socio entra desde el dominio/QR de Atlas, registra su ejecución en Centro y el entrenador autorizado la consulta. Repetir en Norte y en dos sedes de Sur comprueba que los contextos no se mezclan.

La web publicada es visitable sin pertenecer al gimnasio. El login de una persona que sólo pertenece a Sur no crea una sesión autorizada en Atlas. Una persona con membresías en ambas marcas puede entrar en ambos dominios con sesiones independientes. Dentro de una marca, sólo se ofrecen las sedes a las que tiene acceso.

## 3. Base previa y cambios implementados

| Área | Base anterior a WL | Cambio de esta línea |
| --- | --- | --- |
| Organizaciones | Membresías y un rol por organización; validación en API | Mantener la organización como marca y agregar sedes y permisos con alcance explícito |
| Orígenes | `B2B_APP_ORIGIN` único; auth y mutaciones comparan ese origen | Registro de dominios y contexto de marca por petición |
| Login y sesión | Login B2B general; `/me` devuelve membresías de varias organizaciones | Sesión ligada a marca, respuesta acotada al dominio y selección de sede autorizada |
| Navegación | `/g/:slug`, `/app`, `/backoffice/`; selector de organización | Entrada por dominio, sedes, login común y destinos según contexto/rol |
| Identidad | Nombre, descripción, color, logo, contacto y dirección | Identidad publicada previa al login y temas/plantillas versionados |
| Website | Borrador y publicación de contenido y marca por organización | Presentación de marca y contenido público de cada sede; publicación independiente del acceso |
| Equipamiento y entrenamiento | Entidades de organización, unidades con ubicación textual | Propiedad de sede, asignaciones contextualizadas y snapshots que conservan sede histórica |
| Funcionalidades | Roles y estado de servicio | Módulos autorizados por marca y opciones de sede, aplicados en UI y API |

Puntos de entrada reales: [configuración](../apps/b2b-api/src/config.ts), [autenticación](../apps/b2b-api/src/auth.ts), [HTTP](../apps/b2b-api/src/http.ts), [servicio](../apps/b2b-api/src/service.ts), [contexto de organización](../apps/b2b-api/src/organization-context.ts), [datos](../apps/b2b-api/src/database.ts), [migraciones](../apps/b2b-api/src/migrate.ts), [operador](../apps/b2b-api/src/operator.ts), [contratos](../packages/b2b-contracts/src/organization.ts), [sesión React](../packages/b2b-react/src/use-session.ts), [app socio](../apps/member-web/src/App.tsx), [backoffice](../apps/backoffice/src/App.tsx), [UI compartida](../packages/b2b-ui/src/components.tsx), [proxy local](../scripts/b2b-gateway.mjs) y [Nginx](../docker/nginx.b2b.conf).

La frontera implementada usa identidad de proxy con secreto independiente e IP exacta, registro activo consultado por petición y validación de origen exacto; ver [operación de dominios](b2b-white-label-runtime.md). La API no confía en un `Host` o `Forwarded` aportado por el cliente para elegir marca.

## 4. Modelo de marca, sede y permisos

Los nombres siguientes expresan responsabilidades; [WL-0](b2b-white-label-decisions.md) fija políticas y WL-1 las implementa en contratos y migraciones aditivas 004/005.

| Entidad | Propiedad y regla |
| --- | --- |
| Organización | Marca, contrato de servicio, identidad, temas, catálogo propio y dominios |
| Sede | Organización obligatoria; ID estable, slug único dentro de la marca, nombre, dirección, contacto, zona horaria, horarios y estado activo/archivado |
| Membresía de marca | Relación activa de una cuenta con la organización; requisito previo a cualquier permiso de sede |
| Permisos | Administración de marca o concesiones de entrenador/socio en sedes concretas; no conceder acceso por un rol de otra sede |
| Dominio | Host normalizado único, organización, estado de verificación/activación y condición de principal o alias |
| Modelo/ejercicio/programa reutilizable | Base compartida o propiedad de marca; disponibilidad por sede explícita |
| Unidad física | Organización y sede obligatorias; `location` conserva su función de ubicación dentro de esa sede |
| Asignación/ejecución | Organización, sede de práctica y personas autorizadas; snapshot de la prescripción y contexto histórico |
| Medio privado | Propiedad de marca y, cuando corresponde, sede; permiso de lectura por referencia autorizada, no por conocer el ID |

### Reglas de acceso para la primera entrega

- El **administrador de marca** gestiona identidad, sedes, personas y configuración de toda su organización. En pantallas operativas elige sede; cualquier vista agregada identifica claramente qué sedes incluye.
- El **entrenador** trabaja sólo en sedes asignadas y consulta/prescribe a los socios que tiene asignados en esas sedes. Pertenecer a la marca no lo habilita para ver a todos los socios.
- El **socio** ve sus propias rutinas y registros. Puede tener acceso a varias sedes; cada asignación señala dónde puede realizarse y qué unidades admite.
- Una persona puede ser entrenador en Centro y socio en Norte. El contrato deja de asumir un único `role` global suficiente para decidir todo. Cuando más de un contexto es válido, la UI ofrece una elección; no decide por el primer elemento de una lista.
- Dominio → marca → membresía activa → alcance de sede → permiso/acción → recurso es la cadena de comprobación en backend. El cliente puede pedir una sede, pero no otorgarse acceso a ella. El alcance operativo y el derecho de lectura del historial propio se validan por separado.
- Revalidar sesiones y permisos antes de ejecutar operaciones nuevas o encoladas. Al invalidar o cambiar un contexto, el cliente limpia sus datos sensibles, notifica a las otras pestañas y descarta respuestas tardías de ese contexto. Revocar acceso no recupera bytes ya entregados al navegador. Cachés y borradores se identifican por marca, sede, cuenta y contexto de trabajo.
- Archivar una sede impide nuevas asignaciones y actividad allí, conserva el historial y lo mantiene accesible a su propietario y administradores autorizados. El acceso del entrenador sigue requiriendo permisos vigentes; archivar no amplía acceso.
- Mientras conserve membresía activa de marca, el socio mantiene lectura de sus propias ejecuciones históricas y los snapshots/medios asociados autorizados aunque pierda el acceso operativo a su sede anterior. Esta lectura no habilita nuevas sesiones, inventario actual ni datos de otras personas. El backend usa una autorización específica de historial; no vuelve a conceder permisos de sede para mostrarlo. La salida completa de la marca conserva los registros sin acceso autónomo; WL-0 exige exportación antes de la baja o entrega posterior por operador autorizado, sin borrado automático.

El traslado de una persona modifica sus accesos y asignaciones futuras; no reescribe la sede de sesiones anteriores. El traslado de una máquina conserva el historial y exige resolver asignaciones activas antes de moverla: bloquear mientras existan referencias incompatibles o crear/reasignar una nueva versión mediante una acción explícita. En WL-0 se concreta ese flujo; no inferir que una unidad de Norte sustituye automáticamente a una de Centro.

### Migración de organizaciones existentes

Crear una sede inicial **Principal** para cada organización existente y asociar unidades, asignaciones, ejecuciones y relaciones que hoy representan un único establecimiento. Conservar IDs, contenido, texto `location`, identidades y snapshots anteriores; usar un adaptador/versionado para registros históricos que no contenían sede.

Los administradores existentes pasan a administración de marca. Entrenadores/socios y sus asignaciones conservan su alcance previo dentro de Principal. Crear luego sedes adicionales es una operación normal; la fixture nueva tiene al menos dos sedes por marca desde su primera corrida.

Las invitaciones pendientes anteriores a la migración, que no contienen sede, conservan expiración y uso único: administrador → administración de marca; entrenador/socio → permiso equivalente en Principal. Aceptarlas después del backfill no concede acceso a nuevas sedes. Versionar el formato o resolver ese alcance mediante datos migrados en servidor, sin confiar en un parámetro del cliente.

Las migraciones son aditivas y ordenadas: columnas/entidades → backfill determinista → comprobar integridad → índices/constraints obligatorios → contratos nuevos. Las relaciones comprueban que organización y sede del recurso coincidan; un `branchId` válido de otra marca también debe rechazarse. Registrar el tratamiento de datos anómalos antes de activar constraints, sin asignarlos silenciosamente a otra sede.

## 5. Dominios, contexto y sesiones

### Resolución antes del login

1. El proxy recibe HTTPS para un dominio registrado. Sólo el proxy configurado aporta el host normalizado que usa la aplicación; ninguna cabecera enviada libremente por el cliente elige marca.
2. La API resuelve ese host contra el registro de dominios activos. Hosts desconocidos, mal formados, no verificados o desactivados no muestran contenido de ningún cliente. No hay organización por defecto en modo marca blanca.
3. Un contrato público de contexto —`GET /api/b2b/context`, implementado— entrega sólo identidad publicada, sedes públicamente visibles, tema y navegación pública permitida. No expone personas, membresías, permisos privados ni borradores.
4. La API valida el origen exacto del dominio actual en mutaciones y autenticación. Que Atlas y Sur estén registrados no autoriza un POST originado en Atlas contra Sur. Health/readiness internos tienen rutas y exposición operativa definidas.

Todas las rutas aplican el contexto: auth, `/me`, recursos por organización/sede, website, QRs, medios, invitaciones y exportaciones. `atlas.b2b.test/g/sur-demo` y un ID de Norte solicitado por un entrenador autorizado sólo en Centro no ofrecen un cambio de contexto implícito.

### Login y permisos

Reutilizar Better Auth y su verificación de credenciales. La sesión autorizada incluye una asociación verificable con la marca; el chequeo de membresía ocurre antes de devolver una sesión utilizable en ese dominio. Los errores no revelan a qué otras marcas pertenece el email. Cookies limitadas al host, HTTPS y controles de origen se acompañan de validación de marca en servidor: copiar una cookie o token entre dominios tampoco concede acceso.

`/me` devuelve sólo el contexto de esa marca y sus sedes autorizadas. Una sede indicada por QR/invitación prevalece únicamente si sigue autorizada; después se puede usar la última selección válida. Si hay una sola opción, abrirla; si hay varias, mostrar selector. Socio → `/app`; entrenador → `/backoffice/` con seguimiento; administrador → `/backoffice/` con administración/preparación de marca y sede. Los deep links sólo continúan hacia rutas internas autorizadas.

La baja de una sede o permiso invalida selecciones persistidas. Cerrar sesión elimina el estado sensible de ese dominio; cualquier política de revocación global al cambiar credenciales se declara explícitamente. No introducir SSO ni compartir cookies de forma amplia entre dominios.

### Ciclo de vida operativo

Registro solicitado → verificar propiedad → DNS correcto → certificado HTTPS disponible → activación. El registro conserva evidencia/fecha y un único dominio principal por marca; los alias verificados redirigen al principal. Un administrador de gimnasio puede solicitar el alta, pero la activación exige verificación operativa.

Cubrir renovación de certificados, fallos DNS/TLS, dominio pausado, cambio de principal y desvinculación. No reasignar automáticamente un dominio abandonado a otra marca. Desactivar o cambiar una asociación invalida inmediatamente el contexto/sesiones aplicables y las cachés del registro; no confiar en una cookie antigua después de la reasignación. Mantener el acceso por el dominio anterior sólo mientras siga verificado y habilitado.

### Enlaces y compatibilidad

- Nuevos links absolutos de website, invitación, QR y recursos compartidos se generan desde el dominio principal registrado y, si corresponde, incluyen sede/unidad. No se generan desde un `Host` arbitrario.
- El origen general actual puede conservar una entrada/directorio y redirecciones públicas conocidas `/g/:slug` hacia el dominio de la marca. No lista membresías privadas ni ofrece el login global antiguo como vía para saltar los controles nuevos.
- En un dominio de marca, las rutas heredadas sólo se admiten para esa marca y se normalizan; otra marca se rechaza. Invitaciones existentes conservan validación de organización, sede, rol, expiración y uso único durante la transición.
- No reenviar tokens de sesión en redirecciones. Si una invitación heredada debe cambiar de dominio, usar un flujo de entrega acotado al dominio canónico, sin colocar secretos en query strings/logs; definir y probarlo antes de habilitar la redirección.
- Preservar enlaces de recursos y snapshots históricos mediante resolución explícita; no reemplazar strings indiscriminadamente en JSON. Registrar qué QR impresos siguen funcionando y cuáles requieren reimpresión.

## 6. Identidad, diseño, módulos y contenido

### Identidad y diseño publicados

La primera entrega permite temas claramente distintos para Atlas y Sur: logo, nombre, paleta, tipografías de un catálogo permitido, formas de componentes, imágenes/textos de entrada y plantillas de distribución. Usar tokens y componentes compartidos, validación, valores por defecto y contraste legible. No aceptar scripts ni hojas de estilo arbitrarias. Incluir login, selección de sede, website, app del socio, backoffice, estados vacíos/error y metadatos de navegador.

La marca tiene un borrador versionado y una identidad/tema publicados. Previsualizar requiere autorización y no cambia otras sesiones. Publicar o volver a una versión anterior es explícito y auditable; los cambios de diseño no borran formularios ni borradores de entrenamiento.

**Identidad y website tienen ciclos distintos:** retirar el website público no elimina el login de miembros activos. Mantener una identidad pública mínima para login y errores. El contenido de marca y el de cada sede tienen estado/revisión de publicación explícitos, por lo que editar Centro no publica inadvertidamente Norte. Al migrar, conservar la identidad pública anterior hasta publicar la nueva y registrar cómo se concilian diferencias con la marca privada actual.

Las sedes heredan la identidad visual de la marca y tienen datos y contenido propios —dirección, contacto, horarios, actividades, fotos y plano—. Dominio propio por sede y un diseño completamente distinto entre sedes quedan como ampliaciones futuras; varias sedes funcionales sí son obligatorias ahora.

### Módulos y catálogo

Separar **capacidad contratada/habilitada por la plataforma**, **preferencia de la marca/sede** y **permiso del usuario**. La UI muestra las capacidades efectivas y el servidor comprueba la misma política. Una sede puede desactivar un módulo opcional que la marca habilita; no puede habilitar algo que la marca no tiene. Las condiciones de servicio vigentes siguen aplicándose.

Crear un registro explícito de módulos sobre funcionalidades existentes, con dependencias y comportamiento de desactivación: website público, equipo/QR, plano, medios o voz son candidatos a concretar en WL-0. Autenticación, autorización, historial y exportación no se tratan como botones opcionales que el gimnasio pueda quitar sin una política definida.

Cada módulo define lectura, escritura, publicación y tratamiento de trabajo en curso al desactivarse. Preservar registros y snapshots; una rutina activa no pierde silenciosamente instrucciones o referencias porque desaparezca un módulo del menú. Los cambios de acceso/capacidades tienen efecto inmediato en backend y no esperan la publicación del website.

Modelos, ejercicios y plantillas pueden ser compartidos o propios de marca; cada sede define qué está disponible. Las unidades físicas siempre pertenecen a una sede. Adaptar contenido conserva procedencia y no modifica la biblioteca base. Ocultar un ejercicio para futuras rutinas no altera prescripciones anteriores; publicar contenido privado de Norte en Centro exige una acción autorizada explícita. Mantener medios privados, previews y caches separados según su marca/sede y publicación.

## 7. Entregas y dependencias

Todos los estados empiezan **pendientes**. Cada entrega termina con un commit identificable, verificación de su comportamiento y actualización de la evidencia; un plan escrito no cuenta como implementación.

| ID | Entrega | Depende de | Condición de cierre |
| --- | --- | --- | --- |
| WL-0 | Inventario y decisiones de contratos, sedes, roles, dominio y compatibilidad | Base actual | Recorrido multisedes y matriz de permisos acordados; archivos/datos afectados y estrategia de migración documentados |
| WL-1 | Contratos y migraciones de sedes, concesiones, dominios, temas y capacidades | WL-0 | Una instalación existente se migra sin perder datos; fixtures con dos marcas y dos sedes por marca; constraints rechazan cruces |
| WL-2 | Proxy confiable, resolución de dominio y contexto público | WL-1 | Dos hosts reales de prueba llegan al mismo despliegue; cada uno entrega sólo contexto publicado de su marca; desconocidos se rechazan |
| WL-3 | Sesión de marca, permisos por sede y autorización de todas las rutas | WL-2 | Login correcto/incorrecto por marca, roles por sede, revocaciones y ataques por cambio de IDs comprobados en API |
| WL-4 | Entrada común, selección de sede, gestión multisedes, destinos por rol y compatibilidad de links | WL-3 | Admin crea/gestiona sedes y accesos; el recorrido completo funciona por dominio; invitaciones/QR/deep links conservan contexto |
| WL-5 | Temas/plantillas, preview y publicación de identidad/websites | WL-4 | Dos marcas visualmente distintas antes y después del login; contenido de sedes/publicaciones independientes y reversión comprobada |
| WL-6 | Capacidades por marca/sede, catálogo disponible y ciclos de traslado/archivo | WL-4 y contratos WL-5 | UI/API coinciden en permisos; traslado, desactivación e historial conservan semántica y aislamiento |
| WL-7 | Operación de dominios, DNS/TLS, aliases, migración de origen y diagnóstico | WL-2; integrar WL-3 a WL-6 | Alta/cambio/baja/renovación verificables en runtime compartido; controles de plataforma y rollback documentados |
| WL-8 | Aceptación integrada, migración realista y piloto HTTPS | WL-1 a WL-7 | Matriz E2E y runtime completada con evidencia nueva, continuidad de QRs y limitaciones físicas declaradas |

Camino de producto: **WL-0 → WL-1 → WL-2 → WL-3 → WL-4 → WL-5/WL-6 → WL-8**. WL-7 comienza después de WL-2 y se integra antes de cerrar WL-8. El primer recorrido vertical de WL-4 incluye ya dos sedes; no posponer sedes hasta una segunda entrega. Al final de cada fase comprobar también los casos relevantes de la matriz siguiente, en vez de esperar a WL-8 para detectar fallas de aislamiento.

### Trabajo concreto por paquete

| Área | Refactor previsto |
| --- | --- |
| `b2b-contracts` | Organización/sede, concesiones, contexto, sesión, tema, capacidades y respuestas versionadas; DTO públicos distintos de privados |
| `b2b-domain` | Reglas puras de permisos efectivos, disponibilidad de contenido y compatibilidad de unidades/sedes |
| `apps/b2b-api` | Resolver/contexto de petición; migraciones; autorización central reutilizada por contenido, personas, medios, entrenamiento y publicación; auth y herramientas de operador |
| `b2b-client` | Contexto del mismo origen; selección de sede validada; errores tipados y rutas/versiones coherentes |
| `b2b-react` | Sesión ligada a marca; carga por sede; cancelación, limpieza y claves de caché/borrador al cambiar contexto |
| `b2b-ui` | Login común, selector de sede/contexto, tema validado y variantes de componentes |
| `member-web` | Website de marca/sedes, login, selector y entrenamiento con ubicación e inventario correctos |
| `backoffice` | Administración de sedes/personas/concesiones, contenido disponible por sede, identidad/publicación y vistas operativas con alcance visible |
| Proxy y scripts | Resolver hosts de fixtures, HTTPS, readiness, demo, migración, smoke y diagnóstico de dominios |

No trasladar reglas de autorización al frontend ni introducir importaciones de `apps/web` en B2B. Los cambios de contratos estrictos, backend y frontend se liberan coordinadamente.

## 8. Matriz de aceptación de punta a punta

Fixture mínima: Atlas Centro/Norte y Sur Centro/Oeste, dos temas distintos, administradores de marca, entrenadores de una y varias sedes, entrenadores sin socios asignados, socios de una y varias sedes y una persona con roles distintos según marca/sede. Incluir unidades con etiquetas iguales en sedes diferentes, contenido compartido/privado y rutinas históricas.

| ID | Caso | Resultado necesario |
| --- | --- | --- |
| D01 | Dos dominios, mismo servicio e imagen | Identidad correcta antes del login; ningún cambio de build para elegir cliente |
| D02 | Host desconocido/no verificado, proxy falsificado y acceso directo a API | No se selecciona una marca ni se exponen recursos privados |
| D03 | Socio/entrenador/admin de Atlas inicia sesión en Atlas | Sólo sedes autorizadas; destino y navegación según permisos del contexto elegido |
| D04 | Cuenta sólo de Sur intenta entrar en Atlas | Rechazo sin sesión autorizada y sin divulgar otras membresías |
| D05 | Persona pertenece a ambas marcas y tiene roles distintos | Sesiones/contextos separados; no se hereda el rol más alto de otra marca/sede |
| D06 | Cambio de ID de organización/sede/recurso en URL, cuerpo o selección persistida | API rechaza cruces; no basta con esconder opciones |
| D07 | Cookie/token de otra marca, Origin cruzado, revocación y petición encolada | Fallo de autorización; UI limpia datos y respuestas tardías |
| D08 | Invitación nueva, existente, usada, vencida, abierta en otro dominio/sede o emitida antes del backfill | Marca, sede, rol y consentimiento correctos; las antiguas conservan su alcance equivalente en Principal y no se amplían privilegios al reutilizar identidad |
| D09 | Publicar una sede y mantener otra en borrador; `/g/otra-marca` | Sólo contenido publicado de la marca/sede correcta; retiro de website mantiene login |
| D10 | Medios privados, enlaces directos, HEAD/Range y caches | Propiedad/permiso/publicación comprobados; sin mezcla entre marcas ni sedes |
| D11 | Crear sedes; asignar personal/socios; prescribir y registrar en cada una | Inventario y asignaciones pertenecen a la sede elegida; entrenador sin asignación no consulta resultados |
| D12 | Trasladar socio/unidad, retirar acceso o archivar sede | Acción explícita para lo activo; el socio con membresía de marca activa conserva su historial propio de la sede anterior, sin acceso operativo; snapshots conservan contexto y no hay nuevas escrituras en sede archivada |
| D13 | Persona cambia sede con formulario o entrenamiento sin guardar | Aviso/recuperación y claves aisladas; no se guarda el borrador en otra sede |
| D14 | Dos temas, preview, publicar, revertir y reload | Tema consistente en todas las superficies; borrador privado; contraste y fallback accesibles |
| D15 | Deshabilitar módulo en marca o sede y llamar directamente a su API | Se cumple su política de lecturas/escrituras/historial; una sede no eleva capacidades |
| D16 | QR viejo/nuevo, dominio principal/alias, cambio y desvinculación | Continuidad sólo por mappings autorizados; sin redirecciones abiertas ni tokens en logs |
| D17 | Admin configura → entrenador prescribe → socio registra → entrenador consulta | Recorrido completo con dos marcas y al menos dos sedes por marca, incluyendo reintento de guardado |
| D18 | Migrar fixture anterior y base vacía; reiniciar, backup/restaurar | IDs/datos/permisos históricos preservados; configuración nueva y medios restaurados conjuntamente |
| D19 | B2C/demo y paquetes compartidos después del cambio | Sin dependencia de dominios, sesiones o DB B2B; regresiones aplicables aprobadas |

Cubrir Chromium escritorio/táctil y WebKit táctil con **dos hostnames dentro de la misma instancia de prueba**. Las suites actuales de un origen no demuestran aislamiento por dominio. Añadir verificación HTTPS de cookies, redirecciones y certificados; permitir confianza en una CA de fixture controlada, nunca desactivar globalmente verificación TLS como evidencia de producción.

Las pruebas API usan bases/schemas desechables. El entorno del VPS puede ejecutar integración y navegador headless, guardar screenshots/trazas y reproducir el flujo sin la Mac. La aceptación de Safari/iPhone real, WebGL en hardware, voces y QR impreso sigue teniendo evidencia propia.

## 9. Migración, release y recuperación

1. Inventariar revisión, esquema, organizaciones, sedes implícitas, membresías, enlaces, datos y medios; crear/restaurar una copia aislada para probar la migración.
2. Incorporar schema aditivo y código que valide marca/sede. Los cambios estrictos de DTO, frontend y API se actualizan en una entrega coordinada. Declarar versión mínima compatible y política de sesiones antiguas; las sesiones sin contexto nuevo requieren reautenticación al activar el modo por dominio.
3. Configurar primero los dominios de prueba y verificar WL-8. Elegir un piloto sólo después de registrar sus dominios verificados y su contenido/revisión.
4. Activar la marca piloto, comprobar sedes, identidades, links/QR y permisos; luego ampliar marcas. Registrar errores por dominio/marca/sede sin incluir emails, tokens, contraseñas ni URLs privadas completas.
5. Documentar recuperación de DB/medios/configuración, registro de dominios y proxy/TLS. Volver a una versión del tema no equivale a revertir una migración.

**Límite de rollback:** después de crear sedes y permisos nuevos, el binario anterior que sólo entendía organización puede exponer datos a personas de otra sede. No es un rollback permitido por defecto. Mantener una versión anterior compatible con el nuevo aislamiento, corregir hacia adelante o restaurar de forma coordinada el estado previo según un procedimiento ensayado. No eliminar sedes/datos para hacer funcionar el código anterior.

Antes de una restauración, detener escrituras y conservar también una copia consistente del estado actual de DB/medios/configuración. Restaurar en recursos separados y comprobarlos antes del cambio de servicio; inventariar y definir cómo recuperar las escrituras posteriores al respaldo elegido. Restaurar un backup antiguo no implica haber conservado esos cambios. Registrar el punto de recuperación y cualquier pérdida pendiente de resolver.

Los resultados de `508e9e1` y sus informes históricos no acreditan esta arquitectura. Publicar evidencia nueva con commit, árbol limpio o diff identificado, versiones de imágenes/schema, topología de prueba, casos ejecutados, resultados/omitidos y limitaciones. No declarar un despliegue público a partir de un smoke local.

Se conserva la decisión vigente de diferir previews hasta terminar los modelos. `pnpm check`, `check:all`, `check:release` y CI conservan sus requisitos; registrar por separado verificaciones de esta línea y cualquier gate global pendiente. No editar hashes, snapshots ni configuración de CI para simular una validación completa.

## 10. Continuación desde otra instancia de Codex

Seguir [Desarrollo desde el VPS](development-vps.md). La documentación y el setup raíz se trasladan mediante el checkpoint de Git: traer `main` del remoto `gitlab` y verificar el SHA antes de continuar en el VPS. Comprobar que no queden cambios locales previstos sin publicar antes de apagar la Mac. No copiar `.env`, `.cache`, sesiones, DB ni medios privados como parte del código.

La continuación parte de los checkpoints actuales y de la evidencia WL-8. Las decisiones de módulos iniciales, variantes, traslados e historial están en [WL-0](b2b-white-label-decisions.md). **La existencia de múltiples sedes desde la primera entrega está implementada.** Leer esta documentación no autoriza operar dominios públicos o desplegar producción.

| Etapa | Estado | Commit/evidencia |
| --- | --- | --- |
| WL-0 | Completado | `a451d9c`, inventario, permisos y decisiones |
| WL-1 | Completado | `5fdf22d`, migración 004; 005 y perfil público en `d0a9011`; migración 5/5 |
| WL-2/WL-3/WL-7 | Implementado y probado | `d0a9011`, dominios, sesión y autorización; suite API 76/76 |
| WL-4/WL-5/WL-6 | Completado | `15660fd`: login, sedes, temas, módulos y recorridos UI; E2E 30/30 |
| WL-8 | Completado en el alcance local autorizado | API 76/76, E2E 30/30, B2C 3/3, imágenes 6/6 y restauración 6/6; [evidencia nueva](b2b-white-label-validation.md) |
| Publicación de dominios reales | Fuera de esta ejecución | Sin DNS/certificados de clientes ni despliegue de producción |

Al cerrar cada etapa, actualizar esta tabla y el roadmap con estado real y evidencia. Los informes históricos de release conservan su contenido y alcance.
