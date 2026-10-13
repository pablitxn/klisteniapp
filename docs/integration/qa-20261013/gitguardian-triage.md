# GitGuardian: disposición con evidencia, sin cierre externo

El aviso Generic Password del commit `cf73bbc607f1439f31f125f02c54e320a7a29bb8` se localizó en `scripts/b2c-admin-fixtures.ts:11`, constante `adminPassword`, mediante el [comentario del bot en PR3](https://github.com/pablitxn/klisteniapp/pull/3#issuecomment-6144725872). Incidente 38163411, ocurrencia 303868615. No se reproducen valores.

Disposición estática final: **not_actionable**, confianza alta, candidato a falso positivo de fixture sintético. Supersede el checkpoint `needs_review`, que carecía de la línea exacta. El blob del commit reportado y el integrado coinciden. Sólo lo importan el config Playwright de administración y su E2E; la imagen y el inicio productivo no incorporan el fixture. Requiere una DB loopback, schema UUID validado, search_path aislado, modo test, envío de correo desactivado, API ligada a loopback y limpieza del schema.

El check actual de la fuente es neutral y no tiene anotaciones; eso no fue usado como prueba de falso positivo. La correspondencia del bot con commit, archivo y línea sí permite esta disposición. No hay evidencia en el repo de reutilización productiva; no se auditó reutilización fuera del repo. El responsable puede revisar esa última condición antes de cerrar el incidente. No se cerró, suprimió ni alteró la alerta; no se cambiaron credenciales, permisos ni configuración GitGuardian.

El JSON adjunto conserva el contrato `triage-finding/v0`, fuentes, frontera y límites. Se aplicó la skill `codex-security:triage-finding`; dos referencias comunes no estaban disponibles y el límite se conserva en el JSON.
