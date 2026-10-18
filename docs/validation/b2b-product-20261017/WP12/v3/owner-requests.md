# WP12 real-journey composition requests

Preparation context: `4954accaf0e4a0c88f8179b949886b1fcece8fa7`, not a final
acceptance head. QA has not changed production source, shared seed/config/routes,
manifests, lockfile or immutable v1/v2 evidence. These are concrete requests to
the existing INTEGRATION owner, not an ownership transfer.

## Preserve the real harness; publish actual navigation bindings

The new specs read the existing, real runner-side control endpoint:
`GET http://127.0.0.1:<fixtureControlPort>/fixtures?project=<fixtureIndex>`.
The current `fixtureVersion:2` map's organizations, actor IDs/emails, branch IDs
and `resources.legacy` references already match the tests. No generated database
ID or accepted DTO is fabricated by QA. Cases create their additional routines,
enrollments, occurrences, actual revisions and consents through real authorized
product endpoints; no shared SQL seed extension is required for those cases.

Keep `featuresActivated:false` until the accepted handlers and UI are composed.
At an actual ready candidate, publish `featuresActivated:true` and these **actual
application route paths** in the fixture map, using whichever routes the real
router exposes:

```ts
routes: {
  programming: string,
  history: string,
  health: string,
  trainerHealth: string, // may bind {memberId} if the actual route supports it
  people: string,
  reports: string,
  workout?: string, // only an actual route; may bind {occurrenceId}/{sessionId}/{programId}/{version}
}
```

QA deliberately has no guessed default for a newly composed feature route. A
missing map entry produces an annotated unavailable/skip; an advertised route
whose actual component, label or API is wrong fails. Do not add a test-only
component mount, injected-prop page or synthetic replacement route. If workout
entry is an actual calendar action rather than a URL, omit `routes.workout` and
publish `entryPoints.workoutButtonName` with its real accessible name. The test
uses WP08's real `#scheduled-occurrence-ID` card, opens that button and obtains
the session ID from the real save acknowledgment, rather than forcing an ID.

If trainer health has no addressable route, return the real reports route and
its actual subject/health entry controls instead; QA will adapt the navigation
once those controls exist. WP08's existing historical selector is `Persona`;
WP10's delivered view is `Salud compartida con entrenadores` with
`Validar y mostrar datos`. No producer has supplied the composed transition
between them yet, so QA cannot safely invent it.

## Explicit readiness for privacy/store paths

Return these booleans only when the corresponding real bindings exist:

```ts
readiness: {
  remoteHealthInvalidation: boolean,
  localRecoveryBinding: boolean,
}
```

`remoteHealthInvalidation` must attest the authenticated server-committed
cross-context/device notification path and fail-closed disconnect behavior.
Foreground polling or a local BroadcastChannel alone is insufficient. QA's
race holds a genuine authorized HTTP response, revokes through a separate owner
API context while the trainer remains focused, then releases the stale response.
Its immediate hide assertion uses a three-second bound, preventing the 15-second
foreground fallback or a focus change from manufacturing a pass. No channel
event is mocked.

`localRecoveryBinding` means the actual selected WP09 store/scope/session is
injected into WP11's published recovery callback. QA obtains pending bytes by
using the actual form offline, deactivates through actual ACCESS, checks receipt
denial, and downloads the real separate recovery file. A mocked callback or
guessed IndexedDB key is not an acceptable substitute.

## Current concrete gaps requiring actual owner interfaces

- The checkpoint has no WP07-WP11 producer UI composition and its real seed is
  still `foundation-baseline`, activation false. No browser execution there can
  establish product acceptance. Keep the unified realm, administrative branch
  bootstrap and inactive identity-only admission guards intact while composing.
- WP08 requests scoped legacy assignment descriptors, immutable enrollment
  revisions and occurrence-by-ID/inclusion detail. The checkpoint endpoint
  inventory lacks those named reads. Return the accepted CONTRACT operation
  names/input/output and composed UI binding before QA asserts period exclusion
  for an unloaded moved occurrence, full period-revision history, or complete
  original legacy content. Existing `routineVersion`/`sessionRevisions` are used
  directly, never replaced with mutable catalog/draft data.
- WP04's checkpoint alternatives read still has a legacy-assignment-only member
  predicate. Integrate its accepted own-v2-occurrence amendment before accepting
  v2-only reviewed selection. QA chooses only genuine server-published canonical
  directed relations/dose; it invents no reverse/transitive relationship. If the
  approved branch fixture cannot supply a bodyweight reviewed target, provide
  the exact approved source/target/availability fixture rather than fake metadata.
- WP11 asks for a `/self` client correction. In checkpoint4954, the actual
  `ProductEndpoints` constructor already prefixes self paths with `/self` and
  the client uses that path. Reconcile against the final source before applying
  an extra prefix. QA's actual download waits for exactly
  `/api/b2b/self/exports` and validates the strict downloaded envelope, catching
  either a missing or doubled prefix without a raw-fetch UI workaround.
- Trusted HTTPS still needs existing valid certificate/trust inputs. HTTP UUID
  support in the task fixture uses `crypto.getRandomValues` only and changes no
  secure-context, certificate, cookie or sandbox property. CacheStorage absence
  on a fictitious HTTP origin does not attest HTTPS cache behavior.

## Isolation, execution and remaining coverage

Cases allocate unique IDs and historical weeks per scenario; they retain real
server `asOf`/closed results. Date-only browser clock controls select/display a
historical week and exercise enrollment timezone presentation; server responses
are untouched. The open four/three/one case uses a separate secondary-branch
member/current week; closed accounting uses its own historical week. Temporary
membership deactivation is restored in `finally`. Each browser project must
retain its own disposable schema/API/media/origin and use a database separate
from concurrent API suites.

Use the proven matching 1.63 runtime and real full-stack composition. Keep
Chromium `chromiumSandbox:true`, TLS verification, six exact viewports and the
existing guarded loopback DB setup. QA will not modify shared runtime/config or
relax a guard to execute an unready checkpoint. Parent supplies the exact final
combined head and accepted input SHA map for acceptance.

The v3 source receipt inventories implemented journeys and remaining authoring
gaps. It does not waive the original 88-scenario inventory. The existing strict
final runner continues to reject a missing ID, skipped/unavailable cell or
incomplete matrix. Discovery/compilation is not a product pass.
