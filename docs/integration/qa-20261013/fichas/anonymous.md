---
id: 2026-10-13-orchid-labs-klisteniapp-qa-anonymous
title: QA Klisteniapp — B2B anónimo
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../b2b-anonymous-qa-2026-10-13.md
created: 2026-10-13
---

# QA Klisteniapp — B2B anónimo

Pre-documentación pendiente de consolidación. Este archivo no es una entry registrada ni absorbida en Atlas. Fuente primaria: código y evidencia del repo owner; prueba local no demuestra despliegue.

## Summary

Marcas/sedes, website/catalog/medios/QR/plano textual, estados no publicados/archivados/ocultos, fallos/retry, entrada/login inválido, invitación inválida y rutas protegidas sin cuenta.

## Relevant Facts

- Fuente inmutable: rama `qa/b2b-anonymous-20261013-publicable`, SHA `32a801116ce211b56880b6782f4b66b5fc3ea19c`, [PR fuente](https://github.com/pablitxn/klisteniapp/pull/6). Base común `7172041102a8a7029af5fb3e2527a1fa51611a86`; fecha de trabajo 2026-10-13.
- Correcciones incorporadas: Contacto publicado por sede y medios referenciados en galería de marca se resuelven sin exponer borradores; front page no publicada no oculta sedes publicadas; QR/login/return y retry conservan contexto.
- Fuente incorporada es la variante publicable confirmada PR6; preserva código y QA textual, excluye evidencias binarias grandes originales. Histórico 42 casos×6=252; no acredita WebKit HTTPS ni login válido posterior al QR.
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

- Fuente: [reporte del rol](../../../b2b-anonymous-qa-2026-10-13.md).
- Integración: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Destino de intake existente: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidar fuente/entry usando templates vigentes y registrar en `atlas/catalog/sources.yaml`.
- Síntesis a conciliar: `atlas/wiki/klisteniapp.md`, intake `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisiones/preguntas sólo donde el intake lo exige.
- Atlas leído `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`; no escrito. No hay nuevo protocolo ni catálogo paralelo.
