# WP07 v4: local programming grid width fix

**Local only.** No push, PR creation/reopening, deleted remote branch recreation
or main merge. Parent's concurrency hold remains in effect; the unexpected PR21 /
PR32 closures and integration-branch deletion have not been investigated or resolved
by this work. Parent retains dispatch, composition and merge authority.

- Executable base: `22310c7ee29423e7672a8e74dc801557adab53e9`.
- Read-only diagnosis: `8f53931effaa66e738018d6fd3f4f1b57d40205b`,
  `INTEGRATION/v12/planning-diagnosis/owner-request.md`.
- Local source: `17215c6c6990d92402e30c410bce5dac6ac73049`.
- Local branch/worktree: `fix/b2b-programming-grid-width-v1`, `/workspace/wp07-grid`.
- Exact application delta: [application.patch](application.patch); full source and
  two dedicated harness files are listed in [files.txt](files.txt).
- Complete raw/published log hashes, source/runtime/bundle hashes and applicability:
  [evidence.json](evidence.json). Earlier WP07 reports remain unchanged.

## Actual fix and important difference from the handoff

The only application file changed is owned `features/programs/product/programming.css`:

```css
.programming-grid > * {
  min-width: 0;
}
.programming-grid > .field {
  contain: layout;
}
```

The requested minimum-width rule works when injected into the already-rendered
baseline diagnostic. **The static rule alone did not fix initial rendering** in
this matching native runtime: both editors remained 371px/51px scroll, although
Field's computed minimum became 0. The first full matrix with only that rule had
24 passed checks, 6 failed, 0 skipped; failed groups' subsequent functional assertions
were unexecuted and are not counted as passes. [Results](min-only-results.json).

A fresh static `contain: layout` on the direct grid Field wrappers repairs the
initial render too. Inline-size containment, flex/grid display and explicit width /
maximum width did not independently repair that static state. The selected extra
constraint is narrowly scoped to those owned wrappers. It is **layout containment,
not paint containment**; field/document/body/main overflow stays visible, and no
labels, IDs, names, values, option arrays or controls are shortened or hidden.
No application JavaScript, shared Field, root, API, schema, actual/history, schedules,
QA spec/fixture, exports or manifests changed. Parent should review this additional
property rather than assume the handoff's single-rule counterfactual proved static
acceptance. Diagnostic measurements are preserved in the adjacent logs.

## Native before/after evidence

The dedicated harness renders the actual PeriodImpactEditor and GoalProgramEditor,
which use the actual StageScheduleEditor, AccountProvider and shared/owned styles.
It retains the exact full UUID routine labels, synthetic duration option and demo
names from the handoff, and separately exercises a legitimate 150-character publication
and the exact preserved-version fallback. Baseline and fixed JavaScript bundles
have **identical SHA-256**; only the owned stylesheet differs. Baseline builds use
source CSS read at exact executable base, then the fixed owned CSS is restored.

| State | Native WebKit320 document/body | Actual horizontal scroll range |
| --- | --- | --- |
| Period baseline | 371px | 51px |
| Two-stage/incomplete-date goal baseline | 371px | 51px |
| All final 320px states | 320px | 0px |

Final Chromium and WebKit profiles: 320x740 and 430x932 touch/mobile, 1440x1000 desktop.
**30 checks passed, 0 failed/skipped; 48 fixed-state layout measurements all fit their
viewport and have actualScrollRange 0.** [Full native results](native-results.json),
[compact widths](width-summary.json), [screenshots](screenshots).

The native driver checks initial and applied period states, two-stage incomplete
goals and valid gaps, preserved-version fallback and full 150-character option text.
It exercises native weekday/routine/date controls, blocks apply before impact
confirmation, preserves the exact preview fingerprint/revision and displayed linked
session identity, shows actor/revision/changed-field audit details, rejects missing
end dates and overlaps before any component dependency call, then saves/enrolls a
valid goal. Labels and native focus/Tab remain intact; no unhandled page errors.
Screenshots of the final 320px period/audit state were visually reviewed.

The component dependencies are explicit typed synthetic callbacks; no product API,
auth service or real database is called by this native harness. Runtime uses the
matching official Playwright 1.63 image, WebKit 26.6 revision2359 and Chromium 153,
UID 1001, network-none, existing verified seccomp and no-new-privileges, with a
read-only runtime mount. Chromium sandbox is enabled and TLS verification is not
bypassed. The local HTTP loopback page uses its native secure-context classification.
No global crypto, IDB, security-context or network shims are installed.

## Other checks and limits

Node 24.19.0 / pnpm 12.7.0, frozen lockfile/dependencies:

| Command | Result |
| --- | --- |
| `pnpm --filter @klisteniapp/b2b-web test` | 299 passed, 0 failed/skipped |
| `pnpm --filter @klisteniapp/b2b-web typecheck` | pass |
| `pnpm --filter @klisteniapp/b2b-web lint` | pass |
| `pnpm check:b2b:boundaries` | pass |
| `pnpm build:b2b` | pass; existing large-chunk warning |
| Scoped Prettier, source/staged whitespace, runner syntax | pass |
| Effective Git identity | Pablo Coronel `<git@pablocoronel.com>` |
| Atlas engineering content | 176 reviewed files pass; human provenance/language review still needed |

Existing programmingComponents.test.ts semantic/native-date/preserved-version
coverage ran unchanged. No CSS-source/string assertion substitutes for native
layout. API/DB suites were not rerun for this CSS-only change; no backend, contracts
or prescription/mutation logic changed. Native callback assertions are component
regression evidence, not a database/history/authorization acceptance claim.

The initial standalone library harness omitted Vite's production define and failed
before finding controls; its bootstrap log is preserved, with no scenario pass
claimed. The corrected builder uses the ordinary build-time production define.
A task-local diagnostic page also needed UTF-8 metadata to match the actual app;
setup attempts are not included in passing matrix totals. Subsequent measured
static-minimum failures remain preserved and separate from the final result.
Terminal whitespace/blank EOF lines were normalized before freezing this local
receipt; evidence.json records raw and published hashes. Screenshot/JSON bytes are
unchanged. Test iteration totals are not added together.

## Local delivery and parent follow-up

Application-only patch: this directory's application.patch (also
`/tmp/wp07-grid-delivery/application.patch`). Full source/test commit patch:
`/tmp/wp07-grid-delivery/source-and-tests.patch`. The application patch was
forward-apply checked against a temporary index at executable BASE_SHA, and reverse
checked against the tested local source. No shared/root file was edited to verify it.

After parent accepts and composes the exact local source, QA owns rerunning original
PROGRAMMING-004/008 against BOTH unified and White Label HTTP modes, first WebKit320
and then the affected matrix, using the pinned QA files/unchanged viewport predicate
from the handoff. Those full application scenarios were not rerun here and are not
promoted to passes by this isolated native result. Root routing, unrelated features,
trusted HTTPS/Secure-cookie and physical-device acceptance remain with their owners.
No production/paid/provider calls, security changes or deployment occurred.
