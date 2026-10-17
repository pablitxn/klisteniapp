# WP03 v3: frozen selection error mapping and latest planning pin

Source `4d6c1ccce4eb68917fa44f938a42f0064ca7b167`; WP02 `c6825101d6ac798437599062481adf2a79ac5f69`; WP04 `04b2e036e6d9b5d8987c6d228ab92bf1a48827d1`. This supersedes v2's suggestion to extend ProductErrorSchema and its older WP02 pin. V1/v2 remain unchanged historical evidence. Do not apply v2/contract-selection-error.patch.

## Frozen wire mapping implemented

The writer consumes `assertNewReviewedCatalogEligibility` unchanged and catches only its internal REVIEWED_TARGET_UNAVAILABLE. It emits existing status 409 / code INVALID_INPUT with one ProductIssue: `{code: 'unavailable', path: ['content', 'selectedSegments'], stepId: null, message: <safe selection guidance>}`. Current source/target visibility withdrawal and equipment unavailability use the same mapping. Authentication and unrelated exceptions retain their existing behavior. There is no new wire enum, raw internal error message, client implementation change or contract edit.

Real API denial/race cases parse their actual error payload through ProductErrorSchema and assert the unavailable issue. The new dedicated client test uses the existing public client/transport and strict frozen schema, verifies the same status/code/issues survive, input stays unchanged, and no auth-change signal is emitted. This client test is within the parent's explicit contract/client regression request; client source/registration remains INTEGRATION-owned and untouched. Retained history behavior is unchanged.

## Integration still required

Production factories and lock conventions are unchanged from v2. Register `createPlanningSchedule()` from `src/schedule/planning.ts` and `createRecordsServices()` from `src/schedule/index.ts` using ACCESS's current authorized transaction. INTEGRATION applies sessions/schedule/alternatives exports; no shared manifest or barrel was edited here.

The latest WP02 amendment changes scoped legacy queries and the authorized publication resolver; its ScheduleChange still lacks immutable effectiveAt. The v2/wp02-effective-time.patch and v2/wp02-production-fixture.patch still apply cleanly against c6825101d6ac798437599062481adf2a79ac5f69. The first is required for deterministic future-only end; the second replaces the synthetic fixture and corrects its old cancellation-only assertion. Do not count that end endpoint as accepted. WP03's pinned missing-time negative regression must be updated when the timestamp amendment is accepted, as described in v2.

WP02/v2/integration-test-expectation.patch was reviewed: it asserts the exact northAssignment ID in a branch explicitly granted to the coach, rather than the superseded zero count; this preserves a positive scoped identity assertion instead of weakening it. The shared test remains exclusively INTEGRATION-owned, so WP03 did not apply it. Its broader full-suite failure is reported separately from owned tests.

Final ordinary static checks, new HTTP/current-access composition, Astra review, repaired owner tests/end input, browser/mobile/HTTPS/physical acceptance and full combined build remain owner gates. No new Cloud dispatch, main merge, activation or deployment occurred.
