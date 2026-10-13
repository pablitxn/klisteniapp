---
id: 2026-10-13-orchid-labs-klisteniapp-qa-selfservice
title: QA Klisteniapp — B2C usuario autogestionado
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../validation/b2c-qa-20261013/README.md
created: 2026-10-13
---

# QA Klisteniapp — B2C usuario autogestionado

Pre-documentación pendiente de consolidación. Este archivo no es una entry registrada ni absorbida en Atlas. Fuente primaria: código y evidencia del repo owner; prueba local no demuestra despliegue.

## Summary

Invitación/activación, recuperación/login, rutinas nombradas y plan semanal, zona horaria, cardio/fuerza/yoga, salud/progreso, import/export, trial/activa/expirada y límites de escritura. Billing únicamente fixtures.

## Relevant Facts

- Fuente inmutable: rama `codex/qa-b2c-selfservice-20261013`, SHA `640ec502b0eb09b0675defe910492980afd00709`, [PR fuente](https://github.com/pablitxn/klisteniapp/pull/2). Base común `7172041102a8a7029af5fb3e2527a1fa51611a86`; fecha de trabajo 2026-10-13.
- Correcciones incorporadas: Respuesta de yoga perdida tras commit: el replay 409 se confirma con lectura canónica exacta por cuenta; no se duplica el registro ni se pierde el borrador.
- Histórico: 288 combinaciones (48×6), ampliación activa 6/6 y persistencia de salud 3/3. Integración nueva: ver ../matrix.json; no reutilizar el histórico como evidencia del merge.
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

- Fuente: [reporte del rol](../../../validation/b2c-qa-20261013/README.md).
- Integración: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Destino de intake existente: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidar fuente/entry usando templates vigentes y registrar en `atlas/catalog/sources.yaml`.
- Síntesis a conciliar: `atlas/wiki/klisteniapp.md`, intake `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisiones/preguntas sólo donde el intake lo exige.
- Atlas leído `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`; no escrito. No hay nuevo protocolo ni catálogo paralelo.
