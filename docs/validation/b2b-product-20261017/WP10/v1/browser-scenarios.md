# WP10 scenarios for QA/WP12

Status: supplied scenarios, **unrun**. QA exclusively owns the new
`b2b-product-health.spec.ts` and fixtures. No browser spec/config was edited by
WP10. Use only synthetic identities/health JSON and the parent-supplied composed
head, with exact backend and access/provider revisions recorded.

Run Chromium and WebKit using matching Playwright 1.63 runtime documented at
PR13 head `e71c5c4273a9e18b7422a0250626729417de8a95`,
`docs/validation/b2b-product-20261017/WP12/v2`. No runtime substitution or TLS
bypass. Required layouts: 320x740, 430x932 touch/mobile and 1440x1000 desktop.
Synthetic HTTP evidence remains distinct from valid-trust HTTPS/Secure cookies
and physical-device acceptance.

## Owner import and explicit consent

1. With no grant, owner settings identifies the correct brand and selected
   branch and reports private status after current load. Trainer, other member,
   admin-only, superadmin-only and other tenant cannot see owner values.
2. Native JSON selection, including a picker that blurs/hides/refocuses the
   window, reaches server preview. File reading never imports automatically.
   Keyboard can select a file, inspect counts/status and explicitly confirm.
   Reopening/cancelling the native picker preserves a valid reviewed preview.
3. Supported normalized v1 JSON shows exact added counts by category and exact
   duplicates. Confirm writes once; repeat/lost-response retry preserves the
   operation ID/body and does not duplicate records. Import causes zero consent
   POSTs; existing consent choices remain unchanged.
4. Malformed JSON, wrong envelope/version, renamed vendor JSON, CSV, ZIP,
   over-2-MiB UTF-8, over-10000 records, conflicting identity/content, future
   observations and accumulated payload over 4 MiB fail honestly. Semantic
   rejection shows parser issues and disables confirm. No partial write occurs.
   The producer currently returns a generic raw issue, not invented conflict IDs.
5. Ticket expiry, process restart/eviction and owner revision conflict require
   a fresh preview. A delayed older preview/file read cannot replace a newer
   selection or survive account/branch change. Exact retry of an already
   accepted operation still resolves after expiry.
6. Grant requires at least one category and a separate acknowledgement. Copy
   identifies exact brand/branch, selected categories, disclosure v1 and the
   dynamic current/future authorized branch trainer audience. Changing selection
   clears acknowledgement and does not save by itself. New branch trainers can
   read only inside the granted branch after current server authorization.
7. Replace categories using current revision; old responses cannot restore the
   prior category set. Other-branch active grants are disclosed and have a
   reachable authorized branch selection/revocation flow. Check the unavailable
   prior-branch lifecycle with ACCESS; do not infer permission to switch there.

## Revocation, disconnection and scope races

1. Delay a trainer response, revoke in another tab, then release it: no old values
   remount. Repeat after revoke/regrant to different categories. Inspect the
   event/authority path, epoch invalidation and next authorized GET separately.
2. Repeat revocation on another device/browser context or via server membership
   transition. Confirm the composed shell receives a current notification and
   clears immediately. Without that wiring the case is blocked; the foreground
   15-second fallback is not an immediate cross-device-revocation pass.
3. Revoke while a trainer already shows values: mounted content disappears on
   invalidation, the pending request aborts and a denial cannot leave old data.
   Owner UI waits for current settings. Lost/failed revoke is visibly unconfirmed;
   it never announces success on a network failure.
4. Mounted and pending trainer views clear on offline, hidden document, blur,
   pagehide, logout, account change, brand/host/domain generation change, branch
   switch, coach role loss and current grant loss. Release every delayed response
   after the transition and assert no remount under the obsolete scope.
5. Remain offline and inspect IndexedDB, local/session storage, CacheStorage and
   relevant app/service-worker caches: no trainer health value survives there.
   Refresh/back/forward/reload never displays cached trainer values. Reconnect,
   focus or restored page must fetch and authorize again before showing values.
6. Revalidation begins by clearing the old DOM. HTTP error, invalid strict DTO,
   wrong owner/tenant/branch and lost connection leave data hidden. Every
   foreground refresh rechecks current categories/consent revision. A blurred
   page stays empty even when its interval fires.
7. Inactivate the owner with simultaneous requests: same-transaction revocation
   removes all brand grants, including branches; other brands remain independent.
   Correct-host export-only access offers own export including own health and
   calls no operational health endpoints. Reactivation does not restore a grant.
8. Two brands/four branches: account, target and branch switching never mount the
   previous context's values even for a single render. Check active membership
   elsewhere cannot unlock the inactive tenant, and staff historical-training
   access supplies no inactive health bypass.

## HTTP, presentation and accessibility

1. Check actual success and denial responses use WP05 no-store/private headers,
   without ETag/304/shared cache. Requests carry the v2 contract header and
   selected authorized branch; strict activation/host/body/path handling and
   per-route 5-MiB HTTP envelope limit remain enforced by ACCESS.
2. Trainer view contains only granted categories and raw recorded measurements
   with original units/provenance. Profile/goals, ungranted placeholders,
   diagnoses, recommendations and trainer export/download controls are absent.
   General gym/staff/audit downloads contain no health payload.
3. Test empty authorized categories, loading, semantic rejection, conflict,
   timeout, denied access and uncertain mutation states with keyboard and status
   announcements. Confirm 44px touch controls and visible focus indicators.
4. Check long brand/member/branch names and notes, record details, file picker,
   category acknowledgements and errors at all three widths: no horizontal
   overflow or clipped controls. Screenshots supplement assertions; they do not
   replace scope/authorization tests.

These scenarios do not claim compliance, legal erasure, absolute recall of
already delivered bytes, physical-device behavior or production readiness.
