# Publicación y operación de Klisteni

Esta release integra publicación estática y las miniaturas animadas del commit `09d7215` sobre la base `ac19b91`, conservando el modelo 3D y la persistencia local. Código canónico: [GitLab proyecto 35](https://gitlab.orchid-labs.xyz/orchid-labs/homelab/klisteniapp). Dominio: [klisteniapp.orchid-labs.xyz](https://klisteniapp.orchid-labs.xyz). La configuración no constituye evidencia de que una release ya esté activa; verificar el pipeline, digest y runtime después de cada promoción.

## Release reproducible

1. `pnpm install --frozen-lockfile --ignore-scripts` con Node 24+ y pnpm 12.7.0.
2. `pnpm check:all` y `node scripts/validate-anatomy.mjs`. Los 20 recorridos funcionales y de miniaturas usan Vite **preview** productivo; las pruebas de analytics construyen un bundle separado con UUID ficticio y collector interceptado.
3. Compilar `pnpm build` con las cuatro variables públicas de `apps/web/.env.example`. Ninguna credencial va en `VITE_*`. Turborepo incluye las cuatro variables en la clave de caché para no reutilizar un bundle de otro hostname/Website ID.
4. CI conserva `apps/web/dist` del job `quality`. `browser-tests` es un gate obligatorio. Kaniko publica exactamente ese artifact en una imagen runtime, sin Docker socket ni modo privilegiado, y produce `image.ref` y `image.digest`.
5. `smoke-image` ejecuta la imagen por digest y comprueba salud, fallback de privacidad, modelo, headers/cache y denegaciones del proxy. No genera una visita aceptada.
6. Promover el digest por Mycelium. Confirmar pod Ready, Argo Synced/Healthy, TLS, HTML y hashes, GLB realmente renderizado en escritorio/móvil, preservación local, analytics/retirada y observabilidad pública antes de dar la release por publicada.

La rama `codex/klisteniapp-public-release` requiere disparar manualmente `publish-image`; `main` publica después de los gates. El proyecto debe coincidir con `orchid-labs/homelab/klisteniapp`. La imagen y las herramientas CI están fijadas por digest; una actualización exige validación explícita. Las miniaturas versionadas se validan con `pnpm previews:check` sin regenerarlas. No instalar Blender ni descargar las fuentes anatómicas para construir la web: el GLB aprobado ya está versionado.

## Contrato runtime

Nginx escucha 8080, UID/GID 1000, sin escritura en `/etc` ni en la web. El deployment debe usar filesystem raíz readonly, `/tmp` writable limitado, capabilities DROP ALL y no-new-privileges. Salud: `GET /healthz`. No hay PVC ni backend de registros. Solo `/assets/*` lleva cache immutable; los modelos, miniaturas y manifests de nombre estable se revalidan con `no-cache`. `/privacy` y `/privacy/` usan SPA fallback; assets inexistentes devuelven 404.

La CSP restringe scripts y conexiones al mismo origen. Google Fonts está permitido únicamente en `style-src`/`font-src` y declarado en privacidad. Los estilos inline son necesarios para la UI/Three.js; no se permite script inline ni eval. No hay decoders o texturas externos en el GLB publicado.

## Analytics

Website ID público: `ac451943-95f5-4b3e-8c49-33d17c4f511c`. Hostname exacto: `klisteniapp.orchid-labs.xyz`. Proxy same-origin únicamente `GET/HEAD /umami/script.js` y `POST /umami/api/send`, upstream privado `10.66.66.10:443`, Host/SNI `umami.orchid-labs.xyz`, TLS verificado. Todas las rutas de administración permanecen inaccesibles desde el proxy público. El deployment debe permitir exclusivamente ingress del Traefik/túnel confiable: el header de IP de Cloudflare depende de esa frontera.

Controller adaptado de T3: tracker 3.4.0, auto-track desactivado, callback before-send que siempre cancela el transporte nativo, transporte propio abortable, sin Referer/cookies ni replay, payload reconstruido de constantes. Una única visita `/`, título `Klisteni`, por documento después de aceptación válida. No mide cambios de pestaña o acciones del usuario. `/privacy` no carga analytics; abrirla detiene el transporte, preserva el estado de práctica y pausa la demostración. Acceso directo a privacidad tampoco carga el GLB.

Consentimiento separado del historial: `klisteniapp.analytics-consent`, decisión/version/expiración de seis meses. DNT/GPC prevalecen. Expiración, hostname distinto, desarrollo, storage bloqueado o error de tracker/collector dejan analytics apagado. La retirada no borra solicitudes recibidas previamente.

Retención configurada para este Website ID: 90 días por job específico de Panopticon. Logs operativos centralizados: 14 días configurados. Estos plazos no prometen caducidad equivalente para backups o archivos locales. Nginx emite categorías fijas y no URLs/query/IP en su stdout; eso no convierte los logs Traefik/Loki en anónimos.

## Validación pública y rollback

Usar un contexto de navegador limpio: antes de elegir y tras rechazar/reload debe haber cero solicitudes `/umami/*`; aceptar debe producir un único POST 200 sanitizado; retirar debe quitar el tracker y detener nuevos envíos. Una visita controlada verifica recepción en el Website ID correcto, sin copiar IPs o datos visitantes al reporte. Confirmar /privacy directo y reload, formulario cardio, rutina, exportación y fallback sin WebGL. Las pruebas locales no acreditan DNS/TLS/proxy privado ni recepción real.

Observar el dashboard y sondas Klisteni en Panopticon, métricas de ingress/pod y logs. Para rollback, volver al digest anterior por GitOps y repetir smoke; en primera publicación, retirar solo la exposición Klisteni. No tocar túneles compartidos ni reiniciar WireGuard. El historial vive en el origen del navegador: mantener el hostname evita perder su acceso local entre releases.
