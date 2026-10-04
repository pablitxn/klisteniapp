# Invitaciones, acceso a la nube y suscripciones

La aplicación mantiene una capa gratuita en el dispositivo. Las cuentas agregan persistencia en el servidor: cada alta por invitación recibe **15 días de acceso a la nube**, contados desde la creación de la cuenta. El checkout de esta versión es exclusivamente de **desarrollo con Mercado Pago**. Que el código y las pruebas estén disponibles no acredita una cuenta de cobro configurada, un pago efectuado ni un despliegue.

## Alcance del producto

| Capacidad | Dispositivo gratuito | Cuenta con prueba, pago vigente o acceso vitalicio |
| --- | --- | --- |
| Catálogo, animaciones y entrenamiento | Sí | Sí |
| Rutinas, historial, metas y dashboards calculados con datos disponibles | Sí, guardados en este navegador | Sí, guardados en la cuenta |
| Exportación e importación personal | Sí | Sí |
| Persistencia y sincronización entre dispositivos | No | Sí |
| Sesión de cuenta persistente | No requiere cuenta | Sí; depende de una sesión válida |
| Sincronización externa de salud | Pendiente de implementar | Pendiente de implementar y de habilitar el proveedor |

Los conectores de salud no se venden como disponibles. El [estado de las integraciones](health-integrations.md) separa Google Health API de Health Connect y de la importación de archivos que ya existe.

Al vencer la prueba o el período pagado, se bloquean **las escrituras de datos personales en la nube**. La persona puede iniciar sesión, consultar, exportar y eliminar registros, gestionar el acceso y seguir usando la aplicación local. La eliminación de salud no permite agregar ni modificar los valores que se conservan. El vencimiento no borra su historial. No convertir el error `402 CLOUD_ACCESS_REQUIRED` en una confirmación de guardado ni reenviar indefinidamente escrituras que requieren pago.

El reloj y las fechas de acceso pertenecen al servidor. Cambiar la hora del navegador, modificar localStorage, recuperar una contraseña o volver a usar un enlace no reinicia la prueba. El instante de vencimiento es exclusivo: a esa hora termina el acceso.

## Invitaciones para amigos y publicaciones

Hay dos tipos de enlace:

| Tipo | Uso previsto | Límites |
| --- | --- | --- |
| Invitación dirigida a un email | Una persona concreta | Un uso, vence a las 24 horas; permite elegir prueba o acceso vitalicio |
| Enlace compartible | Amigos, una publicación o una comunidad | Cantidad máxima de altas y fecha de caducidad; concede siempre prueba de 15 días |

El administrador crea los enlaces desde la administración de cuentas. Un enlace compartible admite entre 1 y 10.000 altas y vence entre 1 y 90 días después de emitirse. Su vigencia habilita el registro; **no cambia los 15 días de cada cuenta**, que empiezan cuando esa persona se registra. Abrir o previsualizar un enlace no consume un cupo. La creación de la cuenta y el consumo del cupo se confirman en una transacción para impedir que dos altas simultáneas superen el máximo.

Los tokens son aleatorios y solo su hash se guarda en PostgreSQL. Se entregan en el fragmento de la URL (`#token=…`) y la web los retira de la barra. La API no devuelve el token nuevamente al listar invitaciones: copiar el enlace al crearlo. Revocar un enlace impide nuevas altas; no revoca las cuentas creadas anteriormente. Para bloquear una cuenta se utiliza su acción de suspensión.

Un enlace compartido públicamente no prueba que el destinatario controle el email que escribe. Esas cuentas conservan `emailVerified=false`; no usar ese email como identidad verificada ante otros proveedores. La recuperacion publica de contrasena por email se conserva, con respuesta uniforme y envio por SMTP; tambien sigue disponible la gestion del administrador, como se describe en [Cuentas y operacion](accounts.md).

## Acceso vitalicio

El acceso vitalicio es un derecho de uso de la nube, separado del rol administrador. Permite dar acceso a Pablo, Fio u otra persona sin otorgarles permisos de administración. El administrador puede concederlo al invitar o modificarlo para una cuenta existente.

Quitar ese acceso vuelve a evaluar la prueba y los períodos pagados originales: no inventa una nueva prueba. Suspender la cuenta continúa impidiendo iniciar sesión aunque tenga acceso vitalicio.

La migración `account-access-v1` conserva como vitalicias las cuentas de la beta que ya existen cuando se aplica por primera vez. Es una decisión de compatibilidad: el despliegue no empieza a cobrar a los usuarios anteriores. Repetir migraciones no vuelve vitalicias las cuentas creadas posteriormente. El primer administrador creado por bootstrap recibe acceso vitalicio.

## Mercado Pago: contrato y referencia

La referencia solicitada se localizó mediante Atlas en `montserrat-api`. Montserrat utiliza **Checkout Pro para un pago de activación**, no cobros recurrentes. Se conserva su patrón de consulta del recurso en el servidor, pero Klisteni utiliza la API de suscripciones. No se reutilizan su aplicación de Mercado Pago, sus credenciales, su base ni sus webhooks.

Referencias de implementación consultadas en Montserrat:

- `services/backend/src/Adapters/Infrastructure/MercadoPago/MercadoPagoClient.cs`: preferencia hospedada, referencia propia y consulta del pago.
- `services/backend/src/Adapters/WebApi/Controllers/MercadoPagoWebhooksController.cs`: validación HMAC y consulta canónica. Su excepción de aceptar notificaciones sin secreto no se adopta.
- `services/backend/src/Core/Application/UseCases/Activation/ReconcileActivationPayment/ReconcileActivationPaymentCommand.cs`: reconciliación al regresar del checkout y validación de pertenencia.

Klisteni crea `POST /preapproval` con estado `pending`, una referencia interna opaca, email del comprador de prueba, motivo, URL de regreso y recurrencia de **1 o 12 meses**, en ARS. Los precios se definen en el servidor; el navegador solo elige `monthly` o `yearly`. No se envían datos de tarjeta ni se crea un segundo período de prueba en Mercado Pago. El comprador completa el medio de pago en el `init_point` hospedado devuelto por el proveedor. [Suscripción con pago pendiente](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments), [referencia de creación](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/create-preapproval/post).

La autorización de la suscripción permite que Mercado Pago intente cobrar. **No demuestra que se haya cobrado.** Para actualizar un período pagado, la API consulta las facturas de la suscripción y el pago asociado. La búsqueda `GET /authorized_payments/search?preapproval_id=…&offset=…&limit=…` admite paginación; cada factura vincula `preapproval_id` con `payment.id`. [Facturas](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/get-authorized-payment/get), [filtros y paginación del SDK oficial](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/invoice/search/types.ts).

El servidor comprueba pertenencia, vendedor, importe, moneda, modalidad de prueba y estado confirmado del pago. Una URL de regreso, un cuerpo de webhook, una captura del checkout o el estado `authorized` por sí solos no conceden acceso. Las confirmaciones repetidas deben ser idempotentes. Las renovaciones extienden el período confirmado; un pago rechazado no lo extiende. Cancelar la recurrencia no elimina un período ya pagado.

Si se pierde la respuesta de creación, el servidor conserva la referencia antes de llamar al proveedor. Solo el primer intento puede enviar `POST /preapproval`; los siguientes buscan las suscripciones del comprador de prueba y comparan la referencia exacta. Si la creación no se puede localizar, aparece `CHECKOUT_UNCONFIRMED` y no se genera otro contrato. Volver a elegir el mismo plan permite recuperar la creación cuando el proveedor ya la muestra. No borrar ese registro ni cambiar su referencia para sortear el estado incierto: primero comprobar si existe en Mercado Pago. El header de idempotencia no se trata como garantía suficiente de evitar duplicados.

### Configuración

Además de la [configuración de cuentas](accounts.md), el proceso API utiliza:

| Variable | Valor o propósito |
| --- | --- |
| `BILLING_MODE` | `disabled` por defecto; `sandbox` para el checkout de desarrollo |
| `MP_ACCESS_TOKEN` | Credencial del vendedor de prueba de la aplicación dedicada |
| `MP_WEBHOOK_SECRET` | Secreto HMAC de esa aplicación; al menos 32 caracteres |
| `MP_SANDBOX_PAYER_EMAIL` | Email del comprador de prueba; reemplaza el email de la cuenta Klisteni en estas pruebas |
| `MP_MONTHLY_AMOUNT` | Importe mensual positivo en ARS, hasta dos decimales |
| `MP_YEARLY_AMOUNT` | Importe anual positivo en ARS, hasta dos decimales |
| `APP_ORIGIN` | Origen HTTPS de la web y API accesible para regreso y notificaciones |

No hay un modo `production` de cobros en este MVP. Activar `NODE_ENV=production` endurece la sesión y el servidor; no habilita cobros reales. Ningún secreto se coloca en `VITE_*`, el bundle, un enlace compartido o Git. No inferir el entorno por el prefijo del token: el adaptador verifica la identidad del vendedor y rechaza recursos de pago reales.

Rutas de cuenta autenticadas: `GET /api/me/access`, `GET /api/me/billing`, `POST /api/me/billing/checkout` con `{ "plan": "monthly" }` o `{ "plan": "yearly" }`, `POST /api/me/billing/refresh` y `POST /api/me/billing/cancel` con `{}`. El servidor deriva la cuenta de la sesión. Las escrituras del navegador también requieren el origen permitido.

En despliegue, mantener `BILLING_MODE` y los importes en la configuración de API, e inyectar `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` y el comprador de prueba desde un Secret dedicado mediante el mecanismo SealedSecrets existente. El ejemplo `deploy/accounts.example.yaml` no permite salida HTTPS pública: adaptar la política de salida o proxy de Mycelium para alcanzar `api.mercadopago.com:443`, además de DNS y PostgreSQL. Las NetworkPolicy estándar no filtran por hostname; usar las capacidades reales del clúster y verificar la salida antes de habilitar sandbox. No aplicar reglas genéricas a otros servicios. Los procesos de migración no necesitan consultar Mercado Pago.

`POST /api/billing/webhook` recibe notificaciones externas. Excluirlo de la protección basada en cookies del navegador no significa aceptar su contenido: requiere firma válida y reconcilia contra Mercado Pago. El resto de `/api` conserva su autenticación normal. Publicar por HTTPS con la ruta API correcta, sin caché ni fallback HTML.

### Particularidad de las notificaciones

Los temas relevantes son `subscription_preapproval`, `subscription_authorized_payment` y `payment`. El secreto de firma y la consulta canónica cumplen funciones distintas: el primero valida el aviso; la segunda confirma el estado de facturas y pagos. [Webhooks de suscripciones](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/notifications/webhooks).

La documentación oficial consultada el 4 de octubre de 2026 presenta una limitación: excluye suscripciones de la configuración de notificaciones mediante el panel y remite a configuración durante la creación, mientras el contrato de `PreApprovalRequest` del SDK no expone `notification_url`. Por eso la entrega automática debe verificarse con la aplicación y cuenta de prueba concretas. No declarar operativo un webhook solo porque existe la ruta. [Contrato del SDK](https://github.com/mercadopago/sdk-nodejs/blob/master/src/clients/preApproval/commonTypes.ts).

Si el proveedor no permite configurar el aviso o no lo entrega, usar **Actualizar estado** en la cuenta: la API vuelve a consultar facturas y pagos. No se habilita una excepción de firma ni una activación manual desde parámetros de retorno. La integración no está lista para cobros productivos mientras esa entrega y la reconciliación periódica sigan sin validación real.

## Prueba manual de desarrollo

1. Preparar una base de desarrollo aislada, ejecutar las migraciones y crear el administrador según [Cuentas y operación](accounts.md). Verificar primero altas, recuperación y persistencia sin pagos.
2. Crear una aplicación dedicada y cuentas de vendedor y comprador de prueba en Mercado Pago. Deben ser cuentas distintas y del mismo país; este adaptador espera Argentina. Utilizar sus datos exactos, no los de la cuenta personal. [Cuentas de prueba](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/test/accounts).
3. Proveer las variables anteriores y una URL HTTPS de desarrollo que enrute tanto la web como `/api`. No cambiar el origen del almacenamiento local existente para realizar esta prueba; usar un perfil de prueba separado.
4. Crear una invitación compartible, canjearla con un usuario Klisteni de prueba y confirmar que recibe 15 días. Elegir el plan mensual y comprobar que la salida abre el checkout de Mercado Pago y sigue mostrando que es una prueba.
5. Iniciar sesión allí como el comprador de prueba. Usar una tarjeta de la tabla oficial. Al verificar esta guía, Visa de crédito `4509 9535 6623 3704`, código `123`, vencimiento `11/30`, titular `APRO` y DNI `12345678` corresponden al escenario aprobado. Reabrir la tabla si cambia el formulario o la fecha; no usar una tarjeta real. [Tarjetas de prueba](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/additional-content/your-integrations/test/cards).
6. Regresar a Klisteni y actualizar el estado. Confirmar un pago consultado en el servidor con `live_mode=false`, importe y moneda esperados, y período pagado. Guardar solo evidencia sanitizada de IDs y estados, sin tokens, cookies, contraseñas ni datos personales.
7. Repetir la actualización y, cuando esté disponible, reenviar la notificación: el período no debe sumarse otra vez. Probar el anual con otra cuenta y confirmar 12 meses de recurrencia. El pago de prueba confirma el flujo inicial; no demuestra que una renovación futura ya haya sucedido.
8. Probar titular `OTHE` para rechazo y `CONT` para pendiente según la tabla del proveedor. Ninguno debe generar acceso pagado. Si el checkout de suscripciones no acepta uno de esos escenarios, registrar la limitación exacta sin cambiar a credenciales o tarjetas reales.
9. Cancelar la suscripción desde la cuenta y comprobar el estado en Mercado Pago y en Klisteni. El acceso de un pago aprobado ya vigente se conserva hasta su fecha final.

Verificar además con pruebas automatizadas y usuarios descartables: firma inválida, pago de otra cuenta, moneda/importe incorrecto, recurso real en sandbox, reembolso, cupo concurrente, enlace revocado, repetición de alta, fecha exacta de fin de prueba y exportación después del vencimiento. Las pruebas con un proveedor simulado no sustituyen los pasos 4 a 9.

## Publicación y recuperación

La release requiere la migración de cuentas y facturación antes de habilitar la interfaz. Conservar primero las cuentas anteriores mediante la migración de compatibilidad y verificar que un nuevo usuario empieza en prueba. Mantener `BILLING_MODE=disabled` hasta configurar y comprobar el entorno de desarrollo.

Ante un problema del proveedor, volver a `BILLING_MODE=disabled` detiene el checkout sin borrar historial, derechos vitalicios ni períodos previamente confirmados. Desactivar el adaptador **no cancela contratos existentes en Mercado Pago**: las suscripciones de prueba abiertas se cancelan explícitamente y se confirma la respuesta. No borrar tablas de facturación para hacer rollback; seguir el procedimiento de recuperación de la base de Klisteni y preservar las referencias necesarias para reconciliar.

Para cobrar dinero real harán falta una implementación explícita del modo productivo, credenciales y precios definitivos, validación del vendedor y entorno, entrega de notificaciones, recuperación periódica ante avisos perdidos, comportamiento acordado de reembolsos y pruebas completas. El MVP deja separadas esas decisiones de la invitación gratuita y del uso local.


## Verificacion de la release

El candidato de publicacion se prepara sobre la version ya desplegada y conserva
la recuperacion publica de contrasena. Se valida por separado del checkout de
trabajo, que contiene cambios de catalogo y anatomia fuera de esta publicacion.
Los resultados exactos de CI y del smoke publico se registran en el informe de
rollout; una prueba local no demuestra un pago real ni la entrega de webhooks.

