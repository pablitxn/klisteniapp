# Integration v3: composed application candidate

Candidate source: `9c9f1929fcc1fe203bdae86f7dfbd14f7e406614` on
`integrate/b2b-product-v1`, [draft PR21](https://github.com/pablitxn/klisteniapp/pull/21).
This merges QA source/evidence `6cadf53f038f1778d11d415956441797cbe0012b` after
application source `87cf020`. The evidence-only commit containing this receipt
follows that source. Main remains `d65261d18de4522fb9a66104aabb5750104fb8b8`;
Atlas remains `ce45d206a2ed4035f8003a3303abd1fff98e09b8`.

The [original plan](../../../../plans/klisteni-b2b-development-v1.md), work
packages, old milestones and immutable owner receipts remain intact. Parent
retains dispatch and acceptance. INTEGRATION retains shared contracts, schema,
HTTP authorization, root composition, harness and lockfile ownership. No main
merge, production activation/migration, deployment, paid service or real data
access occurred.

## Actual application bindings

| Area | Composed behavior | Main implementation |
| --- | --- | --- |
| Identity | Fresh unified realm binding; real own organization/branch/role bootstrap; explicit superadmin; inactive branchless export identity; validated selection restoration | `product-bootstrap.ts`, `product-identity.ts`, migration009, shared session controller |
| Planning | Actual WP07 reusable routine and goal/stage editors, publication, enrollment and period preview/apply; active selected-branch planning roster | `ProductWorkspace.tsx`, `features/programs/product/` |
| History | Current/past/future routine continuity, weekly summary/move, original routine versions, actual session history/revisions, inactive historical subjects | `ProductHistoryPage.tsx`, `SessionHistory.tsx`, `product-history.ts` |
| Workout | Real occurrence entry, immutable issued routine/equipment/alternatives reads, selected-target doses, editable accepted v2 records, IndexedDB draft/outbox and real access/save transport | `ProductWorkout.tsx`, `features/training/sync/` |
| Health | Manual supported JSON preview/confirm, own health, explicit branch consent/revocation and current trainer-only shared view | `HealthSettings.tsx`, `TrainerHealthGate`, existing guarded health services |
| Inactive | Global restricted boundary, actual `/api/b2b/self/exports`, separate selected owner-local pending export, optional separate B2C invitation | `RestrictedMembership.tsx`, `exportOwnerLocalWorkout`, WP06 identity-only services |
| Remote invalidation | Transactional identifier-only notifications, independent API-process listeners, actual authenticated SSE through gateway/proxy, target projection clearing | migration010, `product-events.ts`, `productStream.ts` |

All integrated producer heads are listed in `evidence.json`. WP04's exact own-v2
alternatives amendment and WP03's retired-assignment/stale-end amendment are
included. The obsolete WP11 request to prepend another `/self` was not applied.

Amendments005–006 document additive historical reads and lifetimes. Healthy
streams no longer expire every45seconds. Concurrent subscribers wait for complete
LISTEN setup; actor quotas protect the global stream budget; shutdown closes
streams before draining HTTP. Target heartbeats authorize consent metadata
without reading health records. Background focus checks preserve unchanged
editor identities. Temporary root disconnection aborts guarded requests but
retains owner-local editors; a successful fresh handshake is required before
requests resume. Trainer health still clears immediately on disconnection.

## Reproduce the candidate

Use Node24 and the repository's pnpm12.7, the frozen lockfile and matching
Playwright1.63 runtime. The supplied execution environment has a task-owned
PostgreSQL17.11 container on loopback55441. API tests use `klisteni_b2b_test`;
the harness uses the distinct `klisteni_b2b_integration_test` database. Do not
share a database with API tests dropping schemas during BetterAuth introspection.
Do not copy credentials into evidence or use production data.

From the repository root, with a guarded loopback `B2B_TEST_DATABASE_URL` already
set to a disposable test database:

```bash
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @klisteniapp/b2b-web build
B2B_PRODUCT_TEST_ACTIVATE=1 B2B_PRODUCT_USE_BUILT=1 \
  pnpm --filter @klisteniapp/b2c-web exec playwright test \
  --config playwright.b2b-product-unified.config.ts
```

Use `playwright.b2b-product-wl-http.config.ts` for the other HTTP mode. The configs
start the real API/gateway/proxy and six independent fixture schemas. Preserve
320/430/1440 Chromium/WebKit projects, sandboxing, zero retries and verified TLS.
`B2B_PRODUCT_PORT_OFFSET` permits a distinct available port range. For manual
local inspection after building:

```bash
B2B_PRODUCT_TEST_ACTIVATE=1 B2B_PRODUCT_MODE=unified-http \
  node scripts/b2b-product-e2e-server.mjs
```

The control endpoint is `http://127.0.0.1:5600/fixtures?project=0` in unified mode
and5700 in WL HTTP, plus the chosen offset. Use the returned project gateway or
proxy ports and actual actor identities. The public synthetic password is
`PRODUCT_TEST_PASSWORD` in `scripts/b2b-product-seed.mjs`; it is not an application
credential. The secondary coach/member pair has an actual issued v2 enrollment
with six occurrences. Inactive actors have real restricted access. Health sharing
is not pre-granted; QA creates it explicitly through the real API/UI.

| Fixture route key | Actual route |
| --- | --- |
| programming | `/manage?view=planning` |
| history | `/app?view=history` |
| health | `/app?view=health` |
| trainerHealth | `/manage?view=shared-health` |
| people | `/manage?view=people` |
| reports | `/manage?view=reports` |

There is no separate workout URL. `entryPoints.workoutButtonName` is
`Abrir sesión`, inside the real `#scheduled-occurrence-ID` card. The actual
trainer-health route uses the `Persona` selector, then the delivered shared-view
controls. `Sede y función` option values are JSON arrays `[branchId, role]`, not
the colon-delimited values guessed by the older QA helper. QA should adapt its
owned fixture helper to this real UI before execution. Reload restores a saved
selection only after current server choices validate it.

`readiness.remoteHealthInvalidation` and `readiness.localRecoveryBinding` are true
only in the activated synthetic fixture. They advertise implemented paths for
testing, not accepted results. The latter binds the actual selected WP09 document,
owner scope and store to WP11; it is not a fake export callback or a full inventory
of every local draft. Self exports remain exactly `/api/b2b/self/exports` with the
selected organization query.

## Validation and source qualification

| Check | Actual result |
| --- | --- |
| Full API after lifecycle server amendments | 232 passed, 0 failed, 0 skipped |
| Prior full application API source04ac103 | 228 passed, 0 failed, 0 skipped |
| React controller/package | 18 passed, 0 failed, 0 skipped |
| B2B web package | 185 passed, 0 failed, 0 skipped |
| Contracts/domain/client at composed source04ac103 | 22/34/27 passed; these packages are unchanged by87cf020 and the QA merge |
| Combined9c9f192 typecheck/lint/build | 14/14/16 tasks passed; existing large-chunk build warnings retained |
| Activated actual unified and WL HTTP harness | 2 passed, including real password login, bootstrap/access, planning/history, inactive exports and SSE ready through the actual gateway/proxy |
| Product browser execution by this owner | 0; QA execution and final combined acceptance remain outstanding |
| Valid-trust HTTPS/physical device | Not run or accepted by this receipt |

The full API run used exactly the API source now committed in87cf020; subsequent
edits before that source commit were controller/UI-only.9c9f192 adds only QA
source and immutable evidence. The combined builds/checks and harness were run
against9c9f192. Raw logs and hashes are retained beside this receipt. No runtime
guard, TLS check or sandbox setting was relaxed to obtain passing results.

Initial composition failures are preserved as diagnostics: two race tests waited
for the old organization-lock query after the inactive gate added an earlier lock;
their waiting assertions now recognize both exact paths. Demo reset needed the
new owned session-binding table and migration-count assertions needed10. The
full228-test rerun passed. The first lifecycle React run exposed a legacy
organization-selection reset; the product-only clearing fix passed the final
18-test suite. These were corrected; they are not accepted failures.

## Remaining implementation and acceptance gates

1. **QA execution and source completion:** WP12/v3 authored52 of88 browser IDs
   (312 discoverable HTTP cells per mode), with0 executed and36 IDs plus variants
   still to author. Preserve its strict missing/skipped/unavailable final gate.
   Adapt the actual selection and trainer-target navigation, then run a small
   composed subset immediately; broaden only after its real failures are fixed.
   Include >90second editor continuity, focus/offline recovery, exact pending
   operation identities, remote consent revocation with a delayed old response,
   inactive export and active/inactive public/back navigation.
2. **Historical detail presentation:** exact immutable `enrollmentRevision` and
   atomic `occurrence`+current-enrollment reads now exist. WP08 still needs an
   issued-period revision detail affordance and per-record atomic pairing for
   inclusion display. Its current flattened arrays may select a weekly snapshot
   before the paired linked snapshot. Do not claim complete period-history UI.
3. **Legacy editing/adoption:** old snapshots/history/export remain intact.
   Verified supplements can be read, but the product UI does not yet expose
   reviewed legacy supplement adoption or convert revision-zero/pending legacy
   records into an editable v2 workflow. It honestly blocks missing prescription
   rather than inventing doses. Existing-session and first-legacy-correction API
   support is present; a preserved, explicit UI migration remains required.
4. **Local recovery across reload:** active-to-inactive recovery uses the actual
   selected document. Its selected recovery pointer is currently in root memory.
   An inactive reload needs a durable owner/realm-scoped selection lookup; fresh
   legacy-entry reopen also needs an explicit resume-versus-new-session choice.
   Never guess an IndexedDB identity or silently replay a legacy pending operation.
5. **People/audit UI breadth:** the actual page lists people and changes active
   membership through ACCESS. Role/grant/invitation editors and the scoped audit
   drawer are not composed yet; server APIs and restrictions exist. Do not treat
   hidden controls or server-only tests as completion of those UI journeys.
6. **HTTPS and final review:** valid pre-existing certificate/trust inputs and
   full browser/physical acceptance remain separate. No new trust or TLS bypass
   is authorized. Parent must reconcile final source and receipts in Atlas and
   retain the existing Yoga/model/Blender milestone qualifications.

## Ready parallel follow-ups for parent dispatch

- **WP12:** On9c9f192, adapt only owned QA specs/fixtures to the actual route and
  selector bindings above; execute a focused real HTTP subset, publish failures
  with traces and exact candidate SHA, then complete remaining IDs. Preserve
  shared harness/config and immutable v1–v3 evidence. Model: Sol6.1 high fast.
- **WP08:** Use `legacyAssignments`, `enrollmentRevision`, `occurrence` and
  `historySubjects` from amendment005. Own only history/calendar/report feature
  modules and focused tests. Add original period detail and use each returned
  occurrence/enrollment pair together for actual inclusion, including moved,
  cancelled and unloaded-week records; preserve original linkage and distinguish
  continuity from actuals. No shared contracts/schema edits. Sol6.1 high fast.
- **WP09:** Own training storage/sync modules and focused tests. Define a durable
  selected owner-document recovery pointer and explicit legacy resume/new choice;
  preserve exact pending operation IDs/bytes, CAS and owner/realm boundaries.
  Provide the small root binding requested from INTEGRATION. Do not manufacture
  legacy doses or silently replay blocked v1 payloads. Sol6.1 high fast.
- **People/audit UI:** Parent may lease new feature modules to an existing UI
  owner, consuming current `people`, `updateMember`, invitation and audit APIs.
  Require exact selected roles, last-superadmin/tenant denials, actor attribution,
  mobile keyboard/touch and desktop coverage. Root ACCESS/contracts remain here.
  Sol6.1 high fast; INTEGRATION review remains Astra ultra.
- **Legacy adoption contract proposal:** WP04/WP09 can jointly propose the exact
  reviewed supplement and first-correction binding from their existing services.
  INTEGRATION must freeze and implement shared endpoint/schema changes before
  parallel UI implementation; historical snapshots and unsupported doses remain
  unchanged. This is a technical integration dependency, not a new import-format
  product question.

Integration order: QA adaptation/execution may start now; merge independent
history and recovery modules, then shared root bindings, then reviewed legacy
adoption and people/audit UI. Run affected checks and finally the complete
combined QA matrix. No remaining executor failure blocks this dispatch. The
GitHub CLI GraphQL read returned403; connector metadata operations remain the
authorized fallback, and Git fetch/push succeeded without credential changes.
