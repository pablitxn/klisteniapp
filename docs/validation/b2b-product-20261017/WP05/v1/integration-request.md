# WP05 owner wiring requests

Implementation: `ec4ca015d54a836b8f46aa5a6d00a99fc253d96b`.
Frozen base: `0b611064a91b87b3a17274cabca5415bcf1d7d55`.
No reserved/shared file was edited. These requests belong to ACCESS/INTEGRATION,
WP06 and WP10; they are not applied patches or passing HTTP/browser evidence.

## ACCESS / INTEGRATION: eight frozen handlers

```ts
import {
  createHealthServices,
  HEALTH_RESPONSE_HEADERS,
  healthDisclosureGeneration,
  revalidateHealthDisclosure,
} from './health/index.ts';

// Create ONCE per API process, not once per request: preview tickets are local.
const health = createHealthServices();
```

Register these existing `ProductEndpoints` names directly to the corresponding
`health[name](authorizedContext, parsedInput)` method. Every method implements
the frozen `HealthServices` signature and also validates strict input itself.

| Name | Method and suffix under the versioned organization namespace |
| --- | --- |
| ownHealth | GET `/health/own` |
| saveOwnHealth | POST `/health/own` |
| previewHealthImport | POST `/health/import-preview` |
| applyHealthImport | POST `/health/import` |
| healthConsents | GET `/health/consents` |
| grantHealthConsent | POST `/health/consents/:id` |
| revokeHealthConsent | POST `/health/consents/:id/revoke` |
| consentedHealth | GET `/members/:memberId/health` |

Use WP01's current locked `AuthorizedProductContext` and its existing session,
host/domain-generation, product activation/version header, entitlement and
branch checks. Use READ COMMITTED and the supplied `context.db`; no feature
service opens, commits or replaces that transaction. `context.role` is the
organization product role; a trainer disclosure additionally requires a live
selected-branch coach grant and `read-consented-health`. Administrative scope
alone is not that audience. `authorizeMember` is still called for health targets.
Path/body IDs must agree. Never construct identity/scope from a request body.

The existing HTTP `body()` limit is 1 MiB, smaller than the frozen health DTOs.
Requested exact change to its owner: make `body(request, maximum = 1024 * 1024)`
accept a per-route maximum, and pass `5 * 1024 * 1024` only for these health
POST bodies. This accommodates JSON escaping around a 2 MiB raw file and the
4 MiB owner state plus envelope. Keep byte-counting/Content-Length protection;
the strict schemas/parser retain the lower 2/4 MiB semantic limits. Other
routes retain their existing maximum. Test HTTP boundary/stream rejection.

Set `HEALTH_RESPONSE_HEADERS` on every health/consent response, including errors,
and personal owner exports. Do not add ETag/304 or shared caches. The current
generic `json()` writes only content-type: the exported constants are not yet
HTTP enforcement. Do not persist or bulk-export trainer projections.

For a projection delayed outside its original authorization transaction, call
`revalidateHealthDisclosure(freshAuthorizedContext, preparedProjection)` in a
fresh current-authority transaction immediately before dispatch. Serialize its
returned projection, not captured bytes. It reloads current owner health and
rejects revoked/replaced consent generations and changed scope/authority.
Keep the authority/consent locks through serialization. The linearization
boundary is the final authorized disclosure; already delivered bytes cannot be
recalled. Transport scheduling after that boundary still needs composed tests.
`healthDisclosureGeneration(projection)` supplies a scope/owner/consent/revision
key for app-controlled response gates; it is not a reusable authorization token.

Preview tickets expire after five minutes, are bounded to 1000 pending previews,
and hold only hashes/owner/revision/expiry. They bind parsed input and merged
normalized data. Process restart, eviction or another replica requires a new
preview, failing closed. Use a single process or request affinity for the
preview/confirm pair; durable multi-replica tickets would require an explicit
CONTRACT-owned storage amendment. Accepted import receipts remain durable and
exact retry works after ticket expiry or owner edits. No schema change is
requested for the current single-process implementation.

The shared parser's rejected preview contains one error, without structured
conflict IDs. WP05 preserves it as `issues[{path:'raw',message}]`, returns zero
additions and no valid ticket; `conflicts` stays empty rather than inventing
IDs or partially merging. Successful counts use `byCategory[].added` and
`counts.duplicates`. UI must block confirm whenever issues are present.

## WP06: inactivity and personal export

```ts
import {
  ownerHealthExport,
  revokeHealthForInactiveMembership,
} from './health/index.ts';

// Inside the SAME authorized membership-deactivation transaction, after UPDATE:
await revokeHealthForInactiveMembership(context, memberId, input.operationId);

// Compose the health field of PersonalExportSchema under identity-only access:
const health = await ownerHealthExport(authorizedIdentityContext);
```

The hook requires the selected organization's target membership to be inactive.
It revokes every active branch consent for this owner in this organization,
increments consent revisions, appends consent snapshots and bounded audit
references atomically. Its trusted caller owns staff/transition authorization
and membership access revision; it is not an externally callable route. Repeat
calls do not duplicate changes. Rollback restores membership/consents together.
Do not call it for reactivation, which must never recreate consent.

`ownerHealthExport` accepts only the authenticated identity context, requires
`export-own-records`, supports current inactive/export-only membership and never
accepts another owner ID. Include it only in personal owner export. General gym
training, audit, routine, reports and staff exports must exclude all health
payloads. Owner data is global to this B2B identity; selected gym context is an
audience, not a separate copy or a B2C transfer.

## WP10 / QA: required composed scenarios

- Explicit import preview/confirm and separate consent confirmation; invalid
  CSV/ZIP/version/oversized/conflicting files cannot confirm or write.
- Disclose the exact dynamic current authorized branch-trainer audience,
  categories, organization/branch and disclosure version before granting.
- Clear trainer views on revoke, role/branch/account/host change, inactive state
  and disconnect. Abort requests and increment a local view epoch; a delayed
  response must match both the captured view epoch and current scope/generation
  before mounting. Revalidate online before showing health again; no offline or
  persistent trainer cache. Server no-store cannot clear already mounted UI.
- Delay a trainer response, revoke, then release it; verify no remount. Repeat
  with revoke/regrant to different categories, branch/role loss and logout.
- Inactive owner export remains available; fresh active health sharing needs a
  new explicit grant after reactivation. Test two brands/four branches.
- Check actual HTTP no-store on success and denial, route body limits, strict
  DTO/header/activation/host checks and ordinary gym downloads without health.

WP12 owns final browser specs/fixtures. WP05 supplies these scenarios only.
