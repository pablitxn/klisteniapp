# Perfil de salud e importación de registros

La sección **Salud** permite registrar medidas corporales, sueño, actividad, comidas y suplementos, y compararlos con objetivos personales. Estos datos pertenecen a la cuenta autenticada. La vista previa de un archivo se procesa en el navegador; recién al confirmar se guarda el resultado en la cuenta. Los datos no se envían a analítica.

## Qué funciona en esta versión

- Registro manual de observaciones y objetivos, con fecha y origen.
- Importación explícita de JSON en el formato `klisteniapp.health`, versión 1, descrito abajo.
- Vista previa de cantidad de registros nuevos, duplicados, categorías, orígenes y rango de fechas.
- Detección de duplicados y conflictos antes de guardar. Una importación inválida no guarda ninguna de sus filas.
- Exportación de los datos de salud dentro de la copia completa de la cuenta. Esa copia completa se restaura desde el importador de cuenta; no es el JSON de intercambio de esta página.

**No hay sincronización automática con Samsung Health ni Health Connect en esta versión.** El archivo JSON normalizado es un contrato de intercambio de Klisteniapp. No es el formato que Samsung o Android exportan directamente. Tampoco hay un conversor de CSV de Samsung ni un lector de `Health Connect.zip`. La plantilla descargable está vacía y nunca agrega medidas de ejemplo a tu perfil.

## Qué permite cada plataforma

La información se verificó en documentación oficial el 4 de octubre de 2026. La disponibilidad concreta depende del teléfono, versión de las aplicaciones, permisos y datos realmente medidos.

| Origen | Alcance documentado | Consecuencia para Klisteniapp |
| --- | --- | --- |
| Galaxy Watch → Samsung Health → Health Connect | El reloj entrega datos a Samsung Health en el teléfono; Health Connect funciona en Android móvil, no en Wear OS. | La futura conexión necesita un componente Android en el teléfono. El navegador actual no implementa ese puente. |
| Samsung Health → Health Connect | Samsung documenta peso, grasa corporal, altura, metabolismo basal, sueño, nutrición, ejercicio y frecuencia cardíaca, entre otros tipos. El alcance puede cambiar entre versiones. | No asumir que todo lo visible en el reloj está disponible en Health Connect. |
| Samsung Health Data SDK | `BodyCompositionType` distingue peso, grasa, masa libre de grasa, masa muscular esquelética, agua corporal y otras propiedades. | La masa muscular esquelética podría requerir este SDK o una exportación verificada. No convertir masa magra en músculo. |

Fuentes: [FAQ de Samsung sobre Health Connect](https://developer.samsung.com/health/health-connect-faq.html), [tabla de sincronización Samsung](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect), [inicio de Health Connect y SDK Android](https://developer.android.com/health-and-fitness/health-connect/get-started), [BodyCompositionType de Samsung](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-body-composition-type/index.html).

Health Connect contempla `LeanBodyMassRecord`, pero esa medida **no equivale a masa muscular esquelética**. La tabla de sincronización publicada por Samsung no enumera esta última; no se promete su disponibilidad a través de ese recorrido. El adaptador deberá inspeccionar qué registros llegan realmente. [Tipos de Health Connect](https://developer.android.com/health-and-fitness/health-connect/data-types).

## Obtener una copia de origen

Samsung indica este recorrido en el teléfono: Samsung Health → menú de opciones → Ajustes → Descargar datos personales → Descargar. Los archivos se pueden consultar en Mis archivos → Descargas → Samsung Health. Esta operación descarga una copia; no usar «Borrar datos personales». La página de soporte no define un contrato CSV/JSON estable suficiente para implementar un adaptador sin examinar una muestra. [Instrucciones oficiales de descarga](https://www.samsung.com/us/support/answer/ANS10001379/).

Android 14 o posterior permite configurar una copia de Health Connect desde Ajustes → Health Connect → Gestionar datos → Copia de seguridad y restauración. La copia es un ZIP, normalmente `Health Connect.zip`, orientado a restaurarse en Health Connect. **No se puede subir ese ZIP al importador actual.** [Copia y restauración de Health Connect](https://support.google.com/android/answer/15323271?hl=en).

Para un futuro adaptador de Samsung se necesita una muestra reducida y anonimizada del formato real: encabezados, unidades, identificadores y uno o dos registros por tipo, manteniendo zona horaria y estructura. Nunca reemplazar nombres de campos, inventar IDs por posición de fila ni adivinar si un valor es porcentaje, kilogramos o calorías. Una conversión debe informar qué tipos no admite, conservar el archivo original y rechazar los ambiguos.

## Formato normalizado soportado

La implementación es [health-import.ts](../apps/web/src/lib/health-import.ts); los rangos y tipos compartidos están en [health.ts](../packages/scene-schema/src/health.ts). El formato requiere todos estos campos:

```json
{
  "format": "klisteniapp.health",
  "version": 1,
  "exportedAt": "2026-10-04T12:00:00Z",
  "timeZone": "Europe/Paris",
  "records": {
    "measurements": [],
    "sleep": [],
    "activity": [],
    "nutrition": [],
    "supplements": []
  }
}
```

El archivo debe contener al menos una observación real. `exportedAt` es la fecha de generación del archivo. `timeZone` es una zona IANA explícita, aplicada a cada registro que no declare su propia zona. El importador conserva esa zona en los registros guardados.

Cada observación necesita:

| Campo | Significado |
| --- | --- |
| `id` | Identificador local estable, hasta 200 caracteres, único entre todos los registros y objetivos de salud. No usar el número de fila. |
| `date` | Fecha local de la observación, `YYYY-MM-DD`. Se conserva sin reinterpretarla a UTC. |
| `recordedAt` | Momento en que se capturó o creó el registro, en ISO 8601 con `Z` u offset. Puede diferir de la fecha observada si se cargó retrospectivamente. Debe mantenerse estable entre exportaciones del mismo registro. |
| `modifiedAt` | Momento opcional de una corrección manual, en ISO 8601 con `Z` u offset. No sustituye el instante original ni el origen del registro. No puede estar en el futuro. |
| `source.kind` | `manual`, `samsung-health` o `health-connect`. Es metadato declarado por el archivo, no una certificación de que el dispositivo haya medido el valor. |
| `source.externalId` | Obligatorio para importar: ID estable del registro en el origen, hasta 200 caracteres. Debe estar correctamente separado por aplicación y tipo de registro si el proveedor reutiliza IDs. |
| `source.device` | Etiqueta opcional del dispositivo, hasta 200 caracteres. |
| `timeZone` | Zona IANA opcional por registro; tiene prioridad sobre la del archivo. |
| `notes` | Notas opcionales, hasta 2.000 caracteres. |

### Unidades y campos por categoría

Los nombres de campo fijan las unidades. Los valores numéricos deben ser números JSON, no textos como `"81 kg"`. El importador no convierte unidades ni estima valores faltantes. Las claves desconocidas se rechazan para evitar descartarlas silenciosamente.

| Categoría | Campos |
| --- | --- |
| `measurements` | `weightKg`, `bodyFatPercent`, `skeletalMuscleKg`, `fatMassKg`, `bodyWaterPercent`; perímetros en centímetros: `waistCm`, `hipsCm`, `chestCm`, `neckCm`, `leftArmCm`, `rightArmCm`, `leftThighCm`, `rightThighCm`, `leftCalfCm`, `rightCalfCm`. Al menos una medida. |
| `sleep` | `durationMinutes` obligatorio: minutos efectivamente dormidos. Opcionales `startAt` y `endAt` juntos, `deepMinutes`, `remMinutes`, `awakeMinutes`, `score` de 0 a 100. Sueño más vigilia no puede exceder el intervalo; profundo más REM no puede exceder el tiempo dormido. |
| `activity` | Al menos uno: `steps`, `activeMinutes`, `activeEnergyKcal`, `restingHeartRateBpm`, `averageHeartRateBpm`, `maxHeartRateBpm`. `activityLabel` y `workoutId` permiten identificar o asociar una observación a un entrenamiento real de Klisteniapp cuando corresponde. |
| `nutrition` | `meal` y/o datos observados: `energyKcal`, `proteinG`, `carbsG`, `fatG`, `fiberG`. Una comida sin calorías conocidas conserva esos campos ausentes. |
| `supplements` | `name` y `taken` obligatorios. `dose` y `unit` son opcionales, pero se completan juntos. Son un registro de lo que se tomó o no se tomó, no una dosis recomendada. |

No colocar calorías totales del día en `activeEnergyKcal`: la energía activa y el gasto total son medidas distintas. El contrato actual tampoco admite masa magra, agua en litros, todas las fases individuales de sueño, series de pulsaciones crudas ni todos los micronutrientes. Un exportador debe reconocer estas limitaciones antes de convertir, conservar el original y describir las omisiones. No sustituirlos por una medida parecida.

Ejemplo **sintético y exclusivamente explicativo**, para colocar en `records.measurements` después de reemplazarlo por un registro real:

```json
{
  "id": "measurement-example-1",
  "date": "2026-10-03",
  "recordedAt": "2026-10-03T09:00:00+02:00",
  "timeZone": "Europe/Paris",
  "source": {
    "kind": "samsung-health",
    "externalId": "REEMPLAZAR-POR-ID-REAL",
    "device": "Galaxy Watch 8"
  },
  "weightKg": 81.5,
  "bodyFatPercent": 24.2,
  "skeletalMuscleKg": 32.1
}
```

### Duplicados, conflictos y límites

La identidad de origen es la terna **categoría + `source.kind` + `source.externalId`**. Reimportar esa identidad con el mismo contenido no agrega un registro. El orden de las claves JSON, el ID local y distintas representaciones del mismo instante con offset no cambian esa comparación. La primera identidad local guardada se conserva. Los demás datos —incluidas notas, dispositivo y zona horaria— deben coincidir.

Una misma identidad con valores diferentes es un conflicto: se rechaza el archivo completo y no se reemplaza el registro anterior. El usuario debe revisar qué versión conservar. Tampoco se admite reutilizar un ID local para otro origen o categoría. Orígenes distintos permanecen separados aunque sus valores coincidan; el importador no puede inferir que representan la misma medición.

Las correcciones manuales conservan la identidad de origen y el momento original, y agregan `modifiedAt`. Volver a importar una versión anterior debe provocar un conflicto, no deshacer la corrección. Las notas o la etiqueta del dispositivo también forman parte del contenido protegido por esta comparación.

El límite de archivo es **2 MiB en UTF-8** y **10.000 registros totales por importación**. La cuenta admite como máximo 10.000 observaciones por categoría. Las fechas de observación futuras, instantes futuros, fechas de calendario inexistentes, intervalos inconsistentes, valores fuera de rango y campos desconocidos rechazan la importación. La API vuelve a validar al guardar.

## Procedimiento de importación y recuperación

1. Exportar una copia de la cuenta desde sus ajustes antes de modificar un historial que ya contiene datos importantes.
2. Preparar el JSON con registros reales y conservar el archivo de origen. La plantilla muestra la estructura; no realiza la conversión.
3. En Salud, elegir el JSON. Comprobar el rango, las categorías y los conteos de la vista previa.
4. Confirmar la importación. El guardado usa la revisión de cuenta que se revisó; si la cuenta cambia mientras tanto, volver a generar la vista previa.
5. Comprobar la confirmación de guardado y el historial. Una vista previa correcta no implica que la API haya guardado los datos.
6. Ante un error, conservar el archivo y corregir el campo o conflicto señalado. No reducir todos los valores a cero ni eliminar filas a ciegas. Los registros previos permanecen intactos si se rechaza el archivo o la API no confirma el guardado.

Los suplementos no se traducen a recomendaciones automáticas y los objetivos no prescriben un déficit calórico. Las mediciones de composición corporal y los resúmenes sirven para seguir tendencias declaradas, sin establecer diagnósticos ni atribuir un cambio corporal a un ejercicio específico. Samsung también limita el propósito del Data SDK a bienestar y fitness. [Alcance del SDK](https://developer.samsung.com/health/data/overview.html).

## Trabajo pendiente para sincronización Android real

El puente deberá usar el SDK Android y solicitar únicamente los tipos de datos que el usuario elija. También deberá comprobar disponibilidad, permisos revocados y qué historial está realmente accesible. Por defecto, Health Connect limita la lectura de otros orígenes a los 30 días anteriores al primer permiso; la lectura de historial anterior requiere un permiso adicional disponible según la versión. No prometer «todo el historial» antes de verificarlo. [Lectura e historial en Android](https://developer.android.com/health-and-fitness/health-connect/read-data).

La lectura en segundo plano tiene permisos adicionales y compatibilidad que deben verificarse; no se debe extrapolar la restricción histórica de primer plano que aparece en publicaciones antiguas. [Permisos y tipos actuales](https://developer.android.com/health-and-fitness/health-connect/data-types).

El puente debe conservar IDs y origen de aplicación, paginar lecturas, convertir unidades explícitamente, separar energía activa de total y tratar correcciones o eliminaciones como cambios revisables. Su primera versión puede producir este JSON y usar la vista previa existente. Una sincronización posterior deberá agregar consentimiento, estados de última lectura y último guardado, control de revisión y manejo de cambios de cuenta; los datos de salud no deben incorporarse a eventos de analítica.

Para validar un adaptador hace falta probarlo con un teléfono y datos autorizados reales. Los tests actuales prueban el contrato normalizado, sus límites, el rechazo atómico y la deduplicación; no acreditan conexión a un reloj, exactitud de sus sensores ni fidelidad de un formato de Samsung aún no inspeccionado.

```sh
node --test apps/web/test/health-import.test.ts
```

## Verificación reproducible

```sh
# Validación del dominio y el contrato de intercambio
pnpm --filter @klisteniapp/scene-schema test
pnpm --filter @klisteniapp/web exec node --test test/health-store.test.ts test/health-import.test.ts test/account-api.test.ts

# Formularios, objetivos, importación, conflictos y vista móvil en puerto 43174
pnpm --filter @klisteniapp/web exec playwright test --config playwright.health.config.ts

# Aislamiento de cuentas y persistencia real; requiere PostgreSQL descartable
# TEST_DATABASE_URL debe estar configurado en el entorno, nunca apuntar a producción.
pnpm --filter @klisteniapp/api exec node --test --test-concurrency=1 tests/*.test.ts
pnpm test:accounts

# Comprueba además que los datos de salud no llegan a la visita de analytics
pnpm test:analytics
```

La suite específica de salud usa una compilación temporal y el puerto 43174 para no interferir con el visor anatómico. Sus datos son ficticios y sus respuestas de cuenta están interceptadas; la persistencia real se verifica por separado en la suite de cuentas y las pruebas de API. Las pruebas no acreditan una sincronización con Samsung ni un despliegue en producción.

La arquitectura actualizada, los permisos y las diferencias entre Health Connect y las APIs cloud están detallados en [Sincronización continua](health-sync.md). El [dashboard personal](health-dashboard.md) utiliza los registros que ya están guardados en la cuenta.

## Capacidad del historial

El estado completo de salud tiene un máximo acumulado de 4 MiB de JSON UTF-8, además del límite de 2 MiB por archivo normalizado. Se valida el resultado de cada fusión: repartir un historial entre varios archivos no evita este máximo. Si una importación lo supera, no se guarda ningún registro ni se cambia la revisión. El límite deja margen bajo los 5 MiB de la petición de guardado para seguir corrigiendo o eliminando registros.

Al restaurar una copia completa desde Ajustes, una observación vinculada a un entrenamiento ausente se conserva sin esa asociación. Los entrenamientos ya eliminados no se recrean y los vínculos históricos existentes en la cuenta se mantienen. Esta normalización no permite crear vínculos nuevos inválidos desde los formularios de salud.
