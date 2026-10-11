# Demo local e instancia propia

## Clonar y ejecutar sin servicios privados

Requisitos: Node.js 24 o posterior y pnpm 12.7.0. Las dependencias se descargan del registro público durante la instalación; después, el runtime de demo sólo necesita sus archivos estáticos. No necesita PostgreSQL, credenciales, Blender, repositorios privados ni un submódulo.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev:demo
```

El modo predeterminado es `demo`. Para producir y servir una distribución estática:

```sh
pnpm build:demo
pnpm --filter @klisteniapp/web preview --host 127.0.0.1
```

El resultado está en `apps/web/dist`. Publicá **esa carpeta**, con fallback SPA a `index.html`, incluidos sus modelos, previews y avisos de licencia. No publiques todo el checkout ni los archivos `.env`, directorios de pruebas o evidencias operativas. Para desplegar bajo un subdirectorio hay que configurar también el enrutamiento; el ejemplo está preparado para la raíz del sitio.

`/privacy` funciona directamente como ruta estática sin backend. No existe service worker: poder usar los datos localmente no implica que la web pueda arrancar sin conexión antes de descargar sus archivos.

## Un recorrido completo

1. Abrí **Mi rutina**, explorá un ejercicio y sus instrucciones. Cambiá entre piel, músculos y huesos, o usá el contenido textual si no hay WebGL.
2. Personalizá ejercicios y series, iniciá una sesión, registrá repeticiones y guardala. Revisá la sesión en **Mi progreso**.
3. Registrá una caminata y verificá sus minutos. Recargá: ambas actividades deben continuar allí.
4. En **Mi salud**, registrá una medida corporal, una noche de sueño y un objetivo propio. El dashboard usa tus registros; no simula una cuenta o un historial de otra persona.
5. Descargá una copia desde **Ajustes**. Importala en otro perfil del navegador para trasladar tus datos. El importador admite progreso v1 y copias personales v2; una importación local reemplaza la copia local tras confirmarla. Conservá una exportación previa si querés poder volver atrás.
6. Para datos del reloj, **Mi salud → Importar** acepta el formato normalizado documentado en [importación de salud](health-import.md), con vista previa y confirmación. Los ZIP/CSV nativos de fabricantes necesitan conversión; no existe sincronización automática con el reloj en esta versión.

El historial empieza vacío. No se añaden datos ficticios a tu almacenamiento ni se sobrescribe el historial al actualizar. Las claves locales existentes (`klisteniapp.progress.v1`, preferencias y `klisteniapp.personal.v2`) se conservan. Los formularios sin guardar y los entrenamientos en curso todavía no forman parte de una copia exportada.

## Qué cambia entre modos

| Función | Demo predeterminada | Instancia explícita |
| --- | --- | --- |
| Catálogo, anatomía y previews | Incluidos | Incluidos |
| Rutinas, progreso, salud, objetivos y copias locales | Gratuitos | Gratuitos sin iniciar sesión |
| Inicialización de sesiones y pantallas de cuenta | Ausentes del bundle | Habilitadas |
| PostgreSQL y guardado entre dispositivos | No se usan | Requieren backend configurado |
| Invitaciones y suscripciones | No se usan | Backend; pagos desactivados por defecto |
| Analytics | Módulo desactivado, sin solicitudes | Configuración pública explícita y consentimiento |
| Privacidad | Texto local sin identidad o hosting asumidos | Perfil del operador incorporado al build |

El modo se decide **durante la compilación**. No se activa una cuenta por encontrar una cookie, por recibir una respuesta de `/api`, por parámetros en la URL ni por restaurar un consentimiento antiguo. Para cambiar de modo hay que crear un nuevo build.

## Configurar una instancia

El servidor genérico continúa en `apps/api`; cada operador instala su base, genera secretos, crea sus usuarios y decide sus políticas. Seguí [cuentas](accounts.md) y [despliegue](deployment.md). No hay dependencias de una instalación particular.

Creá un archivo fuera del repositorio a partir de `apps/web/instance-profile.example.json`, y reemplazá **todos** los campos de ejemplo. Contiene información pública, no credenciales: identidad y contacto del operador, hosting, procesamiento de correo, conservación de cuenta, backups, logs y analytics, y fecha de actualización. Se valida al construir y se muestra como texto en Privacidad sin consultar la API.

```sh
export KLISTENI_PUBLIC_PROFILE_FILE=/absolute/path/to/public-profile.json
export KLISTENI_API_URL=http://127.0.0.1:3001
pnpm dev:instance
# O una distribución estática para esa instancia:
pnpm build:instance
```

`KLISTENI_API_URL` configura el proxy de desarrollo. En producción, el operador configura el proxy del mismo origen para `/api`; no se incorpora una URL privada de backend al navegador. El perfil público se incorpora al bundle: cualquier visitante puede leerlo. Contraseñas, claves, cookies y tokens jamás deben ir en ese archivo ni en variables `VITE_*`.

La compilación no habilita Mercado Pago, correo, OAuth ni integraciones por sí sola. Esos proveedores necesitan configuración separada. El adaptador de pagos implementado sigue limitado al entorno de desarrollo.

## Verificar antes de publicar

```sh
pnpm check
node scripts/audit-publication.mjs --self-test
pnpm audit:publication
pnpm --filter @klisteniapp/web exec playwright install chromium
pnpm test:e2e
```

La auditoría revisa el árbol publicable y los metadatos de assets; consultá la ayuda del script para revisar también una distribución compilada. No reemplaza una revisión de vulnerabilidades o de dependencias. Las pruebas de instancia se ejecutan aparte con una base desechable y nunca deben apuntar a una base de usuarios reales.

Los indicadores propios del operador se guardan en una política fuera del árbol público y se pasan con `--private-patterns /absolute/path/outside-repository/policy.json`. No los copies en fixtures negativos, regex de ejemplo o strings partidos dentro del detector. Con esa política, el auditor también reconstruye estáticamente literales con escapes, concatenaciones de literales y arrays de literales con `join()`; nunca ejecuta el código inspeccionado. No interpreta identificadores, llamadas arbitrarias ni valores calculados durante la ejecución, y falla si supera los límites del analizador. El CI genérico ejecuta las pruebas sintéticas del auditor; las reglas específicas del operador requieren pasar explícitamente su política externa.

El CI público ejecuta checks genéricos, no publica imágenes ni despliega instancias. El código público no incluye la configuración, credenciales, runbooks ni recuperación privada de ningún operador. Las licencias anatómicas deben acompañar sus modelos y renders; la licencia del código no las reemplaza.
