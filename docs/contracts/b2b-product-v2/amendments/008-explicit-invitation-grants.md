# Amendment 008: explicit invitation grants and fresh admission

CONTRACT/ACCESS/root owns this additive storage and admission amendment. The
existing strict `InviteProductMember` request and `ProductInvitation` response
remain unchanged. Migration011 is required by activated product readiness; old
migration text, role mappings, immutable history and the lockfile stay unchanged.

## Exact grants

`b2b_invitation.branch_grants` is nullable JSONB. SQL NULL preserves the old
scalar `branch_id`/role behavior. An explicit array, including `[]`, is the exact
new invitation snapshot. New v2 invitations always store the supplied array and
NULL scalar branch. The legacy Principal trigger runs only for SQL NULL snapshots.
Migration011 does not rewrite or backfill old invitations.

The request supports any unique same-organization `{branchId, role, active}`
array; branch roles remain `coach` and `member`, independent of the organization
role. No automatic role or grant is added. Active grants require active branches
at creation and acceptance; inactive grants remain explicitly inactive. Acceptance
strictly parses the snapshot and rechecks issuer authority, branch identity/status,
expiry and one-use under the existing organization transaction. Existing membership
cannot be promoted or reactivated through an invitation. The membership default
scope trigger stays disabled for acceptance. `[]` never falls back to Principal.

## Credential and realm admission

Only exact POST `/invitations/accept`, `/invitations/sign-in`, and
`/invitations/join` are additionally admitted in unified mode. Legacy `/me` and
`/auth/get-session` remain blocked. Ordinary sign-in retains its membership
prerequisite. Existing users accept through token-scoped password authentication
plus explicit consent in unified, white-label and supported legacy mode.

A server-internal `fresh-invitation-login` purpose is supplied only after successful
password authentication. Acceptance verifies the newly issued session and absence
of any existing realm binding, then consumes the invitation, creates exact grants
and inserts its positive unified-origin or exact white-label-host/generation
binding in one transaction. Failed admission deletes the new session separately
and forwards no authentication cookie. This purpose is never inferred from a
missing binding or accepted from request JSON.

Normal authenticated join revalidates `requireIdentityRealm` inside the
organization-locked acceptance transaction. A queued join cannot outlive a
committed realm revocation. Origin/content-type/account identity guards remain.
New-account acceptance still returns `{ok:true}` and requires subsequent login.
The invitation UI refreshes the same tab's session and navigates to the workspace
on credential acceptance, so an older mounted actor cannot remain authoritative.

## Parent dispatch: People UI follow-up

**WP01 UI owner, Sol6.1 high fast:** The published typed invitation request now
supports the full unique branch-grant array after migration011. Extend only the
returned People invitation editor/model/tests to let an authorized administrator
explicitly select branch roles and active state from server-provided same-org
branches. Reuse the existing grant editor patterns. Keep organization role
hierarchy, exact operation retries, errors and scoped audit intact. Preserve the
user's exact array; do not default empty arrays to current/Principal, infer grants
from organization role, infer other branches, or grant admin trainer-health access.
Remove the now-obsolete single-branch limitation text only when these controls
are implemented. Permit explicit no-grants invitations with a clear consequence.
Cover multi-branch/mixed role, inactive grants, no grants, invalid/revoked branch,
replay, changed-operation conflict and mobile/desktop controls. Do not edit
CONTRACT/ACCESS/root/migrations/lockfiles; parent owns dispatch.

Root already composes the returned PeopleWorkspace and invitation-entry callback.
QA still owns actual invitation navigation and same-tab identity acceptance.
