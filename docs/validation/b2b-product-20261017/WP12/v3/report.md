# WP12 real product journey preparation v3

Date: 2026-10-17. Status: **source prepared; feature acceptance not executed**.
Parent retains orchestration, dependency acceptance and merge authority. This is
an additive preparation handoff, not approval to merge an incomplete acceptance
suite into main.

| Input | Immutable revision |
| --- | --- |
| Plan and companions, planning PR12 | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Original application base | `d65261d18de4522fb9a66104aabb5750104fb8b8` |
| Atlas, merged PR18 | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| Preparation integration checkpoint | `4954accaf0e4a0c88f8179b949886b1fcece8fa7` |
| New journey source commit | `a45af4b258576f7660295eea5ad3d04eb2cb7dee` |
| WP06 receipt/context, PR24 | `fd138190e18ba84dcf47c1fc81ad535d051d8ff4` |
| WP07 receipt/context, PR23 | `f45f3041b9c399e5ca27c64b2304e90a5e689c71` |
| WP08 receipt/context, PR25 | `ff43b4d29337ade87132eb288d4bde82db843ca6` |
| WP09 receipt/context, PR26 | `3217cadb9148d0772b3bc68bd0abc0a64bb85140` |
| WP10 receipt/context, PR22 | `67b63f922c845e728ddbf8768deeee7cf9baf560` |
| WP11 receipt/context, PR27 | `26f6d4e99a9a504bcdb93ec1b16d0f8c1e06cfeb` |

Producer heads informed authoring through their actual sources, receipts, QA
lists and composition requests. Their reported tests were not run by this
receipt. The integration checkpoint already contained prior WP12 commits and
was fast-forwarded without rewriting published history. It is context only;
parent has not supplied the final accepted combined head/dependency map.

## Concrete source handoff

Eight new `apps/b2c-web/e2e/b2b-product-*.spec.ts` files author **52 distinct
reserved scenario IDs**. Two isolated helpers bind the actual runner-side map,
real password admission, frozen `ProductEndpoints` input/output validation,
real authorized fixture writes and actual producer DOM labels. No generated DB
ID, relation, DTO, handler response, injected component prop or test-only UI is
used as feature acceptance. Fault injection only delays, loses or blocks actual
transport; held responses originate from the real server.

Journeys cover tenant/branch denial and roles, incomplete and ranged routine
editing, period preview/apply, timezone continuity/history and immutable issued
versions, closed/open four/three/one accounting, actual partial/completion/void,
loaded-form offline recovery and exact retries, serialized successors and
two-device conflicts, reviewed alternatives and retained segments, owner health
import/consent/revocation, organization-specific consent loss, inactive access,
strict owner download and reactivation. Actual Spanish labels remain product
content; repository-authored prose/comments are English.

The scenarios are not all fully implemented obligations: **36 of the original
88 browser IDs still need authoring**, and broader variants of some authored
IDs also remain. [Coverage](coverage.md) and the complete
[scenario source map](scenario-source-map.json) distinguish source presence,
qualifications and remaining work. Twenty unit/API/evidence obligations remain
with their owners. The original 108-obligation inventory and final 88-ID gate
are unchanged.

## Checks actually performed

Checks ran on the exact source bytes committed as `a45af4b`; later changes in
this receipt are documentation only. Environment activation used
`source /workspace/.onboarding/activate.sh`, supported pnpm 12.7.0 and the
locked Playwright 1.63.0 package. Dependency materialization used the existing
lockfile; shared manifests and lockfile were not edited.

| Check | Result |
| --- | --- |
| `pnpm --filter @klisteniapp/b2c-web typecheck` | Passed, no diagnostics |
| Scoped `pnpm exec eslint` on the eight new specs and two new helpers | Passed, no diagnostics |
| Scoped `pnpm exec prettier --write` on those same owned source files | Completed before checks |
| `node scripts/check-b2b-boundaries.mjs` | Passed |
| `node --test apps/b2c-web/e2e/fixtures/b2b-product/report-validation.test.mjs` | 6 passed, 0 failed, 0 skipped; [output](collector.tap) |
| Playwright unified HTTP `--list --reporter=json` | 52 distinct IDs, 6 projects, 312 discovered cells, 0 discovery errors |
| Playwright white-label HTTP `--list --reporter=json` | 52 distinct IDs, 6 projects, 312 discovered cells, 0 discovery errors |
| Actual final collector against each partial discovery | Rejected both incomplete inventories as required; [negative gate evidence](final-gate-negative.json) |
| Git staged diff whitespace | Passed |
| Effective author/committer guard | Pablo Coronel `<git@pablocoronel.com>` verified |

[Discovery evidence](discovery.json) projects the real CLI output into exact
project metadata and source/ID/result cells; original task output paths and
SHA-256 hashes are retained. Every discovered cell has an empty `results` array.
The two configurations are **624 discovery cells, zero feature browser tests
executed**, not 624 passes. No feature failures/skips were produced because no
feature run occurred. HTTPS discovery/execution, screenshots and product DB
browser execution were not performed in this receipt. Earlier v1/v2 results
were not rerun or added to these totals.

## Integration and acceptance blockers

[Owner requests](owner-requests.md) list the exact fixture navigation bindings,
real workout entry, health notification readiness and selected local recovery
binding needed by these specs. Missing actual activation or entry points yield
explicit annotated unavailable skips; broken declared bindings and failed
DOM/API assertions fail. Such skips cannot satisfy the strict final runner.

The parent reports that activated unified/WL HTTP composition and real event
stream readiness are being validated in an upcoming checkpoint. This receipt
does not re-test or judge that unpublished composition using the older context
checkpoint. Once parent supplies its immutable combined head, QA must adapt to
the actual advertised routes/controls, finish missing variants, then execute
all 88 IDs across Chromium/WebKit 320x740, 430x932 and 1440x1000. Every mode
requires independent evidence. The exact download assertion remains
`/api/b2b/self/exports`, catching both missing and doubled self prefixes.

The matching sandboxed 1.63 runtime is already available from the unchanged
[v2 receipt](../v2/report.md); no empty-default-cache browser-unavailable claim,
new download or historical runtime rerun is made here. Trusted HTTPS still
requires valid existing certificate/trust inputs. No sandbox, TLS, origin,
realm, seed-topology or disposable-DB guard was relaxed.

Only the ten owned source files and new `WP12/v3/` evidence were changed.
Shared configs, seeds registration, routes, manifests, lockfile, application
features, v1/v2 evidence and the original final runner/inventory are unchanged
by these two preparation commits. Existing Yoga preview/provenance failure,
physical/release checks, providers, production/real users, application merge and
deployment remain outside this handoff. No final product acceptance is claimed.
