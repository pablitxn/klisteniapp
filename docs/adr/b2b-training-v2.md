# ADR: B2B product contract and historical-record foundation

Status: adopted for the authorized development batch; product activation remains disabled.

Authority: Atlas minutes at `ce45d206a2ed4035f8003a3303abd1fff98e09b8`, plan C01-C08 at `447d77ebb5587e319018e7b56003f0ef7299bb6c`, application baseline `d65261d18de4522fb9a66104aabb5750104fb8b8`. This ADR adopts all C01-C08 policies in [the plan](../plans/klisteni-b2b-development-v1.md), with the concrete implementation choices below. It does not replace Atlas milestones, establish legal compliance or authorize deployment.

## Executable boundary

Use `@klisteniapp/b2b-contracts/product-v2`. Existing root exports, role enum and strict v1 DTOs retain their meaning. `ProductEndpoints` defines named input/output schemas; `ProductInput<K>`, `ProductOutput<K>` and `ProductService<Context>` derive from it. `createProductV2Client(accountId, organizationId, options)` validates input/output, carries the explicit version header and preserves structured activation issues. Responses are the declared DTO directly.

Organization endpoints use `/api/b2b/orgs/:organizationId/product/v2/...` and `X-Klisteni-B2B-Contract: 2`. This version namespace refines C07's provisional route spellings. Self export and invitation use `/api/b2b/self/exports` and `/api/b2b/self/b2c-invitation`, with selected `organizationId` query context and the same header. These are static seams: WP00 installs no business handlers. ACCESS verifies path/body IDs agree, explicitly parses query numbers, authenticates capability discovery and never treats a payload tenant or claimed role as authority.

ACCESS constructs `AuthorizedProductContext` inside its current locked transaction after validating session, host/domain generation, entitlement, membership and selected branch grants. Feature services reuse `context.db`, never acquire another connection. `authorizeMember(memberId, 'planning'|'history')` distinguishes active planning from retained historical access. Self export uses `AuthorizedProductIdentityContext`, requiring identity/membership/host authorization without an operational branch grant.

CONTRACT retains schemas, SQL, migration/readiness, DTO fixtures and ADR. INTEGRATION retains manifests, export maps, lockfile, shared client/API registration and composition. ACCESS receives http/service/context ownership only on parent handoff. WP12 exclusively owns new cross-feature browser specs/fixtures. WP13 owns its reserved pure importer/wrapper/tests. Follow-up changes require an explicit successor contract; no shared lease expires implicitly.

## Roles, scope and audit: C01

Organization remains tenant; trainer coverage broadens only inside the selected permitted branch. Wire coach/member means trainer/user. Organization superadmin never implies platform operator.

Migration 006 adds product_role beside legacy role. Existing full admins and existing admin invitations become product superadmins, preserving their issued capability; legacy wire role remains admin. New narrower product admin is represented by legacy admin plus product admin. Constraints reject contradictory mappings; compatibility triggers preserve old writes before activation. Last-superadmin removal writes/locks the organization row and refuses loss of the last active superadmin, including competing transactions. No platform permission is granted.

Membership access_revision changes on role/active changes. ACCESS must also advance it for branch-grant changes. Deactivation revokes same-organization health consents, appends consent revisions and invalidates access in the same transaction. Reactivation never resurrects revoked consent or explicitly revoked branch grants. Other active memberships do not unlock this organization.

Audit adds branch, operation, before/after revision and changed-field names. Store immutable revision references, not raw health values or duplicated actual payloads. Original audit values remain unchanged; role migration is an explicit actor-null system event. Operation/action/resource uniqueness prevents retry duplication.

## Prescription and storage: C02-C03

b2b_program and its versions remain reusable routine identity and immutable prescription. Incomplete drafts use null/empty fields. AssignableRoutine checks completeness, not training balance or suitability. Fixed/range targets preserve integer sets/repetitions, seconds and kilograms. New publication and reviewed target dose require explicit bodyweight or external load. Legacy null load projects to unspecified and absent laterality to null; the projection is a draft requiring confirmation before new publication, not an inferred prescription. Original snapshots/retries remain valid unchanged.

Goal programs are member scoped. Draft stages may omit dates/weekdays/routine references. Activation requires ordered inclusive nonoverlapping stages, explicit IANA timezone and weekly slots; gaps are allowed. Simultaneous enrollments remain separate and continuity returns arrays for current/past/future. No legacy enrollment or schedule is invented.

Final SQL names, replacing only provisional spellings:

- b2b_goal_program, b2b_goal_program_revision
- b2b_enrollment, b2b_enrollment_revision, b2b_stage_revision
- b2b_occurrence, b2b_occurrence_revision
- b2b_training_session, b2b_session_revision, b2b_operation_receipt
- b2b_routine_supplement, b2b_reviewed_relation
- b2b_health, b2b_health_operation, b2b_health_consent, b2b_health_consent_revision

Enrollment stores issued goal revision; stages/occurrences retain issued enrollment revision. Composite FKs bind tenant/branch/member through original assignments, occurrences and sessions. Session routine/version must match its original occurrence/assignment; its legacy execution must match that assignment. Revision and receipt tables reject UPDATE/DELETE. Occurrence/session original identities are immutable; current schedule/revision fields remain editable. There are no destructive cascades. Existing guarded synthetic demo reset explicitly includes new tables.

Store full validated DTO snapshots in append-only revision rows, exact operation responses in receipts, and current revision pointers in mutable heads. SQL enforces relational identity; services validate stage JSON slot membership, nonoverlap, resource eligibility, dates, dose and completion. Missing historical content is an error, never reconstructed from mutable catalog data.

## Schedule, actuals and retry: C04-C05

Occurrence identity includes enrollment/stage/slot/allocated ordinal; ordinals never renumber. Original date/week/timezone/routine are immutable. Week is Monday local midnight through next Monday with calendar arithmetic across DST. Same-week member moves preserve quantity/content and can retain an explicit permitted-date override across a stage boundary. Period preview binds enrollment/occurrence revisions and proposed change hash. Period apply preserves logs and recalculates affected weeks once.

One latest eligible explicitly completed session fulfils at most one occurrence. Partial is a subset of outstanding/missed work. required = completed + missed + pending; closed pending is zero. Four/three means one missed. Unscheduled legacy work stays separate. Authorized late corrections may revise closed derived summaries; frozen-score/grace policy remains optional future work.

A step selects one effective segment. Changing exercise creates a stable segment with target exercise, own dose, reviewed relation and confirmed conditions; earlier actuals remain additional work. Switching back explicitly selects the retained prior segment. Performed-set identity and segment/ordinal/side tuple are unique. WP03/WP04 domain rules require target minimum/per-side sets, positive applicable actuals and explicit completion intent; schema validity alone does not certify completion. Truthful below-target measurements remain valid actuals.

Legacy execution bytes remain in b2b_execution as revision zero. SessionRecordSchema accepts that projection or a v2 revision. First correction appends revision one with original linkage preserved. New records use expected revision zero and first accepted write advances to one. Each mutation compares revision under lock and appends revision, receipt and audit atomically.

Receipt identity is organization/actor/operation, recording branch/resource, normalized request hash and exact response. Hash validated JSON with recursively sorted object keys, preserving array order/scalars. Never reuse health-import dedup normalization for workouts. Recheck current authorization before receipt lookup. Exact operation/hash replay returns its original response even after successors; changed payload conflicts. Health operations use owner/operation identity separately.

Outbox payloads are immutable once sending begins. Edits create successor operations whose expected revision follows the accepted predecessor. Transport acknowledgement never changes completion. IndexedDB durability, account-scoped recovery, conflict handling and visible storage errors remain WP09; no offline-start or browser-profile encryption promise is implied.

## Reviewed alternatives: C06

Reuse the canonical 37 exercises/42 directed relationships and exact condition vocabulary. No reverse/transitive inference or equal-load claim. b2b_reviewed_relation is explicit enrichment storage; WP04 fills it from reviewed provenance rather than relying on old seed ON CONFLICT DO NOTHING. Local adaptations are not automatically reviewed.

Routine steps use reviewed or explicitly blocked policy. Empty old allowlists do not imply blocked; manual legacy permissions are not proof of review. Publication freezes relation, target content hashes/conditions and independent target dose. Legacy versions receive separate immutable supplements when needed. Routine continuity has no substitution count; session detail owns variants/actuals.

## Health, export and activation: C07-C08

Only manual normalized klisteniapp.health version 1 is supported. WP13 preserves existing pure parser normalization/dedup/conflicts. CSV, ZIP and other vendor formats remain unsupported. Source labels are provenance, not a claim of vendor-format support.

NormalizedHealthSchema is structural transport validation. API-only parseProductHealth/previewProductHealthImport also use canonical HealthDataSchema and the pure adapter. WP05 must use semantic validation before storage and server-clock/future-date checks for owner edits. Successful preview maps byCategory[category].added to additions and counts.duplicates to duplicates; rejected imports produce issues and no partial writes. Bind preview hash to owner revision, normalized input and expiry; revalidate on commit. Limits remain 2 MiB/10000 imported records and 4 MiB accumulated health. B2B contracts/domain/client/web do not depend on scene-schema.

Health belongs to the B2B identity. Sharing requires revocable organization/branch/category consent for the disclosed dynamic current-trainer audience. Import grants no consent; admin/superadmin has no bypass. Trainer view is online-only with no bulk export or persistent cache. Every disclosure rechecks current authorization/consent. No-store/view clearing cannot recall already delivered bytes. General audit/gym exports exclude private health.

Inactive membership receives export-only access on its correct host, plus invitation to a separate paid B2C product. No automatic account/cookie/billing/data conversion. Staff retain authorized historical training; health consent stays revoked. Owner export contains issued lineage, original/corrected accepted actuals and own health; unsynced local work is exported separately. Interchange v2 preserves ranges/units/segments/provenance. B2C adapters preserve the envelope or explicitly reject unsupported fields; never flatten or silently discard data. No claim that a gym owns all personal data is made.

Migration 006 is explicit, transactional and registered once; readiness requires it and startup does no DDL. product_active defaults false. Legacy readers inspect schema_version before strict parsing and return 426 UPGRADE_REQUIRED for v2; corrected legacy actuals cannot be returned stale. V1 update predicates cannot overwrite v2 rows. After activation, the legacy organization transaction rejects callbacks after current authorization checks even if a version header is forged. New ACCESS handlers require separate v2 context/wiring.

Migration is not activation. Activation requires integrated handlers, both B2B consumers and authorization acceptance. Do not enable real-environment product_active in this batch. Old binaries are not a safe rollback after v2 writes. No app-main merge, production migration, restore, paid service or history rewrite is authorized.

## Nonblocking product questions

Broader all-branch grants, contractual frozen adherence/grace periods, named-trainer consent, vendor formats and retention/erasure/controller policy remain product decisions. Continue with scoped grants, corrected derived weeks, explicit revocable branch-trainer consent and supported JSON; optional import formats do not block implementation.
