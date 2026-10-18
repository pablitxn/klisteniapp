# WP11 validation log publication amendment v2

This amendment corrects a packaging omission in the published immutable v1 receipt
at `03ba84e29e67731f62cbc2dbbfef554965a757d0`. The repository's log ignore rule
excluded `v1/logs/*.log` from that commit although the v1 narrative referred to
those files. The actual raw outputs are now explicitly tracked under [logs](logs/).
V1 bytes, source `35b63a0536242515920aeae80fca8e58bdaab12e`, screenshots, source
hashes and test results are unchanged. This is a new evidence publication, not a
rerun or a claim that a previously blocked case passed.

Use the linked logs here wherever v1 mentions its uncommitted logs directory:
API188, web73 (including new11), contracts22, domain22, B2C web204, root14-task
typecheck, lint/boundary/format, build, identity, source-commit/prepared-PR checks,
Atlas-only content check, browser acquisition and WebKit launch blocker.
[log-files.json](log-files.json) freezes their SHA256 values. Chromium's successful
three-viewport JSON and screenshots remain in [v1](../v1/README.md).

The earlier exploratory setup failures are described in v1 and are not passing
checks. WebKit has zero executed cases and three unexecuted viewport cases; final
composed application/auth/provider/store/HTTPS acceptance remains pending.
[Owner requests](../v1/owner-requests.md) remain unchanged: exact client `/self`
patch, root/provider access freshness, WP06 self/login bindings, WP09 actual store
injection and QA scenarios. Parent retains orchestration/acceptance/main merge.
No shared source or dependency file is edited by this amendment.
