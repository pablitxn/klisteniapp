# WP08 v5: white-label mobile history overflow fix

Source `a9e80bf0267a7c11598db48b8b1e513b50080c9e`, additive to PR25 head
`bbc7a9d0038cfb27b20b404a32b0b34cb28118a0`. Candidate dependency remains
`591feb1fd6a29306b5dc08a70ae5335a0ce01422`; QA diagnostic source/receipt is
`1aa6b375149a3da90a56fe833fbfd953ee745d8b`, WP12/v4. V1–v4 are unchanged.
Parent retains dispatch, composition, monitoring and main-merge authority.

## Reproduced cause and owned fix

The real composed white-label UI reproduced QA's exact320px result:
`innerWidth343`, document width343 and body width343. Unlike the earlier probe,
the offender scan compares DOM bounds with the **requested320**, not the already
expanded innerWidth. It identifies the full legacy-start button at width324.77,
right342.77, and original/revision buttons at width289.78, right328.78. They
inherit the shared `.button { white-space: nowrap }` style. A separate diagnostic
that wraps occurrence headings alone still measures343px; headings are not the
proven cause of this observed failure.

Only three owned files change (files.txt/source-files.sha256): the existing
ProductHistoryPage and WeekCalendar receive local scope classes/imports, and a
new owned routineHistory.css permits natural button-label wrapping, constrains
controls to their containing width and removes automatic minimum widths. Long
identifiers can wrap without changing them. No overflow:hidden/clip, ellipsis,
control removal, viewport/assertion change or shared theme/root/CSS edit is used.
No INTEGRATION root binding is needed for this fix. Earlier unrelated optional
roster binding requests retain their existing ownership.

## Actual composed browser verification

The final task-local real HTTP diagnostic uses the existing harness's six isolated
project schemas, actual password login/branch selection, actual planning/session
API writes and PostgreSQL. It creates four obligations, records three complete
and one partial, then opens the real branded history route and expands the issued
period. The unchanged requested viewport width must exactly equal innerWidth,
document and body widths; all DOM right bounds and full button-text bounds are
checked against that requested width.

| Engine | Requested widths | Passed | Failed | Skipped |
| --- | --- | ---: | ---: | ---: |
| Chromium153.0.8010.12 | 320 /430 /1440 | 3 | 0 | 0 |
| WebKit26.6 | 320 /430 /1440 | 3 | 0 | 0 |

Every cell retains full legacy/revision control labels, seven-day move controls,
expanded immutable period content, exact stable occurrence IDs and four/three/one
counts. Chromium320 also uses the keyboard to move the partial occurrence within
its week through the real POST, verifies the unchanged ID/routine/quantity and
restored card focus. Six final browser diagnostics passed; this is not the full
QA88-ID matrix or a claim about unrelated workout/health/roles journeys.

See browser-results.json, before-measurements.json, heading-wrap-diagnostic.json,
probe logs and native-resolution screenshots. The full204 web tests pass with
zero failures/skips; affected web typecheck/lint, boundaries, CSS Prettier and B2B
build pass. Existing build chunk warnings remain. API code is unchanged; the
layout diagnostic uses the real API/database, while the prior full232-test API
receipt remains v2 evidence for its exact source. No redundant API rerun is
claimed for this CSS-only patch.

An initial fixed probe reused one fixture across views:320 and430 passed, then
desktop timed out before its timezone selector loaded; remaining cells were not
run. That diagnostic is preserved and not counted as acceptance. The final six
isolated fixtures all pass without changing application source or assertions.
Initial public-copy file-readability setup errors were repaired on task-owned
snapshot copies only, before those browser cases. No test or runtime security
constraint was bypassed to obtain a result.

## Reproduction, source proof and isolation

The baseline snapshot was created with `git archive` of the exact candidate,
then built before applying owned WP08 sources. The fixed snapshot overlays only
current owned history/calendar/report source from PR25. source-proof.json checks
1174 candidate tracked files and binds every overlaid source/new stylesheet.
All other application/API/shared package/script/lockfile bytes match the pinned
candidate. The copied QA app-fixture helper is byte-identical to its pinned QA
receipt and used only in this task snapshot; no QA spec/fixture is edited in Git.

baseline-probe.mjs and fixed-probe.mjs are task-local diagnostic reproductions,
not new canonical QA specs. The latter invokes the actual six-project harness,
performs real setup and unchanged viewport/control assertions, and closes its
schemas/servers. Both resolve dependencies from the candidate's locked tree.
Build with its existing Vite CLI and execute these scripts with the official
pinned Playwright1.63 image shown in results.json, a new synthetic PostgreSQL17.11
container sharing browser loopback, and the existing reviewed seccomp profile.
The scripts accept B2B_TEST_DATABASE_URL only from the disposable runtime;
connection values are not retained in this evidence.

Browser processes run as pwuser1001 with no-new-privileges, no effective process
capabilities, default Docker bridge networking and no published ports, host
network, privileged option, secret/socket mount or TLS/trust modification.
Chromium explicitly enables its sandbox; ignoreHTTPSErrors is false. The official
matching image was acquired from its pinned public digest; no package upgrade or
host-helper replacement occurred. The supported QA cryptographic UUID helper is
unchanged; secure-context/WebCrypto properties are not mocked. HTTP evidence is
separate from valid-trust HTTPS/Secure-cookie or physical-device acceptance.

Source identity, source/evidence hashes and scoped whitespace checks are verified.
The aggregate historical patch-marker whitespace qualification remains v4; this
receipt introduces no patch artifact or new exception. No source/history rewrite,
force push, main merge, production activation, deployment, real-user/health data,
external provider or paid call occurred. QA retains final combined acceptance;
the concrete reported320px overflow is reproduced and fixed here.
