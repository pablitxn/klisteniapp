---
id: 2026-10-13-orchid-labs-klisteniapp-qa-brand-admin
title: QA Klisteniapp — B2B administrador de marca
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../qa/b2b-brand-admin-2026-10-13.md
created: 2026-10-13
---

# QA Klisteniapp — B2B administrador de marca

Pre-documentación pendiente de consolidación. Este archivo no es una entry registrada ni absorbida en Atlas. Fuente primaria: código y evidencia del repo owner; prueba local no demuestra despliegue.

## Summary

11 rutas de gestión en ambas marcas y cuatro sedes, personas/accesos, unidades/lotes/QR, website/diseño/módulos/catálogo/traslados/medios/rutinas/versiones/asignaciones, cuenta y sesión. Modelos y previews excluidos.

## Relevant Facts

- Fuente inmutable: rama `qa/b2b-brand-admin-20261013`, SHA `a959fceb19a231e121a6355072dc3d0b0bc0505b`, [PR fuente](https://github.com/pablitxn/klisteniapp/pull/8). Base común `7172041102a8a7029af5fb3e2527a1fa51611a86`; fecha de trabajo 2026-10-13.
- Correcciones incorporadas: Roster por marca y acompañamiento por sede; slug duplicado 409 atómico; borradores de tema/sede recuperables con comparación; refresh de fragmento de invitación; selectores móviles; salida bloqueada hasta ACK en ejercicios/rutinas.
- Histórico: 108 grupos consolidados sobre a87daf4, con ignoreHTTPSErrors true. La fuente publicada a959fce desactiva la excepción sin reejecución histórica. La matriz nueva HTTP revalida 27×4 sin atribuirle validación TLS.
- Estado integrado y evidencia exacta por caso/motor/viewport: [matriz](../matrix.json), [informe](../README.md). Las fuentes permanecen ancestros; no se cerraron sus PRs.
- Runtime local Cloud Linux, PostgreSQL/medios sintéticos aislados. No datos reales, correos, pagos, producción ni teléfonos físicos.

## Decisions

- Instrucción explícita del usuario del 2026-10-13: sesiones QA por rol, corregir bugs reproducibles, integración para revisión manual posterior. Mantener marca blanca existente; previews y Blender diferidos.
- Integración con rama y PR draft independientes; sin merge a main ni deploy. Atlas permanece de lectura en esta tanda.
- HTTP loopback permitido para fixtures; no excepciones TLS ni cambios de CA/trust. No certificar Secure cookies/HTTPS a partir de estas pruebas.

## Open Questions

- Revisión manual humana, teléfonos/cámara/QR impreso y HTTPS con confianza válida pendiente.
- Yoga previews: receipt stale previo, checker conservado; no marcar gate completo verde ni regenerar capturas en esta tanda.
- Reconciliar esta ficha con las otras seis y la integración final antes de marcar entry absorbed. Las limitaciones específicas y no ejecutados siguen en la matriz y fuente primaria.

## Links

- Fuente: [reporte del rol](../../../qa/b2b-brand-admin-2026-10-13.md).
- Integración: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Destino de intake existente: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidar fuente/entry usando templates vigentes y registrar en `atlas/catalog/sources.yaml`.
- Síntesis a conciliar: `atlas/wiki/klisteniapp.md`, intake `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisiones/preguntas sólo donde el intake lo exige.
- Atlas leído `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`; no escrito. No hay nuevo protocolo ni catálogo paralelo.
