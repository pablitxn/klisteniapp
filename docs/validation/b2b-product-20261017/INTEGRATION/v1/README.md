# Initial composition receipt v1

Source checkpoint: `b46341b8657e804b9fcf32ee80a1c532d6d38998` on
`integrate/b2b-product-v1`. This receipt is immutable baseline evidence; later
producer integration must get a new revision. Product flags remain false.

| Accepted input                            | Immutable SHA                              |
| ----------------------------------------- | ------------------------------------------ |
| App main, refreshed before handoff        | `d65261d18de4522fb9a66104aabb5750104fb8b8` |
| Atlas, unchanged                          | `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |
| Plan                                      | `447d77ebb5587e319018e7b56003f0ef7299bb6c` |
| WP00 frozen foundation                    | `0b611064a91b87b3a17274cabca5415bcf1d7d55` |
| Included WP13 compatibility               | `6d0b5619c3f18ae4c2c52566e3e478166c60f00e` |
| WP12 accepted preparation/runtime receipt | `e71c5c4273a9e18b7422a0250626729417de8a95` |
| Additive QA merge                         | `dd4c585`                                  |

All accepted inputs are ancestors of the source checkpoint. ACCESS's `http.ts`,
`service.ts`, `organization-context.ts`, `white-label-access.ts`, frozen contracts,
migration 006, canonical Atlas and lockfile are unchanged from WP00. Parent owns
Cloud dispatch; WP01 holds ACCESS. This checkpoint starts no additional feature
work and does not merge app main.

## Actual validation

Node 24.19.0, pnpm 12.7.0, PostgreSQL 17.11 in a task-owned disposable container
bound only to loopback port 55441. The database contained synthetic fixtures only.
No production, real user, provider or external health access occurred.

| Check                                  | Result and evidence                                                                      |
| -------------------------------------- | ---------------------------------------------------------------------------------------- |
| Actual app/SQL HTTP composition        | 4 passed, 0 failed/skipped; [log](composition.txt)                                       |
| Root regressions + harness unit checks | 30 passed (26 existing + 4 new), 0 failed/skipped; [log](unit.txt)                       |
| QA report-validator tests              | 6 passed, 0 failed/skipped; [log](qa-validator.txt)                                      |
| QA inventory integrity                 | 108 obligations, 88 reserved browser scenarios, 0 product tests; [log](qa-integrity.txt) |
| Affected B2C web/config typecheck      | passed; [log](typecheck.txt)                                                             |
| New scripts/configs ESLint             | passed, exit 0 with no diagnostic output                                                 |
| New scripts/configs/docs formatting    | passed; [log](format.txt)                                                                |
| Package boundaries                     | passed; [log](boundaries.txt)                                                            |
| Current B2B production build           | passed; existing large-chunk warning; [log](build.txt)                                   |
| Git diff and repository identity       | passed                                                                                   |

Total executable Node tests in this checkpoint's acceptance: **40 passed**.
These are 4 composition + 30 root/harness + 6 QA validator tests, not new product
browser results. The composition log was captured against source bytes committed
unchanged in `b46341b`; the later static/unit checks ran on that commit. The build
ran against the identical unchanged application source. No full package-suite
or browser rerun is claimed. Foundation's separate 147-test receipt remains
[WP00 evidence](../../WP00/v1/README.md), not added to these totals.

Six actual white-label HTTP project environments each had two brands/four
branches/22 named actors, with distinct schemas, secrets, ports and media roots.
Auth login, current member identity, static login page, brand context, readiness,
legacy assignment reads, foreign-brand/project cookie rejection and unknown-host
421 all passed. Every environment verified 001–006 migration idempotence,
legacy/new admin stored-role mapping, unassigned cover coaches, mixed branch
roles, inactive/active dual-brand membership, no QA platform grants, no health
sharing and exact old-record preservation hashes. All schemas/runtime files were
removed. Partial-startup cancellation also removed its own schema and files.

An initial new-test expectation incorrectly required 404 for unknown host; the
existing API's correct response is 421. The assertion was corrected and the
complete four-test composition suite rerun successfully. No app behavior was
changed to satisfy it. The clean rerun is the retained acceptance log.

## Handoff and remaining gates

Use [the harness guide](../../../../testing/b2b-product-harness.md) for exact
configs, mode names, fixture-map endpoint, synthetic password export, port layout,
private database setup requirements and startup commands. QA can now verify the
actual baseline app in its accepted Playwright 1.63 runtime. That runtime's image
and cache are not installed in this integration environment; its generic WP12
transport receipt is not an app/browser result here.

- **Unified functional dependency, WP01:** the full topology hits the existing
  `503 WHITE_LABEL_REQUIRED` guard for domainless login/session access. Static HTML
  and readiness work. No ACCESS bypass or reduced fixture topology was introduced.
- **HTTPS gate:** no pre-provisioned trusted certificate/key was supplied here.
  Missing inputs fail closed before database setup. Browser trust, TLS and Secure
  cookie behavior remain unexecuted. No certificate generation, trust change or
  verification bypass was used.
- **Feature gate:** WP01–WP11 handlers/UI and producer seed extensions are not in
  this checkpoint. V2 routines are unassigned in secondary branches; old readers
  retain 426 protection. Product activation stays false. All 88 reserved browser
  scenarios remain pending; QA's final runner is intentionally not invoked.
- **Existing unrelated debt:** the earlier known Yoga preview issue and deferred
  physical/model/Blender acceptance are not rerun or resolved by this harness.
- **CI:** no hosted CI result is asserted by these local logs.

The parent subsequently supplied WP02/WP04/WP05 receipts for the next integration
revision. They are outside this immutable baseline receipt. UI dispatch may use
frozen contracts and reviewed producer interfaces while composed acceptance waits
for their registered services and remaining dependencies.
