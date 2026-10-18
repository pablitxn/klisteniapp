# Supplemental role-case resource observations

Application `d2adf75d3fee18740ef38632a361c91203d77dc6`; QA `831203470d4c21322b8bc3ce7c4dedb7f84fe5d7`.

This supplements the immutable [Chromium430 role-failure records](../v45-failures-roles-chromium430/README.md). In R72 ROLES-003's failed browser trace, selected JavaScript chunk resources have raw recorded total times of 19,792–53,170 ms. Their raw wait components range from 18,503–53,110 ms. Several records have status200; one ProductReportsPage record has raw status-1 and no completed duration. The existing organization-control assertion timed out after30seconds with loading UI retained.

The exact normalized paths, raw status, monotonicTime, total time, timing components, failing browser trace name and private trace SHA-256 are retained in observations.json. These fields can include queue/transport timing. They do not independently establish body completion, visible readiness, application-server delay, host I/O, browser-queue cause or a passing test. The overlapping host monitoring-read incident remains separately recorded without causal attribution. R71 ROLES-009 has no matching long/failed resources under this selected filter; absence under that filter is not proof of normal rendering or a passing case.

No deadline, test predicate, app/runtime source, browser/security policy or result status changed. Both complete uncapped matrices continue and every observed failure remains failed. This is supplemental read-only diagnosis, not a retest or additional pass. Parent retains investigation, integration and main-merge authority.
