# WP12 v16: HTTP coverage ledger and continuing independent waves

This snapshot includes completed receipts through R28 only, for application
`a1ade61267506442bea99dd5110d73ed5e503283`. It preserves PR32 head
`864091b6549654ea32bbea3edc13ec4bae0b75b1`, R28's 20/20 outcome and all previous
results. Parent retains orchestration; WP09's published d781a3b fix is awaiting
its composed, explicitly accepted application head.

[Compact coverage ledger](coverage-through-r28.md) maps each of the 88 executable
browser scenarios to both HTTP modes, both engines and 320/430/1440 px. Its JSON
retains each attempt's run, exact QA source, actual status and original receipt.
Owner unit/API cases remain mapped in the original scenario inventory and are
not misrepresented as browser executions.

Across 1,056 target HTTP cells, the latest observed planning state is 40 passed,
2 failed and 1,014 never run on this application source. This is a deduplicated
coverage inventory across separately pinned QA revisions, not a combined run,
new test total or acceptance verdict. The two failed cells are SYNC-009 in both
unified 320 px engines. The R26 timeout remains in its attempt history; R27's
separate corrected pass is its latest observation. Earlier application heads
are excluded, not relabelled. Each scenario/mode/engine/width cell remains
independently identifiable.

Trusted HTTPS accounts for a separate 528-cell target with valid trust inputs
still absent. This input blocker does not stop supported HTTP execution and is
not a browser availability claim.

## Active independent execution

R29 and R30 use the unchanged application a1ade612 and QA
`c17e43671eaa6c083c0516f94c70f6a0037dccb6`. Each actual 25-file runtime proof
matches before execution. Every selected cell was unrun in the completed-receipt
snapshot. No result is attested for these active waves here.

| Run | Mode             | Projects                | Selected scenarios                                              | Cells |
| --- | ---------------- | ----------------------- | --------------------------------------------------------------- | ----: |
| R29 | White Label HTTP | WebKit320, Chromium1440 | WEEK-001/002/007, HISTORY-001, HEALTH-002/004, INACTIVE-004/008 |    16 |
| R30 | Unified HTTP     | Chromium320, WebKit1440 | Same eight independent scenarios                                |    16 |

These cover 4/3/1 accounting, truthful partial work, timezone/DST boundaries,
history, consent denial/revocation, owner export and reactivation. Pending
completion-feedback, quota-width, health-offline-readiness and approved duration
fixture cases are left for the accepted composed head and unchanged affected
assertions. No new application implementation or shared config/seed/manifest
change is made.

Both modes run within the one existing nonroot browser container. Existing
mode layouts already provide disjoint ports, independent per-project schemas
and API/auth instances. Each Playwright process retains one worker, its own
output and admission-pacing file, so same-project fixture writes do not race.
No second browser container, worker override or security/admission change occurs.
Safe resource inspection showed about 1.25 GiB combined current container usage,
4 CPUs, 16 GiB memory and 12 GiB free workspace before R30 admission.

The original wrapper preserves its global schema count even when the other
mode remains active. Task-local per-run schema inventories permit an additional
owned-schema cleanup check without treating the other active mode as a leak.
No count will be silently rewritten to zero.

The 18:36 platform disconnect and one read-only command transport error did not
interrupt the original R29 process. Subsequent safe reads and the original exec
session succeeded; completed cells continued without restart. The executor is
available, both synthetic task containers are retained and raw evidence remains
at the original roots.

## Reproduction and next acceptance

The included generator reconstructs the snapshot from immutable raw reports
and per-run source ledgers, with an explicit maximum run number. Run from this
checkout with the pinned Node/Python environment already available:

```sh
python3 docs/validation/b2b-product-20261017/WP12/v16/coverage-generator.py \
  a1ade61267506442bea99dd5110d73ed5e503283 /tmp/wp12-through-r28 28
```

R29/R30 will receive additive completion receipts. The next exact accepted
composed source will receive unchanged affected-case reruns and continuing full
HTTP matrix coverage. Prior passes are not transferred to that new source.
No main merge, production/provider/real-user action, sandbox/TLS relaxation or
additional agent task occurs.
