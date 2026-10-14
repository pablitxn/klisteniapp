---
id: 2026-10-13-orchid-labs-klisteniapp-qa-visitor
title: QA Klisteniapp — B2C local visitor
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../qa-b2c-visitor-local-2026-10-13.md
created: 2026-10-13
---

<a id="qa-klisteniapp--b2c-visitante-local"></a>
# QA Klisteniapp — B2C local visitor

Pre-documentation awaiting consolidation. This file is neither a registered nor
absorbed Atlas entry. Primary source: owner-repository code/evidence; local testing
does not establish deployment.

## Summary

Onboarding/languages-theme/routines-plan-timezone/cardio-strength-yoga/health/import-export, storage quota/corruption, absence of visitor API writes. Demo/instance are distinct scenarios.

## Relevant Facts

- Immutable source: branch `qa/b2c-visitor-local-20261013`, SHA `d35365c69df92eeddca3d534c6622c18a925a17d`, [source PR](https://github.com/pablitxn/klisteniapp/pull/7). Common base `7172041102a8a7029af5fb3e2527a1fa51611a86`; work date 2026-10-13.
- Incorporated corrections: v2 export retains routine preferences without activity; failed storage deletion retains row; confirmed import recovers corrupt copy with backup; dl semantics/yoga-family accessible name/mobile WebKit selector.
- Historical: 18 cases × six profiles × two modes. Integration reruns both modes; see ../matrix.json. 3D authoring/renderers not tested.
- Integrated status/exact case-engine-viewport evidence: [matrix](../matrix.json), [report](../README.md). Sources remain ancestors; their PRs were not closed.
- Local Cloud Linux runtime, isolated synthetic PostgreSQL/media. No real data/mail/payments/production/physical phones.

## Decisions

- Explicit October 13, 2026 user instruction: role-specific QA sessions, correct reproducible bugs, integrate for later manual review. Retain existing white-label; previews/Blender deferred.
- Separate integration branch/draft PR; no main merge/deployment. Atlas remains read-only in this task.
- HTTP loopback allowed for fixtures; no TLS exceptions or CA/trust changes. These tests establish neither Secure cookies nor HTTPS.

## Open Questions

- Human manual review, phones/camera/printed QR and HTTPS with valid trust pending.
- Yoga previews: previous stale receipt/checker retained; do not claim full gate passing or regenerate captures in this task.
- Reconcile this note with other six/final integration before marking entry absorbed. Specific limits/unexecuted cases remain in matrix/primary source.

## Links

- Source: [role report](../../../qa-b2c-visitor-local-2026-10-13.md).
- Integration: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Existing intake destination: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidate source/entry with current templates/register in `atlas/catalog/sources.yaml`.
- Reconcile synthesis: `atlas/wiki/klisteniapp.md`, `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisions/questions only where intake requires.
- Atlas read at `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, not written. No new protocol/parallel catalog.
