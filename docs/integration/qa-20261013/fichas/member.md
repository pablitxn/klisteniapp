---
id: 2026-10-13-orchid-labs-klisteniapp-qa-member
title: QA Klisteniapp — B2B member
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../../validation/b2b-member-qa-2026-10-13.md
created: 2026-10-13
---

<a id="qa-klisteniapp--b2b-socio"></a>
# QA Klisteniapp — B2B member

> **2026-10-16 follow-up:** Atlas has absorbed the seven historical notes in
> `2026-10-16-klisteniapp-role-qa-consolidation`. The original task status and
> restrictions below remain historical. See the [current-main QA receipt](../../../validation/current-main-2026-10-16/README.md)
> and [new intake](../../qa-20261016/intake.md) for subsequent testing and remaining gates.

Pre-documentation awaiting consolidation. This file is neither a registered nor
absorbed Atlas entry. Primary source: owner-repository code/evidence; local testing
does not establish deployment.

## Summary

Routine/catalog/branch-global history, sets/time/RPE/alternatives, drafts/cancellation/replay, invitations, expired/revoked sessions, brand/account/branch separation.

## Relevant Facts

- Immutable source: branch `qa/b2b-member-20261013-session-b752`, SHA `bafb7bf64e6fd84b58452ee85ec3c655650cc652`, [source PR](https://github.com/pablitxn/klisteniapp/pull/5). Common base `7172041102a8a7029af5fb3e2527a1fa51611a86`; work date 2026-10-13.
- Incorporated corrections: Context progress filters selected branch; full history remains explicit view. QR retains branch/equipment and requires authorized selection. Existing identity joins through explicit consent without account overwrite.
- Historical: 96 consolidated combinations after 11 harness failures/24 reruns plus supplemental groups. Certificate exceptions establish no TLS. Current integration uses HTTP without those exceptions.
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

- Source: [role report](../../../validation/b2b-member-qa-2026-10-13.md).
- Integration: [sources.json](../sources.json), [README.md](../README.md), [matrix.json](../matrix.json).
- Existing intake destination: `sysadmin-workspace/atlas/runbooks/intake.md`; consolidate source/entry with current templates/register in `atlas/catalog/sources.yaml`.
- Reconcile synthesis: `atlas/wiki/klisteniapp.md`, `atlas/inbox/2026-10-12-klisteniapp-knowledge-intake.md`, `atlas/retroactive-documentation.md`; decisions/questions only where intake requires.
- Atlas read at `27ae86c83cd4822e6f7c23c70a1b9397ffd39d9f`, not written. No new protocol/parallel catalog.
