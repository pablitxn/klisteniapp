# Amendment 004: inactive identity and export HTTP bindings

INTEGRATION composes WP06 `fd138190e18ba84dcf47c1fc81ad535d051d8ff4` under its
retained ACCESS lease. Operational `requireBrandSession` and selected-branch
authorization remain active-only; restricted identities cannot enter producers.

Correct-host password login resolves the real newly created session ID. Inactive
membership requires explicit contract2, activated product, ready migrations and
current domain binding. Failed admission removes the session in a separately
committed cleanup after rollback, and returns no auth cookie or successful body.

The current selected membership is checked before private dispatch/body handling.
Inactive requests use WP06's deny-by-default method/path allowlist: own complete
self downloads/invitation, restricted access/capabilities and logout. Gym reads,
mutations, receipts, media GET/HEAD/Range and partial downloads remain denied.
Operational handlers still perform their own locked authorization after this
early deny gate.

`GET /api/b2b/self/exports?organizationId=...` and `/self/b2c-invitation` require
exactly one organization selector and no extra query keys. They ignore stale
branch/role headers, authorize the actual owner and domain, and serialize inside
the identity transaction. Exports use WP06's full private/no-store download
headers, including error paths. No member override, range or private media stream
is introduced. Restricted access contains no branches and only
`export-own-records`.

Logout checks the live session and exact bound domain but does not require an
active membership, active product or contract2. Its short authorization transaction
commits before Better Auth deletes the session. Brand-bound sessions cannot be
reused in a no-domain identity request. The forthcoming explicit unified realm
adds positive unified-session binding rather than treating an absent brand row as
new unified authority.

Optional `B2B_B2C_INVITATION_URL` must be HTTPS without credentials, query or
fragment. The default response has a null URL; both modes retain separate paid
product and `automaticConversion:false`. No conversion, account, payment or
provider action occurs.

`product-inactive-http.test.ts` covers actual login, restriction, copied-cookie
denial, failed-admission cleanup, complete historical export, owner health,
deactivation and reactivation with retained revoked grants/consent. Together with
the existing white-label HTTP and anonymous-public suites, the focused run passes
15 tests with zero skips. API typecheck also passes. Synthetic local data only.

Versioned bootstrap/reload and the restricted UI are the next composition layer;
this amendment does not widen legacy `/me` or get-session response schemas. Shared
ACCESS ownership remains with INTEGRATION. No organization activation, production
migration, main merge or deployment is performed.
