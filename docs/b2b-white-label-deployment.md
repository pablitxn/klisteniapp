# Piloto público de marca blanca — 11 de octubre de 2026

Desplegado y verificado en `production-k3s`, aplicación ArgoCD y namespace
`klisteni-b2b-prod`, por autorización posterior al cierre local WL-0 a WL-8.

| Marca | Web pública | Sedes |
| --- | --- | --- |
| Atlas Demo | https://atlas-klisteni.orchid-labs.xyz | Centro, Norte |
| Sur Demo | https://sur-klisteni.orchid-labs.xyz | Centro, Oeste |

En cada dominio, `/app` abre el espacio del socio y `/backoffice/` el de
administradores y profesores. Hay diez cuentas sintéticas con contraseñas
aleatorias distintas: un administrador y un profesor/socio por sede en cada
marca. El administrador selecciona sede y función; profesores y socios acceden
únicamente a su sede. Los accesos están en el archivo privado del VPS
`.cache/wl-deploy/accesos-manuales.md`; no se versionan las credenciales.

## Revisión y operación

- Fuente de las imágenes: `45483e2dc15a8e3cd9df4b9aaa32893652434d28`.
- [Promoción GitOps PR42](https://github.com/pablitxn/mycelium/pull/42),
  `80ff2f5dade3bec9258118f31315be00d0b3d0d5`.
- [Operación y recuperación PR43](https://github.com/pablitxn/mycelium/pull/43).
- [MR de fuente](https://gitlab.orchid-labs.xyz/orchid-labs/homelab/klisteniapp/-/merge_requests/1):
  rama publicada; su integración a `main` requiere Maintainer. La credencial
  de este VPS tiene rol Developer. El despliegue usa los digests de la revisión
  publicada, independientemente de ese merge.

Mycelium conserva los manifests y los scripts operativos en
`applications/klisteni-b2b/`. Nginx y API comparten pod; la API escucha solamente
en loopback y exige la identidad del proxy. PostgreSQL y medios usan volúmenes
dedicados. La migración usa un propietario de esquema separado del rol runtime
sin DDL; los init containers comprobaron cinco migraciones y sus permisos antes
de arrancar la aplicación. Secretos sellados, TLS y rutas explícitas del túnel
completan el acceso público. Ambos dominios pasaron TXT, DNS y TLS reales antes
de activarse; previamente respondían 421.

El sitio B2C `klisteniapp.orchid-labs.xyz` conserva sus deployments, generaciones,
digests y base anteriores; su readiness y acceso público aprobaron.

## Evidencia desplegada

La [evidencia JSON](validation/b2b-white-label-deployed-2026-10-11.json) registra
digests efectivos, resultados, fechas y límites. Las capturas de
[Atlas](validation/b2b-white-label-deployed-atlas-2026-10-11.png) y
[Sur](validation/b2b-white-label-deployed-sur-2026-10-11.png) proceden del HTTPS público.

| Comprobación | Resultado |
| --- | --- |
| Chromium táctil, HTTPS público | **28/28**, cero errores JavaScript |
| WebKit táctil, después de recrear el pod | **22/22**, cero errores JavaScript |
| Host desconocido, identidad proxy y origen cruzado | **4/4** |
| Restauración de DB, medios y configuración | **5/5 grupos**; 33 tablas y 4 medios idénticos |
| API aislada sobre la copia restaurada | **10/10**; login, permisos, historial, branding y cookies cruzadas |
| Persistencia posterior al reinicio | 2 marcas, 4 sedes, 10 usuarios, 8 permisos de sede, 4 medios y 4 ejecuciones |
| ArgoCD al cierre funcional | **33 aplicaciones Synced/Healthy**; API/web 2/2, PostgreSQL 1/1 |

Chromium completó cuatro rutinas mediante UI y consultó su seguimiento con cada
profesor. Probó publicación/restauración de temas, módulos, revocación y reposición
de permisos, cookies entre marcas, upload real y permisos de medios GET/HEAD/Range.
WebKit volvió a entrar con las mismas cuentas e identificadores después del
reinicio, sin editar configuración ni entrenamiento. Las configuraciones y los
permisos modificados por el smoke quedaron restaurados; permanecen los datos
sintéticos de entrenamiento y cuatro imágenes pequeñas para pruebas manuales.

La copia de recuperación se conserva bajo `.cache/wl-deploy/backups/` con acceso
privado. El ensayo restauró otra base y otro directorio de medios, usó una segunda
API sólo en loopback y eliminó sus temporales. La API pública siguió disponible:
se verificó ausencia de cambios con hashes antes y después de la captura, durante
el intervalo controlado previo a entregar los accesos. No se afirma un bloqueo
de escrituras ni una política de backup periódico o recuperación de todo el host.

## Límites y próxima operación

La CI GitOps aprobó. El pipeline de fuente **1244**, job **5356**, falló con
`runner_system_failure`; no acredita el gate completo de fuente. La generación y
revisión de previews siguen diferidas, sin regeneraciones ni cambios de hashes
para omitirlas. Teléfono y QR físicos, Blender y revisión humana del contenido
conservan su aceptación propia.

La evidencia TLS almacenada vence el **22/11/2026 23:56:33 UTC**. Revalidar los
dos dominios con el operador **antes del 08/11/2026**, comprobando su DNS y
certificado vigente. La renovación automática del certificado de Cloudflare no
renueva ese registro de la aplicación. El runbook de Mycelium documenta el comando,
su efecto sobre sesiones y el procedimiento de recuperación ante una pausa.
