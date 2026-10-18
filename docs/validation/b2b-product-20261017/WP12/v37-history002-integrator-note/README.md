# HISTORY-002 evidence for independent integration triage

Frozen application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `92d951c2a6de3b954ef617ecabd3d02e245c46e8`. White Label R62 / Chromium 1440 failed; the current wave continues unchanged and this cell remains failed. This is an evidence handoff, not an app-defect or test-race classification.

The first assertion in [HISTORY-002](https://github.com/pablitxn/klisteniapp/blob/92d951c2a6de3b954ef617ecabd3d02e245c46e8/apps/b2c-web/e2e/b2b-product-history.spec.ts#L22) is `expect(continuity).toContainText(plan.enrollment.content.name)`. It has the existing 5,000 ms assertion timeout. The region is absent, rather than present with incorrect content. The retained page displays the current-access gate verifying access.

The [route helper](https://github.com/pablitxn/klisteniapp/blob/92d951c2a6de3b954ef617ecabd3d02e245c46e8/apps/b2c-web/e2e/fixtures/b2b-product/app-fixture.ts#L329) returns after `page.goto` for the bound history URL. This direct caller does not invoke the bounded heading observation inside `showWeek`. This static path is relevant to investigation but does not establish the reason for delayed readiness.

[MembershipAccessBoundary](https://github.com/pablitxn/klisteniapp/blob/d2adf75d3fee18740ef38632a361c91203d77dc6/apps/b2b-web/src/features/membership/RestrictedMembership.tsx#L75) renders that status when its mode is checking. [RoutineContinuity](https://github.com/pablitxn/klisteniapp/blob/d2adf75d3fee18740ef38632a361c91203d77dc6/apps/b2b-web/src/features/training/routine-history/RoutineContinuity.tsx#L16) owns the expected region. These are source pointers, not evidence identifying which controller transition caused the delay.

| Recorded event | Monotonic timestamp, ms | Offset from assertion end, ms |
| --- | ---: | ---: |
| History navigation begins | 4037147.758 | -6009.081 |
| Continuity assertion begins | 4038108.629 | -5048.210 |
| Continuity assertion fails | 4043156.839 | 0 |
| Access network entry, status 200 | 4043189.173 | +32.334 |
| Last retained member frame: access gate | 4043190.016 | +33.177 |
| Continuity network entry, status 200 | 4043236.711 | +79.872 |

`trace-sequence.json` retains selected request paths, statuses, recorded durations and timestamp offsets. Network timestamps are reported as trace fields; they are not relabeled as completed-response times and durations are not added to infer ordering. A later200 response alone does not establish rendered history correctness. No later retained DOM confirms eventual UI readiness. Raw traces remain task-private; [the original sanitized capture and hashes](../v37-failure-r62-history002-chromium1440/README.md) remain unchanged.

For an independent investigation, use a fresh disposable fixture on the exact pins and observe navigation, access-gate state and the real history/continuity presentation under a bounded meaningful wait, then run the unchanged goal/stage/period assertions. A persistent missing or incorrect view needs app investigation. Successful eventual rendering may support a fixture-readiness correction, but that requires actual observation and a new attributable QA pin. Preserve denial assertions and access guards; do not use sleeps, forced state, skipped assertions or retries to manufacture a pass.

No application or QA runtime source was changed for this handoff. Current full matrices continue uncapped on the original corrected pin. The 72 repeated ALTERNATIVES-005/009 passes remain separate evidence, and all old matrix failures remain preserved.
