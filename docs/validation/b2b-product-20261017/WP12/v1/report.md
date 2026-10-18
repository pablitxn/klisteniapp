# WP12 preparation receipt

Date: 2026-10-17. Status: **preparation complete; feature acceptance blocked**.
Parent retains orchestration, dependency acceptance and merge authority.

| Input | Immutable revision |
| --- | --- |
| Application base | `d65261d18de4522fb9a66104aabb5750104fb8b8` |
| Plan / draft planning PR12 | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| Atlas / merged PR18 | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| Tested preparation code | `402e5c9af2b37b7fd16c0ddf9f3b8c31842840f3` |
| Branch | `test/b2b-product-acceptance-v1` |
| Accepted WP00 / combined feature head | Not supplied; never substituted |

Both mounted checkouts began clean on `work` at the supplied base/Atlas SHAs.
Application main was rechecked remotely at the same base. The exact plan was
fetched and its main, work-packages and prompts companions read. Both AGENTS,
Atlas AGENTS and actual navigation/maintenance skills, source-of-truth/privacy,
language/commit/Cloud identity/PR standards, October 17 source/minutes and A00-A08
were consulted. `atlas-navigate` supplied the authority route; no Atlas writes,
orchestration changes or extra development agents occurred. Model/service-tier
selection controls are not exposed in this task; no worker dispatch or model
substitution was performed or claimed.

## Deliverables and coverage

- [Scenario inventory](../../../../../apps/b2c-web/e2e/fixtures/b2b-product/scenarios.json):
  108 unique obligations across all packages and C01-C08. Of these, 88 reserve
  exact final browser IDs/titles in roles, programming, history, week, sync,
  alternatives, health and inactive specs. [Coverage](coverage.md) maps each
  package, assertion and target. Owner unit/API tests stay with feature workers.
- [Synthetic fixtures and usage](../../../../../apps/b2c-web/e2e/fixtures/b2b-product/README.md):
  two brands/four branches/22 actors, unassigned trainer coverage, old/new admin
  intent, branch role differences, multi-membership and foreign identities;
  four/three/one and same-day obligations, DST and period impact oracles;
  fabricated current-format manual health JSON and unsupported CSV.
- Viewport/screenshot helpers and a final evidence runner require exact immutable
  inputs, six unique projects, every reserved scenario in every project and a
  dedicated local synthetic DB. Collector tests prevent missing/skipped/retried
  or interrupted cells being counted as passes. No new DTO or SQL seed is invented.
- [Exact owner requests](integration-requests.md) identify config/testMatch,
  seed binding, fixture map, contract interfaces and matching browser transport.
  No shared config, seed registration, manifests, lockfiles or feature code changed.

There are no failing or skipped placeholder feature specs. The final
`b2b-product-*.spec.ts` files intentionally await accepted dependencies. Their
absence is an explicit blocked acceptance state, not a green empty test run.

## Actual validation

See [checks.json](checks.json) for exact commands, scopes and earlier corrected
failures. Commands used Node 24.19.0 and activated pnpm 12.7.0. The default shell's
fallback pnpm 11.25.0 was not used for repository checks.

| Check category | Passed | Failed | Skipped | Scope |
| --- | ---: | ---: | ---: | --- |
| New evidence collector Node tests | 6 | 0 | 0 | Harness reporting only |
| Retained health import/schema Node tests | 25 | 0 | 0 | Existing pure B2C/schema regressions |
| Synthetic health fixture assertion groups | 5 | 0 | 0 | Preview, dedup, atomic conflict, CSV/ZIP rejection |
| Supported browser environment smoke | 2 | 0 | 0 | Synthetic page only, Playwright 1.62 |
| Product browser scenarios | 0 | 0 | 0 | **88 blocked; none executed** |

Preparation integrity (108 IDs, full WP/C coverage, topology/calendar), scoped
ESLint, B2C-web typecheck including new e2e helpers, runner syntax, existing B2B
boundary checks and Git whitespace checks passed. An initial helper syntax error
failed typecheck/lint, was corrected before the tested code commit, and both
checks passed afterward. No application feature fix was made.

Negative runner probes exited 2 with zero product execution: one refused a
missing parent-accepted SHA; another supplied the current code SHA solely to
exercise the next guard and refused the absent INTEGRATION config. That probe
does not turn this SHA into an accepted parent dependency. Planned matrix cells
remain blocked, not skipped or passed.

The effective Git author/committer guard passed without changing identity.
The Atlas instruction checker passed its 176-file allowlist, which does not
certify application prose. Its commits CLI hardcodes the Atlas root and failed
on the application base; invoking the same unchanged official
`commits(app_root, base)` function via `runpy` checked the application commit
successfully. English/provenance review remains a human judgment.

## Browser diagnosis

The requested shared browser README is absent. Existing instructions identify
the supported helpers under `/workspace/.onboarding/browser-support`; their
`start.md`, `REPORT.md`, local relay and smoke scripts were read before use.
[runtime.json](runtime.json) records the actual fresh-task outputs.

Both sequential cached-image checks loaded a task-owned HTML page on loopback
port 48712 through the private internal-network relay: Chromium 151.0.7922.34
as UID 1001 with sandbox enabled; WebKit 26.5 as UID 1001 in nonroot container
isolation. Each returned HTTP 200 with no failed requests. Helper containers and
networks were removed; the task page server was stopped. No production/provider
site was accessed. No host/application trust, sandbox, credential or security
setting was changed.

This establishes available supported browsers, correcting an overly broad
"browser unavailable" interpretation of an empty default cache. It does not
establish compatibility with the app's locked Playwright 1.63.0. That requires
Chromium 1243 / 153.0.8010.12 and WebKit 2359 / 26.6; the installed smoke image
is Playwright 1.62.0. Its GET/HEAD relay also cannot exercise authenticated POST
flows. No runtime was silently substituted. No HTTPS/Secure-cookie, physical
device, WebGL, Safari/iOS or full application acceptance is claimed by this smoke.

## Remaining blockers and safe next steps

1. Parent supplies accepted WP00 contracts and the final WP01-WP11/WP13 combined
   head. QA then consumes frozen DTOs, IDs and expected receipts and implements
   the reserved feature specs. CONTRACT/INTEGRATION thread
   `01a149e8-505b-7469-987b-3d99819c90ed` remains the sole shared owner.
2. INTEGRATION binds seed intent and registers six-project product configs for
   unified and scoped WL flows. The exact paths and matrix request are in the
   owner request. Existing testMatch/viewports do not meet the complete matrix.
3. The environment/integration owner prepares the matching locked 1.63 runtime
   using the reviewed nonroot/sandbox/seccomp pattern and a confined full-stack
   transport, without editing installed helpers or relaxing security. Valid-trust
   HTTPS is separate; do not inherit raw WL's certificate bypass.
4. Resume on that immutable candidate for full U/API/STATIC/build and browser
   execution with real disposable PostgreSQL and zero unexpected DB skips.
   No DB was created or mutated during this preparation. New tests, failures,
   screenshots and counts belong in a new immutable evidence revision.

Historical Yoga preview failure/provenance, earlier browser totals including
the old 1218 count, KLI-01/WL milestones, production/provider/backup/device and
release gates remain unchanged and were not rerun or accepted here. Nothing was
merged or deployed. The published draft PR and final head are the delivery
receipt; this v1 directory freezes when published, with later amendments in v2.
