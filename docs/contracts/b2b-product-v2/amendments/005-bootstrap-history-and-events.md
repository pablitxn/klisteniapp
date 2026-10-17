# Amendment 005: authenticated UI composition

This additive integration amendment preserves v1 DTOs, migration006 and immutable
producer receipts. It is a local candidate, not product activation or deployment
approval. Atlas decision source remains ce45d206a2ed4035f8003a3303abd1fff98e09b8.

## Identity and application lifetime

`GET /api/b2b/bootstrap/v2` requires a current session, header2 and its verified
realm. It accepts no query selectors or range. Its strict `ProductBootstrap`
contains authenticated identity, an opaque HMAC realm key, own organization
membership mode/revision/activation and actual permitted branch-role choices.
Inactive entries have no choices. Administrator choices are distinct from real
coach/member grants. Operational calls still authorize current context separately.

`B2B_PRODUCT_UNIFIED=true` explicitly enables a product-only single-origin runtime
and is mutually exclusive with white-label mode. Default behavior is unchanged.
Migration009 adds `b2b_unified_session_context`; only fresh successful password
login creates a positive origin binding. Old unbound or brand sessions cannot
become unified authority. Legacy operational routes remain unavailable in this
mode. White-label host/generation binding remains exact. No existing session is
rewritten or automatically promoted.

The existing session controller owns bootstrap, selection, access, cancellation
and logout. It aborts departed authority before publishing changed state. Product
views mount above legacy loaders and above public/back/deep-link route selection.
No `superadmin` authority is coerced into legacy `admin`. Self-export paths already
include `/self`; the obsolete WP11 prepend request must not be applied.

## Historical and execution reads

Additive organization/branch-scoped GET endpoints:

- `legacyAssignments(memberId)`: exact issued references and status/attribution,
  including retired, archived and unexecuted assignments; no invented obligations.
- `enrollmentRevision(id,revision)`: exact immutable issued period plus recorded
  actor/time. Revision is distinct from issued goal revision.
- `occurrence(id)`: current occurrence and enrollment from one SQL statement;
  includes moved/cancelled records for truthful history inclusion.
- `historySubjects()`: staff roster using the existing historical subject policy,
  including inactive subjects; no organization-wide branch bypass or health data.
- `routineSupplement(id,version)`: nullable verified immutable v1 supplement with
  original snapshot hash/identity checks; never fabricates missing doses.
- `workoutEquipment()`: current nonarchived branch machine IDs for an authorized
  member. Generic equipment still requires explicit user confirmation.

These reads use existing tables and preserve original rows. Selected actor access
must remain active; inactive subjects remain readable under historical policy.
Historical actor access to an archived/former branch is not broadened.

## Committed invalidation

Migration010 installs narrowly scoped transactional `pg_notify` triggers for
membership/grants, health/consent, branch/organization, domain and session bindings.
Payloads contain bounded identifiers only; no health values or auth tokens.
Rollback sends nothing. One lazy PostgreSQL LISTEN connection per API process
filters schema and current subscriber scope; listener failure invalidates views.

`GET /orgs/:organizationId/product/v2/events` uses actual cookies, account header,
header2 and selected context. Optional `memberId` requests a trainer disclosure
stream and revalidates live consent. Subscribe-before-authorize fences initial
races. Authorization transactions are short, with no stream-lifetime database
locks. Frames are only ready/heartbeat/invalidate. Five-second authorization
heartbeats and a45-second lease cover natural expiry. Browser watchdog is10seconds;
disconnect/hidden/context change clears protected content. Trainer display remains
unmounted until its target-specific stream is ready. Cross-device browser and
adversarial delayed-response acceptance remain required.

## Synthetic candidate harness

`B2B_PRODUCT_TEST_ACTIVATE=1` is recognized only by the fresh-schema test harness.
It retains its migration preservation proof, then activates those synthetic
organizations and issues two goal enrollments through actual planning services.
Default foundation harness behavior remains inactive. No runtime database is
activated by migration or application startup. Unified test mode also opts into
the positive realm binding. Manual health import remains supported JSON only;
there is no external health access.

The UI binds WP07/08/09/10/11 to actual clients, access and storage. Reviewed v2
workouts and accepted v2 corrections use the actual IndexedDB outbox; owner-local
recovery remains separate from server exports. Remaining legacy editing/adoption,
revision-detail presentation, context-storage and broad browser acceptance are
explicit integration gates, not inferred from component or HTTP tests.
