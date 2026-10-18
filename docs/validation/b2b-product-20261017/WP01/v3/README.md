# WP01 UI-only People and audit amendment

Status: owned UI implementation ready; root composition and browser acceptance remain pending. This is an additive follow-up to WP01/v1-v2, not a rewrite of their immutable receipts or the integration candidate.

## Inputs and ownership

- Frozen dependency/candidate: `591feb1fd6a29306b5dc08a70ae5335a0ce01422`, integration PR21, source `9c9f1929fcc1fe203bdae86f7dfbd14f7e406614`.
- Tested UI code head: `912f603b0f268da795c042b493bb407eab6eb6c4` on isolated branch `feat/b2b-people-audit-ui-v2`.
- Original plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`; Atlas: `ce45d206a2ed4035f8003a3303abd1fff98e09b8`. Existing repository/Atlas instructions and navigation skill remain applicable and were already read in this task; Atlas identity/revision were rechecked unchanged.
- Read the integration v3 receipt, amendments005/006, real ProductWorkspace composition, current strict DTO/client endpoints, selected-role policy and actual people/invitation/audit services before implementation.
- The parent returned a **UI-only** lease: `features/people/**`, new scoped audit feature modules and dedicated tests. Astra retains ACCESS, root composition, contracts/routes/migrations/manifests and all shared state. QA retains cross-feature specs/fixtures. No shared or API file was edited.
- [code-files.txt](code-files.txt) lists the exact 12 source/test paths and [code-files.sha256](code-files.sha256) pins them. The final evidence-only commit is identified in the draft PR body.

## Implemented journeys

`PeopleWorkspace` receives the shell's actual selected context, generation/realm, access key and guarded client factory. It never constructs another authentication/session controller or infers a role from another branch. Its keyed lifetime clears departed identity data; root-stream loss hides private projections and requires fresh validation. Read cancellation and epochs reject late/superseded rosters and write acknowledgements, including transports that ignore abort.

The People view includes search, explicit loading/empty/blocked/error states, selected-role labels, existing inactive historical subjects, role changes, membership state, and both trainer/member grant controls for the selected branch. Grant writes preserve every other active/revoked branch row because updateMember replaces the complete array; CAS binds the original revision. Role changes create no implicit branch grants. Administrative controls require the exact selected admin/superadmin role and capabilities. A last visible active superadmin receives a clear advisory guard; the server remains authoritative for races. Last-superadmin, tenant/role denial and stale-revision errors are distinct and recoverable. Dirty person fields survive list refresh and cannot overwrite a newer revision without explicit discard/review.

Invitations expose only supported storage: one active trainer/member function in the selected branch, or a privileged organization role with no extra grants. Multiple invitation grants/sedes are explicitly unavailable. The existing CONTRACT request in WP01/v1 remains the exact future storage amendment if broader support is desired; no new schema or silent grant loss is introduced. Successful invitation URLs are private, selectable, explicitly dismissible and cleared on context loss. Confirmed forms reset, including confirmation through explicit retry.

`PeopleController` freezes an uncertain permission/invitation operation in memory and disables competing edits. Explicit retry uses the same operation/invitation IDs, expected revision and exact payload. Known 4xx rejection does not enable blind replay; 401/403 clears protected projections. There is no background retry, persisted staff cache or cross-identity operation storage.

`AuditDrawer` accepts an existing authorized resource ID and uses the current client. People permission history and a scoped planning-resource lookup are available. Known composed planning actions are localized; rows show actual actor name/ID, server time, changed-field names and revision/resource/scope/operation references. Unknown historical content remains explicitly unknown; no raw health/actual values or invented before/after content appears. The native modal has a labelled heading, Close focus, Escape handling, focus return, request cancellation, loading/empty/error/retry states and stale owner/response guards. Planning views can reuse the drawer under their own lease.

Scoped CSS supports wrapping long names/IDs, a viewport-bounded drawer, visible focus and 44px controls. Native labels/checkboxes/selects/forms permit keyboard and touch operation. Actual viewport, focus-trap and touch acceptance still require the QA run below; source/SSR checks are not browser evidence.

## Validation

Runtime: Node `v24.19.0`, pnpm `12.7.0`, frozen lockfile. No dependency upgrade or configuration/security change. This UI-only amendment made no database/API/schema changes and did not rerun real PostgreSQL API tests; the integration receipt's 232 API passes are historical candidate evidence, not new UI-owned acceptance. The original WP01/v1 producer-predicate failure is likewise historical and is not carried forward as a current result.

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile --ignore-scripts --store-dir /workspace/.onboarding/pnpm-store` | Passed, dependencies unchanged |
| Dedicated `node --test tests/peopleUi{Model,Controller,Components}.test.ts` through owning pnpm package | **16 passed, 0 failed, 0 skipped** |
| `pnpm --filter @klisteniapp/b2b-web test` | **201 passed, 0 failed, 0 skipped** |
| `pnpm lint` | 14 package tasks plus boundary/format checks passed; final changed package lint rerun passed |
| `pnpm typecheck` | 14 package tasks passed; final changed package typecheck rerun passed |
| Explicit owned TypeScript/TSX/CSS Prettier check | Passed |
| `pnpm check:b2b:boundaries` | Passed |
| Standalone B2B and synthetic-profile unified instance builds | Passed; existing large-chunk warnings |
| Independent Vite library build of actual `PeopleWorkspace.tsx` and its audit/CSS dependencies | Passed; validates the new entry before shared root binding |
| Root-binding patch application check | Passed, **not applied** |
| Scoped diff whitespace, Conventional Commit/PR-template and effective identity checks | Passed; see metadata receipt |
| Cross-feature browser / physical device / valid-trust HTTPS | **Not executed or accepted** by this amendment |

The first focused run failed because a new controller constructor used a TypeScript parameter property unsupported by Node24 strip-only execution. It was replaced with ordinary field assignments. Subsequent focused/full runs above pass with zero skips; there are no skipped cases represented as passes. Logs are retained as `.txt`; only trailing whitespace and terminal blank lines are normalized before freezing, with original and retained hashes in `log-provenance.json`. No result/count is changed.

## Exact integration handoff

Apply [root-binding.patch](root-binding.patch) after merging this UI source. It only imports `PeopleWorkspace` and replaces the existing inline People implementation with a typed delegation. It preserves the shell's real `createClient`, `accessKey` and guarded `HealthAccess` context. No dummy transport/service, broadened role, new route, AccountProvider or new API registration is introduced. The root patch was generated/apply-checked against the candidate's unchanged root file and remains unapplied under Astra's lease. Optional `branchName` improves the label; otherwise the actual selected branch ID is shown.

Both existing application consumer builds passed with the current inline root unchanged. The independent library build and SSR tests compile the new feature; these are **not** a claim that the new People UI is already composed or browser-tested in either application. After applying the root patch, INTEGRATION must rebuild both consumers and QA must execute the supplied scenarios. Shared planning editors can open `AuditDrawer({createClient, resourceId, resourceName, actors, signal, close})` from an actual routine/program/enrollment action; no planning file was edited here.

The parent retains dispatch, acceptance, integration and merge decisions. This UI lease is returned at the final published head. No ACCESS/API lease is claimed, no new Cloud task was dispatched, and no main merge, activation, deployment, real data/provider access or credential/security change occurred. Existing immutable snapshots/log IDs and unrelated release gates remain unchanged.
