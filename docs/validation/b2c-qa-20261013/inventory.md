# Inventario B2C previo a seleccionar casos

Revision inicial 7172041102a8a7029af5fb3e2527a1fa51611a86. Inspeccionado 2026-10-13.

Fuentes: AppRoot.tsx, App.tsx, account-route.ts, SettingsPanel.tsx, AccountPanel.tsx,
Forms.tsx, YogaPage.tsx, YogaPracticeEditor.tsx, YogaSession.tsx, HealthPage.tsx,
Progress.tsx, BillingPanel.tsx; docs/accounts.md, subscriptions.md, ui-iteration.md,
roadmap-implementacion.md. Atlas wiki/klisteniapp.md y politica source-of-truth.

## Rutas

- `/`: app B2C instance; `?account=login` abre cuenta, `?billing=return` abre billing.
- `/privacy`: politica y preferencias de privacidad; retorno/back/forward.
- `/account/activate`: invitacion dirigida, token en fragmento retirado de URL.
- `/account/join`: enlace compartible limitado; email/nombre/password/confirmacion.
- `/account/recover`: nueva password con token efimero.
- `/account/forgot-password`: solicitud generica; SMTP deshabilitado en fixture.
- Las seis areas de `/` son estado de UI, no rutas historicas independientes.
- `/app`, `/manage`, `/g/:slug` pertenecen a B2B y no son capacidades de B2C.

## Acciones accesibles

| Area | Acciones y estados a cubrir |
| --- | --- |
| Mi rutina | elegir ejercicio, consultar instrucciones/tecnica/variantes, editar orden/agregar/quitar/series, guardar/cancelar; comenzar, registrar repeticiones, descanso/saltar, completar, confirmar abandono; registrar cardio |
| Ejercicios | buscar, filtros patron/dificultad/equipo, limpiar, vacio, abrir ficha y agregar a rutina |
| Mi cuerpo | buscar/filtrar regiones, expandir, enlaces a ejercicios/movilidad/yoga; visor excluido por alcance |
| Yoga | explorar/buscar/filtros, ficha educativa; crear/editar/copia/eliminar practica, ordenar/agregar/quitar pasos y duracion/lado; iniciar/pausar/reanudar/siguiente/finalizar/abandonar, guardar/eliminar historial |
| Mi progreso | vacio, historiales fuerza/cardio/yoga y resumen semanal, eliminar con confirmacion/cancelar; no otorgar progreso a exploracion/abandono |
| Mi salud | resumen y periodos/fuentes, cuerpo/perfil/mediciones, sueno/actividad, comidas/suplementos, objetivos; agregar/editar/eliminar/cancelar, validacion, conflicto; import JSON normalizado, template, preview, confirmar, deduplicacion, limites |
| Cuenta y planificacion | login/logout, trial/lifetime/paid/expired, nombre/timezone, seleccionar rutina nombrada/copiar, dias y fecha efectiva; migracion local explicita; cambiar password/revocar otras sesiones; permisos sin admin |
| Billing | estado/planes, crear/reanudar sandbox, refresh/cancel; retorno no concede acceso; proveedor deshabilitado en backend real, mocks sandbox sin conexion externa |
| Apariencia | ES/EN/FR, paleta, modo; persistencia cuenta y conflicto |
| Datos | export cuenta, JSON v1/v2, restaurar historial y opcional settings, cancelar, invalidos, eliminacion; preservar datos locales separados |
| Configuracion inicial | perfil/medicion opcionales, omitir/repetir; borradores y conflictos |
| Privacidad | consentimiento y retiro local; enlaces, foco y scroll del modal |

## Casos transversales

Happy path, vacio, validacion, error, doble envio, reload/back/forward, perdida de
respuesta, cancelacion, sesion expirada, revision concurrente, cuenta A/B, segundo
dispositivo y timezone. Verificar persistencia por API real y export; mocks se
identifican aparte. No test de telefonos fisicos ni autoría/preview/modelos.
