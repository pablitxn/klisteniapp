# Validación de las imágenes B2B

El smoke test ejecuta los Dockerfiles de producción y el Compose de instancia con `NODE_ENV=production`, detrás de HTTPS local. Crea cuentas y datos ficticios; no usa la demo ni ninguna base, volumen o instancia existente.

```sh
pnpm build:b2b
node scripts/b2b-runtime-smoke.mjs
```

Requiere Node 24+, Docker con Compose, OpenSSL y espacio libre para las capas de las imágenes y dos bases PostgreSQL desechables. El script exige al menos 2 GiB libres; una construcción que descargue imágenes base necesita más. También supervisa el espacio durante la ejecución y cancela si cae por debajo de 384 MiB. No acepta argumentos de conexión ni nombres de proyectos existentes.

Los frontend se construyen antes del smoke: el script toma sus `dist` actuales y no los modifica. Conviene ejecutar esta validación después de los checks y las pruebas de navegador del mismo cambio, sin reconstrucciones simultáneas.

## Qué verifica

| Área                 | Evidencia automatizada                                                                                                                                                                |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Imágenes             | Construcción de `docker/b2b-api/Dockerfile` y `docker/b2b-web/Dockerfile`; IDs inmutables de ambas imágenes registrados en el resultado                                                             |
| Migraciones          | Liveness disponible y readiness 503 antes de migrar; migraciones repetibles; un fallo de esquema de autenticación mantiene readiness 503 hasta reiniciar la API                       |
| Contenedores         | API y Nginx con UID distinto de cero, raíz de archivos de sólo lectura, capacidades eliminadas y `no-new-privileges`                                                                  |
| Base de datos        | Rol de la API sin superusuario, creación de bases/roles ni DDL; el contenedor no recibe la contraseña de migración                                                                    |
| HTTPS y sesión       | Certificado efímero validado mediante una CA local específica; cookies Secure/HttpOnly/SameSite; rechazo de origen ajeno, sesión anónima y acceso a otro gimnasio                     |
| Publicación y medios | PNG mayor de 1 MiB a través de Nginx; medio privado antes de publicar y después de retirar publicación; lectura pública, SHA256 y rangos HTTP correctos                               |
| Inventario           | Dos unidades del mismo modelo, QR por unidad y reenvío exacto de un lote sin duplicación                                                                                              |
| Entrenamiento        | Invitación real, prescripción por tiempo y RPE, asignación versionada, ejecución distinta del objetivo y reintento exacto sin duplicación                                             |
| Reinicio             | Sesión, registros y bytes de los medios permanecen tras reiniciar API y Nginx                                                                                                         |
| Restauración         | `pg_dump` y archivo de medios con escrituras detenidas; restauración en otro proyecto, con otra base y volumen; migración, login, permisos, snapshots, ejecución y SHA256 comprobados |

## Orden de arranque y readiness

El Compose de producción inicia la API después de que el servicio de migración finaliza correctamente. Este orden también debe mantenerse en otros orquestadores: migrar primero y después iniciar o reemplazar los procesos de la API.

Better Auth conserva en memoria un resultado de esquema incompatible. Si se inició una API contra una base vacía, migrar desde otro proceso no corrige esa instancia de autenticación. Hay que reiniciar la API después de migrar. El smoke reproduce deliberadamente esa situación: `/healthz` continúa en 200, `/readyz` devuelve 503 incluso después de crear las tablas y sólo pasa a 200 tras el reinicio. Las API B2B y B2C verifican también la disponibilidad de autenticación antes de declararse listas.

Las regresiones `apps/b2b-api/tests/readiness.test.ts` y `apps/b2c-api/tests/readiness.test.ts` reproducen este caso con PostgreSQL y dos conexiones independientes. Así se evita que un proxy derive tráfico a un proceso que tiene tablas disponibles pero no puede autenticar sesiones.

## Aislamiento, limpieza y resultado

Cada ejecución genera un nombre aleatorio con prefijo `klisteni-b2b-smoke-`, dos proyectos Compose, puertos loopback libres y secretos nuevos. El segundo proyecto se usa sólo para la restauración. El servidor TLS también escucha exclusivamente en loopback; no se instala un certificado de confianza en el sistema ni se deshabilita globalmente la verificación TLS.

El script detiene los contenedores, elimina sus propios volúmenes y etiquetas de imágenes, y borra sus claves y archivos de entorno al terminar, incluso ante un fallo o una interrupción manejable. También comprueba que no hayan quedado contenedores ni volúmenes de esos proyectos. No ejecuta `prune` global ni modifica las instancias anteriores.

El resultado sanitizado queda en `.cache/b2b/runtime/<ejecución>/report.json`: checks aprobados, horas, IDs de imágenes, revisión Git, indicación de cambios locales y tamaños de backups. `diagnostics.private.log` es un diagnóstico privado con permisos restrictivos; no debe publicarse. El dump y el archivo de medios se transfieren por memoria y no se conservan como backups de una instalación.

Un fallo devuelve código de salida distinto de cero y registra la etapa. Los recursos existentes deben permanecer intactos. Ante un corte abrupto del host o `SIGKILL`, revisar exclusivamente los proyectos con el nombre exacto de esa ejecución antes de limpiar.

Esta prueba acredita el runtime local de los artefactos construidos. La configuración del proxy y DNS públicos, la política operativa de backups, el rendimiento con carga real y el escaneo físico de QR se validan en la instalación objetivo. No certifica técnica de ejercicios ni autoría de modelos 3D.

## Evidencia del 11 de octubre de 2026

La [ejecución registrada](validation/b2b-runtime-2026-10-11.json) completó los ocho grupos de comprobaciones, la restauración independiente de PostgreSQL y medios y la eliminación de los recursos temporales. Se usaron imágenes de producción con HTTPS local, `B2B_DEMO_MODE=false` y cuentas creadas por los comandos de operación reales.

El JSON conserva los IDs de ambas imágenes, las horas y los tamaños de los backups temporales. La revisión Git identifica el commit `508e9e166e89b06c0a1d6ea4c2111a57ecc5af2e`; `workingTreeChanges: false` confirma que se validó con el árbol limpio. La ejecución comenzó a las **10:45:59 UTC**, terminó a las **10:47:39 UTC** y registró `cleanupComplete: true`. Esta evidencia corresponde a los artefactos construidos en esa ejecución y debe renovarse al cambiar código, dependencias o frontend.
