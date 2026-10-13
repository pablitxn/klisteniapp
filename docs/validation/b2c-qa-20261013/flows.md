# Matriz de flujos B2C

Estados: PASS = recorrido/aserciones ejecutados; FAIL = defecto reproducido;
BLOCKED = infraestructura necesaria impidio ejecutar; NOT RUN = no ejecutado.
El inventario no equivale a cobertura absoluta. `results.json` detalla cada caso
con su resultado por motor y viewport. Backend real y transporte simulado se
separan en la columna evidencia.

| Flujo | Estado final | Evidencia y alcance |
| --- | --- | --- |
| Invitacion dirigida → activar → login | PASS | API/DB reales en accounts; registro inicial tambien UI simulada |
| Enlace compartible → trial y limite agotado | PASS | API/DB reales; un cupo, token fuera de storage, no permisos admin |
| Invitacion vitalicia | PASS | API/DB reales, entitlement separado del rol |
| Link invalido, proposito incorrecto, expirado o incompleto | PASS | UI transporte simulado + API integration real |
| Recovery por token y preservacion de historial | PASS | Token local emitido por administrador fixture, password rotada; DB real |
| Solicitud publica de recovery / error / rate limit | PASS | UI con respuestas simuladas; no envio SMTP |
| Login / logout / local separado | PASS | DB real; perfil privado no derrama a storage local |
| Cambiar password / password actual incorrecta | PASS | UI + backend real, data conservada |
| Sesiones de otros dispositivos revocadas | PASS | Cambio de password revoca segunda sesion real; reinicio y login antiguo rechazado |
| Sesion vencida / siguiente cuenta | PASS | Cookie eliminada, refresh real, salud oculta y cuenta distinta vacia |
| Aislamiento A/B y segundo dispositivo | PASS | Cuenta B vacia, header de A rechazado 401; read-state real |
| Separacion B2B | PASS | API B2B devuelve 404 desde B2C, admin 403, check:b2b:boundaries; no prueba cruzada de UI B2B desplegada |
| Migracion local explicita y repetida | PASS | API/DB reales, original local conservado, sin duplicados |
| Copia completa v2 → cuenta pristine / export fiel | PASS | API/DB reales; datos exportados iguales al estado |
| Import personal invalido / cancelacion | PASS | Ninguna mutacion de revision; UI + DB |
| Limite 9 MiB de copia y 2 MiB de salud | PASS | Segunda ronda con UI y DB reales |
| Nombre/timezone invalidos y cero dias | PASS | Sin revision nueva; UI + DB |
| Rutina nombrada / copia / rutina activa | PASS | DB real; una copia tras doble clic real; reload |
| Plan semanal y zona Kiritimati/Honolulu | PASS | DB real, fecha de actividad en zona de cuenta y segunda sesion |
| Conflicto del plan con borrador preservado | PASS | Cambio real concurrente; requiere revision |
| Edicion de rutina orden/series/cancelar | PASS | Segunda ronda con UI y DB reales |
| Fuerza completa y doble envio | PASS | Una sesion persistida y todas las repeticiones exactas |
| Sesion fuerza activa y abandono | PASS | Segunda ronda con UI y DB reales |
| Cardio sin red / reload / reintento | PASS | DB real vacia antes, un registro tras reintento |
| Cardio respuesta perdida despues de commit | PASS | route.fetch() confirma backend, aborta respuesta; un registro tras reload |
| Yoga practica → tiempo realizado → historial | PASS | DB real; un tramo de 5s, snapshot y reload |
| Yoga edicion con respuesta perdida | PASS despues de fix | FAIL antes (B2C-01); snapshot exacto confirmado, una practica; DB real |
| Yoga cambio remoto distinto y copia | PASS | UI transporte simulado; regresion de store no reconoce version distinta |
| Yoga error de escritura, borrador retenido | PASS | UI transporte simulado; no spill a local/pending |
| Yoga expired: consulta/eliminar, sin agregar/editar/practicar | PASS | UI simulado + API integration real |
| Mi progreso vacio / historiales / sin XP por explorar | PASS | Segunda ronda con UI y DB reales |
| Catalogo ejercicios: busqueda/filtros/vacio | PASS | Segunda ronda con UI y DB reales |
| Mi cuerpo: busqueda y vacio | PASS | Segunda ronda UI/DB real, busqueda gluteos y vacio; visor excluido |
| Yoga biblioteca: busqueda/vacio/historial vacio | PASS | Segunda ronda con UI y DB reales |
| Salud corporal/perfil/medidas → editar/eliminar | PASS | UI simulado para CRUD exhaustivo; medida real persistida y reload |
| Salud inicial setup / conflicto | PASS | Draft preservado con transporte simulado; guardado real de perfil en accounts |
| Salud revision conflict y no storage fallback | PASS | UI transporte simulado + integration real |
| Salud JSON preview / confirmar / duplicados / futura | PASS | UI + DB real, export fiel; no mutacion antes de confirmar |
| Sueno, actividad, comida, suplementos, objetivos | PASS | UI y DB reales, cancelar cambios/eliminacion y eliminar comida sin perder otras colecciones |
| Salud sueno superpuesto / fuente / tiempos originales | PASS | UI simulado + unit/integration |
| Dashboard periodos y fuentes, sin cobertura inventada | PASS | UI simulado + pruebas de calculos |
| Apariencia guardada, draft del plan conservado | PASS | Modo real guardado; segunda ronda amplía reload |
| Privacidad back/forward y retorno al dialogo | PASS | UI + sesion real conservada |
| Cuenta trial/active/lifetime/expired | PASS | Entitlement real en DB local; fecha servidor |
| Cuenta expired: export/conservar/local, guardar deshabilitado | PASS | UI + DB reales; billing disabled |
| Cuenta expired: borrar con cancelar y 402 a escritura directa | PASS | Segunda ronda con UI y DB reales |
| Billing sandbox: checkout incierto, refresh, URL y cancelar | PASS | Respuestas de fixtures, sin solicitudes/pagos al proveedor |
| Return billing no concede entitlement | PASS | DB real active + UI simulado expired; query eliminada |
| Correo real, pagos reales, proveedor sandbox externo | NOT RUN | Prohibidos/fuera del fixture autorizado; no se prometen entregas |
| Telefonos fisicos / Safari en iPhone / Android fisico | NOT RUN | Solo emulacion tactil disponible |
| Autoría 3D / modelos / previews / snapshots GPU | NOT RUN | Excluidos expresamente por el usuario |
| Yoga partial, pause/resume, reorder y cancelacion de editor real | PASS | Segunda ronda, reloj controlado Playwright; 3s de practica segun el reloj virtual de la app y sin sumar la pausa; respuesta perdida del log, un registro |
| Yoga todos los lados/variantes bilaterales | NOT RUN | No se probaron todas las combinaciones de asanas/lados |
| Reload durante fuerza/yoga sin guardar | NOT RUN | Proteccion beforeunload observada en codigo; no se certifica restauracion de sesiones incompletas |
| Revocar otras sesiones sin cambiar password | NOT RUN | Boton inventariado; se verifica revocacion mediante cambio de password, no este boton independiente |
| Tema/idioma/paleta: todas las combinaciones | NOT RUN | Se prueba un modo y sus persistencias; no cada ES/EN/FR x paleta |
| Restore/datos desde storage corrupto con cuenta | NOT RUN | Unit coverage disponible; no se ejecutó UI de cada variante corrupta |
| CI/produccion/merge/deploy | NOT RUN | Sin escrituras ni acceso a esos sistemas |

No hay bloqueo de motor despues de reparar el setup. Los pasos NOT RUN no son
fallos de producto y conservan su alcance para la revision manual.
