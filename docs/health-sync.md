# Sincronización de salud: ruta propuesta y requisitos

Estado al **4 de octubre de 2026**: Klisteniapp permite registrar información de salud e importar su [JSON normalizado](health-import.md). **No hay un conector Android, vinculación Samsung/Google ni sincronización automática implementados.** Esta página documenta una propuesta y sus dependencias; las capacidades de terceros se contrastaron con documentación oficial en esa fecha. No se probó un Galaxy Watch ni un teléfono real.

## Ruta recomendada para Galaxy Watch8

```text
Galaxy Watch8
  → Samsung Health en el teléfono
  → Health Connect en ese teléfono
  → aplicación Android de Klisteni que lee los permisos elegidos
  → API autenticada de Klisteni
  → dashboard privado de la cuenta, accesible también desde la web
```

Health Connect almacena datos en el dispositivo y ofrece una API Android. Iniciar sesión con Google no concede acceso a ese almacén. La web actual necesita una aplicación Android que lo lea y envíe los registros autorizados a la cuenta; agregar únicamente un botón de OAuth no completa esta ruta. [Diferencia entre las APIs Android y la plataforma cloud](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq).

La recomendación es empezar con lectura hacia Klisteni y mantener las anotaciones manuales. El envío de cambios desde Klisteni hacia Samsung requiere otro contrato y permisos, y no forma parte de esta primera etapa.

## Qué necesitamos, en cinco pasos

1. **Comprobar el teléfono y los datos disponibles.** Anotar Android, Samsung Health y Health Connect instalados. Confirmar que una medición real del reloj aparece primero en Samsung Health y luego en Health Connect. Samsung configura este enlace en Samsung Health → Ajustes → Health Connect; el usuario elige qué compartir. [Configuración Samsung](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect).
2. **Crear e instalar el puente Android.** Una app pequeña puede encargarse de permisos, primera lectura, sincronización y estado, mientras la interfaz principal sigue siendo la web. Health Connect viene integrado desde Android 14; en versiones anteriores compatibles se instala aparte. Comprobar disponibilidad y características en ejecución, sin deducirlas solo de la versión. [Inicio y compatibilidad](https://developer.android.com/health-and-fitness/health-connect/get-started).
3. **Vincularlo a la cuenta Klisteni.** Diseñar un emparejamiento autenticado, por ejemplo un código de un solo uso aprobado desde la sesión de la cuenta. Emitir credenciales revocables del dispositivo con alcance de sincronización, caducidad y almacenamiento seguro. Esto es una propuesta: el backend actual todavía no las emite.
4. **Leer el historial accesible y después los cambios.** Permisos por categoría; permisos adicionales para historial anterior y segundo plano cuando estén disponibles. Mostrar rango realmente importado, campos ausentes y confirmación del servidor. La primera importación no puede prometer todo el historial de Samsung. [Lectura e historial](https://developer.android.com/health-and-fitness/health-connect/read-data).
5. **Mantener sincronización y visibilidad.** Ejecutar al abrir el puente, con un botón manual y trabajos periódicos; añadir reintentos, cola sin conexión y revocación. El dashboard debe distinguir última medición, última lectura del teléfono y último guardado confirmado. Un intento de envío no es un guardado.

Para publicar la app Android en Google Play se deben completar Data Safety y la declaración de aplicación de salud, justificar los tipos solicitados y presentar la política de privacidad correspondiente. Primero conviene validar una compilación de desarrollo con el teléfono real; distribuir públicamente requiere completar el proceso de publicación. [Publicación en Google Play](https://developer.android.com/health-and-fitness/health-connect/publish).

## Frecuencia y alcance reales

La sincronización automática será **periódica**, con demoras variables. WorkManager admite un intervalo mínimo de 15 minutos, pero Android determina cuándo ejecuta el trabajo según restricciones y optimizaciones; incluso puede aplazar u omitir una ejecución. Propuesta inicial: programar cada hora, además de sincronizar al abrir y bajo demanda, y medir el comportamiento real antes de ajustar la frecuencia. Esto no es una garantía de actualización cada hora. [Programación periódica](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work).

Samsung también controla la etapa reloj → teléfono: puede sincronizar al reconectar o abrir/actualizar Samsung Health, y el pulso continuo no se transmite inmediatamente por motivos de batería. La recepción de datos del reloj y la ejecución del puente son demoras distintas. Su documentación enumera peso, grasa corporal, pasos, pulso, sueño, ejercicio y nutrición; el alcance cambia con la versión. [Sincronización Samsung](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect).

Health Connect permite lecturas en segundo plano con `READ_HEALTH_DATA_IN_BACKGROUND` y comprobación de la característica. Sin ese permiso, ofrecer sincronización al abrir. Por defecto puede leerse desde 30 días antes de la primera concesión del permiso; `READ_HEALTH_DATA_HISTORY` amplía el acceso cuando está disponible y autorizado. Reinstalar revoca permisos y cambia esa referencia. Tener permiso no significa que Samsung haya transferido todo su historial. La guía Android actual admite segundo plano, aunque algunos artículos antiguos de Samsung aún afirman que solo se puede leer en primer plano. [Reglas actuales de lectura](https://developer.android.com/health-and-fitness/health-connect/read-data).

## Datos y diferencias que debe conservar el adaptador

| Información | Tratamiento propuesto |
| --- | --- |
| Peso y porcentaje de grasa | Importar observaciones disponibles, con fecha, unidad, origen e identidad estables. |
| Sueño | Conservar sesiones y fases del origen antes de resumir; evitar contar dos veces intervalos superpuestos. El JSON actual conserva un resumen, no todas las fases. |
| Pasos | Aplicar la agregación apropiada o una política explícita de origen; no sumar teléfono y reloj como si fueran actividad distinta. Android recomienda `aggregate()` para los pasos acumulativos. |
| Pulso | El contrato actual acepta resúmenes. Para analizar una sesión en detalle hay que ampliar el modelo para muestras con instante, intervalos y cobertura. |
| Comidas | Importar nutrientes conocidos y conservar los faltantes como ausentes; no convertir falta de registros en consumo cero. |
| Perímetros y suplementos | Seguir con registro manual mientras no exista un origen compatible verificado. |

[Lectura y agregación](https://developer.android.com/health-and-fitness/health-connect/read-data), [contrato actual de Klisteni](health-import.md).

La lista de Health Connect incluye `LeanBodyMassRecord`, pero no un tipo equivalente al campo de **masa muscular esquelética** de Klisteni; masa magra y músculo esquelético no son intercambiables. No rellenar `skeletalMuscleKg` con masa magra ni estimarlo por diferencia. [Tipos de Health Connect](https://developer.android.com/health-and-fitness/health-connect/data-types).

Samsung Health Data SDK sí expone `SKELETAL_MUSCLE_MASS` en kilogramos y otros campos de composición corporal. Es una alternativa posterior para una integración Samsung más completa, pendiente de comprobar datos reales. Para distribuir una app con ese SDK se requiere aprobación de Samsung y registro del paquete y su firma; el modo de desarrollo se limita a pruebas. [Composición corporal](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-body-composition-type/index.html), [proceso de Samsung](https://developer.samsung.com/health/data/process.html).

## Protocolo incremental pendiente

Health Connect entrega altas/correcciones mediante `UpsertionChange` y bajas mediante `DeletionChange`. Las bajas solo contienen el ID: hay que conservar la correspondencia con tipo y registro propio. Android recomienda tokens separados por tipo; un token sin usar caduca dentro de 30 días. Ante caducidad se necesita releer y reconciliar el rango accesible sin duplicados. [Cambios y recuperación](https://developer.android.com/health-and-fitness/health-connect/sync-data).

Diseño propuesto para Klisteni:

- Obtener un cursor antes de la primera lectura, paginar el historial y procesar después los cambios ocurridos durante esa lectura. Guardar cada cursor solo después de persistir el lote o dejarlo en una cola durable que garantice su reenvío.
- Identificar registros por cuenta, conexión, aplicación de origen, tipo e ID. Distinguir instante observado, modificación en origen y recepción. Enviar lotes idempotentes y devolver una confirmación verificable.
- Guardar altas y cambios mediante operaciones incrementales, y conservar marcas de eliminación para evitar que un reintento restaure datos borrados. No sobrescribir notas o correcciones del usuario con un cambio del proveedor: mantener ambas capas o presentar el conflicto.
- Al caducar un token, volver a leer una ventana autorizada y reconciliarla solo cuando la lectura sea completa. No inferir bajas por permisos revocados, páginas pendientes, ausencia de conexión ni datos fuera del rango legible; declarar la cobertura incompleta.
- Pausar la categoría cuyo permiso se revocó; separar desconectar de borrar el historial ya guardado. Al cambiar de cuenta, aislar credenciales, cola y cursores para impedir que se envíen datos de una persona a otra.

El backend observado guarda el objeto `health` completo en `personal_state.settings` mediante `PUT /api/me/health` y una revisión esperada. El importador JSON rechaza una identidad de origen cuyo contenido cambió. Eso protege las ediciones actuales, pero **no implementa** un protocolo automático de correcciones/bajas del proveedor. Faltan emparejamiento y credenciales de dispositivo, ingestión incremental, identidades y versiones de origen estructuradas, marcas de eliminación de salud y estado persistente de sincronización. Las marcas de eliminación de entrenamientos existentes no cubren los registros de salud. Código: [ruta API](../apps/api/src/http.ts), [persistencia](../apps/api/src/state.ts), [importador](../apps/web/src/lib/health-import.ts).

## Google Health API y Google Fit

Google Health API es una API cloud distinta, utiliza Google OAuth 2.0 y reemplaza la Fitbit Web API. Los permisos de salud son restringidos y requieren revisión. La documentación actual indica que **no se están incorporando proyectos nuevos**. Por eso no se adopta como dependencia de la primera integración. [Descripción](https://developers.google.com/health/about), [disponibilidad publicada](https://developers.google.com/health/get-started).

No sería correcto afirmar que solo puede contener datos de Fitbit/Pixel Watch: la referencia también contempla datos provenientes de Health Connect. Si se abre el acceso, habrá que validar categorías, procedencia y cobertura Samsung realmente disponibles en esa cuenta antes de ofrecer la vía cloud. [Orígenes de Google Health API](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list).

Google Fit no admite nuevas altas desde el 1 de mayo de 2024 y su retirada está anunciada para 2026; la FAQ consultada no fija un día exacto. Fitbit Web API finalizó soporte el 30 de septiembre de 2026 y tiene apagado previsto el 30 de octubre de 2026. No son la misma API ni el mismo calendario. [FAQ Google Fit](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq), [calendario Fitbit](https://developers.google.com/health/about).

## Verificación antes de habilitar la sincronización

Probar con datos autorizados del teléfono: primera lectura y paginación, permiso parcial y revocado, histórico mayor a 30 días si está disponible, lote repetido, corrección y eliminación en origen, interrupción de red, token caducado, cierre/reinicio de la app y cambio de cuenta. Comparar muestras e intervalos contra Samsung Health y Health Connect, anotando qué campos no llegan. Confirmar que el dashboard solo marca guardado después de la respuesta de la API.

Los gráficos personales utilizan datos de la cuenta para el propio usuario. La analítica de visitas del producto, como Umami, no debe recibir medidas, sueño, comidas, notas, objetivos, credenciales ni payloads del conector. Esto no impide analizar tendencias en el dashboard privado. El consentimiento de visitas y los permisos de sincronización son decisiones separadas.

Las pruebas del JSON actual verifican el contrato de Klisteni; no demuestran conexión a Samsung, cobertura histórica ni precisión del reloj. Para la sincronización, los criterios anteriores siguen pendientes hasta implementar el puente y probarlo con hardware real.
