# WP08 v2: immutable issued periods and atomic historical inclusion

Date: 2026-10-17. Status: owned historical-detail amendment implemented and
validated on the parent-supplied composed dependency. Parent retains dispatch,
monitoring, final composed acceptance and main-merge decisions. This supersedes
v1's missing-reader implementation blockers; v1 remains byte-for-byte unchanged.
No shared source, contract, root route, manifest or QA browser file was edited.

## Immutable revisions and reproduction

| Input | Revision |
| --- | --- |
| Original implementation base / stacked PR25 base | `0b611064a91b87b3a17274cabca5415bcf1d7d55` |
| Previous published WP08 head | `ff43b4d29337ade87132eb288d4bde82db843ca6` |
| Parent-supplied PR21 dependency | `591feb1fd6a29306b5dc08a70ae5335a0ce01422` |
| Dependency application source | `9c9f1929fcc1fe203bdae86f7dfbd14f7e406614` |
| WP08 v2 source and tests | `346efab0c08ed28b19d2ea030e04f424641241b7` |
| Exact composed validation tree | `11ac37a4ea9cc0cfb0c5575fb8a771a6ed61972f` |
| Plan / Atlas | `447d77ebb5587e319018e7b56003f0ef7299bb6c` / `ce45d206a2ed4035f8003a3303abd1fff98e09b8` |

Read `INTEGRATION/v3/README.md`, adopted contract amendments005/006, their actual
DTOs/client endpoints/server SQL, and current member/staff root bindings. Both
repositories' AGENTS and actual Atlas skill/standards remain applicable from v1.
The selected Atlas checkout remains at its pinned revision; it was not edited.

PR25 remains an additive branch from the original base. The amendment preserves
the six already integrated owned-file adjustments for original references,
workout callbacks and eligibility-aware moves. No dependency implementation from
packages/API/root was copied into the branch. [files.txt](files.txt) lists the18
owned source/test files in this amendment, with exact bytes bound by
[source-files.sha256](source-files.sha256). Their bytes match the tested overlay.

Reproduce by checking out the exact PR21 dependency, then applying
[candidate-owned.patch](candidate-owned.patch). It contains only the incremental
history/calendar/report/test changes against that candidate. Apply-check and
application to an isolated candidate index produced the exact tree above;
composition.json records this identity. The live validation worktree was
`/workspace/wp08-v2-validation`, with those exact source files overlaid. Root,
API, contracts, migration, package exports/manifest/lockfile and browser files have
zero diff from the candidate. The branch itself does not include new shared
contracts, so run current checks with the declared dependency, not the old
foundation alone. Evidence-only commits follow the source; the PR receipt binds
the final published head.

## Behavior and historical correctness

- `loadRoutineHistory` consumes `continuity`, `sessions`, `legacyAssignments` and
  one `occurrence` read per unique linked occurrence, including records outside
  the selected week. It validates all tenant/branch/member scopes and original
  occurrence/routine/enrollment linkage before exposing the projection. A denied
  linked read rejects the projection rather than presenting partial old data.
- Each atomic `occurrence` response stays paired with the enrollment returned by
  that same SQL read. Actual eligibility uses that pair through the existing
  domain `isCompletionEligible`; weekly or continuity arrays are never searched
  for a substitute enrollment. Tests deliberately make independent snapshots both
  older and newer. Moved, cancelled and outside-week actuals retain their original
  IDs, scalar values and bidirectional routine links while exclusion remains
  truthful. Date labels use the linked occurrence's frozen original timezone.
- Every actual with an occurrence and every calendar card has a native expandable
  issued-period affordance. It requests `enrollmentRevision(enrollmentId,
  issuedEnrollmentRevision)`. It never confuses the issued goal-program revision
  or latest period with that immutable issued enrollment revision. The detail
  shows saved objective, dated stages, exact original routine references, actor
  and recorded time. Continuity separately offers explicitly current-period
  revision details. Missing/wrong revision, scope, enrollment or original stage
  fails visibly; no historical data is reconstructed from current content.
- Legacy assignments render even when unexecuted, retired or archived and when
  no start callback exists in a staff view. Issued identity, attribution and exact
  routine link remain available. They create no scheduled absence or occurrence.
  Starting remains limited to the existing optional callback for eligible active
  assignments; this worker adds no session controller, adoption or outbox logic.
- Staff history consumes the approved `historySubjects` interface, retaining
  inactive historical targets. The optional owning-feature loader validates the
  response branch/organization and uses current access lifetimes; it requests no
  `people` substitute or health data. The existing root's compatible roster load
  remains untouched. Its small optional replacement is an exact owner patch.
- Calendar actual status uses the same atomic contexts. Its authoritative counts
  remain the server summary; a missing context is explicitly unknown rather than
  an invented missed/completed record. Partial, completed, missed and excluded
  labels, same-week CAS moves and original identities remain distinct. There is
  no substitution-count metric or inferred completion.

## Actual checks

Toolchain: Node24.19.0 / pnpm12.7.0; frozen dependency installation against the
candidate lockfile. A new PostgreSQL17.11 container was isolated on a loopback-only
ephemeral host port with synthetic `b2b_wp08_v2_test` and per-test schemas. No
existing database/container, production data, credentials or external provider
was used. It was removed after the API run. No security/trust/runtime check was
relaxed.

See results.json and the adjacent logs for exact commands/counts. The40 focused
cases include the earlier21 plus19 new loader/transport/rendering cases. Those
focused cases are included in the complete204-test web suite, not additional
independent test passes. Actual JSX rendering uses the app's declared Vite and
React server renderer; it is not browser interaction or authorization evidence.

Root typecheck and lint passed14/14 tasks, with6 and7 unchanged-package cache
hits respectively. B2B boundaries/full formatting passed; B2B build passed with
its existing large-chunk warning. Contracts22/domain34/client27 passed with zero
failures/skips. The full API command runs the candidate's real current historical
readers and authorization/migration/transaction regressions against disposable
PostgreSQL. The final full API run passed232/232 with0 failures and0 skipped tests; see results.json and api.log.

The first broad API run used a different disposable database basename and hit an
existing exact-name fixture guard in30 cases:202 passed /30 failed /0 skipped.
That is retained in api-db-name-diagnostic.log and is not counted as acceptance.
The required `klisteni_b2b_test` database was then created inside the same new
task-owned container, without changing any test, assertion or guard, and the full
suite was rerun. Tests after each initial guard failure were unexecuted in that
first attempt; only the subsequent complete run supplies their acceptance.

Source/evidence hashes, diff whitespace, effective author/committer identity and
scoped English Conventional Commit checks were verified. New comments, tests,
reports and PR text are English; UI strings retain the existing Spanish product
localization. No force push, source-history rewrite, main merge or deployment.

## Owner handoff and remaining acceptance

[owner-requests.md](owner-requests.md) contains the exact current component/client
bindings and QA scenarios. Existing ProductHistoryPage root props remain valid,
including original-version, workout-start, legacy-entry and edit callbacks. Its
new reads stay inside amendment006's guarded client lifetime. No new root route,
provider, contract or dependency registration is required for issued-period and
atomic inclusion behavior.

[root-binding-request.patch](root-binding-request.patch) optionally replaces the
root Reports wrapper's duplicate roster load with the owning-feature scoped
loader. It passed apply-check but was **not applied or tested**; INTEGRATION owns
that root edit. Direct consumers of ProductExecutionHistory must supply intact
`occurrenceContexts` rather than independent occurrence/enrollment arrays.

QA still owns the cross-feature browser specs and the final combined matrix.
Product-browser scenarios executed by WP08 in this amendment: **0**. Native button
interaction, touch/keyboard focus, delayed old responses, current context/stream
transitions and mobile/desktop Chromium/WebKit remain final composed QA gates;
none is counted as passed or silently skipped. Matching Playwright1.63 guidance
is available in the pinned QA/runtime receipt. Trusted HTTPS/Secure-cookie,
physical devices, historical Yoga/model/Blender and deployment gates remain
separate. Legacy editing/adoption/recovery and people/audit breadth remain with
their existing owners; this amendment does not assert those flows are complete.
