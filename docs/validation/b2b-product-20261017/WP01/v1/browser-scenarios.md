# WP01 scenarios for the exclusive WP12 browser owner

Status: supplied scenarios, **not executed browser acceptance**. Use the composed head after PLANNING applies the coverage patch. Do not use the older installed 1.62 browser image as Playwright 1.63 validation. The parent pinned matching-runtime guidance at PR13 head `e71c5c4273a9e18b7422a0250626729417de8a95`, `docs/validation/b2b-product-20261017/WP12/v2`.

Run Chromium and WebKit at 320x740, 430x932 touch/mobile and 1440x1000 desktop using unified and trainer/white-label harnesses. Preserve two brands/four branches and separate HTTP synthetic vs valid-trust HTTPS/Secure-cookie evidence.

1. An unassigned trainer lists same-branch users, sees issued routines and actual history, edits/publishes a routine and assigns it to another trainer's user. Assignment relationships remain informational. Open a planning resource's audit dialog and verify actor, field names, revision references and server time.
2. Switch to a second branch where the same identity has only a member grant; trainer controls disappear. Another branch without a grant and another brand deny API requests. A branchless context with multiple permitted branches fails closed. Switch brand/account/branch while People or audit loads; previous identity data never reappears.
3. Superadmin can invite/promote organization admins/trainers/members. A narrower admin can manage trainers/members but cannot create/promote/manage an admin or superadmin; forged requests also fail. No platform capability appears. Last-superadmin removal shows the recoverable error and preserves the user.
4. Pause a user: historical training remains readable to currently authorized staff, new planning targets are unavailable, health sharing is revoked. Reactivate: history remains, explicitly revoked grants and consent are not restored.
5. Lose the response to an accepted permission change/invitation and retry unchanged input: the component keeps the same operation identity, the server returns the original response and exactly one audit row exists. Changed payload with the old operation ID conflicts. Show stale revision errors with retained form state and reload recovery.
6. Queue a People/planning request behind revocation of session, membership, branch role or domain generation; release it and verify rejection before any read, write or receipt replay. API tests cover this ordering; the browser must clear protected UI on rejection.
7. Keyboard-open the native audit dialog, verify accessible title, initial Close focus, focus containment, Escape dismissal and focus return to the invoking button. Verify loading, empty, error and unknown-historical-detail states. Long IDs/emails/field names and invitation URLs wrap at 320px; touch controls remain usable and no page overflow occurs.
8. Before activation, capability discovery is authenticated and reports false, People uses its legacy DTOs, product feature requests reject and unregistered feature endpoints return 404. An old tab cannot coerce v2 content through a strict legacy route.

Screenshots supplement assertions. No physical-device, HTTPS/provider, deployment or final combined acceptance is claimed by WP01.
