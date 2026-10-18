# Parent owner request: WP07 programming grid containment in native WebKit320

Please request the owned planning UI fix from the PROGRAMMING/WP07 producer. Parent retains Cloud dispatch; INTEGRATION retains composition. This is a read-only diagnosis; no application, producer, QA, frozen snapshot or browser-cache files were edited and no development was dispatched.

## Problem and exact evidence

Pinned QA branch head:9307b69418d3c8feb6dd9d0df2d954bb62154313. WP12/v27/owner-request.md records original PROGRAMMING-004 and008 functional assertions passing before the final unchanged viewport predicate fails. WP12/v28/report.md+r39-viewport-observations.json and v30/report.md+r40-viewport-observations.json confirm independent fresh-fixture WebKit320 reproduction in unified and White Label HTTP, respectively. Application bd30eab5b2a33c3f3e8a7692649632ec85103431; accepted integration evidence/current read-only inspection89409dcdbd4faedccfeec8ee236932191c6195d3. All programming-product and shared-UI source bytes are unchanged between these application/evidence pins.

R39:008 document/body371px,004359px. R40:008363px,004369px. All have innerWidth/client/visual viewport320,scale1,scrollX0, fitting element rectangles and no right-edge-only diagnostic hits. These remain failed QA outcomes; this diagnosis does not promote them to passes.

The contributing path is the routine picker in StageScheduleEditor.tsx140-171, inside Field at140 and programming-grid at118. R39 period selector*r_8* and004selectors*r_9*/_r_e_ correspond to published-routine fields; generated IDs are unstable, so use accessible label `Rutina publicada · etapa N, sesión N` in new diagnostics. The case snapshots contain selected UUID-named WP12 routines, the synthetic duration fixture option, and ordinary demo routine options. This must support legitimate long routine names and preserved-version labels, without shortening fixture/product values.

## Confirmed cause and minimal fix

An isolated native matching WebKit26.6/Playwright1.63 mobile320x740 actual-component probe reproduces the exact R39 period chain:

- document/root371px despite fitting320px rectangle;
- form-stack284client/353scroll;
- fieldset280client/351scroll;
- stage card278client/350scroll;
- slot programming-grid238client/330scroll;
- immediate Field238client/330scroll,min-width:auto;
- selected published-routine native select remains238px wide.

The fresh page has a REAL horizontal scroll range51px (`scrollTo(1000,0)` yields scrollX51), not zoom or an old retained range. The long program-name text input retains its ordinary internal scrollWidth333/278 even after the fix, while document width becomes320; that text-input scroll is not the cause.

The missing automatic-minimum override is on grid children, not on native controls or fieldsets (both already have min-width:0). The following single owned rule, injected ONLY into task-local diagnostic pages, fixes both actual PeriodImpactEditor and two-stage GoalProgramEditor with no other change:

```css
.programming-grid > * {
  min-width: 0;
}
```

In both editors, document/body371->320 and actual horizontal scroll range51->0. This preserves visible controls, their full values/options, labels, native keyboard/touch behavior and content; it does not introduce clipping.

Isolation controls: `.programming .field{min-width:0}` also fixes but is broader; max-width:100% on grid children also fixes but is unnecessary. Applying text-overflow:ellipsis or overflow:hidden+ellipsis to the SELECT itself does NOT fix (still371/range51). Shortening selected native option text in a diagnostic counterfactual removes overflow, confirming its intrinsic contribution; shortening names/options is not the requested feature fix.

## Dispatch contract

Suggested model: GPT6.1 Sol, high effort, fast service. Suggested isolated branch: `fix/b2b-programming-grid-width-v1`. Base the producer on the accepted `bd30eab5` source or a verified descendant, and return an exact code/evidence SHA for normal integration into root candidate `22310c7ee29423e7672a8e74dc801557adab53e9`. No lockfile, shared contract or API changes are needed. Parent must assign the owning planning task; this request does not dispatch it.

## Owned scope

Expected minimal application change: apps/b2b-web/src/features/programs/product/programming.css near programming-grid18-22. Inspect StageScheduleEditor.tsx, PeriodImpactEditor.tsx and GoalProgramEditor.tsx for regression context, but no semantic edit is indicated. Shared packages/b2b-ui/Field, root routing, production catalog/API/contracts, schedules, period authorization/revision/audit behavior, fixtures and QA files are outside this fix. Do not add document/body overflow clipping, hide controls, shorten routine names/IDs, or relax viewport assertions.

Keep existing apps/b2b-web/tests/programmingComponents.test.ts semantic label/native-date/preserved-version coverage. Its SSR rendering cannot establish WebKit layout. Do not substitute a CSS-source/string assertion for the native reproduction.

## Producer reproduction and validation

Local diagnostic artifacts (synthetic presentation data only; no service/auth calls):

- /tmp/b2b-programming-layout-diagnosis/probe.tsx renders ACTUAL PeriodImpactEditor, GoalProgramEditor and StageScheduleEditor plus shared and owned CSS, inside actual AccountProvider.
- build.mjs builds only into its own /tmp/dist.
- run.sh/run.mjs reproduces baseline and combined/native-select counterfactual variants.
- run-isolation.sh/run-isolation.mjs isolates one-rule sizing variants.
- native.log and native-isolation.log contain full measured controls/ancestor chains and runtime metadata. Both runners exit0; these are diagnostic measurements, not QA scenario passes.

Reproduce locally:

```sh
node /tmp/b2b-programming-layout-diagnosis/build.mjs
/tmp/b2b-programming-layout-diagnosis/run.sh
/tmp/b2b-programming-layout-diagnosis/run-isolation.sh
```

Runtime: existing exact driver1.63 at /tmp/b2b-route-browser-setup/driver-playwright-core; matching Ubuntu WebKit26.6 revision2359 cache; existing image klisteni-browser:1.62.0 supplies OS libraries only; UID1001,pwuser,network-none,existing seccomp,no-new-privileges,readonly runtime mounts. Native HTTP loopback, default secure-context classification, no crypto/IDB/context/network/security shims, no TLS/trust/sandbox changes. Producer Cloud environments should use their equivalent matching supported runtime; task-local paths may not exist there.

The producer should record before/after native WebKit320 in both actual editors, keeping selected full UUID routine labels and full option arrays. Include two-stage/incomplete-date goal and already-applied period states, native date/weekday/routine interaction, published long names up to contract150characters, and preserved-version fallback. Check320,430,1440 and Chromium smoke as appropriate; require document/body<=innerWidth and actualScrollRange0 without global clipping. Preserve functional invalid-date/stage rejection and reviewed impact/apply/session-history/audit assertions.

After root accepts the exact producer fix SHA, QA owner should rerun original PROGRAMMING-004 and008 assertions on that composed head in BOTH HTTP modes, first WebKit320, then the affected supported matrix. From apps/b2c-web with existing registered disposable fixture/runtime and exact QA source:

```sh
node node_modules/@playwright/test/cli.js test --config=playwright.b2b-product-unified.config.ts --project=product-webkit-320 --grep='B2BP-PROGRAMMING-(004|008)' --timeout=180000 --reporter=list,json
node node_modules/@playwright/test/cli.js test --config=playwright.b2b-product-wl-http.config.ts --project=product-webkit-320 --grep='B2BP-PROGRAMMING-(004|008)' --timeout=180000 --reporter=list,json
```

These are proposed owner/QA commands, not executions by this audit. Existing long full matrices and frozen QA snapshots must remain untouched. Parent retains the separate inactive unknown-route fix and all development dispatch.
