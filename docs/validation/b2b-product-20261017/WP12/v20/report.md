# WP12 v20: complete unit/API/static evidence on v11

Application: `bd30eab5b2a33c3f3e8a7692649632ec85103431`.
Accepted integration evidence: `89409dcdbd4faedccfeec8ee236932191c6195d3`.
QA source: `1374b94ed441365789d2756742afa8306022c0a0`.

Every declared package test script has a completed passing result on these
exact source bytes. Results are reported per package and execution; no grand
test total or newly green root invocation is invented. The failed root Turbo
attempt in v19 remains failed. Its three completed pure-package results are
retained; the ten never-completed package scripts run separately, and the entire
B2B API suite reruns against its exact guarded disposable database basename.

| Package                       | Tests passed | Failed | Skipped | Execution                                 |
| ----------------------------- | -----------: | -----: | ------: | ----------------------------------------- |
| `@klisteniapp/anatomy-viewer` |          4/4 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2b-api`        |      244/244 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2b-client`     |        31/31 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2b-contracts`  |        22/22 |      0 |       0 | Completed child in preserved root attempt |
| `@klisteniapp/b2b-domain`     |        34/34 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2b-react`      |        19/19 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2b-ui`         |          2/2 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2b-web`        |      299/299 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2c-api`        |        97/97 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/b2c-web`        |      204/204 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/catalog-base`   |          2/2 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/geometry`       |        33/33 |      0 |       0 | Separate unchanged package script         |
| `@klisteniapp/model-assets`   |          3/3 |      0 |       0 | Completed child in preserved root attempt |
| `@klisteniapp/scene-schema`   |        79/79 |      0 |       0 | Completed child in preserved root attempt |

All rows also have zero cancelled/todo tests. [Package evidence](package-results.json)
links each exact command/result and encoded raw output. The B2B API final run
is one complete 244/244 result with database configured and zero skips, not an
addition of the prior 214/30 run and a subset retry. Its untouched health guard
now points to `/klisteni_b2b_test` inside this task’s disposable PostgreSQL. The
B2C API separately runs 97/97 with its own disposable database. No provider or
persistent-development database is used.

B2C web 204/204, scene-schema 79/79 and catalog-base 2/2 retain the B2C/import/
catalog regressions on this candidate. The current 299/299 B2B web execution is
independent of the producer’s separate 299 count; those executions are not added.

## Root checks

| Command                                            | Actual result                          | Cache/execution qualification                      |
| -------------------------------------------------- | -------------------------------------- | -------------------------------------------------- |
| Root five-script Node test command                 | 26/26 pass; zero fail/skip/cancel/todo | Actual new execution                               |
| `pnpm check:b2b:boundaries`                        | Pass                                   | Actual execution                                   |
| `pnpm typecheck --concurrency=1`                   | 14/14 tasks pass                       | Zero cached                                        |
| `pnpm exec turbo run lint --concurrency=1 --force` | 14/14 tasks pass                       | Zero cached                                        |
| `pnpm format:b2b:check`                            | Pass                                   | Actual check                                       |
| `pnpm build --concurrency=1`                       | 16/16 tasks pass                       | 14 cached typechecks; both consumer builds execute |

[Exact root command evidence](root-checks.json) records exits, terminal times
and hashes. Raw encoded logs preserve existing chunk-size warnings. The initial
Turbo/pnpm discovery failures remain in v19; the copied public tool’s mode repair
changes no binary bytes, dependency version, global setting or security guard.
No failed setup result is silently changed to a pass.

The root script command covers the five declared unit-test files for preview
provenance/relocation, B2B boundaries, development environment and gateway. It
does not claim the separate Yoga extraction/provenance gate or model/Blender/
physical acceptance has been repaired or rerun. No whole `pnpm check` or release
acceptance claim is made.

## Database and runtime disposition

[Read-only postchecks](api-database-postcheck.json) find no non-system schemas
and no public tables in any of the three API test databases, including the prior
incorrectly named task database. They all belong to `wp12-v7-postgres`; the
browser matrix uses a different database. Test databases and the two existing
task containers remain available for the ongoing acceptance. No provider,
production or real-user data was accessed.

Application and QA byte proofs remain separate: 1,218 application files match
the accepted candidate and 26 QA files match the immutable QA source before each
full browser wave. Those are source inventories, not browser test counts. No
application implementation, shared config, seed registration, manifest or
lockfile changes occur in this receipt.

## Continuing browser acceptance

R32/R33 each retain their own completed 30/30 affected HTTP regression waves in
v19. R34 unified and R35 White Label continue their full 528-cell matrices, each
covering 88 scenarios in Chromium/WebKit320/430/1440 with one worker, zero retries
and no failure cap. Their active outcomes are separate; this unit/static receipt
does not attest a full browser pass or add regression repeats to matrix counts.

Trusted HTTPS remains a separate explicit valid-trust input blocker. Supported
HTTP work continues. Parent retains orchestration and final acceptance; no main
merge, history rewrite, operational security relaxation or extra agent task occurs.
