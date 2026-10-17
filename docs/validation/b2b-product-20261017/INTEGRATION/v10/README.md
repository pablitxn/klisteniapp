# Integration v10: root resume control fits narrow viewports

Executable QA candidate: **`a1ade61267506442bea99dd5110d73ed5e503283`**, on
`integrate/b2b-product-v1`, draft [PR21](https://github.com/pablitxn/klisteniapp/pull/21).
This receipt is published in a later evidence-only commit. It adds one application
line relative to v9 source `7dcf45753591da83ee0bfbde2e2c50dca218ff9b`: scoped wrapping
and maximum-width styles on the actual root saved-work resume button.

## Confirmed defect and narrow fix

Parent supplied [QA PR32](https://github.com/pablitxn/klisteniapp/pull/32) at exact
head `7e6242c3b5d3d6e2f69d27eead2db0083c6f6286`. Its unchanged inputs are copied under
`qa-input/`. That receipt correctly attributes R19 application execution to the
older `00b9f855` source; it does not attest the v9 Close integration. The layout
failure was independently reproduced here against v9's exact application bytes,
using evidence head `4b9541c2f205642d6e0b9bef2f1c6a23a6c5ec47` for the baseline build.

The root resume button is outside `.routine-history` and therefore inherits the
shared `.button { white-space: nowrap }` rule without the history-specific wrap
rule. In both native engines at 320px, its right edge was **354.9375px**, width
**336.9375px**, and document/body width **355px**, exactly matching QA's measured
control. Mobile Chromium also expanded `innerWidth` to 355; WebKit retained 320.

`ProductWorkout.tsx` now gives only that control `minWidth: 0`, `maxWidth: '100%'`,
`whiteSpace: 'normal'` and `overflowWrap: 'anywhere'`. The label remains complete
and visible. No overflow hiding, ellipsis, clipping rule, wording change, global
button rule, event handler or application guard changed. See `resume-control.patch`.

## Native before/after evidence

The harness imports actual `ProductViews`, `ProductWorkoutHistory`, the selected
workout/form and shared `Shell`, with the real shared application styles. It uses
synthetic typed reads, current-context fixtures, native IndexedDB and deliberate
storage delay. It is a composed local UI check, not a complete authenticated
ApplicationProvider or live calendar/QA journey.

| Engine | Requested width | Before document / button right | After document / button right | After label lines | Slow-write Close |
| --- | ---: | ---: | ---: | ---: | --- |
| Chromium 153.0.8010.12 | 320 | 355 / 354.9375 | 320 / 302 | 2 | Pass |
| Chromium 153.0.8010.12 | 430 | 430 / 354.9375 | 430 / 354.9375 | 1 | Pass |
| Chromium 153.0.8010.12 | 1440 | 1440 / 394.53125 | 1440 / 394.53125 | 1 | Pass |
| WebKit 26.6 | 320 | 355 / 354.9375 | 320 / 302 | 2 | Pass |
| WebKit 26.6 | 430 | 430 / 354.9375 | 430 / 354.9375 | 1 | Pass |
| WebKit 26.6 | 1440 | 1440 / 394.53125 | 1440 / 394.53125 | 1 | Pass |

All six patched cells pass viewport/document/body bounds, text-line bounds,
visible overflow styles, and equal client/scroll dimensions. At 320px the button
is 284px wide and its complete label wraps to two lines; desktop sizing remains
unchanged. The six before cells characterize the baseline; the two expected
320px overflows are reproduced failures, not product passes.

Each patched cell then clicks the actual resume control, queues notes and a
correction reason behind a held native IndexedDB write, clicks normal `Volver`,
and verifies the form remains mounted until release. A fresh store and durable
selection both show generation 2 with both edits. The record remains `partial`,
`explicitCompletion` stays false, original notes remain intact, and no operation
is added. These six Close checks are part of the six patched cells, not an
additional browser-matrix total.

Raw measurements and six screenshots are under `layout/results/`. Both 320px
screenshots received visual review; the full label is visible and no horizontal
page overflow is present. `layout/{chromium,webkit}.log` records zero page errors.

## Preserved Close integration and static checks

The existing v9 composed Close/navigation runner was rebuilt against the new
candidate and rerun without test-logic changes: **21 passed, zero page errors**.
It retains route/section/brand/public departures, native Back/Forward and hash
behavior, local quota/pointer/CAS failures, explicit retry/export, immediate
revocation, offline revalidation and query/fragment invitation history checks.
Only its temporary build/run directory changes. Source and raw output are in
`close/`; the older v9 receipt remains immutable.

Scoped B2B web typecheck, lint and changed-file formatting pass. Root build passes
**16/16 tasks**, rebuilding both consumer applications where required. Normal
unchanged-task cache reuse and existing chunk-size warnings remain. The full
299-test web suite and broad API/HTTP suites were not rerun for this one-line
visual patch; their v9 evidence retains its original source and qualification.
No implementation-mirroring unit test was added for these CSS declarations.

## Runtime and reproduction

Both engines use the exact Playwright Core **1.63.0** driver, the existing OS
container, nonroot UID 1001, existing seccomp and no-new-privileges. Chromium uses
its matching revision-1243 browser with sandbox enabled on native fictitious-domain
HTTP. WebKit uses matching Ubuntu24.04 revision **2359** / version **26.6** on
native loopback HTTP. Chromium reports an insecure context; WebKit loopback
reports a secure context by native browser classification. No secure-context,
crypto, storage, certificate-trust or sandbox shim is installed.

WebKit could not resolve the fictitious domain in this container despite local
host mapping, so layout validation uses `127.0.0.1`. That runtime limitation is
preserved in `webkit-runtime/`, together with the initial host-default Debian
browser download and successful matching Ubuntu runtime setup/smoke. No global
proxy, DNS or trust setting changed. Domain-specific proxy bypass remains scoped
to each disposable container. The product uses no external health/user data.

Executable harnesses preserve the actual absolute workspace/temporary paths.
See `layout/{probe.tsx,build.mjs,run.mjs,run.sh}`. In an isolated clean checkout at
the recorded root, build the baseline at `4b9541c`, preserve its generated `dist`
as `dist-before`, then build candidate `a1ade612`. Run:

```bash
bash /tmp/b2b-resume-layout-v10/run.sh chromium
bash /tmp/b2b-resume-layout-v10/run.sh webkit
```

Prepare the exact scoped runtimes as described in `webkit-runtime/README.md` and
[v9 runtime provenance](../v9/runtime/README.md). Browser caches and generated
bundles are omitted; `bundle-inventory.json` records the actual before/after build
hashes. The output mount grants write access only to this task's public synthetic
screenshots/results directory. `source-inventory.json` pins all 406 scoped source
files; `evidence-sha256.json` pins receipt artifacts. Raw logs remain unchanged.

## QA handoff and limits

QA can pin **`a1ade61267506442bea99dd5110d73ed5e503283`** and rerun WEEK-008 and
WEEK-012 with their original final viewport assertions. The composed proof resolves
the specifically measured root control; it does not relabel those full QA journeys
as passed. Parent's independent tests on `7dcf4575` remain separately attributable.

Keyboard-audit, explicit-resume and advancing-clock QA corrections did not prompt
application guard changes. Other R16 findings remain with their current owners.
Full authenticated browser/mode coverage, trusted HTTPS and physical acceptance
remain pending. Earlier Yoga/model/Blender qualifications are unchanged.

Main remains `d65261d18de4522fb9a66104aabb5750104fb8b8`; consulted Atlas remains
clean at `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. PR21 stays draft. No main merge,
production activation/migration/deployment, credentials, paid services, real-user
or external health access, history rewrite, shared schema/contract/lockfile change
or SSE policy change occurred. Parent retains Cloud dispatch and final acceptance.
