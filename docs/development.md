# Desarrollo local: todas las apps

Desde el root del repositorio, con Node 24+, pnpm 12.7.0 y Docker iniciado.
En un checkout nuevo, preparar una sola vez:

```sh
pnpm install --frozen-lockfile
pnpm setup:dev
```

Después, usar dos terminales en el root:

```sh
# Terminal 1: PostgreSQL B2C y B2B
docker compose up
```

```sh
# Terminal 2: las cinco apps y el gateway B2B
pnpm exec turbo run dev
# También: turbo run dev si Turbo está disponible en PATH, o pnpm dev.
```

No hacen falta `-f`, perfiles, exportar variables ni ejecutar migraciones a mano.
Turbo prepara el entorno, espera hasta 60 segundos por cada base, migra y crea
las cuentas ficticias antes de arrancar las APIs. Los siguientes arranques
conservan credenciales, registros y medios. Puede iniciarse Turbo mientras
Compose termina de levantar las bases.

| App o servicio | Dirección |
| --- | --- |
| B2C con cuentas y administrador local | http://127.0.0.1:5173/ |
| Entrada B2B | http://127.0.0.1:4200/ |
| Backoffice B2B | http://127.0.0.1:4200/backoffice/ |
| Socio B2B | http://127.0.0.1:4200/app |
| Website Atlas / Sur | http://127.0.0.1:4200/g/atlas-demo · http://127.0.0.1:4200/g/sur-demo |
| API B2C / readiness | http://127.0.0.1:3001/api/readyz |
| API B2B / readiness | http://127.0.0.1:4201/api/b2b/readyz |
| Vite socio / backoffice | `4210` / `4211` (usar el gateway para navegar y login) |
| PostgreSQL B2C / B2B | `127.0.0.1:54331` / `127.0.0.1:54332` |

Usar los orígenes `127.0.0.1` indicados para mantener consistencia de sesiones y
validación del origen. Todos los servicios escuchan en loopback.

## Configuración y cuentas

`pnpm setup:dev` genera secretos aleatorios con permisos privados y conserva
los archivos existentes. Turbo también ejecuta este paso automáticamente.
Los archivos generados están ignorados por Git:

- `.env`: credenciales del Compose raíz; mantenerlo junto a sus volúmenes.
- `apps/{api,b2b-api,web}/.env.development.local`: configuración del entorno local.
- `.cache/dev/b2c-login.private.json`: email y contraseña del administrador B2C,
  con acceso cloud local vitalicio.
- `.cache/dev/b2b-demo.private.json`: cuentas de Atlas y Sur, generado después de
  preparar la base B2B.
- `.cache/dev/b2b-password.env`: contraseña compartida de las cuentas ficticias B2B.
- `.cache/dev/media`: subidas locales B2B.

La API de desarrollo carga únicamente esta configuración local. Las variables
de credenciales, proveedores y destinos heredadas de la terminal no cambian sus
bases. Billing y SMTP están desactivados. B2C usa el perfil público de ejemplo;
la configuración de desarrollo de Vite no habilita cuentas en builds de producción.
Los comandos `start`, `migrate` y de operador mantienen su configuración explícita
habitual; este entorno automático corresponde al comando `dev`.
Para desarrollar una API con un `.env` propio, usar su comando `dev:configured`.

Si un archivo generado entra en conflicto, el setup falla indicando el nombre
de la variable, sin imprimir su valor ni reemplazar el archivo. No regenerar
credenciales conservando una base inicializada con otras contraseñas. Las dos
bases usan volúmenes propios del proyecto Compose `klisteni-dev`; los helpers
anteriores de `deploy/` conservan sus entornos separados. No ejecutar a la vez
helpers que usan los mismos puertos de API o Vite.

## Detener y volver a arrancar

Ctrl-C en la terminal de Turbo detiene las apps; Ctrl-C en Compose detiene las
bases. Los datos se conservan. Para dejar las bases en segundo plano:

```sh
docker compose up -d --wait
pnpm dev
```

Para detenerlas después: `docker compose stop`. `docker compose down` retira
contenedores y red, conservando volúmenes. **`docker compose down -v` borra las
bases de este entorno**; no es necesario para reiniciar.

Para trabajar sólo con la demo B2C sin cuentas ni Docker:

```sh
pnpm dev:demo
```

Los helpers especializados `pnpm dev:b2b` y `node scripts/dev-ui-instance.mjs`
siguen disponibles para sus entornos aislados.

Para ejecutar este entorno desde otro dispositivo con la Mac apagada, seguir
[el relevo al VPS y los túneles privados](development-vps.md). Las URLs de esta guía
describen el setup actual de un origen. Los dominios por marca, temas y varias
sedes desde la primera entrega están implementados en [marca blanca B2B](b2b-white-label.md).
Su suite HTTPS usa entornos desechables propios; consultar [preparación y confianza
TLS](b2b-white-label-runtime.md) antes de ejecutarla. No activar el modo anterior
contra una base que ya tenga dominios o múltiples sedes.
