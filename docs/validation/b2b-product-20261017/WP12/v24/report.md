# WP12 v24: keyboard revocation acknowledgment and owner-test traceability

R37 completes HEALTH-010 in every White Label HTTP Chromium/WebKit viewport:
320x740, 430x932 and 1440x1000. Six pass, zero fail/skip/never-run, zero retries
and no run-level errors. Application source is
`bd30eab5b2a33c3f3e8a7692649632ec85103431`; QA source is
`8cdb825ca399e9446f2705b770bcb77dcfd78ef4`. This independent complete-case
wave does not relabel the original R35 Chromium430 failure.

## Original failure and correction

The original case times out awaiting a successful revoke response after keyboard
activation. Its trace records the actual same-consent POST at monotonic
2243804.277, expectedRevision 1. The guarded POST has no delivered response
(trace status -1). A subsequent real consent GET at 2243952.098 returns 200 with
that exact consent at revision 2, status revoked, and a non-null revokedAt. The
UI snapshot displays the private-consent state. This demonstrates persisted
revocation despite cancellation of its guarded response; it does not demonstrate
a keyboard or privacy failure. The source already documents that committed
consent notifications can cancel their own guarded responses in grantThroughUi.

The corrected case captures the current exact active consent, registers a real
request observer before focusing the existing button and pressing Enter, and
checks its exact ID, expected revision and operation identity. It then requires
the real server to return the same scoped consent revoked at revision +1 and the
existing private UI. It keeps the original error/retry, import, keyboard,
logout/account-switch, private-view clearing and viewport assertions. No response
is fabricated and no privacy/admission guard or application code changes.

All 1,218 diagnostic application files still match the accepted application;
all 26 diagnostic QA files match 8cdb825. All 26 active R34/R35 QA files still
match 1374b94. Scoped ESLint and B2C typecheck pass. The unchanged application
build inputs retain the successful fresh diagnostic build from R36. All six
captured R37 schemas are absent afterward. Twelve schemas belonging to the two
active full runs remain; the global count is recorded truthfully.

Updating the completed diagnostic snapshot initially encountered a host/container
file-owner mismatch. The scoped public QA files were copied by their existing
nonroot container owner, then verified byte for byte from the host. No file mode,
container user, capability, sandbox, dependency or shared configuration changes.
The bounded schema capture first ran before server readiness; a read-only retry
captured all six exact names once its health check returned ready.

Published JSON/log/error text is sanitized, with private-original and published
decoded hashes retained. Full original traces remain private. The targeted
sanitized consent timeline contains only synthetic task data and no headers.

## Reserved owner-test acceptance IDs

[Owner scenario reconciliation](owner-scenario-reconciliation.json) maps all
twelve reserved compatibility/import acceptance IDs to actual owner source paths,
test titles, source hashes and exact passing log lines at application bd30eab5.
The reserved B2BP labels are acceptance labels, not invented names claimed to
have appeared in owner test output. The completed v20 package receipts remain
the execution evidence. Reused tests support multiple assertions and are never
summed into an additional test total. Full root typecheck from v20 and the
scoped current QA typecheck remain separate checks.

The mapping includes strict client upgrade/identity negotiation, explicit
migration readiness and the existing API-before-external-migration readiness
test, rather than attributing all of those checks to the original reserved
legacy-contract target. The actual API entrypoint is server.ts; it starts the
server without invoking migrate. This source observation is not an extra test.
Migration tests retain historical hashes, role/invitation mappings, foreign FKs,
anomaly rejection and no synthetic occurrence backfill. Interchange checks use
the actual web archive tests in addition to schema tests. The import mapping
retains the original parser parity fixtures, manual-only Node adapter, B2C
wrapper/store and health-schema tests.

## Cross-cutting review checkpoint

| Acceptance ID       | Evidence and current limit                                                                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B2BP-VALIDATION-001 | v18/v19/v23/v24 pin accepted app/evidence/QA inputs and verify actual runtime source. New app input requires affected revalidation.                                                         |
| B2BP-VALIDATION-002 | v20 contains every declared package script's separate passing result, disposable PostgreSQL postchecks, root static checks and builds. The original failed root Turbo attempt stays failed. |
| B2BP-VALIDATION-003 | Full R34/R35 HTTP matrices remain in progress. Trusted HTTPS has no execution receipt because required task-owned certificate/key/trust inputs remain unavailable.                          |
| B2BP-VALIDATION-004 | Executed cases combine semantic UI, native storage/network and viewport checks; selected state screenshots supplement them. Remaining full-matrix cells are pending.                        |
| B2BP-VALIDATION-005 | v20 retains catalog/B2C/import results. Existing Yoga preview provenance and physical/provider/release limitations stay explicit; those gates are not passed here.                          |
| B2BP-VALIDATION-006 | Receipts retain per-run scenario/project/source/outcome. v23/v24 and the prepared full collector sanitize credentials while preserving private-original hashes and failed outcomes.         |
| B2BP-VALIDATION-007 | Effective Git identity, Conventional Commits, English prose and five-section draft PR checks pass. No main merge occurs.                                                                    |
| B2BP-VALIDATION-008 | Canonical Atlas A00-A08 implementation receipt and owning consistency checks remain WP15/parent work. QA does not edit Atlas or claim completion.                                           |

The original v1 preparation inventory remains immutable and describes its initial
blocked preparation phase. This reconciliation updates traceability through
additive evidence instead of changing scenario metadata inside the active
runtime. Both complete HTTP matrices continue on unchanged runtime QA1374 with
zero retries and no failure cap. INTEGRATION's independent v21 public unknown-route
availability request now reproduces at both Chromium mobile widths; no feature
fix is made by QA. Parent retains orchestration and final acceptance.
