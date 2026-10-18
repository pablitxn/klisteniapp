# R67 SYNC-002 failure: unified WebKit 430

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `4ec0273151194acb189ac6ed327033d66366dbd5`.

This actual complete SYNC-002 instance failed, without retry, at its first synchronized-status assertion (`b2b-product-sync.spec.ts:541`) immediately after startWorkout. The intended held-send/partial/completed assertions later in this case were not reached and are not credited as passes. The snapshot shows failed synchronization and the actual alert “Explain the correction to accepted work.”

The initial real draft POST returned 200 and accepted revision 1 with performedAt `2025-09-29T12:00:06.781Z`, status draft, explicitCompletion false and an empty correctionReason. The helper filled the actual performed-time input with `2025-09-29T10:00:00Z`. Its first-response waiter accepts the occurrence's first successful draft, without requiring that accepted content to match the filled performedAt. The error snapshot retains the filled 10:00 value and the correction alert.

Domain source requires a correction reason when changing an already accepted performedAt (`packages/b2b-domain/src/sessions.ts:106–109`). The UI input uses session.edit; queueWorkout checks firstCorrectionProblem before queuing. These facts identify a helper/initial-autosave ordering candidate for review. They do not establish final product/harness ownership or a passing fix. No extra server error response is invented; the retained draft response is 200.

All 2,103 source/build hashes still match. Both full uncapped matrices continue on the exact same pair. No source swap, test retry, timing/guard relaxation, application fix or runtime change was applied. A safe follow-up is to inspect the initial draft acknowledgment against the actual performed-time edit and preserve the correction-reason guard and all original assertions.

The exact-name capture proof, selected synthetic request/response fields, source references, and raw timing fields are in diagnosis.json. The sanitized error context is base64 encoded to preserve exact bytes. Original trace and screenshots remain task-private with hashes. Original v40/v41 and R68 failure evidence remain immutable. HTTPS remains unexecuted without existing trusted TLS inputs. GitGuardian's size-limit skip is neutral, not clean. Parent retains orchestration, integration and main-merge authority.
