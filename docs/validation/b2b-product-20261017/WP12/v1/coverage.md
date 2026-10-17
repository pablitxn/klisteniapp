# WP12 acceptance traceability

Plan: `447d77ebb5587e319018e7b56003f0ef7299bb6c`.
Inventory: [scenarios.json](../../../../../apps/b2c-web/e2e/fixtures/b2b-product/scenarios.json).

All rows are **blocked preparation obligations**. No row means that a feature
exists or a test passed. Browser rows reserve exact final spec paths and titles;
unit/API rows name owning tests requested by the plan, whose implementation and
execution remain with their owners. Evidence-review rows are acceptance gates,
not executable browser tests. All C01-C08 clauses and every WP acceptance/edge
case are mapped below; a final amendment must identify any newly accepted ADR
semantics and remap affected IDs before execution.

| Package | Reserved scenario IDs |
| --- | --- |
| WP00 | B2BP-COMPATIBILITY-001, B2BP-COMPATIBILITY-002, B2BP-COMPATIBILITY-003, B2BP-COMPATIBILITY-004, B2BP-COMPATIBILITY-005, B2BP-COMPATIBILITY-006, B2BP-COMPATIBILITY-007, B2BP-COMPATIBILITY-008, B2BP-COMPATIBILITY-009 |
| WP01 | B2BP-ROLES-001, B2BP-ROLES-002, B2BP-ROLES-003, B2BP-ROLES-004, B2BP-ROLES-005, B2BP-ROLES-006, B2BP-ROLES-007, B2BP-ROLES-008, B2BP-ROLES-009 |
| WP02 | B2BP-PROGRAMMING-001, B2BP-PROGRAMMING-002, B2BP-PROGRAMMING-003, B2BP-PROGRAMMING-004, B2BP-PROGRAMMING-005, B2BP-PROGRAMMING-006, B2BP-PROGRAMMING-007, B2BP-PROGRAMMING-008, B2BP-PROGRAMMING-009, B2BP-PROGRAMMING-010, B2BP-PROGRAMMING-011, B2BP-PROGRAMMING-012, B2BP-HISTORY-001, B2BP-HISTORY-002, B2BP-HISTORY-003, B2BP-HISTORY-004, B2BP-HISTORY-005, B2BP-HISTORY-006, B2BP-HISTORY-007, B2BP-HISTORY-008, B2BP-HISTORY-009 |
| WP03 | B2BP-HISTORY-001, B2BP-HISTORY-002, B2BP-HISTORY-003, B2BP-HISTORY-004, B2BP-HISTORY-005, B2BP-HISTORY-006, B2BP-HISTORY-007, B2BP-HISTORY-008, B2BP-HISTORY-009, B2BP-WEEK-001, B2BP-WEEK-002, B2BP-WEEK-003, B2BP-WEEK-004, B2BP-WEEK-005, B2BP-WEEK-006, B2BP-WEEK-007, B2BP-WEEK-008, B2BP-WEEK-009, B2BP-WEEK-010, B2BP-WEEK-011, B2BP-WEEK-012, B2BP-SYNC-001, B2BP-SYNC-002, B2BP-SYNC-003, B2BP-SYNC-004, B2BP-SYNC-005, B2BP-SYNC-006, B2BP-SYNC-007, B2BP-SYNC-008, B2BP-SYNC-009, B2BP-SYNC-010, B2BP-SYNC-011, B2BP-SYNC-012 |
| WP04 | B2BP-ALTERNATIVES-001, B2BP-ALTERNATIVES-002, B2BP-ALTERNATIVES-003, B2BP-ALTERNATIVES-004, B2BP-ALTERNATIVES-005, B2BP-ALTERNATIVES-006, B2BP-ALTERNATIVES-007, B2BP-ALTERNATIVES-008, B2BP-ALTERNATIVES-009, B2BP-ALTERNATIVES-010, B2BP-ALTERNATIVES-011 |
| WP05 | B2BP-HEALTH-001, B2BP-HEALTH-002, B2BP-HEALTH-003, B2BP-HEALTH-004, B2BP-HEALTH-005, B2BP-HEALTH-006, B2BP-HEALTH-007, B2BP-HEALTH-008, B2BP-HEALTH-009, B2BP-HEALTH-010, B2BP-HEALTH-011 |
| WP06 | B2BP-INACTIVE-001, B2BP-INACTIVE-002, B2BP-INACTIVE-003, B2BP-INACTIVE-004, B2BP-INACTIVE-005, B2BP-INACTIVE-006, B2BP-INACTIVE-007, B2BP-INACTIVE-008, B2BP-INACTIVE-009, B2BP-INACTIVE-010, B2BP-INACTIVE-011, B2BP-INACTIVE-012 |
| WP07 | B2BP-PROGRAMMING-001, B2BP-PROGRAMMING-002, B2BP-PROGRAMMING-003, B2BP-PROGRAMMING-004, B2BP-PROGRAMMING-005, B2BP-PROGRAMMING-006, B2BP-PROGRAMMING-007, B2BP-PROGRAMMING-008, B2BP-PROGRAMMING-009, B2BP-PROGRAMMING-010, B2BP-PROGRAMMING-011, B2BP-PROGRAMMING-012, B2BP-ALTERNATIVES-001, B2BP-ALTERNATIVES-002, B2BP-ALTERNATIVES-003, B2BP-ALTERNATIVES-004, B2BP-ALTERNATIVES-005, B2BP-ALTERNATIVES-006, B2BP-ALTERNATIVES-007, B2BP-ALTERNATIVES-008, B2BP-ALTERNATIVES-009, B2BP-ALTERNATIVES-010, B2BP-ALTERNATIVES-011 |
| WP08 | B2BP-HISTORY-001, B2BP-HISTORY-002, B2BP-HISTORY-003, B2BP-HISTORY-004, B2BP-HISTORY-005, B2BP-HISTORY-006, B2BP-HISTORY-007, B2BP-HISTORY-008, B2BP-HISTORY-009, B2BP-WEEK-001, B2BP-WEEK-002, B2BP-WEEK-003, B2BP-WEEK-004, B2BP-WEEK-005, B2BP-WEEK-006, B2BP-WEEK-007, B2BP-WEEK-008, B2BP-WEEK-009, B2BP-WEEK-010, B2BP-WEEK-011, B2BP-WEEK-012 |
| WP09 | B2BP-SYNC-001, B2BP-SYNC-002, B2BP-SYNC-003, B2BP-SYNC-004, B2BP-SYNC-005, B2BP-SYNC-006, B2BP-SYNC-007, B2BP-SYNC-008, B2BP-SYNC-009, B2BP-SYNC-010, B2BP-SYNC-011, B2BP-SYNC-012, B2BP-ALTERNATIVES-001, B2BP-ALTERNATIVES-002, B2BP-ALTERNATIVES-003, B2BP-ALTERNATIVES-004, B2BP-ALTERNATIVES-005, B2BP-ALTERNATIVES-006, B2BP-ALTERNATIVES-007, B2BP-ALTERNATIVES-008, B2BP-ALTERNATIVES-009, B2BP-ALTERNATIVES-010, B2BP-ALTERNATIVES-011 |
| WP10 | B2BP-HEALTH-001, B2BP-HEALTH-002, B2BP-HEALTH-003, B2BP-HEALTH-004, B2BP-HEALTH-005, B2BP-HEALTH-006, B2BP-HEALTH-007, B2BP-HEALTH-008, B2BP-HEALTH-009, B2BP-HEALTH-010, B2BP-HEALTH-011 |
| WP11 | B2BP-INACTIVE-001, B2BP-INACTIVE-002, B2BP-INACTIVE-003, B2BP-INACTIVE-004, B2BP-INACTIVE-005, B2BP-INACTIVE-006, B2BP-INACTIVE-007, B2BP-INACTIVE-008, B2BP-INACTIVE-009, B2BP-INACTIVE-010, B2BP-INACTIVE-011, B2BP-INACTIVE-012 |
| WP12 | B2BP-VALIDATION-001, B2BP-VALIDATION-002, B2BP-VALIDATION-003, B2BP-VALIDATION-004, B2BP-VALIDATION-005, B2BP-VALIDATION-006, B2BP-VALIDATION-007, B2BP-VALIDATION-008 |
| WP13 | B2BP-IMPORT-001, B2BP-IMPORT-002, B2BP-IMPORT-003 |
| WP14 | B2BP-VALIDATION-001, B2BP-VALIDATION-002, B2BP-VALIDATION-003, B2BP-VALIDATION-004, B2BP-VALIDATION-005, B2BP-VALIDATION-006, B2BP-VALIDATION-007, B2BP-VALIDATION-008 |
| WP15 | B2BP-VALIDATION-001, B2BP-VALIDATION-002, B2BP-VALIDATION-003, B2BP-VALIDATION-004, B2BP-VALIDATION-005, B2BP-VALIDATION-006, B2BP-VALIDATION-007, B2BP-VALIDATION-008 |

## browser

| Scenario / exact test ID | Planned target | Assertion |
| --- | --- | --- |
| B2BP-ROLES-001 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Unassigned same-branch coach reads roster/history, edits planning and assigns a routine |
| B2BP-ROLES-002 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Foreign tenant, foreign branch, foreign resource ID and ambiguous branchless requests are denied |
| B2BP-ROLES-003 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Superadmin creates admins/coaches/members; admin creates only coaches/members; no self-escalation |
| B2BP-ROLES-004 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Last-superadmin loss and platform/operator promotion are denied |
| B2BP-ROLES-005 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Accepted planning/permission mutations show actor, bounded changed fields, server time, request and revision; exact replay adds no audit |
| B2BP-ROLES-006 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Audit drawer is scoped, keyboard accessible and omits raw health/actual payloads |
| B2BP-ROLES-007 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Inactive member remains a historical training target and is rejected as active planning target |
| B2BP-ROLES-008 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Queued write after grant revocation is denied; another branch's higher role does not authorize this branch |
| B2BP-ROLES-009 | `apps/b2c-web/e2e/b2b-product-roles.spec.ts` | Unified and WL paths enforce host/domain generation and selected branch identically |
| B2BP-PROGRAMMING-001 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Blank and incomplete draft saves to server, reloads and survives offline recovery without a balance score |
| B2BP-PROGRAMMING-002 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Publish/assignment rejects empty or incomplete steps with actionable step/field issues |
| B2BP-PROGRAMMING-003 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Complete fixed/range sets/reps/time/bodyweight/external-load/rest/notes/RPE use explicit units and distinguish missing, zero and inapplicable |
| B2BP-PROGRAMMING-004 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Invalid min/max/numeric bounds, incomplete or reversed dates and overlapping/out-of-order stages are rejected |
| B2BP-PROGRAMMING-005 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Goal objective, explicit timezone confirmation, gaps, past/current/future stages and repeated routine references persist |
| B2BP-PROGRAMMING-006 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Two slots on one day remain two obligations; simultaneous enrollments stay distinct |
| B2BP-PROGRAMMING-007 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Publishing/archive/reuse retain stable routine IDs and immutable issued versions |
| B2BP-PROGRAMMING-008 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Period move previews affected eligibility/logs/date overrides; apply is audited and atomic with expected revisions |
| B2BP-PROGRAMMING-009 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Stale trainer save/period preview conflicts without losing local work; no silent merge |
| B2BP-PROGRAMMING-010 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Account/brand/branch switch hides the prior draft and prevents a late response restoring it |
| B2BP-PROGRAMMING-011 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Trainer can set per-step reviewed/block policy and sees target dose/notice without a grading workflow |
| B2BP-PROGRAMMING-012 | `apps/b2c-web/e2e/b2b-product-programming.spec.ts` | Date/range controls work with keyboard and touch at 320px without horizontal overflow |
| B2BP-HISTORY-001 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Today uses enrollment timezone with truthful past/current/future, rest, gap and no-stage states |
| B2BP-HISTORY-002 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Routine continuity shows objective/stages/period revisions with no substitution-count metric |
| B2BP-HISTORY-003 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Session history shows actual performed date, original version, variants and accepted corrections; links navigate both ways |
| B2BP-HISTORY-004 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Period edits before/after work and cross-week moves preserve every actual and original routine/assignment/version link |
| B2BP-HISTORY-005 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Excluded actual work stays visible with a reason and cannot fulfill another occurrence |
| B2BP-HISTORY-006 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Later routine/catalog edits and archive never rewrite historical target/actual snapshots |
| B2BP-HISTORY-007 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Legacy unbound execution appears unplanned revision zero; first edit appends revision one without an invented occurrence |
| B2BP-HISTORY-008 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Authorized staff can inspect inactive history; another brand/member cannot |
| B2BP-HISTORY-009 | `apps/b2c-web/e2e/b2b-product-history.spec.ts` | Back/forward/reload and routine-to-session navigation retain correct scope |
| B2BP-WEEK-001 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Four required and three explicit completions yield one missed only after week close; before close one pending |
| B2BP-WEEK-002 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Partial-only, zero-set draft, autosave and sync never count as completion |
| B2BP-WEEK-003 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Same-week own pending/partial move preserves occurrence ID, quantity, content and original stage |
| B2BP-WEEK-004 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Outside-week, foreign-owner, archived/inactive and completed-occurrence schedule moves are denied |
| B2BP-WEEK-005 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Accepted move across a midweek stage boundary remains completion-eligible and appears in later period impact preview |
| B2BP-WEEK-006 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Two same-day slots and separate enrollments count separately; retries/repeated records cannot double-fulfill or fill another |
| B2BP-WEEK-007 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Monday start/Sunday end are half-open in frozen IANA timezone through 23h/25h DST days; device zone change has no effect |
| B2BP-WEEK-008 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Late offline completion and date correction retain performed/received times and revise both affected closed summaries |
| B2BP-WEEK-009 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Completed-to-partial and void correction reduce adherence with revision/time/reason; future performed date is rejected |
| B2BP-WEEK-010 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Reconciliation retains IDs and ordinals when earlier slots are added/removed; excluded work never causes completed > required |
| B2BP-WEEK-011 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Touch and keyboard non-drag schedule controls preserve exact four/three/one accounting |
| B2BP-WEEK-012 | `apps/b2c-web/e2e/b2b-product-week.spec.ts` | Below-target truthful positive actuals and ranged-set minimum allow explicit completion; extra sets stay actual |
| B2BP-SYNC-001 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Loaded form autosaves locally before success, survives offline reload and reconnects without automatic completion |
| B2BP-SYNC-002 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Draft/partial/completed and local-only/pending/syncing/synchronized/conflict/failed/authorization-blocked remain independent visible states |
| B2BP-SYNC-003 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Lost response retries immutable operation ID/payload and produces one accepted revision/audit/fulfillment |
| B2BP-SYNC-004 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Reusing operation ID with changed bytes conflicts; edits after enqueue use serialized successor operations |
| B2BP-SYNC-005 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Replay of an earlier accepted operation returns its receipt after a successor; current authorization precedes receipt lookup |
| B2BP-SYNC-006 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Two tabs/devices and stale expectedRevision surface local/server versions with explicit resolution and no last-write-win |
| B2BP-SYNC-007 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Logout/account/brand/branch switch cancels requests, hides prior memory/outbox and ignores late acknowledgments |
| B2BP-SYNC-008 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Revoked/inactive queue blocks replay, retains owner-recoverable local export, and does not transfer on login to another identity |
| B2BP-SYNC-009 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Quota/store failure is visible and unreadable old draft bytes survive migration |
| B2BP-SYNC-010 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Own partial/completed correction and void retain append-only history; trainers/other members cannot edit measurements |
| B2BP-SYNC-011 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Reconnect uses bounded retry/backoff and retained operation IDs; server acknowledgment alone sets synchronized |
| B2BP-SYNC-012 | `apps/b2c-web/e2e/b2b-product-sync.spec.ts` | Delete/void, revocation and reactivation races do not resurrect departed state or silently authorize pending writes |
| B2BP-ALTERNATIVES-001 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Unchanged canonical exercise shows reviewed directed alternative/progression/regression candidates by default |
| B2BP-ALTERNATIVES-002 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | No inferred reverse/transitive relation; 37 exercises/42 links and nine empty reviewed lists retain catalog provenance |
| B2BP-ALTERNATIVES-003 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Per-step trainer block shows accessible brief notice; reviewed-empty is distinct from blocked and legacy-empty |
| B2BP-ALTERNATIVES-004 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Equipment availability and target conditions/requirements need confirmation; no trainer approval or equal-load/effect claim |
| B2BP-ALTERNATIVES-005 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Modified local adaptation with matching base/animation does not inherit review |
| B2BP-ALTERNATIVES-006 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Fresh and existing seeded DB enrichment is versioned and idempotent; old snapshot bytes/local edits stay unchanged |
| B2BP-ALTERNATIVES-007 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Legacy manual lists stay labelled and adoption creates an immutable supplement with source version/hash |
| B2BP-ALTERNATIVES-008 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Mid-session reps-to-time/count/per-side switch freezes target dose and relation, resets incompatible load/RPE and creates stable segment/set IDs |
| B2BP-ALTERNATIVES-009 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Prior source work remains additional actual work/exported and cannot fulfill selected target minimum/per-side coverage |
| B2BP-ALTERNATIVES-010 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Switch back restores only an exactly matching frozen prescription; selection never deletes actual sets |
| B2BP-ALTERNATIVES-011 | `apps/b2c-web/e2e/b2b-product-alternatives.spec.ts` | Partial/completed behavior uses selected target sets/rest/unit/laterality while original routine/objective remain unchanged |
| B2BP-HEALTH-001 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | User explicitly selects JSON, previews and confirms import; import alone leaves sharing private |
| B2BP-HEALTH-002 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Absent consent denies trainer/admin/superadmin; wrong tenant/branch/audience/category or changed role denies |
| B2BP-HEALTH-003 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Explicit category/branch grant discloses dynamic current/future authorized-trainer audience and permits only that scope |
| B2BP-HEALTH-004 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Revoke in another tab wins over queued/in-flight read and stale response cannot repopulate app-controlled view |
| B2BP-HEALTH-005 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Disconnected trainer hides health until online revalidation; no trainer persistent/offline health cache; no-store enforced |
| B2BP-HEALTH-006 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Deactivation revokes only that organization's grants with incremented versions; reactivation requires fresh explicit consent |
| B2BP-HEALTH-007 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Owner import deduplicates same provenance, conflicts reject atomically, and B2B identity storage stays independent of B2C |
| B2BP-HEALTH-008 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Malformed/oversized/empty/future/unknown-version JSON and unsupported CSV/ZIP reject without writes |
| B2BP-HEALTH-009 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Health writes/export remain owner-only; ordinary gym reports/exports/audit omit health values |
| B2BP-HEALTH-010 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | Keyboard preview/confirm, loading/error/revoke states and account switch clear private view |
| B2BP-HEALTH-011 | `apps/b2c-web/e2e/b2b-product-health.spec.ts` | No provider/auth/watch polling occurs on import/settings; already delivered bytes are not promised recalled |
| B2BP-INACTIVE-001 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Correct-brand inactive login grants export-only; unknown/foreign membership and copied/stale domain cookie remain denied |
| B2BP-INACTIVE-002 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Inventory/planning/private media/history browsing/health sharing/session writes deny GET/HEAD/range/mutations and queued replay |
| B2BP-INACTIVE-003 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Deep links/back/stale active screens refresh to restricted export/invitation immediately |
| B2BP-INACTIVE-004 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Own download includes versioned manifest, original routine lineage, original/corrected actual revisions and own health with omissions explained |
| B2BP-INACTIVE-005 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Other-member IDs, staff-private material and foreign tenant data are excluded from owner export |
| B2BP-INACTIVE-006 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Unsynced local export is distinct, labelled and recoverable; never represented as accepted server work |
| B2BP-INACTIVE-007 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Active membership in another brand does not unlock inactive brand; explicitly revoked grants stay revoked on reactivation |
| B2BP-INACTIVE-008 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Reactivation restores records/current valid grants without restoring health consent or automatic queue replay authority |
| B2BP-INACTIVE-009 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Configured/unconfigured invitation is truthful separate paid B2C choice; viewing/clicking does not mutate account/cookie/payment or transfer data |
| B2BP-INACTIVE-010 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Training interchange round-trip preserves compatible fields and unsupported ranges/units/provenance or rejects explicitly without flattening |
| B2BP-INACTIVE-011 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Staff historical training view survives inactivity while health remains revoked |
| B2BP-INACTIVE-012 | `apps/b2c-web/e2e/b2b-product-inactive.spec.ts` | Export loading/error/retry/download works at all six viewport/engine combinations |

## owner-unit-api

| Scenario / exact test ID | Planned target | Assertion |
| --- | --- | --- |
| B2BP-COMPATIBILITY-001 | `packages/b2b-contracts/tests/product-v2.test.ts` | Draft and activation schemas accept unfinished drafts and return structured activation issues |
| B2BP-COMPATIBILITY-002 | `packages/b2b-contracts/tests/legacy-product-compatibility.test.ts` | Legacy fixed snapshots, original execution IDs and pending POST retries decode unchanged |
| B2BP-COMPATIBILITY-003 | `packages/b2b-contracts/tests/legacy-product-compatibility.test.ts` | Version discriminator prevents strict v1 clients receiving mixed v2 payloads; explicit upgrade required |
| B2BP-COMPATIBILITY-004 | `apps/b2b-api/tests/product-migration.test.ts` | Legacy full admins and pending admin invitations preserve issued capabilities without platform authority |
| B2BP-COMPATIBILITY-005 | `apps/b2b-api/tests/product-migration.test.ts` | New install, 001-005 upgrade and repeat migration preserve counts, IDs, FKs, audit/media links and historical JSON hashes |
| B2BP-COMPATIBILITY-006 | `apps/b2b-api/tests/product-migration.test.ts` | Cross-tenant/member FKs and anomalous legacy rows fail closed; no guessed schedule backfill |
| B2BP-COMPATIBILITY-007 | `packages/b2b-contracts/tests/product-v2.test.ts` | Stable occurrence/segment identities and health normalized adapter boundary compile for consumers |
| B2BP-COMPATIBILITY-008 | `packages/b2b-contracts/tests/product-v2.test.ts` | Versioned interchange preserves ranges, units and provenance or rejects unsupported fields explicitly |
| B2BP-COMPATIBILITY-009 | `packages/b2b-contracts/tests/legacy-product-compatibility.test.ts` | Old tab identity/capability negotiation, client strict responses and readiness-before-DDL are explicit |
| B2BP-IMPORT-001 | `packages/scene-schema/tests/health-import.test.ts` | Extracted pure parser normalized bytes/errors/dedup/conflict behavior match retained B2C fixtures |
| B2BP-IMPORT-002 | `packages/scene-schema/tests/health-import.test.ts` | Node synthetic bytes require no browser/store/credential and unsupported formats remain listed |
| B2BP-IMPORT-003 | `apps/b2c-web/test/health-import.test.ts` | B2C importer wrapper, health store, schema and current UX regressions retained |

## evidence-review

| Scenario / exact test ID | Planned target | Assertion |
| --- | --- | --- |
| B2BP-VALIDATION-001 | `docs/validation/b2b-product-20261017/WP14/v1/` | Record exact input base/head/dependencies and combined SHA; moved inputs invalidate affected evidence |
| B2BP-VALIDATION-002 | `docs/validation/b2b-product-20261017/WP14/v1/` | Full U/API/STATIC and builds run on combined head with disposable real PostgreSQL and zero unexpected DB skips |
| B2BP-VALIDATION-003 | `docs/validation/b2b-product-20261017/WP12/` | All browser scenarios run on unified plus scoped WL matrix: 320x740,430x932,1440x1000 Chromium/WebKit; HTTP and trusted HTTPS remain distinct |
| B2BP-VALIDATION-004 | `docs/validation/b2b-product-20261017/WP12/` | Keyboard focus/labels/status, touch, overflow, loading/error/empty/conflict and back/reload/scope switch assertions accompany screenshots |
| B2BP-VALIDATION-005 | `docs/validation/b2b-product-20261017/WP14/v1/` | Catalog/B2C/import regressions retained; Yoga preview baseline, physical/provider/release gates remain explicit |
| B2BP-VALIDATION-006 | `docs/validation/b2b-product-20261017/WP12/` | Sanitized failures carry scenario/project/SHA; passed/failed/skipped/blocked are separate and no missing test counts as pass |
| B2BP-VALIDATION-007 | `docs/validation/b2b-product-20261017/WP14/v1/` | Identity guard, English Conventional Commits, five-section PR and diff checks run; draft inputs remain unmerged |
| B2BP-VALIDATION-008 | `docs/validation/b2b-product-20261017/WP15/v1/` | Atlas canonical receipt preserves October12/16 and PR18, traces A00-A08 actual results and runs owning consistency checks |
