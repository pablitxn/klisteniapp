---
id: 2026-10-13-orchid-labs-klisteniapp-qa-brand-admin
title: QA Klisteniapp — B2B brand administrator
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../qa/b2b-brand-admin-2026-10-13.md
created: 2026-10-13
---

<a id="qa-klisteniapp--b2b-administrador-de-marca"></a>
# QA Klisteniapp — B2B brand administrator

Pre-documentation awaiting consolidation. This file is neither a registered nor
absorbed Atlas entry. Primary source: owner-repository code/evidence; local testing
does not establish deployment.

## Summary

11 management routes in both brands/four branches, people/access, units/batches/QR, website/design/modules/catalog/transfers/media/routines/versions/assignments, account/session. Models/previews excluded.

## Relevant Facts

- Immutable source: branch `qa/b2b-brand-admin-20261013`, SHA `a959fceb19a231e121a6355072dc3d0b0bc0505b`, [source PR](https://github.com/pablitxn/klisteniapp/pull/8). Common base `7172041102a8a7029af5fb3e2527a1fa51611a86`; work date 2026-10-13.
- Incorporated corrections: Brand roster/branch coaching; atomic duplicate-slug 409; recoverable theme/branch drafts with comparison; invitation fragment refresh; mobile selectors; exercise/routine exit blocked until ACK.
- Historical: 108 consolidated groups on a87daf4 with ignoreHTTPSErrors true. Published a959fce disables exception without historical rerun. New HTTP matrix revalidates 27×4 without TLS validation attribution.
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

- Source: [role report](../../../qa/b2b-brand-admin-2026-10-13.md).
- Integration: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Existing intake destination: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidate source/entry with current templates/register in `atlas/catalog/sources.yaml`.
- Reconcile synthesis: `atlas/wiki/klisteniapp.md`, `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisions/questions only where intake requires.
- Atlas read at `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, not written. No new protocol/parallel catalog.
