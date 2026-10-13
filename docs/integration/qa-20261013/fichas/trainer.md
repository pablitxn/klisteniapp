---
id: 2026-10-13-orchid-labs-klisteniapp-qa-trainer
title: QA Klisteniapp — B2B entrenador
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../b2b-trainer-qa-2026-10-13.md
created: 2026-10-13
---

# QA Klisteniapp — B2B entrenador

Pre-documentación pendiente de consolidación. Este archivo no es una entry registrada ni absorbida en Atlas. Fuente primaria: código y evidencia del repo owner; prueba local no demuestra despliegue.

## Summary

Inventario de rutas autorizadas, edición de dosis/versiones, asignaciones, seguimiento, conflicto/recuperación, medios autorizados, permisos/contextos y servicio pausado.

## Relevant Facts

- Fuente inmutable: rama `qa/b2b-trainer-20261013-cloud`, SHA `ed53bbc41054c20cbb0abb30c372513367487c19`, [PR fuente](https://github.com/pablitxn/klisteniapp/pull/4). Base común `7172041102a8a7029af5fb3e2527a1fa51611a86`; fecha de trabajo 2026-10-13.
- Correcciones incorporadas: Idempotencia con identidad estable del borrador y asignación evita dos rutinas/prescripciones cuando PostgreSQL confirma y se pierde la respuesta. Replays comparan autor, destino, versión y payload.
- Histórico: T01–T20 en matrices y cierres dirigidos; Chromium y WebKit con protocolos históricos distintos. Integración amplía a seis perfiles HTTP: 120 combinaciones previstas; resultado real en ../matrix.json.
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

- Fuente: [reporte del rol](../../../b2b-trainer-qa-2026-10-13.md).
- Integración: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Destino de intake existente: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidar fuente/entry usando templates vigentes y registrar en `atlas/catalog/sources.yaml`.
- Síntesis a conciliar: `atlas/wiki/klisteniapp.md`, intake `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisiones/preguntas sólo donde el intake lo exige.
- Atlas leído `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`; no escrito. No hay nuevo protocolo ni catálogo paralelo.
