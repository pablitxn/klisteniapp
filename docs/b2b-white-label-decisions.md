# WL-0: inventario y decisiones de implementación

Fecha: **11 de octubre de 2026**. Este checkpoint concreta el
[plan de marca blanca](b2b-white-label.md) sobre el código recibido. Documenta
decisiones para WL-1–WL-8; no acredita su implementación ni un despliegue.
El estado y los resultados de cada etapa se registran en el
[roadmap](roadmap-implementacion.md).

## 1. Límite y recorrido de la entrega

La organización sigue siendo la marca y el límite entre clientes. La sede es
una entidad propia, con identidad estable y organización obligatoria. Una
instancia B2B y su PostgreSQL sirven Atlas Centro/Norte y Sur Centro/Oeste.
Las dos marcas se prueban en hosts diferentes contra ese mismo runtime.
B2C conserva aplicaciones, DB, cookies, cuentas y suscripciones independientes.

La primera entrega vertical debe permitir crear una sede, autorizar personas,
preparar sus unidades, prescribir, registrar y consultar una ejecución. Una
persona puede entrenar socios en Centro y practicar como socio en Norte. La
selección de marca, sede y función es explícita cuando existe más de una opción.

Fuera del trabajo autorizado: despliegue de producción, publicación de DNS real,
SSO entre dominios, builds por cliente, CSS/JS arbitrarios y regeneración de los
previews diferidos. La aceptación física de Safari/iPhone, voces, WebGL y QR
impreso no se sustituye por el navegador headless del VPS.

## 2. Inventario comprobado en el checkout anterior a WL-1

| Área | Estado encontrado | Archivos afectados y obligación |
| --- | --- | --- |
| Schema | SQL propio con migraciones `001-initial`, `002-catalog-lifecycle`, `003-content-media`; no usa Prisma | `apps/b2b-api/src/database.ts`, `migrate.ts`: migración aditiva, backfill e integridad compuesta |
| Cuentas | Better Auth B2B separado; `baseURL` y `trustedOrigins` usan un único `config.origin`; cookie host-only | `auth.ts`, `config.ts`: origen de marca resuelto en servidor, asociación verificable de sesión y rechazo genérico de membresía incorrecta |
| HTTP | Sanitiza Host y cabeceras forwarded para auth; mutaciones exigen el origen global | `http.ts`: resolución antes de auth/public/media, origen exacto actual, controles antes del streaming |
| Transacciones | `organization()` bloquea organización y revalida sesión/membresía dentro de la transacción | `service.ts`, `organization-context.ts`: conservar esa serialización; añadir sede, función y concesiones al contexto |
| Personas | `b2b_membership.role` único por marca; `b2b_coach_assignment` sin sede | `service.ts`, `packages/b2b-contracts/src/organization.ts`, `People.tsx`: separar administrador de marca y concesiones operativas de sede |
| Inventario | `b2b_unit.location` es texto libre; todos los queries filtran sólo organización | `equipment/index.ts`, `Equipment.tsx`, `QRCodes.tsx`, contratos de catálogo: sede obligatoria, disponibilidad y QR contextual |
| Biblioteca | Modelos/ejercicios tienen propietario marca o base global; programas/versiones pertenecen a marca | `catalog/index.ts`, `training/index.ts`, contratos/dominio: reutilización y procedencia conservadas, disponibilidad de sede explícita |
| Prescripción e historial | Asignaciones/ejecuciones sólo tienen organización; versiones publicadas guardan snapshots | `training/repository.ts`, `training/rules.ts`, contratos de entrenamiento: asignación/ejecución con sede; autorización histórica separada |
| Website | `b2b_website` es singleton por organización; publicación incluye brand y content | `service.ts`, `Website.tsx`, `websiteDraft.ts`, `PublicGym.tsx`: identidad pública independiente y publicación propia de sede |
| Medios | Propietario organización; staff puede acceder a todo su inventario; socio por referencia autorizada | `service.ts:mediaAccess`, `media.ts`, `MediaLibrary.tsx`, `ContentMedia.tsx`: ámbito explícito y comprobación del host/sede para GET, HEAD y Range |
| Invitaciones | Token hasheado, expiración y uso único; no guarda sede | `service.ts`, contratos de organización, `Invitation.tsx`: backfill de Principal y consumo dentro de la marca correcta |
| Cliente y sesión | `/me` expone todas las membresías; las aplicaciones eligen rol/marca de listas; controlador cancela respuestas obsoletas | `b2b-client/src`, `b2b-react/src`, `app/ApplicationProvider.tsx` y `app/Workspace.tsx`: respuesta acotada a host, contexto operativo validado y limpieza al cambiarlo |
| Borradores | Entrenamiento usa organización/cuenta/asignación; editores organización/cuenta/tipo/entidad | `sessionDraft.ts`, `editorDraftStorage.ts`, `useEditorDraft.tsx`: versionar claves e incluir sede/función cuando es operativa |
| Proxy | Gateway local reemplaza Host por loopback; Nginx pasa `$host`, elimina forwarded | `scripts/b2b-gateway.mjs`, `docker/nginx.b2b.conf`: preservar host normalizado mediante frontera de confianza explícita |
| Fixtures/operador | Demo Atlas/Sur y herramientas de organización sin sedes | `demo.ts`, `operator.ts`, scripts setup/runtime/E2E: dos sedes por marca, dominios y escenarios negativos |
| Tests | Suites API con schemas desechables; Playwright en un origen y tres proyectos | `apps/b2b-api/tests`, `apps/b2c-web/playwright.b2b.config.ts`, suites B2B: añadir dos hosts, migración previa y matriz D01–D19 |

Archivos de frontend abreviados en la tabla se ubican en `apps/b2b-web/src/features`,
`apps/b2b-web/src` o `packages/b2b-ui/src` según el dominio indicado.

## 3. Entidades y compatibilidad

Agregar sedes, concesiones de sede, dominios, asociación de sesión a marca,
identidad versionada, preferencias/capacidades y publicación por sede. Cada
relación de sede utiliza una FK compuesta `(organization_id, branch_id)`;
conocer un ID real de Sur nunca permite asociarlo a Atlas. Los slugs son únicos
por marca y no se usan como autorización.

La membresía de marca conserva estado activo y administración de marca. El
rol heredado `coach`/`member` sólo se conserva para compatibilidad/migración;
la autorización operativa nueva consulta concesiones de sede. No se obtiene
el rol efectivo eligiendo el mayor rol que una persona tenga en otra sede.

Pertenecen a sede: unidades físicas, vínculo entrenador-socio, asignaciones,
ejecuciones, datos/contacto/horarios/contenido público del establecimiento y
medios que se hayan subido con ese ámbito. Los modelos, ejercicios y programas
pueden ser biblioteca de marca; disponibilidad y modificación tienen permisos
explícitos. Un entrenador que sólo trabaja en Centro no publica ni modifica
contenido de Norte por compartir el ID de organización.

La migración crea **Principal** por organización con un ID determinista, asigna
los datos operativos existentes a ella y conserva todos los IDs y `location`.
Los administradores siguen administrando su marca; entrenadores/socios sólo
reciben su acceso anterior en Principal. Invitaciones antiguas de staff/socio
se resuelven a Principal en datos del servidor, conservando token, caducidad y
uso único; una invitación antigua no da acceso a sedes creadas posteriormente.

No modificar indiscriminadamente el JSON de snapshots. El contexto histórico
se obtiene de la asignación/ejecución migrada o de un adaptador versionado; el
contenido publicado de ejercicios/modelos permanece inmutable. El historial
debe mostrar el nombre/ID de sede correspondiente al registro y no inferirlo
de la selección actual. Versionar también claves/resultados idempotentes de
`b2b_unit_batch`: una repetición de Centro no debe recuperar unidades de Norte.

Ejecutar en orden: tablas/columnas, backfill, comprobaciones de datos anómalos,
constraints/índices y contratos estrictos. La migración aborta ante relaciones
inconsistentes; no corrige silenciosamente una referencia de otra marca. Al
activar dominios, las sesiones antiguas sin asociación requieren nuevo login.

## 4. Matriz de permisos efectiva

Toda operación sigue: host confiable → marca activa → sesión de esa marca →
membresía activa → sede/función autorizada → permiso → recurso. Ningún header,
body, query o localStorage del cliente concede permisos por sí mismo.

| Acción | Admin de marca | Entrenador de sede | Socio de sede |
| --- | --- | --- | --- |
| Configurar marca/tema/capacidades y gestionar sedes/personas | Sí, sólo su marca | No | No |
| Activar/verificar/reasignar dominio | Operador de plataforma; admin sólo solicita | No | No |
| Leer inventario/catálogo operativo | Sede elegida | Sedes concedidas | Sedes concedidas y contenido permitido |
| Crear/mover/archivar unidad; publicar website de sede | Sí, sede identificada | No | No |
| Crear/editar biblioteca compartida de marca | Sí | Sólo recursos expresamente de su ámbito | No |
| Prescribir rutina | Sede elegida y socio autorizado allí | Sólo socio asignado en esa misma sede | No |
| Registrar ejecución | No en nombre ajeno | Sólo cuando actúa como socio autorizado | Sólo propia y en sede operativa autorizada |
| Consultar actividad actual | Sede elegida; agregado explícito si se implementa | Sólo socios asignados en la sede elegida | Sólo propia |
| Leer historial de sede a la que ya no tiene acceso operativo | Sí dentro de su marca | No sin permisos y relación vigentes | Sí, sólo propio y con membresía de marca activa |
| Leer medios privados | Propiedad/referencia dentro de su marca | Ámbito concedido y referencia autorizada | Referencia de contenido autorizado o snapshot propio |
| Exportar historial | Registros de su marca autorizados | Sólo alcance vigente si se ofrece exportación | Sólo historial propio mientras tenga membresía activa |

No introducir vistas agregadas implícitas para entrenadores. El administrador
selecciona sede en pantallas operativas. Cualquier futuro agregado debe enumerar
su alcance y utilizar queries/autorización específicos.

Las revocaciones comparten el bloqueo de organización ya existente con las
mutaciones para impedir que una petición en espera escriba con permisos viejos.
Cambiar sede/función invalida resultados pendientes, remonta los consumidores
con una clave de contexto y recupera exclusivamente sus borradores. Logout o
revocación limpia estado sensible y notifica otras pestañas; no promete retirar
bytes que el navegador ya recibió.

## 5. Traslados, archivo y salida de marca

**Traslado de persona:** conceder el destino y revocar el origen mediante una
acción administrativa explícita. Las asignaciones previas no cambian de sede.
Las nuevas prescripciones requieren acceso/relación en destino; una sesión
encolada del origen se rechaza después de la revocación. El socio mantiene
lectura de sus ejecuciones y snapshots anteriores mientras su membresía de
marca esté activa. Ese permiso histórico no abre inventario actual ni medios
privados que no estén referenciados por su historial.

**Traslado de unidad:** sólo dentro de la misma marca y hacia sede activa.
Bloquear si existen asignaciones activas incompatibles que necesitan esa
unidad/modelo en origen. La resolución explícita consiste en cerrar/reasignar
las prescripciones afectadas antes de mover; no sustituir automáticamente una
unidad homónima. Si el sistema aún no permite cerrar una asignación, el bloqueo
se conserva y se registra como limitación. Historial y QR conservan el ID; el
QR resuelve el destino sólo después de confirmar publicación y autorización.

**Archivo de sede:** conserva su fila y todo el historial. Impide nuevas
asignaciones, ejecuciones y operaciones del inventario, y retira publicación
pública operativa. El historial del propietario y administrador sigue legible.
No se amplía el acceso del entrenador. Restaurar una sede es una acción
administrativa explícita; no restaura automáticamente concesiones revocadas.

**Salida completa de marca:** la política conservadora de esta entrega revoca
acceso y sesiones inmediatamente, conserva los registros y permite al
administrador autorizado atender una exportación. Antes de la baja, el socio
puede exportar su historial propio si el flujo está implementado. La revocación
no borra registros ni crea acceso público para descargarlos; una exportación
posterior se gestiona mediante el administrador y un canal controlado. No se
promete borrado automático ni un plazo de retención contractual que todavía no
se haya definido. Las solicitudes de borrado/retención legal no se automatizan
en WL. La interfaz de baja debe expresar la conservación y la pérdida de acceso.

## 6. Dominios y sesiones

El host se normaliza y se busca en un registro único con organización, estado,
evidencia de verificación, revisión y condición de principal/alias. En modo WL
no hay marca por defecto para un host desconocido, mal formado, pendiente,
pausado o desactivado. La API sólo acepta la identidad de host proporcionada por
el proxy configurado; el proxy elimina valores de cliente antes de inyectarla.
Health/readiness internos se documentan como excepción operativa sin datos.

La sesión se vincula en servidor a la marca y a una asociación de dominio
vigente. Copiar cookies entre hosts o reactivar/reasignar un dominio no concede
acceso. La comprobación incluye `/auth/get-session`, `/me`, medios, website,
invitaciones, exportaciones y enlaces heredados. `/me` entrega sólo la marca
del host actual. Un login con cuenta ajena devuelve un error genérico y nunca
una sesión utilizable para esa marca.

El origen exacto actual autoriza auth y mutaciones; registrar Atlas y Sur no
los convierte en orígenes intercambiables. Cookies host-only, HttpOnly,
SameSite y Secure bajo HTTPS; no hay cookie compartida ni SSO. Alias verificados
redirigen al principal registrado sólo mediante destinos obtenidos del registro.
Los cambios de asociación invalidan cachés/sesiones aplicables inmediatamente.

Website, QR e invitaciones nuevas se generan con el principal de la marca.
`/g/:slug` sólo puede resolver la marca actual; el directorio general, si se
conserva, redirige entradas públicas conocidas y no funciona como bypass de login.
Los secretos de invitación siguen fuera de query strings/logs. No habilitar un
traspaso entre hosts de una invitación heredada hasta probar un mecanismo
específico; presentar una continuación segura en el dominio canónico es mejor
que trasladar automáticamente tokens a un destino no validado.

## 7. Temas, publicación y módulos iniciales

Temas versionados con dos variantes compartidas y distinguibles: **Atlas,
compacto y geométrico**, y **Sur, amplio y redondeado**. Usar paleta, tipografías
de catálogo, formas, logo, textos e imágenes; defaults legibles y validación
de tokens. No se acepta HTML/CSS/JS de cliente. Login, selectores, website,
miembro, backoffice, vacíos/errores y título de navegador aplican la misma
identidad publicada.

El borrador de identidad requiere autorización. Publicar/revertir es explícito,
versionado y auditable; preview no altera otras sesiones ni sus formularios.
Website de marca, website de sede e identidad mínima de acceso tienen ciclos
separados. Retirar el website conserva el login de miembros. La migración
preserva la última identidad pública existente aunque el borrador privado difiera.

Capacidad efectiva = habilitación de plataforma ∩ preferencia de marca ∩
preferencia de sede ∩ permiso de usuario ∩ condiciones de servicio. Una sede
no eleva capacidades. Autenticación, autorización, lectura histórica y
exportación propia son funciones base y no módulos opcionales.

| Módulo inicial | Dependencias | Política al desactivar |
| --- | --- | --- |
| Website público | Identidad mínima independiente | Retirar lectura/publicación pública; conservar borrador e historial de versiones; login permanece |
| Equipo/QR | Catálogo disponible e inventario de sede | Bloquear nuevas operaciones/publicación del módulo y QR públicos; preservar snapshots y referencias históricas autorizadas |
| Plano/espacio | Website y, para puntos de unidades, equipo | Ocultar publicación/plano actual y bloquear edición/publicación mientras esté apagado; no borrar medios ni historial |
| Medios | Almacenamiento privado autorizado | Bloquear nuevas cargas/selecciones; conservar lectura de medios ya referenciados por publicaciones o snapshots autorizados |
| Voz guiada | Entrenamiento e instrucciones escritas | Detener/ocultar lectura de voz; entrenamiento y texto permanecen disponibles |

No permitir que apagar equipo o medios invalide silenciosamente una rutina
activa. Los registros y snapshots siguen accesibles por su autorización
histórica, aunque su recurso ya no se ofrezca para nuevas prescripciones.
Ocultar una entrada de biblioteca afecta nuevas selecciones de esa sede; no
modifica la base compartida ni las versiones asignadas. Publicar recursos
privados en otra sede exige una acción autorizada explícita.

## 8. Checkpoints y evidencia exigida

1. **WL-1:** fixture anterior y vacía migradas; Principal con IDs/datos/roles
   preservados; dos sedes Atlas/Sur; FKs rechazan organización/sede cruzadas.
2. **WL-2/3:** dos hosts del mismo runtime; rechazo de hosts/proxy/orígenes
   incorrectos, login ajeno, cookie copiada, roles cruzados y revocación en cola.
3. **WL-4:** recorrido administrador → entrenador → socio → seguimiento en
   cada sede; invitaciones nuevas/heredadas y cambio de sede con borrador.
4. **WL-5/6:** publicación separada y reversión; políticas de módulos en UI/API;
   disponibilidad, traslado/archivo y lectura histórica después de revocar sede.
5. **WL-7/8:** dominio principal/alias/baja; HTTPS con CA controlada; matriz
   D01–D19 en Chromium escritorio/táctil y WebKit táctil; backup/restauración
   conjunta de DB/medios/configuración y regresión B2C aplicable.

Usar DB/schema desechables, comandos documentados y evidencia nueva. Los
resultados anteriores de `508e9e1` certifican sólo la base. Registrar por fase
SHA o diff, comandos, resultado, topología, omisiones y riesgos. El plan no
autoriza el despliegue de producción y no declara prueba física ni DNS público.

Riesgos que bloquean cerrar una fase: queries sólo por organización en una ruta
operativa; privilegios deducidos del rol heredado; medios públicos resueltos
antes de comprobar marca; cache de dominio sin invalidación; login global que
evade binding; inventario/borradores idempotentes reutilizados en otra sede;
snapshots adaptados desde contenido mutable; E2E usando dos paths en un host;
restauración de DB sin medios/configuración compatibles.

Después de crear sedes y concesiones no se permite arrancar el binario antiguo
que sólo conoce organización. Recuperación: binario compatible, corrección
hacia adelante o restauración coordinada ensayada con escrituras detenidas y
copia previa del estado actual. Registrar el punto de recuperación y el
tratamiento de escrituras posteriores al backup; no borrarlas para simular
compatibilidad. La reversión visual de un tema no revierte schema ni permisos.
