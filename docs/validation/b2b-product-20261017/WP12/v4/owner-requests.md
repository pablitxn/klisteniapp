# WP12 v4 concrete owner requests

QA merged exact candidate `591feb1fd6a29306b5dc08a70ae5335a0ce01422` and read
INTEGRATION/v3. All 88 reserved IDs now have source, replacing the older
52-source handoff. This does not mean all variants or browser cells pass.
Parent retains dispatch and acceptance. QA has edited no shared configuration,
registration, application feature or contract file.

## Reproducible accepted-work correction entry loss

On candidate591feb1 with QA source1ad4038, unified Chromium320 completed a real
session, waited for server acceptance **and** the visible synchronized state,
then filled `Motivo de corrección`. The textarea returned to an empty string
and stayed empty through the five-second assertion. SYNC-010 fails before the
next save; this is not merely a missing server correction reason or a raw API
substitute. It also reproduced in the older candidate.

WP09 should inspect `ProductTrainingSession.tsx` event handlers and the deferred
`session.edit` callback. The current handler reads `e.target.value` inside a
serialized callback instead of capturing the entered value before deferral.
This is a proposed cause to verify, not an application fix made by QA. Preserve
CAS, pending request bytes and actual accepted revisions while fixing the real
controlled-form interaction. The test now explicitly checks the field value.

The new-head multi-scenario run also reached HTTP429 on a subsequent password
admission. `auth.ts` intentionally permits ten email logins per minute. QA is
adding seven-second admission pacing with a timestamp-only task output ledger;
no auth limit, credential, cookie, token or application configuration is changed.
The affected weekly cell remains failed at admission, not an accounting failure.

## White-label history/calendar overflows at320px

R9 on candidate591feb1, QA source896ae6b, passed the actual weekly API and
calendar count assertions before failing the unchanged viewport assertion.
Chromium requested320px but measured `innerWidth=343`,
`document.documentElement.scrollWidth=343` and `document.body.scrollWidth=343`.
The same scenario passed at430px and1440px in that run. Snapshot and measured
attachment bytes are retained. The first measurement's offender list compares
against the already-expanded inner width and is empty, so it does not identify
one proven offending DOM node.

WP08/INTEGRATION should inspect wrapping/minimum widths in the actual
`WeekCalendar.tsx` occurrence cards and controls under the white-label brand
theme. Occurrence headings render stable `occ-` hash IDs without a local
wrapping declaration; this is a static candidate to check, not a proven root
cause. Preserve stable identities, responsive semantics and the320px assertion.
QA has not patched application CSS or hidden overflow.

## Actual white-label HTTP hashing failure

The actual WebKit white-label HTTP workout trace on candidate04ac103 reports:
`undefined is not an object (evaluating 'crypto.subtle.digest')`.
The same direct calls remain in candidate591feb1:

- `apps/b2b-web/src/features/training/sync/workoutEdit.ts`,
  `occurrenceWorkoutId`, deterministic occurrence document identity.
- `apps/b2b-web/src/features/training/sync/workoutSync.ts`,
  `workoutRequestHash`, immutable canonical request hashing.

A fictitious HTTP origin is not a secure context; the existing task fixture's
cryptographic UUID compatibility helper does not provide WebCrypto. QA will
not override `isSecureContext`, `crypto.subtle`, certificate verification or a
sandbox flag to obtain a pass. INTEGRATION/WP09 must choose and validate the
accepted HTTP implementation, preserving exact existing SHA-256 bytes/IDs, or
supply an accepted valid-trust HTTPS candidate/runtime for that mode. Do not
invent a v2 DTO or alter operation hash semantics in the QA branch. A new-head
white-label execution will determine whether this persists; older failure is
not claimed as a rerun on591feb1.

## Known UI composition work remains with parent-dispatched owners

The real People view on04ac103 had no `Buscar persona` control; ROLES-001 timed
out there. INTEGRATION/v3 independently confirms that role/grant/invitation and
scoped audit UI breadth is pending. Keep the real producer controls and required
assertions; do not replace them with raw API mutations and call the UI accepted.
The relevant original scenarios include ROLES-001/003/006/008.

INTEGRATION/v3 also confirms pending immutable period-detail UI, atomic actual
inclusion presentation, durable selected local recovery after reload, explicit
legacy resume/new handling and legacy revision-zero editing. Their actual
production modules/bindings must be supplied by the existing owners. Browser
results remain independent from owner-reported unit/API totals.

## Exact real fixture/adoption dependencies

- **ALTERNATIVES-005:** supply a persisted, currently published branch-available
  organization exercise that actually changes its canonical base while keeping
  matching `baseExerciseId` and `animationId`. Return its actual ID through the
  ordinary catalog read. QA selects that real row and asserts no inherited
  reviewed relation. If absent, the case records annotated unavailable and the
  strict final gate cannot pass. QA does not edit shared seeds or insert a fake
  reviewed relation.
- **ALTERNATIVES-007:** candidate591feb1 has a real `routineSupplement` read, but
  no accepted adoption write endpoint or composed adoption UI. CONTRACT/
  INTEGRATION must freeze the operation/input/output and bind the actual explicit
  trainer confirmation UI before QA can perform the full adoption journey.
  A null actual supplement records unavailable after the legacy/no-auto-review
  assertions. A preexisting supplement can prove retention/export, not that a
  browser adoption action was performed. Immutable original bytes and source
  hash/version remain mandatory.

These are specific remaining dependencies, not requests to change the original
88-ID inventory, reduce the matrix, bypass activation or accept skips.

## Runtime and isolation findings

The supported official1.63 runtime launched the real application and disposable
PostgreSQL17.11 with both browsers. No runtime download, sandbox or TLS blocker
was fabricated from the host's default browser cache.

The initial `--network none` container makes Chromium's native online state
false. A task-only internal bridge makes Chromium online but leaves WebKit
native offline because it lacks a default route. These are runtime findings,
not application bugs. The installed supported HTTPS smoke helper uses ordinary
Docker bridge networking. The task browser was attached to an isolated named
Docker bridge using that supported networking model; WebKit's native online
state then became true. No JS online property or secure-context API was mocked,
no route/security capability was added, and no host networking, ports, secret
mounts or production/provider target was used. Synthetic DB and application
remain on shared container loopback. The bridge has normal Docker outbound
capability; it is not claimed to be `--internal` or an egress firewall.

Trusted HTTPS remains separate: `B2B_PRODUCT_TLS_CERT` and
`B2B_PRODUCT_TLS_KEY` are not configured in this task. Do not generate new trust
or use ignore-certificate settings. Parent must supply the accepted inputs if
that mode is to run here.
