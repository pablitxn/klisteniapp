# Integracion QA Klisteni — checkpoint de trabajo

Rama `qa/klisteni-integration-20261013`, worktree `/workspace/klisteni-integration-20261013`.
Main remoto verificado `7172041102a8a7029af5fb3e2527a1fa51611a86`.
Fuentes inmutables y PR2–8: `sources.json`. Todas son ancestros de la integracion;
las ramas originales y sus PRs se conservan. Anonimo usa la variante publicable
confirmada por el usuario; la rama original/evidencia grande no estaba publicada.

Resoluciones iniciales: union de exclusiones de specs instance/admin en config demo;
union de configs tipadas admin/visitor/member, luego inclusion de todos los configs
`playwright*.config.ts`. Esto descubrio un tipo WebServerConfig no exportado en el
config extra B2C; se reemplazo por guardia sobre el array real de servidores.
Stores B2C combinaron recuperacion durable/importacion del visitante con confirmacion
exacta de respuesta perdida de yoga. ProgramEditor combina ID estable de creacion
con bloqueo de salida hasta ACK; Invitation combina consentimiento de identidad
existente y refresh de token por hashchange/popstate. No se descartaron regresiones.

Harness nuevo `scripts/b2b-integration-e2e-server.mjs` y config HTTP de integracion:
HTTP ficticio por proxies restringidos en loopback, schemas UUID y medios desechables,
marcas separadas y origen validado. No usa TLS, ignoreHTTPSErrors ni flags SPKI,
CA/trust/credenciales del sistema. Auth conserva el limiter de producto (10/60s).
HTTP no acredita cookies Secure, TLS ni produccion. La cobertura HTTPS del source
admin B2B publicado a959fce estaba pendiente; no se reutiliza como nueva evidencia.

Comprobado hasta este checkpoint: lint global 14/14 y formato, tipos 14/14 con todos
los configs incluidos. Smoke admin B2B Chromium 320 HTTP: 4/4 (44 rutas de marcas/sedes,
back/forward, Personas/permisos y modulos scoped). Tests globales corriendo con bases
B2C y B2B ficticias distintas; matriz completa y gate Yoga aun pendientes.

Próximo: concluir tests, revalidar matrices afectadas HTTP/mobile/desktop; resolver
fallos reales, preparar informe unico/fichas de predocumentacion pendientes de Atlas,
y publicar PR DRAFT. Atlas sin cambios de contenido, head27ae86c.

## Checkpoint recuperable solicitado

Siete fuentes incorporadas en merges locales, ultima base de merges `4f903962094bcc7069891d7aba7ad8683544d44c`. Sin conflictos Git pendientes. Lint/tipos globales 14/14 y tests globales 14/14 completados (601 tests, cero skips con ambas DB aisladas). Build global instance 16/16 completado. UI admin B2C 84/84 completada. Autogestion B2C sigue en sexto perfil; admin B2B nueva matriz 108 en curso.

Intentos admin B2B conservados: primer intento HTTP no soportaba CONNECT de Playwright; segundo 10 PASS, fallos por `crypto.randomUUID` ausente en origen HTTP ficticio y cancelacion. No son evidencia de TLS ni fallos de producto confirmados. Fixture opt-in de UUID Web Crypto para esta matriz HTTP, sin elevar el origen a secure context ni cambiar cookies. Tercera corrida confirma los cuatro primeros casos, incluyendo ACK de programas, y continua. Gates previews fallaron; pendiente contraste exacto con baseline, sin regenerar assets. GitGuardian: `needs_review` documentado en JSON redacted; candidato fixture aislado byte-identico al commit reportado, check neutral sin anotaciones, falta finding/path/line exactos. No se cerro ni altero la alerta.

## 13:01 UTC — avance verificado, no bloqueo

Codigo/harness06a13ee. Socio96/96; entrenador120/120; anonimo252/252 consolidado tras WebKit126/126 en DB propia; visitante216/216; adminB2C84/84; selfservice288/288 consolidado tras Yoga6/6. Ultimos checks: lint14, tipos14, tests602/zero skips (raiz26), build16. AdminB2B previo106/108: snapshot real de destinatarios evidencia carga async y traza WebKit identifica PeoplePage404 tras reemplazo de dist por build global. Regresion del gateway5/5 y fixture con copia fija del build. Nueva corrida completa108 activa; resultados anteriores intactos. README/matrix son autoridad del estado mas reciente. Checkpoint compartido /workspace/shared/klisteni-integration-checkpoint.md.

## Cierre QA — 1164 combinaciones aprobadas

Ultimo harness2822dec. Nueva corrida fija admin107/108; traza identifica Load request cancelled de imports iniciales antes de descargar el documento, luego mismos archivos200. El inventario ahora espera titulos reales de cada seccion y contenido tras history/reload, sin filtrar erroresJS. Reejecucion8/8 en cuatro perfiles; admin108/108 consolidado. Matriz final1164 PASS; previos44 runs retenidos, 3442 capturas/trazas con hashes. Global final lint/tipos14/14, tests602/zero skips; build16/16 y gateway5/5 sobre06a, sin cambios posteriores de producto. Siete archives locales; grandes binarios fueraGit. Rama remota96cb839 confirmada en checkpoint; PRdraft rechazado por auto-review (instruccion no publicarPRtodavia), autorizacion explicita solicitada y pendiente, cero PRs confirmado. Cierre documental local y actualizacion fast-forward de rama pendientes de registrar; sin merge/deploy/Atlaswrites.

Limpieza final comprobada: cero schemas no sistemicos/public en las cuatro DB de QA usadas. Fixture servers/browser jobs terminados; PostgreSQL propio permanece para reproduccion. Los siete tar.gz coinciden con tamaño/SHA256 registrados. Todos los JSON y links primarios de fichas validos. Matriz JSON compacta para lectura programatica; flows.md conserva tabla humana completa. No mas cambios funcionales tras2822dec.
