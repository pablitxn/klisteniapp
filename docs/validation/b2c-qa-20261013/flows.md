# B2C flow matrix

PASS = journey/assertions executed; FAIL = reproduced defect; BLOCKED = necessary
infrastructure prevented execution; NOT RUN = unexecuted. Inventory is not absolute
coverage. `results.json` details engine/viewport case results. Evidence column
separates real backend/simulated transport.

| Flow | Final status | Evidence and scope |
| --- | --- | --- |
| Targeted invitation → activate → login | PASS | Real API/DB in accounts; initial registration also simulated UI |
| Shareable link → trial/exhausted limit | PASS | Real API/DB; one slot, token outside storage, no admin permissions |
| Lifetime invitation | PASS | Real API/DB, entitlement separate from role |
| Invalid/wrong-purpose/expired/incomplete link | PASS | Simulated UI transport + real API integration |
| Token recovery/history preservation | PASS | Fixture administrator-issued local token/password rotation/real DB |
| Public recovery request/error/rate limit | PASS | Simulated UI responses; no SMTP delivery |
| Login/logout/separate local mode | PASS | Real DB; private profile does not spill to local storage |
| Change password/incorrect current password | PASS | UI/real backend/data retained |
| Other-device session revocation | PASS | Password change revokes real second session; restart/old login rejected |
| Expired session/next account | PASS | Removed cookie/real refresh/hidden health/different empty account |
| A-B isolation/second device | PASS | Empty B account/A header rejected401/actual read-state |
| B2B separation | PASS | B2B API returns404 from B2C/admin403/check:b2b:boundaries; no deployed B2B UI cross-test |
| Explicit/repeated local migration | PASS | Real API/DB/original local retained/no duplicates |
| Full v2 copy → pristine account/faithful export | PASS | Real API/DB/export equals state |
| Invalid personal import/cancellation | PASS | No revision mutation/UI/DB |
| 9 MiB backup/2 MiB health limit | PASS | Second round real UI/DB |
| Invalid name/timezone/zero days | PASS | No new revision/UI/DB |
| Named routine/copy/active routine | PASS | Real DB/one copy after actual double click/reload |
| Weekly plan/Kiritimati-Honolulu timezone | PASS | Real DB/activity date in account zone/second session |
| Plan conflict/draft retained | PASS | Real concurrent change/review required |
| Routine order/sets/cancel | PASS | Second round real UI/DB |
| Complete strength/double submit | PASS | One persisted session/exact repetitions |
| Active strength/abandonment | PASS | Second round real UI/DB |
| Offline cardio/reload/retry | PASS | Real DB empty before/one record after retry |
| Cardio lost response after commit | PASS | route.fetch() confirms backend/aborts response; one record after reload |
| Yoga practice → actual time → history | PASS | Real DB/5s segment/snapshot/reload |
| Yoga edit/lost response | PASS after fix | Before FAIL B2C-01; exact confirmed snapshot/one practice/real DB |
| Different remote yoga change/copy | PASS | Simulated UI transport; store regression rejects different version |
| Yoga write error/draft retained | PASS | Simulated UI transport; no local/pending spill |
| Expired yoga: read/delete, no add/edit/practice | PASS | Simulated UI + real API integration |
| Empty progress/history/no exploration XP | PASS | Second round real UI/DB |
| Exercise catalog search/filter/empty | PASS | Second round real UI/DB |
| Mi cuerpo search/empty | PASS | Second round real UI/DB/glute search/empty; viewer excluded |
| Yoga library search/empty/empty history | PASS | Second round real UI/DB |
| Body health/profile/measurements → edit/delete | PASS | Simulated UI exhaustive CRUD; actual measurement persisted/reloaded |
| Initial health setup/conflict | PASS | Draft retained with simulated transport; actual profile saving in accounts |
| Health revision conflict/no storage fallback | PASS | Simulated UI transport + real integration |
| Health JSON preview/confirm/duplicate/future | PASS | UI/real DB/faithful export/no mutation before confirm |
| Sleep/activity/meals/supplements/goals | PASS | Real UI/DB/cancel edits-deletion/delete meal without losing other collections |
| Health overlapping sleep/source/original times | PASS | Simulated UI + unit/integration |
| Dashboard periods/sources/no invented coverage | PASS | Simulated UI + calculation tests |
| Saved appearance/plan draft retained | PASS | Actual mode saved; second round expands reload |
| Privacy back-forward/dialog return | PASS | UI/actual session retained |
| Trial/active/lifetime/expired account | PASS | Actual local-DB entitlement/server date |
| Expired account: export/retain/local/save disabled | PASS | Real UI/DB/billing disabled |
| Expired account: cancel deletion/direct write402 | PASS | Second round real UI/DB |
| Sandbox billing: uncertain checkout/refresh/URL/cancel | PASS | Fixture responses/no provider requests-payments |
| Billing return grants no entitlement | PASS | Real active DB + simulated expired UI/query removed |
| Real mail/payments/external sandbox provider | NOT RUN | Prohibited/outside authorized fixture/no delivery promised |
| Physical phones/iPhone Safari/physical Android | NOT RUN | Touch emulation only |
| 3D authoring/models/previews/GPU snapshots | NOT RUN | Explicit user exclusion |
| Partial yoga/pause-resume/reorder/real editor cancellation | PASS | Second round Playwright controlled clock/3s app virtual practice time excluding pause; lost log response/one record |
| Every yoga side/bilateral variant | NOT RUN | Not every asana/side combination tested |
| Reload during unsaved strength/yoga | NOT RUN | beforeunload observed in code; incomplete-session restore not certified |
| Revoke other sessions without password change | NOT RUN | Button inventoried; revocation tested through password change, not separate button |
| Every theme/language/palette combination | NOT RUN | One mode/persistence tested, not every ES/EN/FR × palette |
| Restore/corrupt account storage | NOT RUN | Unit coverage available; not every corrupt UI variant executed |
| CI/production/merge/deploy | NOT RUN | No writes/access to those systems |

No engine blocker after setup repair. NOT RUN steps are not product failures;
retain their scope for manual review.
