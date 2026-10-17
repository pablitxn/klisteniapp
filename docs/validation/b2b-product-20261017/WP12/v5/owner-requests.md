# WP12 v5 owner requests

## INTEGRATION: downstream gateway disconnect must cancel upstream SSE

On application `2d0df2797d7876070372bc7808d582604ca3bbf0`, R12
INACTIVE-011 timed out selecting the actual staff-history Persona control.
Its coach trace shows repeated HTTP429 at `/product/v2/events`. ROLES-001 later
could not reach the actual People search. The API's existing limit is eight
active subscriptions per actor in `apps/b2b-api/src/product-events.ts`; that
limit must remain intact.

The actual `scripts/b2b-gateway.mjs` proxy pipes the upstream response to the
browser and cancels the upstream request only on incoming request `aborted`.
A completed GET followed by browser response close does not trigger that event.
The gateway therefore retains upstream SSE connections when clients navigate
or close contexts. The API's new healthy indefinite lifetime makes the leak
persistent instead of ending at an old transport lease.

A bounded transport-only probe used this exact actual gateway, a disposable
loopback SSE producer, and actual HTTP client disconnects. A direct disconnect
left 0 upstream responses. Three gateway disconnects left 1, 2, 3 open responses.
See [raw result](gateway-disconnect-probe.json) and the exact
[executed script](gateway-disconnect-probe.mjs.txt). This proves transport cleanup
behavior, not product acceptance or an independent browser pass.

Requested shared-owner change: bind downstream response close to idempotent
upstream request/response cancellation and remove/detach listeners on normal
completion as appropriate. Preserve healthy streams, authorization fencing,
heartbeat behavior, proxy headers, eight/128 limits and existing API contracts.
Add a gateway transport regression that completes the incoming GET, disconnects
the response, and verifies the upstream closes. Repeated real browser
navigation/context closure must not exhaust the actor limit. QA has not edited
this shared gateway, the hub or any shared configuration. A later exact
combined head must rerun the affected browser cells and the transport probe.

## WP09/root: existing controlled input fix also covers local recovery export

R12 INACTIVE-006 filled the real notes field after an accepted synchronized
workout while actual revision transport was blocked. The textarea became empty
and the UI remained synchronized, so it failed before local export. Owner
`1371477205ec1a767bcfac21ae9de1c973a65619` captures note values as well as performed
and correction inputs. Keep this cell, SYNC-010 and the earlier HTTP WebCrypto
workout failure queued for the exact parent-composed head. No application fix
or substitute DOM/state injection was made in QA.

## QA corrections prepared, not yet rerun

- R11 sign-in 429: locked better-auth 1.7.7 resets its database counter only after
  an idle minute. Seven-second spacing never expires it. The owned helper now
  reserves at most nine real admissions, then waits 61 seconds. It stores only
  timestamp/count, includes the direct synthetic admission in INACTIVE-001,
  extends only the current test budget for required admission waiting, and
  leaves the real application guard unchanged. No session/credential cache or
  response retry can turn a denial into a pass.
- HEALTH-005: the actual stream wrapper offers `Volver a validar consentimiento`
  after offline invalidation. Drive that control before the display button.
  Offline hiding and durable-store checks already reached their assertions.
- HEALTH-008: unsupported/malformed/oversized file failures are explicit status
  messages in the accepted component. Require their exact text, unchanged
  authoritative health data and disabled/absent confirmation; add empty-file
  rejection. Do not demand a nonexistent alert role.
- HEALTH-009: impersonating the account header correctly returns exact
  HTTP 401 `ACCOUNT_CHANGED`; require that denial for health write and export.
- INACTIVE-003: use the advertised actual workspace deep links. The invented
  `/manage/programs` path correctly rendered the public404. Preserve a separate
  unknown-route private-data denial and reentry through the real header link.
- ROLES-002: a coach with one permitted Principal branch has a documented safe
  legacy default. Use the actual mixed-role actor's two branches for the
  ambiguous branchless request, requiring exact 400 `BRANCH_REQUIRED`.
- ROLES-006: the returned audit dialog's actual accessible name includes the
  resource name. Bind the exact named dialog for keyboard/focus assertions.

Prepared current/original immutable-period detail actions still need their
separate source-bound run. Earlier R11 history passes do not exercise these
later assertions. They distinguish original issued revision from the revised
current period after a real accepted period edit.

## Other accepted dependencies remain separate

The integrator supplied ALTERNATIVES-005's actual changed local adaptation in
`6a479f00f6941e0ec7fb89cc399a7569e3b08e04`; QA merged that head but did not restart
the running 2d0 snapshot. The adaptation case still needs an actual browser run.
ALTERNATIVES-007 now explicitly records unavailable after retained-data checks;
a preexisting supplement cannot pass the required reviewed adoption action.
The returned WP07 UI and amendment008 invitation controls/acceptance flow still
need exact parent composition and browser execution.

WP08's width fix and WP09's hashing/input fix were reported by parent while this
run was active. Owner test totals are not QA reruns. The original failing320px
cell, HTTP workout and corrections remain unresolved in this receipt until
executed against the exact combined fix head. Trusted HTTPS inputs are absent;
no TLS/trust/sandbox bypass is proposed. No final full-matrix acceptance is claimed.
