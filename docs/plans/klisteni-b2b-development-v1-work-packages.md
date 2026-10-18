# Klisteni B2B v1 work packages

Read [the main plan](klisteni-b2b-development-v1.md) first. All contracts C01-C08, the evidence baseline, exclusions, immutable reports and model restrictions apply to every package. These are subdivisions of Atlas A00-A08, not replacement roadmap items. None has been dispatched by this planning task.

## Ownership and shared paths

| Owner seat | Exclusive ownership / handoff |
| --- | --- |
| CONTRACT (WP00, Astra ultra) | `packages/b2b-contracts/**`; migration SQL/registry/readiness and migration fixtures; contract ADR; new transport DTO fixtures. No other worker edits these. Follow-up deltas return to this seat |
| INTEGRATION (WP14, Astra ultra; architecture thread when returned by parent) | Root/package manifests, `pnpm-lock.yaml`, tsconfigs, boundary checker, package export barrels, `b2b-client/src/client.ts`/input-response registration, shared Playwright configs/fixtures, app route/navigation/workspace composition, final reports. WP00 receives an exclusive initial lease for required client/export registration, returned before consumers start |
| ACCESS (WP01 then WP06, GPT-6.1 Sol high/fast) | `apps/b2b-api/src/{http,service,organization-context,white-label-access}.ts`, auth capability modules and People UI. Sequential lease: WP01 then WP06; never two tasks editing this family. Feature workers deliver route/service registration requests to this owner; INTEGRATION takes final wiring lease after WP06 |
| PLANNING (WP02) | Existing `apps/b2b-api/src/training/{index,repository,rules}.ts`, new `planning/**`, new `b2b-domain/src/prescription.ts`; legacy training stays a compatibility facade |
| RECORDS (WP03) | New `apps/b2b-api/src/{sessions,schedule}/**`; `b2b-domain/src/{sessions,schedule}.ts`; no concurrent edits to PLANNING's legacy training files |
| ALTERNATIVES (WP04) | `apps/b2b-api/src/catalog/seed.ts`, new catalog projection module and `b2b-domain/src/alternatives.ts`; new substitution components only. Existing legacy `b2b-domain/src/training.ts` changes go through INTEGRATION |
| HEALTH API / UI (WP05 / WP10) | Separate `apps/b2b-api/src/health/**` and `apps/b2b-web/src/features/health/**`; neither edits shared auth/DTO files |
| TRAINER UI (WP07) | `apps/b2b-web/src/features/programs/**`, new goal-program feature modules and their CSS; consumes alternative policy components |
| MEMBER HISTORY (WP08) | Existing `features/training/{AssignedRoutines,ExecutionHistory,HistoryPage}.tsx`, new routine-history/week-calendar components; Reports feature; never session draft/hook |
| WORKOUT UI (WP09) | Existing `features/training/{Session,SessionStep,useTrainingSession,sessionDraft,RestTimer,restClock}.*`, new local store/outbox/sync modules and session-specific styles; no history/calendar edits |
| INACTIVE UI (WP11) | New restricted-access/export/invitation components and pure training interchange adapter; composition requests go to INTEGRATION |
| QA (WP12) | New task-specific browser specs/fixtures and test documentation; shared fixture/config changes via INTEGRATION. Production modules excluded |
| IMPORT (WP13) | Pure shared health parser/adapters in `packages/scene-schema` plus B2C importer compatibility wrapper/tests; package manifests/export wiring via INTEGRATION. No B2B contract files |
| ATLAS (WP15) | One canonical source/entry/wiki/decisions/questions/roadmap/catalog/log receipt in `sysadmin-workspace`, after actual integrated evidence; no other worker changes Atlas |

The parent appoints the Astra INTEGRATION seat at W0 for per-wave shared wiring/manifest/export/config leases; WP14's dependency on all producers applies only to final composition and receipt. It must not leave workers waiting for an owner that cannot start until their own work is complete. The architecture thread takes that seat only after the parent explicitly returns integration ownership.

Every worker may edit its own tests/report. When an existing test file is shared, add a uniquely named new test file instead, or request its owner to change the old expectation after integration. Existing broad integration tests that assert superseded behavior are updated by INTEGRATION/ACCESS, not independently by several workers. An ownership transfer requires an explicit parent receipt with last SHA; no implicit lease expiration.

## Common test commands and definitions

Use the declared pnpm 12.7 and Node >=24 when available; disclose deviations. A fresh task should read its environment startup instructions instead of copying baseline temporary paths. Use locked dependencies, no unsolicited dependency upgrades. Inspect command configuration before running. `B2B_TEST_DATABASE_URL` and `TEST_DATABASE_URL` may point only to disposable local/dev synthetic databases; never print credentials.

- **U:** `pnpm --filter @klisteniapp/b2b-contracts test`, `pnpm --filter @klisteniapp/b2b-domain test`, plus the owning package/app's `test` script. Run affected named new files directly with `node --test <paths>` during iteration.
- **API:** `pnpm --filter @klisteniapp/b2b-api test` with disposable PostgreSQL configured; verify **zero skipped DB tests**, migration upgrade/new-install/repeat and transaction races. B2C reuse also runs `pnpm --filter @klisteniapp/b2c-api test`.
- **STATIC:** `pnpm check:b2b:boundaries`, `pnpm typecheck`, `pnpm lint`; `pnpm build:b2b` for changed UI, both B2B consumers and full `pnpm build` at integration.
- **BROWSER:** `pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.b2b.config.ts <new-spec>` for unified B2B and the scoped role config below for cross-brand/branch scenarios. Add new specs to explicit testMatch via the integration owner. Required viewports: 320x740, 430x932 touch/mobile and 1440x1000 desktop, Chromium and WebKit. Use existing member/trainer harnesses as appropriate: `playwright.member-qa.config.ts`, `playwright.trainer.config.ts`, `playwright.white-label.config.ts`. HTTP synthetic evidence is separate from valid-trust HTTPS/Secure-cookie acceptance. No certificate bypass, trust changes or silently substituted browser runtime.
- Browser acceptance checks keyboard focus/labels/status announcement, no horizontal overflow at 320px, touch controls, loading/error/empty/conflict states, navigation/back/reload and account/brand/branch switch. Screenshots supplement assertions; they do not substitute for API isolation tests or physical-device acceptance.

New test paths below are intended deliverables and do not exist at baseline. Existing tests/evidence are named as regressions. Each package also runs STATIC relevant to its changes and documents actual commands/counts/skips.

## WP00 — Contract, migration and compatibility foundation

- **Atlas:** A00 plus shared A01-A08 foundations. **Model:** Astra ultra. **Branch:** `feat/b2b-contract-foundation-v1`. **Depends:** this plan revision. **Ready:** yes, first dispatch.
- **Goal/context:** replace conflicting behavioral assumptions with one executable contract before consumers diverge; current schemas are strict and current migrations stop at 005.
- **In:** ADR adopting C01-C08, v2 schemas and legacy adapters, explicit role/access capabilities, draft vs assignable types, target ranges/segments, program/stage/occurrence/session/revision/outbox receipts, health/consent/export contracts; additive SQL and migration IDs; authorized-context service interfaces; static client endpoints/fixtures; format-version/capability gates.
- **Out:** feature service/UI implementation, production migration, new watch formats, B2C billing. Do not rewrite old snapshot bytes or migration files.
- **Files:** CONTRACT ownership table; new `docs/adr/b2b-training-v2.md`, `apps/b2b-api/src/product-schema.ts`; migration/readiness additions to existing owner files; contract tests/fixtures. Coordinate IMPORT's pure health payload boundary without importing scene-schema into forbidden B2B layers.
- **Acceptance:** an ordinary worker can compile against named APIs without inventing semantics. Draft accepts empty/missing values; activation errors are structured. Legacy fixed-dose snapshots, old executions and pending POST retry payloads decode unchanged. Schema version discriminator routes old/new records before strict parsing. Role migration preserves existing brand admin capabilities without platform grants. Stable occurrence/segment identities and tenant-member FKs validated. JSON import normalized envelope/adapter mapping explicit. Versioned training interchange preserves ranges/units/provenance without flattening unsupported B2C fields.
- **Exact tests:** new `packages/b2b-contracts/tests/product-v2.test.ts`, `legacy-product-compatibility.test.ts`; `apps/b2b-api/tests/product-migration.test.ts`; old `white-label-migration.test.ts`, `packages/b2b-contracts/tests/roadmap.test.ts`, client response validation. Fixtures: empty DB; existing 001-005 database with admin/coach/member, two brands/four branches, published routine/assignment/execution/audit/media; migration twice; cross-tenant FK rejection; byte/hash stable historical JSON; new v2 records fenced from old strict routes; last-superadmin constraint; old tab capability/error. Run U, API, STATIC. Browser layout is not a WP00 deliverable.

## WP01 — Scoped trainer coverage, roles and attributable changes

- **Atlas:** A01. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-roles-audit-v1`. **Depends:** WP00. **Ready:** after contract freeze.
- **Goal:** every trainer can cover another trainer's users within current permitted branch; superadmin/admin capabilities and change attribution match d01.
- **In:** capability predicates, safe branch resolution for legacy routes, roster/member/planning/history authorization, org-superadmin hierarchy, invitations/promotion safeguards, historical-target access, audit write/read projections; People UI role labels/actions and audit presentation.
- **Out:** granting all brand branches implicitly, platform operator powers, health grant bypass, goal/stage features.
- **Files:** ACCESS lease plus new access/audit modules, `features/people/**`, own tests. Submit exact legacy training query predicate changes to PLANNING/INTEGRATION; all entrypoints must consume one scoped policy.
- **Acceptance:** same-branch unassigned coach can view user/history and edit/assign routine; foreign branch/tenant and ambiguous branchless requests denied. Admin cannot create/promote admin/superadmin; superadmin inherits own-brand admin; no self-escalation/last-superadmin loss. Actor/what/time reconstructs planning changes once per accepted mutation; retries don't duplicate audit. Inactive historical target is distinct from active planning target.
- **Exact tests:** new API `product-authorization.test.ts`, `product-audit.test.ts`; update existing `integration.test.ts:1701-1732` assigned-only expectation under single-owner integration; `white-label-authorization.test.ts`, `white-label-training.test.ts` retained. New web `peopleCapabilities.test.ts`; browser `b2b-product-roles.spec.ts` plus trainer-role harness at required mobile/desktop widths, two brands/four branches, queued revoke race and audit drawer keyboard checks. U/API/STATIC/BROWSER.

## WP02 — Draft routines, goal programs, stages and period changes

- **Atlas:** A02/A03. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-goal-programs-v1`. **Depends:** WP00; auth interface available; final acceptance after WP01. **Parallel:** WP03/WP04/WP05 on separate modules.
- **Goal:** extend existing reusable routines into dated goal programming without replacing old versions or evaluating trainer judgment.
- **In:** routine v2 draft persistence, complete publication/assignment validation, numeric target domain rules, goal-program/enrollment CRUD and revisioned stage schedules, period impact preview and audited apply, history continuity projection; emit deterministic schedule-change input for WP03.
- **Out:** actual log mutations, adherence counters, offline queue, trainer/member UI, shared schema/SQL edits.
- **Files:** PLANNING ownership; new `apps/b2b-api/src/planning/**`, `packages/b2b-domain/src/prescription.ts`; existing training facade compatibility adjustments. New modules use Context transaction, no second DB connection or tenant from payload.
- **Acceptance:** empty/incomplete drafts save/reload; assigning empty/missing dose fails with exact fields; complete fixed/range routine publishes immutable version. Stages ordered/nonoverlapping with explicit gaps/timezone/slots. Reusing one routine in two stages does not copy mutable identity. Moving periods previews affected obligations/log eligibility, creates revision and preserves all existing versions/assignments/logs. No balance scoring.
- **Exact tests:** new domain `prescription.test.ts`; API `goal-programs.test.ts`, `period-history.test.ts`; legacy `training.test.ts`/integration immutable-history cases. Include two sessions same day, stage gap/overlap, incomplete dates, range min/max/units, timed/reps/bodyweight/external load, archive/reuse, stale trainer revision, period move before/after logged work and actor audit. U/API/STATIC. UI tests owned WP07/WP08.

## WP03 — Stable occurrences, editable actual records and weekly adherence

- **Atlas:** A03/A04/A05. **Model:** GPT-6.1 Sol high/fast; Astra reviews contract-sensitive diff. **Branch:** `feat/b2b-session-ledger-v1`. **Depends:** WP00; final integration after WP01/WP02/WP04; can implement against frozen fixtures concurrently.
- **Goal:** durable actual history independent of calendar and one-count-per-prescribed-session adherence.
- **In:** new sessions/schedule services and pure rules, stable occurrence reconciliation, within-week reschedule, own draft/partial/completed revisions and void correction, CAS and immutable operation receipts, legacy revision-0 read/first-edit adapter, history projections, derived week revisions and explicit late correction.
- **Out:** shared legacy training file edits, automatic completion, auto-assignment of unbound legacy history, trainer editing another member's measurements, frontend outbox, irreversible deletion.
- **Files:** RECORDS ownership; new API `/sessions/**`, `/schedule/**`, domain `sessions.ts`/`schedule.ts`, own tests. Register service/routes through ACCESS/INTEGRATION.
- **Acceptance:** all C03-C05/C06 invariants; exact create replay still idempotent; changed create payload 409; editing with expected revision appends once; replay old accepted operation returns its receipt even after a successor. Four/three/one; partials/retries/repeated sessions never count twice. Date shifts preserve original linkage and change only current eligibility. Same-day slots separate; no inferred missed work for legacy routines. Latest void/correction updates affected weeks with auditable reason. Current revoked/inactive access rejects new/replayed writes before receipt lookup.
- **Exact tests:** new domain `schedule.test.ts`, `sessions.test.ts`; API `session-revisions.test.ts`, `weekly-adherence.test.ts`, `training-operation-races.test.ts`. Cases: DST 23/25h weeks, Monday/Sunday boundaries, enrollment timezone/device change, no stage/current stage, move within/outside week, four/three/one, partial-only, two slots/day, duplicate retry, stale CAS/two devices, late submission, completed-to-partial/void, period move across weeks, source-target segment changes and original snapshot unchanged. API real PostgreSQL concurrent transactions; U/API/STATIC. Browser owned WP08/WP09.

## WP04 — Reviewed alternatives projection and target-aware rules

- **Atlas:** A06. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-reviewed-alternatives-v1`. **Depends:** WP00, consumes WP02 publication interface; final integration before WP03/WP07/WP09.
- **Goal:** reuse 37 exercises/42 directed reviewed links, preserve conditions and target dose, distinguish explicit block from no reviewed option.
- **In:** API catalog metadata projection/provenance, existing-base-row enrichment design via CONTRACT migration, reviewed eligibility service, immutable version/legacy supplements, pure effective-dose/segment selection rules and reusable presentational condition/dose/block component in a new feature folder.
- **Out:** creating relationships, automatic inference from base/animation/muscles, biomechanics/equal-load claims, direct catalog imports into web/domain, editing Session/ProgramEditor concurrently.
- **Files:** ALTERNATIVES ownership plus `apps/b2b-web/src/features/alternatives/**`; seed metadata changes alone are insufficient because existing seed uses ON CONFLICT DO NOTHING. Submit migration request to CONTRACT and component integration to WP07/WP09.
- **Acceptance:** unchanged canonical exercise gets reviewed directed candidates by default; explicit per-routine-step block suppresses with notice. Relation/equipment/condition requirements enforced; local adaptations do not inherit unproven review. Target reps/time/sets/rest/laterality and no carried load; mid-workout change preserves prior actual sets through segment identity. Legacy manual lists remain labelled; historical snapshots are not rewritten. Count/validation stays 37/42 unless separately reviewed catalog change authorized.
- **Exact tests:** new domain `alternatives.test.ts`, API `reviewed-alternatives.test.ts`, web `alternativePresentation.test.ts`; retain `packages/catalog-base/tests/catalog.test.ts`, `packages/scene-schema/tests/exercise-planning.test.ts`, API `training.test.ts`. Cases all relation kinds/direction/no transitivity, 9 empty lists, trainer block, missing equipment, source/target time-vs-reps and laterality changes, changed local adaptation, existing seeded DB vs fresh, legacy supplement/idempotency, later catalog edits, immutable snapshots. U/API/STATIC; browser spec `b2b-product-alternatives.spec.ts` integrated by WP09/WP12.

## WP05 — Manual health storage and revocable trainer consent

- **Atlas:** A07. **Model:** GPT-6.1 Sol high/fast; Astra reviews disclosure boundaries. **Branch:** `feat/b2b-health-consent-api-v1`. **Depends:** WP00/WP13; final auth acceptance WP01.
- **Goal:** manual owner health data with explicit, revocable, scoped sharing.
- **In:** normalized JSON import preview/confirmation endpoint, atomic owner storage/dedup/conflict behavior, consent grant/list/revoke, scoped trainer read, no-store/revocation generation, owner export projection; inactivity revocation hook consumed by WP06.
- **Out:** automatic connectors, vendor adapters, B2C data access, health inside gym routine/audit snapshots, legal ownership claims, trainer offline cache.
- **Files:** `apps/b2b-api/src/health/**` and own tests; no shared route/auth/contract edits. Uses pure normalized adapter boundary, not B2C app modules.
- **Acceptance:** no consent denies trainer/admin/superadmin; wrong audience/category/tenant denied; grant allows precisely disclosed current authorized scope; revoke wins over later/in-flight disclosure and stale responses cannot repopulate app-controlled views. Consent and import are separate user acts. Deactivation revokes relevant gym sharing; reactivation never recreates consent. Health absent from ordinary gym exports/reports.
- **Exact tests:** new API `health-import.test.ts`, `health-consent.test.ts`, `health-revocation-races.test.ts`; retained B2C health/store/schema tests. Real DB tests for owner override, absent/revoked grant, role/branch change, queued read/export vs revoke, inactive state, idempotent JSON import/conflicts, malformed/oversized files and unsupported CSV/ZIP no-write. U/API/STATIC; frontend race/browser acceptance WP10.

## WP06 — Inactive authentication, self-export and reactivation API

- **Atlas:** A08 with A01/A07. **Model:** GPT-6.1 Sol high/fast; Astra review. **Branch:** `feat/b2b-inactive-export-api-v1`. **Depends:** WP01/WP03/WP05; same ACCESS owner, sequential lease.
- **Goal:** known inactive gym membership can authenticate solely to export and see separate B2C invitation while history remains accessible to authorized gym staff.
- **In:** purpose-limited session/access-state capabilities, route allowlist and stale-session enforcement, own versioned exports, training/health projections, inactivity consent revocation, reactivation preserving records/current grants and historical-target reads.
- **Out:** broad m.active bypass, restoring revoked grants, active membership through another tenant, pricing/payment/account conversion, production migration.
- **Files:** ACCESS lease plus new `apps/b2b-api/src/membership/**` and `exports/**`; exact root service/http binding done by this owner; transfer to INTEGRATION after delivery.
- **Acceptance:** inactive correct-host login succeeds restricted, missing/foreign membership rejected; no gym read/write/media routes or queued workout writes; own complete export valid without other-user/staff-private data. Gym authorized historical training reads survive, health remains revoked/private. Reactivation restores existing records and valid grants, no automatic B2C mutation. Domain generation/copied cookies retain denials.
- **Exact tests:** new API `inactive-access.test.ts`, `personal-export.test.ts`, `reactivation.test.ts`; retain white-label session/domain/training tests. Exhaustive route matrix for GET/HEAD/range/mutation, stale session, multi-membership, revoked branch, inactive with unsynced operation, consent auto-revoke, own export manifest and wrong-member ID. U/API/STATIC; WP11/WP12 mobile/desktop browser.

## WP07 — Trainer goal-program and routine editor

- **Atlas:** A02/A03/A06. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-trainer-programming-ui-v1`. **Depends:** WP00/WP02/WP04; WP01 capabilities.
- **Goal:** trainer saves incomplete work, builds goal/stage schedules and publishes/assigns complete prescriptions with visible audit/period impact.
- **In:** existing program editor extension, range/applicability controls, stage dates/slots/routine reuse, objective, incomplete draft persistence/recovery, assignment errors, routine-step block, period-change preview, stale revision recovery. Use existing editor draft infrastructure.
- **Out:** replacing navigation/session provider, grading balance, actual-log editing, concurrent Session files.
- **Files:** TRAINER UI ownership; unit/editor tests; root navigation requests to INTEGRATION.
- **Acceptance:** blank/incomplete saves server-side; no misleading completeness score; field errors actionable. Routine reused without changing prior publications. Explicit timezone, stage ordering/gaps, past/current/future preview, target dose/block and audit references. Account/branch change hides old draft and rejected/conflicting save retains work.
- **Exact tests:** extend `apps/b2b-web/tests/editorModels.test.ts`; new `goalProgramDraft.test.ts`, `prescriptionEditor.test.ts`; browser `b2b-product-programming.spec.ts` in trainer harness plus unified config. Required mobile/desktop/browser matrix; keyboard date/range inputs, 320px no overflow, two-trainer concurrent edit, offline draft/recovery, period impact acceptance, tenant switch. U/STATIC/BROWSER.

## WP08 — Mi rutina, continuity/session history and weekly calendar

- **Atlas:** A02/A03/A04. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-routine-history-ui-v1`. **Depends:** WP02/WP03, frozen DTOs.
- **Goal:** clearly separate prescribed routine continuity from dated actual work and expose today's/past/future stages and editable weekly schedule.
- **In:** AssignedRoutines/history/calendar/report views, bidirectional original routine/session links, stage/period revisions, effective eligibility/excluded actual work, same-week session move and week summaries, staff historical member navigation.
- **Out:** session draft/outbox files, substitution counts, personal activity chart used as adherence, implicit completion.
- **Files:** MEMBER HISTORY ownership and `features/reports/**`; no Session edits. Export button may delegate to WP11's component under integration.
- **Acceptance:** today highlighted in enrollment timezone; past/current/future and rest/gap states truthful; history shows original version/objective/actual date/variant and corrections; no substitution-count metric. Same-week moves preserve content and count; completed/partial/missed distinct; closed late-corrected week labelled. Legacy unbound logs not treated as scheduled absence.
- **Exact tests:** new web `routineHistory.test.ts`, `weekCalendar.test.ts`; browser `b2b-product-history.spec.ts`, `b2b-product-week.spec.ts`; retain `member-qa.spec.ts`, `b2b-member-roadmap.spec.ts`. Mobile/desktop touch/keyboard rescheduling with non-drag alternative; four/three/one, same-day slots, boundary week, period move/log-link persistence, two-brand isolation, report inactive history. U/STATIC/BROWSER.

## WP09 — Workout editing, durable outbox and conditional alternatives UI

- **Atlas:** A05/A06 plus A03/A04. **Model:** GPT-6.1 Sol high/fast; Astra reviews protocol-sensitive diff. **Branch:** `feat/b2b-workout-sync-ui-v1`. **Depends:** WP03/WP04; WP06 access-state interface before replay activation.
- **Goal:** users can edit truthful own work, recover offline drafts and choose valid target alternatives during workouts without saves implying completion.
- **In:** session forms/segments/target requirements, explicit completion, revisioned editing, IndexedDB draft/outbox migration, immutable operation payloads/successors, reconnect/retry/CAS conflict UX, storage failure/authorization-blocked recovery and local export.
- **Out:** health offline caching, provider sync, service-worker offline startup, silent conflict merge, other-member edits, history view files.
- **Files:** WORKOUT UI ownership; new `features/training/storage/**`, `sync/**`; dedicated tests.
- **Acceptance:** every C05/C06 state visible; reload/offline retains draft; saving never finishes; partial never promoted automatically; response loss same ID exact replay; follow-up edits use successor operations. Target changes after recorded source work preserve both segments and own target dose; no assumed load. Logout/brand/branch/account change cannot display/replay another identity. Inactive/revoked queue blocks and remains owner-recoverable; late ack doesn't repopulate departed session.
- **Exact tests:** extend `sessionDraft.test.ts`, `restClock.test.ts`; new `trainingOutbox.test.ts`, `trainingSync.test.ts`, `sessionSegments.test.ts`, `sessionEdit.test.ts`. Browser `b2b-product-sync.spec.ts`, `b2b-product-alternatives.spec.ts` under member and unified harness: offline loaded form/reload, reconnect, lost response, two tabs/devices, stale revision conflict, storage quota error, account switch/inactivity, target reps-to-time/per-side/count switch mid-session, block/empty notice, partial/completion distinction at mobile/desktop widths. U/STATIC/BROWSER.

## WP10 — Manual health import, privacy settings and trainer view

- **Atlas:** A07. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-health-ui-v1`. **Depends:** WP05/WP13 and shared access state.
- **Goal:** user initiates JSON import and controls clearly scoped sharing; trainers see only currently consented data.
- **In:** member health/import preview/errors/confirmation, settings grant/revoke/category/audience copy, authorized trainer health view, cancellation/no-store/live revalidation/disconnected hiding, owner export affordance.
- **Out:** medical inference, automatic imports, unsupported formats, new chart framework, changes to trainer authorization or B2C store.
- **Files:** `apps/b2b-web/src/features/health/**`; route requests to INTEGRATION; existing components reused without app imports.
- **Acceptance:** import never grants sharing; default private visible; exact audience/categories explained; revoke clears view including late responses and reconnect; no trainer persisted health state. Unknown format rejects honestly. Inactivity has no lingering grant or hidden unreachable revocation problem.
- **Exact tests:** new web `healthConsentState.test.ts`, `healthImportFlow.test.ts`; browser `b2b-product-health.spec.ts` at mobile/desktop widths across owner/trainer/other tenant, absent/granted/revoked consent, revoke in another tab while request pending, offline trainer view, JSON duplicates/conflict/unsupported file, keyboard preview/confirmation. Retain B2C health regressions. U/STATIC/BROWSER.

## WP11 — Restricted member UI, export and separate B2C invitation

- **Atlas:** A08. **Model:** GPT-6.1 Sol high/fast. **Branch:** `feat/b2b-inactive-member-ui-v1`. **Depends:** WP06/WP09; WP00 interchange contract.
- **Goal:** inactive login presents export and a separate paid B2C offer with no gym operation or automatic conversion.
- **In:** restricted route/screen, export progress/manifest/errors, optional owner-local unsynced export clearly separate from server records, safe configured B2C destination/invitation, reactivation refresh; pure versioned training interchange adapter/round-trip fixtures.
- **Out:** changing B2C subscription price/provider, creating accounts, identity linking, automatic import, claiming unsupported B2C dose fields were imported.
- **Files:** INACTIVE UI ownership, new `features/membership/**`, export adapter in an allowed pure shared boundary selected by WP00; composition only via INTEGRATION. Shared package/lockfile additions require owner lease.
- **Acceptance:** deep links/back/stale active screen lose gym access immediately; export includes own original routine/actual records and own health under privacy rules; invitation states separate product and user choice. No cookie/account/payment mutation on viewing/clicking. Reactivation restores current grants/history; unsupported B2C import fields preserved in interchange or rejected with explicit issues, never flattened/lost. Compatible user-managed routine semantics are verified through round-trip fixtures; full new B2C commercial onboarding is outside this batch.
- **Exact tests:** new web `restrictedAccess.test.ts`, shared `trainingInterchange.test.ts`; browser `b2b-product-inactive.spec.ts` with active/inactive/reactivated transitions, queued offline write, multiple memberships, downloaded JSON assertions, no cross-product requests and configured/unconfigured invitation. Mobile/desktop Chromium/WebKit; U/STATIC/BROWSER and affected B2C unit tests.

## WP12 — Synthetic regression harness and cross-cutting acceptance

- **Atlas:** A00/A01-A08 validation. **Model:** GPT-6.1 Sol high/fast. **Branch:** `test/b2b-product-acceptance-v1`. **Depends:** plan for initial read-only harness/fixture prep; WP00 for new DTO fixtures; final feature checks WP01-WP11.
- **Goal:** reproducible independent acceptance without reviving old QA milestones or masking pre-existing gates.
- **In:** inspect existing harness/setup, task-specific synthetic fixture builders, declarative scenario inventory from C01-C08, new `b2b-product-*.spec.ts` files (coordinate ownership with feature workers: QA writes final cross-feature specs, workers own unit tests), viewport assertions and exact evidence runner. Diagnose environment browser availability read-only; repair recoverable task-local setup without TLS/sandbox/security relaxation.
- **Out:** source feature fixes without reassignment, shared config/manifest writes, Yoga provenance repair, claiming old 1218 browsers passed on new head, physical/provider/release assertions.
- **Files:** `apps/b2c-web/e2e/b2b-product-*.spec.ts`, isolated `e2e/fixtures/b2b-product/**`, own validation report. Integrator owns shared testMatch/config/seed registration. During W0 do not introduce failing main tests before contract fixtures exist; deliver harness patch/scenario manifest.
- **Acceptance/tests:** all package acceptance cases mapped to exact spec/test ID; real DB two brands/four branches, role hierarchy, foreign ID/grant denial, period/log preservation, four/three/one, offline replay/revocation/target segments/health/inactive transitions. Browser matrix 320/430/1440 Chromium/WebKit, unified plus WL scoped flows; existing B2C/import/catalog regressions retained. Capture failures with sanitized fixtures, tested SHA and distinct blocked/skipped/passed counts. Full U/API/STATIC/BROWSER on combined head when available; known browser environment block is not a pass.

## WP13 — Pure health import boundary (independent preparation)

- **Atlas:** A07 reuse. **Model:** GPT-6.1 Sol high/fast. **Branch:** `refactor/health-import-adapter-v1`. **Depends:** plan for inventory/parity fixtures; WP00 reserves the pure API/destination before extraction, plus export/manifests lease from INTEGRATION; no B2B schema changes.
- **Goal:** expose existing normalized JSON parser/preview semantics to server use without importing B2C application/state into B2B.
- **In:** move pure format parsing/normalization/validation to `packages/scene-schema/src/health-import.ts` or the contract-owner-approved existing pure boundary; preserve B2C wrapper signature and tests; adapter interface/version/capability metadata. B2B API may consume via explicitly approved package dependency while forbidden B2B domain/web imports remain prohibited.
- **Out:** behavior changes, extra file formats, provider calls, B2B consent/storage/UI, direct edits of shared manifest/lock/boundary checker without lease. No new package required unless the current boundary demonstrably cannot support server reuse.
- **Acceptance:** byte-equivalent normalized existing fixture outputs; same duplicates/conflicts/unknown-format errors; pure code no browser/store/credentials; B2C current UX unchanged; adapter can run under Node using synthetic file bytes. Unsupported formats listed, not silently accepted.
- **Exact tests:** retained `apps/b2c-web/test/health-import.test.ts`, `health-store.test.ts`, `packages/scene-schema/tests/health.test.ts`; new `packages/scene-schema/tests/health-import.test.ts`, pure adapter parity fixtures. Run affected package/B2C unit suites and boundary/typecheck; B2C `exercise-planning.spec.ts`/health import browser regression when shared UI behavior changes (no speculative full browser run for move-only code). Deliver shared dependency request to INTEGRATION.

## WP14 — Composed integration, contract review and final evidence

- **Atlas:** A00-A08 integration. **Model:** Astra ultra. **Branch:** `integrate/b2b-product-v1`. **Depends:** all selected producer PRs for final acceptance; parent-appointed integration seat handles earlier per-wave wiring leases.
- **Goal:** one coherent application candidate with preserved history and no unresolved contract/file conflicts.
- **In:** fetch fresh main/heads, verify immutable worker reports and actual diffs, combine in explicit plan order, resolve conflicts and shared registration/manifests/lockfile once, update owner docs/README/spec status in English, independent boundary/contract/privacy review, rerun affected checks/full combined baseline, draft integration PR and truthful receipt. Parent retains merge authority until explicitly delegated.
- **Out:** production deploy, force push, silently waive browser/privacy/migration failures, take over old Yoga/provider/backup work or mark Atlas complete early.
- **Files:** INTEGRATION ownership; shared barrels/wiring/navigation; docs `b2b.md`, API README, relevant architecture/health docs while retaining historical sources. CONTRACT amendments remain with WP00 or explicit ownership handoff.
- **Acceptance/tests:** pinned base/head for every input and combined head; no missing migration or strict client mismatch; coherent role/period/log/substitution/consent/inactive flows; full `pnpm lint`, `pnpm typecheck`, `pnpm test` real DB zero unexpected skips, `pnpm build`, targeted/full agreed browser matrix, catalog counts, `pnpm previews:check` reported with unchanged known Yoga failure. Run `git diff --check`, PR/commit text checks and identity guard. Do not report `pnpm check:all` green while preview/browser gates fail. Review screenshots mobile/desktop; physical/HTTPS/provider limits explicit. Changes to base/head invalidate affected review.

## WP15 — Canonical Atlas implementation receipt

- **Atlas:** A00-A08 status/evidence only. **Model:** GPT-6.1 Sol high/fast. **Branch:** `docs/klisteni-b2b-implementation-receipt-v1` in `sysadmin-workspace`. **Depends:** WP14 immutable actual receipt, parent dispatch.
- **Goal:** reconcile the original roadmap with what actually integrated/tested, retaining older milestones and unresolved choices.
- **In:** standard source -> entry -> wiki/decisions/questions/roadmap/catalog/log intake; links to exact app PR/base/head and evidence, implemented/partial/blocked status per A01-A08, adopted technical ADR and surviving product questions. One canonical writer only.
- **Out:** duplicate minutes/backlog, app edits, invented execution/deploy evidence, marking blocked browser acceptance complete, Notion updates or merge without scope.
- **Files:** existing canonical Atlas intake paths selected by atlas-maintain; no copy of app schema/implementation docs as new canon.
- **Acceptance/tests:** preserves October 12/16 milestones and PR18 source; exact source/entry/synthesis traceability; no runtime claim. Run `ruby atlas/scripts/check_consistency.rb`, `ruby atlas/scripts/check_consistency_test.rb`, engineering content/PR/commit checks and `git diff --check`; reader `npm run check` when content falls in existing allowlist. Report unavailable official tools without substituting a parser as a pass. Publish draft PR; parent chooses merge.
