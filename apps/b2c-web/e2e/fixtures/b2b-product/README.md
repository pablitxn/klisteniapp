# WP12 product acceptance preparation

This directory contains the original scenario inventory, synthetic fixture intent,
strict browser collector and current executable feature helpers. The 88 reserved
browser IDs now have owned specs against the parent's accepted v2 contracts.
WP00 owns transport authority and migrations; INTEGRATION owns the registered
seeds, configs and combined application head. No skipped placeholder establishes
acceptance. Source-bound execution and limitations are recorded in the additive
WP12 validation revisions.

`scenarios.json` reserves exact IDs, final spec paths and titles for 88 browser
scenarios, plus owner unit/API and evidence-review obligations. Its `blocked`
states describe preparation readiness, not Playwright results. Do not add a test
that merely asserts inventory contents and count it as product acceptance.
The immutable pinned plan is recorded in the inventory and validation report.

`topology.ts` generates 22 synthetic actor definitions across two brands and four
branches. Keys are logical references for a seed adapter; they are not database
IDs or payload authority. It includes an unassigned cover coach, separate old/new
admin intent, a higher role in a different branch, an inactive/active dual-brand
member, and an identity without membership. No credentials are generated or read.
INTEGRATION must bind these references through WP00-approved seed interfaces,
return server-issued IDs, and preserve per-project disposable schema isolation.

`calendar.json` supplies independent four/three/one, same-day-slot, DST and period
impact oracles. `health/synthetic-v1.json` is an existing-format Klisteni JSON file
with fabricated manual measurements/activity. It grants no sharing. Reimport it
for deduplication, or change one value with the same source identity for an atomic
conflict. `health/unsupported.csv` must fail; raw ZIP is also unsupported.

Use `scenarioTitle(id)` in the final `test(...)` declarations and
`assertProductViewport` after meaningful transitions. Semantic focus, accessible
labels/status, touch and authorization assertions remain required in each spec;
a screenshot or a viewport assertion alone never satisfies the scenario.

Preparation integrity check, from the app root after environment activation:

```sh
node apps/b2c-web/e2e/fixtures/b2b-product/validate-preparation.mjs
```

For the final wave, supply the parent's exact accepted combined head, a JSON map
of accepted WP00-WP11 and WP13 commit SHAs, and an INTEGRATION-owned config. All
input commits must be ancestors; reconcile squash/different-history receipts with
the parent rather than substituting a moving ref. The runner records actual
Playwright leaf results and refuses a missing scenario or matrix cell. A skipped,
flaky, failed, interrupted or undiscovered case cannot produce a green receipt.

```sh
source /workspace/.onboarding/activate.sh
node apps/b2c-web/e2e/fixtures/b2b-product/run-browser.mjs \
  --accepted-head=FULL_PARENT_ACCEPTED_SHA \
  --dependencies=/tmp/parent-accepted-dependencies.json \
  --mode=unified-http \
  --config=playwright.b2b-product-unified.config.ts \
  --output=/tmp/wp12-unified-UNIQUE_RUN
```

Run separately for `white-label-http` and `white-label-https-valid-trust`; each
receipt attests only its mode/head. The configs are maintained by INTEGRATION;
this preparation does not edit them. Every one of the six projects must expose
truthful `metadata.b2bProduct = { mode, engine, width, height, touch }`; metadata
does not itself verify browser launch policy. The config owner must preserve the
matching locked runtime, Chromium sandbox, certificate verification and explicit
synthetic transport. The runner requires a clean checkout, pnpm 12.7 and a
dedicated loopback `B2B_TEST_DATABASE_URL` whose name contains b2b/test and has no
connection options. Set its value privately; never put it in a command or report.

Evidence goes to a fresh `/tmp` directory, with sanitized JSON/logs and artifact
paths. Only synthetic data may be in traces/screenshots; inspect before promoting
them to a versioned report. Supply full unit/API/static/build and owner evidence
separately. This runner cannot establish physical-device, HTTPS in HTTP mode,
provider, production or historical QA acceptance.
