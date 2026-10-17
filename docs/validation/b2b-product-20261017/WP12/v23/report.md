# WP12 v23: corrected QA checks on the unchanged accepted application

R36 completes four selected authenticated unified HTTP cells: INACTIVE-011 and
SYNC-002 in Chromium320 and WebKit320. All four pass, with one attempt each,
zero failures/skips and no run-level errors. Application source is
`bd30eab5b2a33c3f3e8a7692649632ec85103431`; QA source is
`9f76dd7089d7f1e0e4a4693c48aa2a1e4814b07f`. This separate diagnostic wave
does not replace or relabel the original full-run failures in R34.

INACTIVE-011 retains every deactivation, historical-training and revoked-health
assertion. Its positive owner-health heading now waits up to 30 seconds for real
readmission. Immediate hide/revoke/privacy assertions retain their original
timing. The source and late-readmission evidence are described in v22.

SYNC-002 previously failed inside QA's Node `route.fetch` forwarding transport
with a socket hangup, before the visible-state assertions could complete. The
new hook holds the original browser request before delivery, then calls native
`route.continue()`. A response observer is installed before release and requires
the actual successful POST for that same session revision operation ID. No
response is fabricated. The existing syncing/pending/partial/explicit-complete,
backend status and viewport assertions remain. The unknown-acknowledgment
scenario SYNC-003 is unchanged. Both engines now complete the entire case.

The diagnostic snapshot is separate from the two active full matrices. Its
1,218 application files match the accepted application, and all 26 QA files
match the stated QA commit. The active full-run snapshot is rechecked: its 26 QA
files still match `1374b94ed441365789d2756742afa8306022c0a0`. No running source
was hot-patched. Scoped ESLint and B2C typecheck pass on both prospective QA
changes; the fresh diagnostic B2B consumer build passes.

The public-source snapshot shares unchanged frozen dependencies with the active
runtime and resolves its own workspace package links. Setup first found one
task-local helper unreadable by container UID1001; setting that public helper to
0644 repaired it. Pnpm's automatic dependency check rejected the shared `.pnpm`
symlink before Vite ran. Those failed attempts are retained. The successful
build uses the same installed pinned Vite CLI directly; no package/lockfile,
dependency version, admission guard or trust configuration changes.

The diagnostic completed before its own six-schema inventory was captured. The
post-run comparison finds exactly the twelve schemas independently inventoried
for still-active R34/R35 and no additional schemas. This is explicitly a set
comparison, not an exact six-name R36 cleanup attestation.

Published reports and logs are sanitized copies. Their original task-local
hashes and published decoded hashes appear in the sanitization ledger; raw
status/count calculations use the untouched originals. Session cookies,
authorization headers and private URL tokens are removed from promoted text.
Full private traces remain local. Sanitizer checks preserve case statuses,
counts, operation identity and error class while removing supported text and
structured credential forms.

R34/R35 continue all 528 cells per HTTP mode, on their unchanged QA source, with
zero retries and no failure cap. White Label INACTIVE-003 remains the independent
INTEGRATION-owned public-route availability request in v21. Trusted HTTPS inputs
remain separately blocked. No full acceptance claim, application feature fix,
shared configuration/seed/manifest edit, main merge or real-user/provider action
is made. Parent retains orchestration and final acceptance.
