# Continuar el trabajo en macOS

Entrega del VPS: **11 de octubre de 2026**. La rama de trabajo es
`codex/b2b-first-delivery`; su integración en `main` conserva los commits de código
y documentación. El punto de partida para continuar es `main` actualizado.

Para continuar el refactor con la Mac apagada, usar [Desarrollo en VPS](development-vps.md).
El [roadmap](roadmap-implementacion.md) y el [plan de marca blanca](b2b-white-label.md)
definen dominios, permisos, temas y varias sedes desde la primera entrega. Backend,
frontend y pruebas pueden avanzar en el VPS; Blender conserva su autoría local.
Los cambios locales nuevos requieren un checkpoint publicado antes de traerlos al otro host.

## Traer el repositorio

Para un checkout nuevo, con acceso SSH a GitLab configurado:

```sh
git clone --origin gitlab ssh://git@gitlab-ssh.orchid-labs.xyz:32222/orchid-labs/homelab/klisteniapp.git
cd klisteniapp
git switch main
git pull --ff-only gitlab main
```

Si ya existe una copia en la Mac, conservar primero sus cambios locales y después
actualizar `main`. Usar el nombre de remoto que muestre `git remote -v` (`origin`
si se clonó sin `--origin gitlab`). Para el siguiente cambio, crear una rama desde
ese `main`, por ejemplo `git switch -c codex/b2b-white-label`.

Git incluye fuentes, lockfile, modelos y derivados versionados, fuentes Blender,
documentación y el informe sanitizado de runtime. No transporta `node_modules`,
`dist`, `.cache`, bases de datos, subidas locales ni credenciales del VPS. Instalar
dependencias y generar la demo nuevamente; no copiar entornos privados al repo.
Si se necesitan registros personales de otro navegador, usar su exportación JSON.
Una transferencia de una instancia B2B requiere el backup de DB y medios descrito
en [operación B2B](b2b.md#backup-y-restauración), separado del traslado del código.

## Dependencias y primer arranque

Para levantar todas las apps desde el root, usar [el setup unificado](development.md):
`pnpm setup:dev` una vez y después `docker compose up` y `pnpm exec turbo run dev`
en dos terminales. `pnpm dev` es un alias del arranque completo.

Usar **Node 24+** y **pnpm 12.7.0**, fijados en `package.json`. Para la demo B2B,
tener Docker iniciado y el comando `docker compose` disponible. Blender sólo es
necesario para autoría/exportación; la web usa los assets ya versionados.

```sh
node --version
pnpm --version
docker compose version
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev:b2b
```

Si pnpm no está preparado y la instalación de Node dispone de Corepack, el comando
del proyecto es `corepack prepare pnpm@12.7.0 --activate` (con los shims de
Corepack habilitados). Conservar el lockfile al instalar en una máquina nueva.

| Pantalla | Dirección local |
| --- | --- |
| Entrada B2B | `http://127.0.0.1:4200/` |
| Equipo del gimnasio | `http://127.0.0.1:4200/backoffice/` |
| Socio | `http://127.0.0.1:4200/app` |
| Website Atlas | `http://127.0.0.1:4200/g/atlas-demo` |
| Website Sur | `http://127.0.0.1:4200/g/sur-demo` |

El helper prepara PostgreSQL, migra y siembra ambos gimnasios. Las cuentas quedan
en `.cache/b2b/demo.private.json`; la contraseña generada es `B2B_DEMO_PASSWORD`
dentro de `.cache/b2b/local.env`. Consultarlas localmente y mantener esos archivos
fuera de commits y capturas. Repetir el arranque conserva la demo existente.

Puertos reservados: entrada `4200`, API `4201`, Vite socio `4210`, Vite backoffice
`4211` y PostgreSQL `54330`. Ctrl-C detiene las aplicaciones y conserva la base.
Para detener también esa base sin borrar sus datos:

```sh
docker compose --env-file .cache/b2b/local.env -f deploy/compose.b2b.yaml stop db
```

El helper escucha en loopback; un QR con `127.0.0.1` no abre la Mac desde un
teléfono. El escaneo físico se hará sobre el origen HTTPS de una instancia
accesible, siguiendo [la guía B2B](b2b.md).

Para B2C, `pnpm dev:demo` sirve la demo personal en el puerto habitual `5173`, sin
backend. Para iterar cuentas B2C con datos ficticios, usar
`node scripts/dev-ui-instance.mjs` y [su guía](ui-iteration.md); es otro producto,
con base y sesiones independientes.

El entorno y el smoke se comprobaron en Linux en el VPS. El primer arranque en
macOS queda por comprobar. Las imágenes fijadas y las capturas visuales se deben
evaluar para la arquitectura del host; un resultado en Linux no acredita una
ejecución nativa en Apple Silicon. No actualizar snapshots por diferencias de
plataforma sin revisar las imágenes.

## Qué retomar en Blender

1. Elegir la máquina piloto, reunir medidas y referencias y acordar quién revisa
   el contenido. El modelo reutilizable y las dos unidades físicas tienen IDs
   distintos del archivo 3D.
2. Producir fuente editable, GLB estático, imagen de respaldo, orientación y
   procedencia. Para un recurso compartido, crear con el primer asset las rutas
   propuestas `assets/blender/equipment/<id>.blend` y
   `packages/model-assets/public/models/equipment/`. El contenido privado del
   gimnasio se carga en su biblioteca B2B.
3. Comprobar el perfil binario antes de subir:

   ```sh
   pnpm equipment:check /ruta/maquina.glb --poster /ruta/maquina.png
   ```

   GLB 2 autocontenido, hasta 24 MiB, sin animación, skins, extensiones ni recursos
   externos; texturas internas PNG/JPEG. Este check no certifica escala, técnica
   ni calidad visual.
4. Subir desde el backoffice, asociar al modelo/unidad, revisar y publicar. Abrir
   la ficha y su QR, con imagen/instrucciones disponibles aunque falle WebGL.
5. Trabajar después el primer movimiento con máquina: poses, contactos, fases y
   cámaras revisados. El runtime tiene movimientos registrados explícitamente;
   **no hay un importador general Blender → animación de la app**. Un GLB estático
   no crea un ejercicio animado. El taller de yoga exporta del runtime a Blender.
6. Repetir con un segundo caso visual antes de generalizar. Las previews se
   regeneran y revisan **después de estabilizar los recursos**, como indica B4 del
   [roadmap](roadmap-implementacion.md); este relevo no pide rehacer miniaturas.

## Dónde continuar el código

| Cambio | Entrada |
| --- | --- |
| Preparación, inventario, publicación y QR | [Backoffice](../apps/backoffice/src) |
| Rutina, borradores, registro, historial y website | [Features del socio](../apps/member-web/src/features) |
| Permisos, persistencia, migraciones y medios | [API B2B](../apps/b2b-api/README.md) |
| Contratos, reglas y límites de paquetes | [Arquitectura](architecture.md) y [B2B](b2b.md#componentes-y-límites) |
| Modelos y procedencia | [Assets compartidos](../packages/model-assets/README.md) |
| Visores y movimientos soportados | [Anatomy viewer](../packages/anatomy-viewer/README.md), `packages/geometry` y `packages/catalog-base` |

## Comprobaciones y evidencia que se conserva

Para cambios de código, ejecutar los checks aplicables, en serie:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Las pruebas con PostgreSQL requieren bases **desechables** independientes:
`TEST_DATABASE_URL` para B2C y `B2B_TEST_DATABASE_URL` para B2B. Sin las variables,
los casos de integración omitidos no cuentan como cobertura. Para navegador:

```sh
pnpm --filter @klisteniapp/web exec playwright install chromium webkit
# Con B2B_TEST_DATABASE_URL configurada en un entorno privado:
pnpm test:b2b:api
pnpm test:b2b:e2e
```

No ejecutar a la vez suites que construyen los mismos frontend. Las guías de
[navegadores](b2b-browser-validation.md), [release](b2b-release.md) y
[runtime](b2b-runtime-validation.md) documentan las comprobaciones completas.

El código `508e9e1` tiene resultados de lint, tipos, tests, builds, auditoría,
integración real con PostgreSQL y navegadores registrados en la guía de release.
El [informe de runtime](validation/b2b-runtime-2026-10-11.json) acredita 8/8 grupos
sobre ese commit con árbol limpio, incluida restauración y limpieza. Los cambios
posteriores de documentación no convierten ese informe en evidencia de otro código.

**Pendiente conocido:** `pnpm check`, `check:all`, `check:release` y el job GitLab
`quality` incluyen `previews:check`; la regeneración completa está diferida.
No se afirma un gate completo verde. CI no publica ni despliega esta aplicación.
El siguiente cierre de contenido debe resolver ese check con recursos reales,
sin editar hashes ni relajar validadores. Tampoco se dio por hecha la aceptación
en teléfonos físicos ni un despliegue público.
