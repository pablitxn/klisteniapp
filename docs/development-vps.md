# Continuar el desarrollo en un VPS con la Mac apagada

Actualizado: **11 de octubre de 2026**. Relevo de código para el
[roadmap](roadmap-implementacion.md) y la [marca blanca B2B](b2b-white-label.md).
No acredita conexión, preparación ni validación del VPS en esta sesión.

El VPS ejecuta Git, Codex, backend, PostgreSQL y navegadores sin interfaz gráfica.
La Mac puede estar apagada; se necesita otro dispositivo con acceso SSH al VPS.
Codex, Git remoto y descargas necesitan conexión. No agrega un modo sin conexión
a la aplicación. Blender, calidad visual WebGL y teléfonos físicos conservan su revisión.

## 1. Entregar el código antes de apagar la Mac

El checkpoint de relevo reúne el setup unificado y este plan. La referencia de
este relevo es **`main` en el remoto `gitlab`**. Antes de cambiar de host, confirmar
que los cambios previstos estén en Git y publicados, y anotar **rama, remoto y SHA**.

```sh
git status --short
git diff --stat
git branch --show-current
git remote -v
git rev-parse HEAD
```

Revisar también los archivos nuevos: `git diff` no muestra su contenido. Incluir
los scripts, configuración y documentación que forman el setup; seleccionar los
archivos explícitamente al preparar el commit. `.env`, `.cache`, credenciales,
bases, medios locales, `node_modules` y cachés no se transfieren por Git. Generar
un entorno nuevo en el VPS. Publicar el código no inicia una sesión remota de Codex
ni despliega la aplicación.

En el VPS, inspeccionar `git status`, rama y remotos; conservar cualquier trabajo existente.
Hacer `git fetch <remoto>` y cambiar a la rama publicada, o crear un worktree desde
el SHA acordado. Confirmar `git rev-parse HEAD` antes de editar. No usar `reset --hard`,
borrar el checkout ni sobrescribir modificaciones. Si el setup aún no llegó, completar el relevo.

Asignar la rama de implementación a un solo entorno a la vez. Al volver a la Mac,
cerrar el checkpoint del VPS y traerlo con Git después de revisar el estado local.
No editar simultáneamente la misma rama en ambos hosts.

## 2. Preparar una sesión persistente y revisar recursos

Flujo: **Termius u otro cliente SSH → VPS → tmux → Codex CLI**. El alias histórico
`code-klisteni` se debe revalidar: disponibilidad, checkout y sesión de destino.
Host, usuario, ruta y alias se toman de la configuración privada vigente.

```sh
# Ya conectado por SSH al VPS, dentro del checkout elegido:
pwd
git status --short
node --version
pnpm --version
docker compose version
tmux ls
df -h .
free -h
docker system df
ss -ltn
```

Comprobar también procesos existentes, espacio de cachés de pnpm/Playwright y
acceso al daemon Docker. El repositorio pide Node **24+** y pnpm **12.7.0**;
conservar `package.json`, lockfile e imágenes fijadas. Una diferencia del runtime
global no justifica cambiar versiones del proyecto. Inventariar antes de instalar motores,
dependencias o imágenes; no hacer limpieza global ni modificar SSH, VPN o firewall.

Si no hay un alias adecuado, crear una sesión propia, por ejemplo
`tmux new -s klisteni-white-label`. Usar ventanas distintas para Codex, Compose y
Turbo. Desacoplar con `Ctrl-b d` y recuperar con
`tmux attach -t klisteni-white-label`. Desconectar SSH conserva procesos dentro
de tmux; reiniciar el VPS requiere arrancarlos otra vez. Verificar la autenticación
de Codex sin copiar claves o sesiones privadas de la Mac.

## 3. Arrancar el entorno propio del VPS

Con recursos y dependencias revisados, desde el root:

```sh
pnpm install --frozen-lockfile
pnpm setup:dev
# En una ventana de tmux:
docker compose up
# En otra ventana de tmux:
pnpm exec turbo run dev
```

El [setup unificado](development.md) crea secretos, espera PostgreSQL, migra y siembra
las cuentas antes de iniciar las APIs. Conservar archivos privados y volúmenes:
no regenerar contraseñas sobre bases existentes. Consultar las cuentas en `.cache/dev/` del VPS.
Ante puertos ocupados, identificar sus dueños antes de detener algo. No ejecutar
simultáneamente los helpers antiguos que comparten puertos.

## 4. Abrir las webs desde otro dispositivo

`127.0.0.1` pertenece al dispositivo donde se abre. Mantener los servicios en loopback
y usar un túnel SSH privado. Desde el cliente, sustituir el destino ya configurado:

```sh
ssh -N -o ExitOnForwardFailure=yes \
  -L 127.0.0.1:4200:127.0.0.1:4200 \
  -L 127.0.0.1:5173:127.0.0.1:5173 USUARIO@HOST_SSH
```

En Termius, configurar esos dos reenvíos locales equivalentes. Abrir en el
dispositivo cliente `http://127.0.0.1:4200/backoffice/`,
`http://127.0.0.1:4200/app` y `http://127.0.0.1:5173/`. No hace falta exponer
PostgreSQL o las APIs públicamente. Resolver puertos ocupados o configurar orígenes
compatibles; cambiar sólo el puerto del túnel puede romper autenticación.
El QR con loopback requiere un túnel propio en el dispositivo que lo abre.

La prueba futura usa `atlas.b2b.test` y `sur.b2b.test`, **dos orígenes del navegador
servidos por el mismo proxy y aplicación**, con resolución local y TLS confiable.
Configurar resolución también dentro de Docker y del navegador sin interfaz;
documentar la confianza del certificado y preservar host/origen por el túnel.
Dos rutas en `127.0.0.1:4200`, o cambiar únicamente una cabecera con
`curl`, no acreditan aislamiento de cookies, login y marca entre dominios.

## 5. Implementar y validar por entregas

Empezar por **WL-0** y continuar con **WL-1**, siguiendo dependencias y criterios
del [plan detallado](b2b-white-label.md). Registrar por entrega SHA, comandos,
resultados, omisiones y pendientes. Para cambios de código, existen `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build:b2b`, `pnpm test:b2b:api` y
`pnpm test:b2b:e2e`; ejecutar los aplicables en serie. Agregar builds y recorridos
B2C cuando cambien paquetes compartidos.

`B2B_TEST_DATABASE_URL` y `TEST_DATABASE_URL` deben apuntar a bases desechables
independientes de desarrollo y producción. La B2B exige nombre con `b2b` y `test`,
sin `options`, y permisos de crear/eliminar schemas. No reutilizar las URLs del
setup dev. Antes del navegador, comprobar motores y librerías Linux; instalar
sólo lo necesario siguiendo la [matriz B2B](b2b-browser-validation.md).

Los comandos actuales no certifican el futuro aislamiento por dominio. La suite de dos
dominios se debe implementar y documentar en WL; su comando aún no existe.
La regeneración/revisión completa de previews sigue diferida: conservar derivados,
registrar la omisión y no falsificar hashes ni declarar `pnpm check` completo verde.
Linux sin interfaz gráfica no sustituye la aceptación física o visual.

## Prompt para la siguiente instancia de Codex

> Continuemos el refactor B2B por dominios y marca blanca. Leé
> `docs/roadmap-implementacion.md`, `docs/b2b-white-label.md`, `docs/b2b.md`,
> `docs/development.md` y `docs/development-vps.md`. Inspeccioná rama, SHA,
> cambios locales, instrucciones y recursos del VPS antes de modificar nada.
> Confirmá que llegaron el plan y el setup unificado. Empezá por WL-0 y luego
> WL-1; respetá sus dependencias y las decisiones pendientes, con incrementos
> revisables y pruebas de aislamiento. Varias sedes forman parte de la primera
> entrega: dominio → marca/organización → sede. Prepará Atlas y Sur con al menos
> dos sedes cada una y permisos de profesores/socios limitados a las sedes
> asignadas. Conservá B2C independiente. Usá bases
> desechables para tests y secretos generados en este host. No actualices versiones
> ni regeneres previews diferidas. No publiques dominios ni despliegues por este
> relevo. Al cerrar cada entrega, actualizá estado y evidencia en el roadmap y
> explicá qué está implementado, comprobado, omitido y pendiente.
