# Integraciones de salud y acceso a la nube

Estado contrastado con fuentes oficiales el **4 de octubre de 2026**. El dashboard, las metas y la importación del [JSON normalizado](health-import.md) están disponibles en Klisteni. **No hay una conexión automática con Google Health, Health Connect o Samsung implementada.** La cuenta con acceso a la nube prepara la persistencia de futuras integraciones; pagar o tener acceso vitalicio no habilita un proveedor que todavía no está integrado.

## Dos rutas distintas

| Ruta | Dónde se obtienen los datos | Dependencia pendiente |
| --- | --- | --- |
| Google Health API | API cloud de Google con OAuth 2.0 | Admisión del proyecto, configuración y autorización del proveedor; implementación del conector |
| Health Connect | Almacén del teléfono, mediante API Android | Aplicación Android de Klisteni, permisos y protocolo de sincronización |

Iniciar sesión con Google no concede permisos sobre Health Connect. Tampoco demuestra que los datos de un reloj estén disponibles en Google Health API. La [propuesta Android existente](health-sync.md) conserva el recorrido Samsung Health → Health Connect → aplicación Android → cuenta Klisteni y sus requisitos de prueba con un teléfono real.

## Google Health API: disponibilidad real

Google Health API es una API web nueva que utiliza Google OAuth 2.0. Al revisar la documentación oficial, el aviso de disponibilidad dice: **“we are not onboarding new projects at this time”**. La integración de un proyecto nuevo no puede prometerse activa hasta que Google habilite ese acceso. La ruta no depende de restaurar Google Fit ni de usar la API antigua de Fitbit. [Disponibilidad publicada](https://developers.google.com/health/get-started).

Las instrucciones públicas permiten preparar el trabajo: proyecto Google Cloud, API habilitada, cliente OAuth de tipo web, URI de retorno y usuarios de prueba. El ejemplo de lectura utiliza el permiso `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly` y `GET https://health.googleapis.com/v4/users/me/dataTypes/exercise/dataPoints`. Esto acredita la existencia del contrato, no que un proyecto Klisteni tenga acceso ni que todas las categorías del dashboard estén cubiertas. [Codelab oficial](https://developers.google.com/health/codelabs/make-your-first-api-call).

## Camino de implementación cuando exista acceso

1. **Confirmar el proyecto habilitado.** Completar los pasos del proveedor y una lectura real con una cuenta autorizada. Registrar las categorías, procedencias, intervalo histórico y permisos disponibles. No dar por completo el catálogo de salud basándose en una respuesta de ejercicios.
2. **Agregar autorización separada.** Vincular el permiso de salud desde una sesión Klisteni válida y con acceso a la nube. Guardar el estado OAuth de un solo uso en el servidor, validar el retorno y limitar permisos a las categorías ofrecidas. La autorización de salud no cambia el rol ni el plan del usuario.
3. **Guardar credenciales en el servidor.** Cifrar tokens con una clave fuera de la base y de Git; no enviarlos a localStorage, al export personal ni a analytics. Solicitar acceso offline solo para la sincronización acordada. Google recomienda renovar tokens cuando hacen falta y evitar renovaciones masivas programadas. [Acceso y autorización](https://developers.google.com/health/migration/data-access).
4. **Normalizar sin inventar datos.** Conservar ID y modificación de origen, unidades, zona horaria y procedencia; paginar hasta completar la ventana. Implementar correcciones, eliminaciones y cursores antes de llamar automática a la sincronización. El importador actual es una operación de archivo y no representa ese protocolo incremental.
5. **Aplicar el acceso a la nube.** La comprobación del servidor debe bloquear nuevas ingestas al vencer prueba o pago, conservando lectura y exportación del historial. Renovar una suscripción no renueva permisos revocados en Google.
6. **Ofrecer desconexión y borrado por separado.** Revocar tokens y detener trabajos al desconectar; eliminar datos solo cuando la persona elija esa acción. Aislar credenciales, colas y cursores por usuario y conexión.
7. **Probar los límites reales.** Permiso parcial/revocado, token vencido, paginación, lote repetido, corrección, eliminación, cambio de cuenta, falta de acceso cloud y recuperación tras una falla. Comparar el resultado con la cuenta origen sin registrar medidas personales en los logs.

La interfaz debe mostrar **Pendiente de habilitación** hasta que autorización, lectura, persistencia y revocación estén probadas. Un botón de conexión, un token emitido o una respuesta exitosa sin datos no justifican mostrar “sincronizado”. La última medición, la última consulta y el último guardado confirmado son instantes distintos.

## Lo que se puede usar ahora

Continuar con registros manuales, metas, dashboards y archivos normalizados. En modo local permanecen en el navegador; en una cuenta con prueba, período pagado o derecho vitalicio se pueden guardar en la nube. Se conserva la separación entre el consentimiento opcional de analytics y la autorización para datos personales de salud. Los valores del dashboard, notas, rutinas, credenciales y respuestas del proveedor no se envían a Umami.
