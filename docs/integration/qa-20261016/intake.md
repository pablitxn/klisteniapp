---
id: 2026-10-16-orchid-labs-klisteniapp-current-main-qa
title: Klisteniapp current-main role QA follow-up
entity: orchid-labs
domain: product
source_type: review
sensitivity: normal
status: draft
source: ../../validation/current-main-2026-10-16/README.md
created: "2026-10-16"
---

# Klisteniapp current-main role QA follow-up

## Summary

Owner-repository evidence for the authorized retry of current-main B2C/B2B QA.
This draft intake supplements the already absorbed Atlas entry
`2026-10-16-klisteniapp-role-qa-consolidation`; it does not create another canonical
catalog or claim absorption. The coordinator owns later merge and Notion sync.

## Relevant Facts

- Tested application revision: `1258642b4543b6acc598d6e72ccf1c50e75b7a67`.
- Browser result: **1218/1218 unique combinations pass**: 882 API/PostgreSQL, 120
  simulated UI contracts and 216 local-storage combinations. Six engine/viewport
  profiles per role; B2C visitor has separate demo/instance matrices.
- Local regression/database result: **602 pass, zero fail/skip**; includes B2C
  API97 and B2B API82. Lint, types and build pass at the recorded scopes.
- Test portability fix: `c4fb918498d07b3d7bd43cf0adec8c65983ddb4d`; final B2B
  runs use this test source, with unchanged production source. Anonymous and brand
  administration run at documentation checkout `a98fdf6fcfbbc75c6e7b1c305a28b2731e3781e1`;
  earlier final member/trainer runs execute directly at the fix commit.
- All earlier case attempts remain: 208 failed, 106 skipped/unexecuted and
  1 deliberate interruption. Those are separated from the latest passing cases;
  pre-discovery setup failures also retain their reports.
- Seven fresh local role archives have gzip integrity, bytes and SHA-256 receipts.
  They have no durable remote retrieval/expiry receipt; all seven historical bundles
  remain missing. Seven selected captures were visually inspected.
- [Draft PR #11](https://github.com/pablitxn/klisteniapp/pull/11) publishes the changes
  and small evidence. No merge or deployment is claimed.
- Atlas context: `d20e288168ee04177e8864a43c13bd05a864238a`; shared canonical files
  were not modified. Both tracked Atlas skills were read through `.agents/skills`.
- [QA receipt](../../validation/current-main-2026-10-16/README.md) owns executed
  commands, exact run provenance, case outcomes, failures and untested coverage.
- The previous integration is merged through PR #10; its 1164 combinations
  remain historical. The earlier draft-creation rejection is preserved as
  evidence and is superseded only for this newly authorized publication.

## Decisions

- The current delegation authorizes synthetic local QA, reproducible fixes,
  English Conventional Commits, PR publication and this product-repository intake.
- Retain current brand boundaries, Yoga assets and provenance guards. No new
  product, provider, infrastructure, trust, merge or deployment decision.

## Open Questions

- Reconcile new evidence under existing `call-20261014-q02` and gates
  `kli-role-qa-20261016-g01` through `g04`; do not reopen completed integration
  milestones `a03/a08` or duplicate their tasks.
- Yoga capture/provenance acceptance, historical archive retrieval, CI receipts
  and physical/provider/HTTPS acceptance remain distinct from local QA.
- Notion synchronization and merge are pending coordinator actions.

## Gate handoff

| Existing gate | New evidence / remaining action |
| --- | --- |
| `kli-role-qa-20261016-g01` | Final-main local browser/DB receipts, exact revisions/source delta and actual commands are supplied. The 97/82 DB results are fresh executions; they do not reconstruct the old interim receipt's missing SHA. Coordinator reconciles gate status. |
| `kli-role-qa-20261016-g02` | Provenance audit and previews reproduce the pre-existing Yoga failure. 22/23 source proofs, original dependency proof and all 128 WebP hashes match; mixed 47 retained / 17 later entries require separate acceptance. Exercise74/body24 pass. No fabricated receipt or regenerated asset. |
| `kli-role-qa-20261016-g03` | Missing historical archive list retained; new raw bundles are local-only. Direct GitHub APIs report zero check-runs and zero all-event Actions runs at all three tested heads. This declares observed absence, not passing CI. Current GitLab CI remains unverified. |
| `kli-role-qa-20261016-g04` | Added wide-mobile/desktop WebKit admin profiles pass. Manual review is a seven-capture sample; valid-trust HTTPS/Secure cookies, physical devices/QR/voice, providers/mail/payments and GPU/model/Blender/content remain untested. |

The source is the authorized retry delegated from thread
`01a118ed-6bf7-7481-93e6-336de48270f7`, captured on 2026-10-16. Platform disconnect
notices did not stop the same executor; no completed suites were repeated because
of those notices. Only disposable task resources are cleaned up, with a receipt.
Shared Atlas canonical documents remain unchanged. This owner-repository draft
is ready for the coordinator's existing source -> entry -> synthesis/catalog flow;
it does not change accepted decisions, duplicate the seven sources, absorb itself
or close q02/remaining gates on behalf of their owner.

## Links

- [Seven historical role intakes](../qa-20261013/fichas/)
- [Current QA receipt](../../validation/current-main-2026-10-16/README.md)
- [Existing Atlas entry](https://github.com/pablitxn/sysadmin-workspace/blob/d20e288168ee04177e8864a43c13bd05a864238a/atlas/entries/2026-10-16-klisteniapp-role-qa-consolidation.md)
- [Existing Atlas source](https://github.com/pablitxn/sysadmin-workspace/blob/d20e288168ee04177e8864a43c13bd05a864238a/atlas/sources/src-20261016-klisteniapp-role-qa-consolidation.md)
- Existing intake route: `atlas/runbooks/intake.md`; reconcile source/entry/wiki/
  questions/roadmap under one writer. This file remains draft until that receipt.
