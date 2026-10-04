# Cuentas, datos personales y operación

Klisteni conserva un catálogo público y una demostración local. Las cuentas habilitan rutinas, planificación semanal e historial sincronizados mediante una API propia y PostgreSQL. El administrador invita a las personas; cada una elige su contraseña al activar el enlace. El registro público está deshabilitado en el servidor. Esta documentación describe la implementación y los pasos de activación: **no acredita un despliegue productivo ni una base provisionada**.

## Qué se guarda y dónde

| Modo | Datos | Persistencia |
| --- | --- | --- |
| Público / demostración | Catálogo educativo, animaciones y práctica de prueba | Recursos estáticos; preferencias e historial de la demo en el navegador |
| Cuenta | Nombre, email de acceso, zona horaria, rutinas, plan semanal, fuerza y cardio | PostgreSQL, asociados al usuario autenticado |
| Sesión de acceso | Identificador de sesión revocable | Cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción; registro de sesión en PostgreSQL |
| Cambios pendientes de cuenta | Operaciones todavía sin confirmar, con ID estable | Cola local asociada al usuario hasta sincronizar o resolver su error |
| Entrenamiento en curso | Series introducidas antes de finalizar | Memoria de la pestaña; todavía no se retoma en otro dispositivo |
| Analytics | Una visita fija tras consentimiento | Umami separado, sin rutinas, historial, email ni identificador de la cuenta |

La API nunca acepta un `userId` para elegir propietario: deriva la cuenta de la sesión. La base y el rol son exclusivos de Klisteniapp; T3 Designer puede compartir el servidor PostgreSQL, pero no estas tablas, credenciales ni sesiones. Las contraseñas se guardan con el hash del proveedor de autenticación, nunca en texto plano. Los administradores de infraestructura conservan capacidad de acceso a la base: no existe cifrado de extremo a extremo.

`PersonalData` versión 2 contiene perfil, rutinas, plan e historial `ProgressData` versión 1. El catálogo y la geometría siguen versionados con el código. Los registros nuevos pueden guardar zona horaria y una copia de la rutina al completar la sesión. Editar la rutina después no cambia las series ya registradas ni ese snapshot.

## Semanas, viajes y racha

La zona horaria del perfil determina el día de seguimiento. Las fechas guardadas no se convierten al viajar o cambiar de dispositivo. Las semanas van de lunes a domingo; el primer plan puede empezar en la semana actual, y las modificaciones posteriores empiezan el lunes siguiente. El servidor conserva las revisiones ya comenzadas.

La constancia principal cuenta semanas cumpliendo el número de días de fuerza elegido. Cada fecha aporta como máximo un día, aunque existan varias sesiones. Se permite recuperar una sesión en otro día de la misma semana. Los días elegidos son la agenda; el objetivo semanal no exige coincidencia exacta de fechas. El cardio permanece en sus métricas de actividad y XP. Los descansos y una semana actual todavía incompleta no cortan la racha de semanas anteriores; una semana terminada sin cumplir el objetivo sí la corta. No se cuentan registros futuros.

## Desarrollo local

Requisitos: Node 24+, pnpm 12.7.0 y una base PostgreSQL de desarrollo accesible. Para explorar solamente el catálogo no hace falta arrancar la API.

1. Instalar las dependencias con `pnpm install --frozen-lockfile --ignore-scripts`.
2. Copiar `apps/api/.env.example` a `apps/api/.env`. Configurar `DATABASE_URL`, un `BETTER_AUTH_SECRET` aleatorio de al menos 32 caracteres y `APP_ORIGIN=http://localhost:5173`. Mantener este archivo fuera de Git. Puede generarse el secreto con `openssl rand -hex 32`; guardarlo en el gestor de secretos/archivo local sin pegarlo en issues o logs.
3. Crear las tablas explícitamente: `pnpm --filter @klisteniapp/api migrate`.
4. Crear una cuenta de prueba con la CLI descrita abajo.
5. Ejecutar `pnpm dev:accounts` o, en terminales distintas, `pnpm --filter @klisteniapp/api dev` y `pnpm --filter @klisteniapp/web dev`. `pnpm dev` conserva el arranque de la demo web sin requerir la API.
6. Abrir exactamente `http://localhost:5173`. `localhost` y `127.0.0.1` son orígenes diferentes; si se elige otro hostname/puerto, cambiar `APP_ORIGIN` en consecuencia.

Vite y Vite preview envían `/api` a `http://127.0.0.1:3001`; `KLISTENI_API_URL` permite cambiar ese destino en desarrollo. Esa variable pertenece al proxy de Vite; no contiene credenciales ni es una opción del bundle público. `APP_ORIGIN` siempre es el origen del navegador, sin ruta ni barra final. En producción debe usar HTTPS. Dentro del contenedor, `HOST=0.0.0.0`; el valor local predeterminado es `127.0.0.1`.

La API separa `GET /api/healthz` (proceso vivo) de `GET /api/readyz` (conexión disponible y esquema de autenticación/datos personales preparado). Una base inaccesible o sin migrar debe retirar disponibilidad de cuentas sin afectar el catálogo público. La web muestra el estado de conexión y no presenta un guardado fallido como sincronizado.

## Invitaciones y administración

La primera cuenta administradora se prepara desde la CLI privada. La persona activa el enlace y elige su contraseña: el operador no necesita conocerla.

```sh
pnpm --filter @klisteniapp/api users bootstrap --email persona@example.com --name "Persona" --send-email
```

El correo debe estar configurado para `--send-email`. Para entregar el enlace por un canal privado se usa `--show-link`; su salida contiene una credencial temporal y no debe publicarse en logs, issues ni capturas. La CLI no crea otro administrador cuando ya existe uno. La opción explícita `--reissue` reemplaza la invitación inicial pendiente.

En **Mi cuenta y planificación → Usuarios e invitaciones**, el administrador puede:

- Invitar un email y elegir si enviar el correo o copiar el enlace.
- Ver invitaciones pendientes/usadas/revocadas/vencidas y reemitirlas o revocarlas.
- Ver cuentas, suspender o rehabilitar un acceso y cerrar sus sesiones.
- Emitir un enlace para recuperar una contraseña sin elegirla por la persona.

El rol de administrador permite gestionar accesos; no proporciona una API para leer el progreso personal de otras cuentas. El servidor valida el rol y la identidad de sesión en cada operación. Impide suspender al último administrador activo.

Las invitaciones duran 24 horas y los enlaces de recuperación una hora. Son de un solo uso; reemitir invalida el enlace anterior. PostgreSQL conserva únicamente el hash del token. El enlace lleva el token en el fragmento (`#token=…`), que no se transmite al servidor al abrir la página; la web lo retira enseguida de la barra y lo conserva en memoria hasta completar el formulario. Recargar después de eso exige abrir de nuevo el enlace original. Ni un GET ni la vista previa del enlace consumen la invitación. Las rutas `/account/activate`, `/account/recover` y `/account/forgot-password` no cargan analytics, sesión personal ni modelo 3D.

Después de activar o recuperar, la persona inicia sesión normalmente. Cambiar o recuperar la contraseña invalida los enlaces de recuperación pendientes y las sesiones correspondientes. El enlace «Olvidé mi contraseña» abre `/account/forgot-password`. La persona introduce su email y recibe siempre la misma confirmación; si la cuenta existe, está habilitada y el envío puede procesarse, se intenta enviar un enlace de una hora. El administrador conserva su flujo de recuperación como alternativa.

### Correo SMTP

La API acepta `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` y `SMTP_FROM`. `SMTP_FROM` es un email simple; la aplicación agrega el nombre visible. Para 587 se exige STARTTLS y certificado válido; 465 usa TLS desde el inicio. La ausencia de SMTP no impide el acceso de cuentas existentes ni la entrega manual de enlaces.

Una respuesta **aceptado por SMTP** confirma que el servidor aceptó el mensaje, no que llegó a la bandeja de entrada. La pantalla distingue esa respuesta de un fallo o un envío no solicitado. Si falla el envío, el administrador puede entregar el enlace vigente por un canal privado o reemitirlo. No se envían rutinas, historial ni contraseñas por correo.

En producción se reutiliza el SMTP personal autorizado que ya utiliza Odoo de desarrollo, mediante un Secret propio `klisteniapp-smtp`; la API no depende de Odoo ni usa su API en tiempo de ejecución. El secreto se entrega como SealedSecret ligado al nombre y namespace de Klisteniapp. Cambiar la clave Gmail exige actualizar también este secreto: no hay sincronización automática con Odoo.

### CLI operativa

Se conserva la CLI para operaciones de soporte desde un entorno autorizado:

```sh
pnpm --filter @klisteniapp/api users create --email persona@example.com --name "Persona"
pnpm --filter @klisteniapp/api users reset-password --email persona@example.com
pnpm --filter @klisteniapp/api users disable --email persona@example.com
pnpm --filter @klisteniapp/api users enable --email persona@example.com
pnpm --filter @klisteniapp/api users revoke-sessions --email persona@example.com
```

`create` y `reset-password` solicitan la contraseña con entrada oculta (12–128 caracteres). Para automatización, `--password-stdin` recibe una línea desde un gestor de secretos. Preferir las invitaciones y recuperación para usuarios reales. En el contenedor, el equivalente es `node apps/api/src/operator.ts`.

Rehabilitar una cuenta no recupera sesiones anteriores. Restringir el entorno que ejecuta estos comandos; no poner credenciales en argumentos, archivos versionados o variables `VITE_*`.

## Recuperación pública: límites y entrega

`POST /api/account/request-recovery` acepta exclusivamente JSON `{ "email": "persona@example.com" }` desde el origen configurado. Para cualquier email válido responde `202 { "ok": true }`, sin cookie, enlace, token, estado de cuenta ni resultado de correo, con `Cache-Control: no-store`. Una cuenta inexistente, deshabilitada, un transporte no configurado o un fallo SMTP producen la misma respuesta. Los errores de formato/origen mantienen sus respuestas habituales; más de diez intentos por IP en un minuto producen `429 RATE_LIMITED`, independientemente del email.

Los límites por email se reservan atómicamente en PostgreSQL, utilizando `account_rate_limit` existente y claves HMAC con el secreto del API; el email no aparece en esas claves. El período de espera es de cinco minutos desde la primera solicitud admitida, sin prolongarlo por repeticiones. Se permiten como máximo tres reservas por hora fija UTC. Ambos límites se aplican también a emails inexistentes y sobreviven a reinicios; al alcanzarlos se conserva la confirmación genérica. Cambiar `BETTER_AUTH_SECRET` reinicia de hecho estas claves, además de afectar las sesiones.

La respuesta termina antes de consultar la cuenta o iniciar SMTP. Una cola en memoria admite hasta 32 trabajos pendientes y ejecuta como máximo dos envíos a la vez. Si está llena, no consume la cuota del email y conserva la misma respuesta. Un enlace de recuperación vigente creado durante los últimos cinco minutos, incluso por un administrador, se conserva sin reemitir ni invalidarlo. Los enlaces públicos reutilizan el hash, la caducidad de una hora, el consumo único y la invalidación de sesiones del flujo existente. Ningún pedido crea una cuenta ni amplía permisos.

El correo es un intento de entrega, no una garantía: `smtp_accepted` sólo indica aceptación del servidor SMTP. La cola no es durable. El apagado deja de admitir trabajo y procura vaciar lo ya admitido dentro del límite total existente de diez segundos; un reinicio abrupto o ese límite pueden perder un envío pendiente. También puede fallar el transporte. La persona puede volver a solicitarlo después de cinco minutos o contactar al administrador. No se almacenan tokens sin hash en PostgreSQL ni se registran emails, enlaces o respuestas SMTP en logs. La confirmación pública nunca permite distinguir estos casos.

No hay nueva tabla ni migración para esta funcionalidad. Para validarla localmente, ejecutar `TEST_DATABASE_URL=… pnpm --filter @klisteniapp/api test` contra PostgreSQL descartable: la suite nueva usa un transporte de correo simulado y no conecta con SMTP real. Los archivos de pruebas se ejecutan de uno en uno porque el introspector de Better Auth enumera esquemas y no debe coincidir con la eliminación del esquema temporal de otra suite. Los casos cubren respuesta anterior a SMTP bloqueado, origen/JSON, resultados genéricos, reservas concurrentes y persistentes, capacidad de cola, dos envíos simultáneos, apagado, conservación de enlaces recientes y recuperación con revocación de sesiones y rechazo de repetición.

## Migración, importaciones y concurrencia

Iniciar sesión no asocia automáticamente el historial de un navegador compartido. La interfaz ofrece una incorporación explícita y muestra el contenido local disponible. La copia local original se conserva. Los archivos v1 siguen siendo aceptados para importar fuerza/cardio; las copias v2 incluyen también perfil, rutinas y plan. La importación de registros en una cuenta es una fusión atómica: repetirla no duplica los mismos identificadores. Un identificador con otro contenido produce un conflicto visible y no un reemplazo silencioso.

Los ajustes usan una revisión esperada; si otro dispositivo los cambió, el servidor devuelve un conflicto y la interfaz debe actualizar antes de reintentar. Agregar registros independientes no sobrescribe el historial completo. Los borrados dejan una marca por identificador para impedir que una operación retrasada o una importación vieja resucite un registro. Esto también significa que importar una copia antigua no funciona como “deshacer borrado”.

Una cuenta completamente vacía admite restaurar una copia v2 completa —incluidas revisiones históricas— mediante una opción explícita. Después de la primera escritura, las revisiones de planes empezadas son inmutables también al importar ajustes: si una copia contradice el plan existente, se rechaza esa modificación. Se puede incorporar su historial sin reemplazar ajustes. Una exportación JSON es portabilidad personal; una restauración operativa de PostgreSQL preserva además sesiones, revisiones y marcas de borrado, y tiene otro procedimiento.

La interfaz distingue pendiente, sincronizado y error. Si la red falla, usar el reintento de la operación existente; no volver a crear un entrenamiento nuevo con otro identificador. El trabajo personal temporal queda asociado a la cuenta; cambiar de usuario no debe mostrar ni reenviar sus operaciones bajo otra cuenta. Todavía no hay service worker ni garantía de arranque o trabajo completo sin conexión.

## Base e infraestructura

Mycelium es el propietario del estado deseado de producción. [accounts.example.yaml](../deploy/accounts.example.yaml) es una referencia con placeholders y secretos por nombre, no un manifiesto listo para aplicar. Antes de copiarlo a Mycelium, verificar la versión y capacidad actuales de PostgreSQL, nombres del namespace/Service, etiquetas de pods, reglas de red, ingress/TLS y recursos disponibles. No reinicializar el volumen PostgreSQL existente ni usar su script de inicialización como mecanismo de alta de una nueva app.

Provisionar una base y rol exclusivos —por ejemplo `klisteniapp`— con `LOGIN`, sin superusuario ni capacidad de crear roles/bases. El operador de PostgreSQL puede crear el rol sin contraseña en SQL y asignarla mediante `\password klisteniapp`, evitando literales de contraseña. Crear la base propiedad de ese rol y revocar acceso de `PUBLIC` a la base y creación pública en su esquema. La URL de conexión usa el Service interno PostgreSQL, nunca un puerto público. Si la instalación exige TLS, configurar y comprobar su verificación al construir esa URL.

Guardar `DATABASE_URL` y `BETTER_AUTH_SECRET` en un Secret dedicado, creado por el mecanismo SealedSecrets existente. El secreto de autenticación debe ser estable entre réplicas y reinicios. No incluir valores reales en los ejemplos, el bundle web, una imagen o el repositorio. La cuenta runtime necesita los permisos de sus tablas; el job de migración necesita además crear/actualizar el esquema de esta base. No conceder permisos sobre bases de otras aplicaciones.

Configurar ambos extremos de la red: egress desde API/job hacia PostgreSQL y DNS, e ingress PostgreSQL desde los pods Klisteni autorizados. El ejemplo restringe el ingreso HTTP de la API a Traefik; sus selectores deben confirmarse en el clúster vigente. Revisar políticas existentes porque los permisos de NetworkPolicy se suman.

## Imagen y publicación

```sh
docker build --platform linux/amd64 -f Dockerfile.api --build-arg OCI_REVISION="$(git rev-parse HEAD)" -t klisteniapp-api:local .
```

La imagen usa el Node fijado por digest en CI, instala dependencias de producción con lockfile congelado y ejecuta TypeScript con Node. Corre como UID/GID 1000. En producción: filesystem raíz readonly, sin escalada/capabilities y sin token de ServiceAccount; la API no necesita PVC. El almacenamiento persistente pertenece a PostgreSQL. La imagen no ejecuta migraciones al arrancar.

El camino recomendado es un router `/api` del mismo hostname, con prioridad superior a la ruta estática, hacia el Service de API. Mantener `/api` sin quitar el prefijo. Esto deja Nginx y el catálogo disponibles aunque no haya backend. La configuración estática devuelve una respuesta JSON de API no disponible cuando todavía no existe esa ruta. [api.conf.example](../docker/api.conf.example) documenta la alternativa mediante proxy Nginx: completar el DNS del clúster y reemplazar las ubicaciones fallback `/api` por el include indicado en la configuración de Nginx del deployment. Montar ese archivo sin el include no activa el proxy.

Aplicar límite de cuerpo de **5 MiB** y `Cache-Control: no-store` a **todas** las respuestas de `/api`, incluidos GET anónimos, errores y auth. Desactivar cualquier regla de caché de Cloudflare/CDN para esa ruta. No servir `index.html` para fallos de API. La cookie queda en el mismo origen; no abrir CORS general ni añadir un segundo dominio público para el backend.

La API no confía por defecto en `X-Forwarded-*` ni `CF-Connecting-IP`; limita login usando el peer TCP. Si el proxy agrupa muchos usuarios, configurar `TRUSTED_CLIENT_IP_HEADER` únicamente después de comprobar que el ingress sobrescribe ese header, valida su cadena de proxies y no se puede eludir accediendo al puerto de API. Dejarlo sin configurar es seguro, pero comparte el límite entre clientes que llegan por el mismo proxy. No habilitarlo basándose solamente en un header que el cliente puede enviar.

Secuencia de release:

1. Completar validaciones locales/CI y producir imágenes web y API por digest.
2. Verificar PostgreSQL, Secret, capacidad y reglas sin cambiar servicios compartidos.
3. Obtener una copia recuperable **de la base Klisteni** si ya tiene datos. Antes de abrir el servicio a datos personales, comprobar una restauración aislada de esa base.
4. Ejecutar el job explícito `node apps/api/src/migrate.ts` con el mismo digest de API. Exigir resultado exitoso antes de promover el Deployment. Un fallo detiene esta release; no arrancar una versión incompatible ni borrar tablas para desbloquearla.
5. Promover API, comprobar readiness y habilitar la ruta del mismo origen; desplegar la web y emitir la invitación administradora mediante CLI.
6. Validar dos cuentas y dos dispositivos, importación, revocación, headers, catálogo anónimo y estado Argo/sondas. Registrar commit, digests y evidencia actual en Atlas, sin credenciales.

## Recuperación limitada a esta base

Una exportación personal no reemplaza la copia operativa. Confirmar ubicación, cifrado, retención y una restauración probada del mecanismo existente para **Klisteniapp**. Este trabajo no autoriza ni requiere reorganizar backups de la flota.

Antes de migraciones que modifiquen datos existentes, el operador genera una copia PostgreSQL de esta base en formato custom, mediante credenciales de servicio y almacenamiento protegido. Evitar una URL con contraseña en argumentos de procesos; usar las convenciones del gestor de secretos/archivo `.pgpass` con permisos restringidos. Probar `pg_restore` en una **base nueva aislada** y verificar usuarios, conteos, rutinas/planes, historial y marcas de borrado; no ensayar restauración sobre producción.

Ante un fallo de release, suspender las escrituras de Klisteniapp, conservar evidencia sanitizada y decidir si basta volver a los digests anteriores compatibles con el esquema. Un downgrade de imagen no deshace una migración. Si hace falta recuperar datos, restaurar la copia validada en una base separada y comparar antes de cambiar la URL del Secret; conservar la base fallida para investigar. Una copia previa pierde las escrituras posteriores a su fecha: informar ese intervalo antes de sustituir datos. No tocar WireGuard, el volumen compartido ni otras bases como parte del rollback de esta app.

## Verificación reproducible

```sh
# Lint, tipos y pruebas de API sin depender de producción
pnpm --filter @klisteniapp/api lint
pnpm --filter @klisteniapp/api typecheck
pnpm --filter @klisteniapp/api test

# Suite pública del repositorio y recorridos de navegador
pnpm check:all

# Con TEST_DATABASE_URL en el entorno: API real y cuatro flujos de cuenta
pnpm test:api
pnpm test:accounts
```

Las pruebas que requieren PostgreSQL usan `TEST_DATABASE_URL`. Configurarlo únicamente para una base de pruebas descartable; la suite crea y elimina su propio esquema aislado. Los tests que aparecen como omitidos por falta de esa variable **no acreditan** migraciones, aislamiento SQL ni login real. Configurar esa variable mediante un entorno protegido en CI y ejecutar otra vez `pnpm --filter @klisteniapp/api test`. No apuntar la suite a producción. `pnpm test:accounts` levanta una API real en 4182 y Vite preview en 4181, crea un esquema único, da de alta cuentas ficticias y elimina ese esquema al salir. También comprueba reintentos tras fallo de red, aislamiento entre cuentas, restauración v2 y coherencia de zona horaria entre contextos de navegador. No ejecutarlo simultáneamente con otras suites que compilan `apps/web/dist`.

Antes de activar producción, comprobar con datos ficticios:

- A y B no pueden leer, agregar, borrar ni importar en el historial del otro.
- Registro público denegado; login incorrecto limitado; cookie `HttpOnly`/`Secure` y origen ajeno rechazado.
- Registro de A visible en un segundo contexto de navegador; refresh y recuperación de sesión funcionan.
- Reenvío del mismo registro/importación no duplica; ID con distinto contenido y ajustes obsoletos producen conflicto.
- Borrado no reaparece por reintento; logout, revocación, reset y cuenta deshabilitada cortan acceso.
- Medianoche, viajes/DST, descanso y cambio de plan no reescriben fechas ni semanas anteriores.
- Fallo del backend deja el catálogo disponible y un guardado sin confirmar permanece visible como pendiente/error.
- Exportación v2 incluye las rutinas y ajustes; el importador v1 conserva las fechas históricas originales.

Guardar los resultados concretos y los casos omitidos. Que compile la web o pase una prueba con API simulada no certifica PostgreSQL, el ingress real ni una restauración.

### Validación local de la primera etapa, antes de invitaciones — 2026-10-04

- Lint, tipos, tests unitarios, build y verificación de las siete previsualizaciones aprobados.
- 17 pruebas de API con PostgreSQL 17 descartable: migraciones, sesiones, aislamiento, reintentos, conflictos, revocación y cierre del proceso.
- 20 recorridos públicos, 13 de privacidad/analítica y 4 de cuentas aprobados. Los de cuentas usan PostgreSQL real y cubren dos navegadores, importación, recuperación tras fallo de red y zonas horarias distintas. Vista móvil comprobada a 390 px.
- Imagen API `linux/amd64` construida y ejecutada como usuario sin privilegios, con raíz de solo lectura. Migración sobre base vacía completada; `/api/healthz` y `/api/readyz` devolvieron 200, datos privados sin sesión 401 y registro público 404, todos con `Cache-Control: no-store`.
- No se publicaron imágenes ni se modificaron PostgreSQL, secretos o GitOps de producción. Los manifiestos siguen siendo una referencia pendiente de adaptar y validar en el entorno real.
