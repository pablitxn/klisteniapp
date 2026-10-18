# WP08 QA handoff: mobile, desktop and historical continuity

Status: scenarios supplied; **0 feature-browser scenarios executed by WP08**.
QA owns `b2b-product-history.spec.ts`, `b2b-product-week.spec.ts` and shared
fixtures. No such file was created or edited here. These are requirements for the
parent-accepted composed head, not passing results inferred from unit rendering.

Use matching Playwright 1.63.0, Chromium and WebKit, viewports 320x740 and 430x932
touch/mobile and 1440x1000 desktop, unified and white-label current-context flows.
The matching-runtime instructions are pinned at PR13 head
`e71c5c4273a9e18b7422a0250626729417de8a95`,
`docs/validation/b2b-product-20261017/WP12/v2/report.md`. Keep Chromium sandbox and
TLS verification enabled; local HTTP remains distinct from trusted HTTPS/Secure
cookie acceptance. Existing `member-qa.spec.ts` and `b2b-member-roadmap.spec.ts`
regressions remain QA's composed-head gates.

| Scenario | Fixture and action | Required observation |
| --- | --- | --- |
| H01 enrollment today | Enrollment in America/New_York; device in a different zone; clock crosses UTC midnight and DST repeat | Today and `aria-current=step/date` follow the enrollment date. Rest day, gap, future stage and ended enrollment labels are truthful; no fabricated absence |
| H02 simultaneous enrollments | Two current programs and two slots on one day | Both programs/objectives and every stable occurrence remain visible; same-date sessions never collapse |
| H03 original links | Complete a version, publish a later routine and move/remove its stage | Routine-to-session and session-to-original links retain schemaVersion/program/version and log ID; never open the mutable draft as original. Original-snapshot reader request must be resolved first for full content acceptance |
| H04 actual detail | Below-target actual reps, timed variant, external load zero, unilateral sides, earlier deselected segment, notes | Dated scalar actuals, independent target ranges/units, variant provenance, retained additional work and null/zero distinction; no substitution-count metric |
| H05 corrections | Open original/revisions; correct completed to partial and then void on accepted WP09 UI | Latest status and accepted/performed timestamps stay distinct; earlier revisions/actor/reason readable; adherence recalculates without deleting original links |
| H06 period exclusion | Move a logged period across weeks; remove a slot | Actuals remain visible; known excluded work is explicitly excluded; no double completion/absence. Resolve CONTRACT occurrence reader request before accepting automatic exclusion for unloaded moved occurrences |
| H07 legacy | Legacy assignment/log with no enrollment and revision zero; first correction | Original ID/snapshot/values remain; unplanned label; no invented scheduled obligation. First edit appears once with original revision reachable |
| H08 retained inactive target | Staff selects inactive member in authorized branch reports | Historical training and corrections readable, inactive label, no move form, no health fetch/export. Active member in other brand does not unlock this brand |
| H09 context change | Switch actor/branch/brand/host while continuity/week/revisions/move responses are delayed; revoke in another tab | Old private data clears immediately, context signals abort; stale response cannot populate new scope; revoked operational route yields WP11 restricted screen |
| W01 four/three/one | Four required, three explicitly complete, one partial | Before close: required4/completed3/pending1/missed0/partial1. After close: missed1/pending0/partial1, with explanation that partial is included in missed |
| W02 keyboard move | Tab to same-week native select, choose Sunday by keyboard, submit with Enter | Seven Monday-Sunday options, visible labelled confirmation, one exact CAS/operation POST with ID/date only, updated day, count/version/content unchanged. After refresh focus lands on `#scheduled-occurrence-ID` and persistent status announces acceptance |
| W03 touch move | Repeat W02 at 320/430 using touch; no dragging | Native control usable; no horizontal viewport overflow; dates, status and original links readable; form stays within card |
| W04 same-day and stage edge | Two occurrences same day; move one past midweek stage end but within its week | Stable separate IDs; original stage/routine retained; explicit accepted override shown; completion eligible on accepted date; no new quantity |
| W05 prohibited moves | Completed/cancelled/ended/foreign occurrence; outside-week payload; stale CAS | No UI move form when prohibited; server rejects forged input; error not success, no optimistic count/date mutation; refresh obtains accepted revision |
| W06 lost response | Accept a move then drop response; retry unchanged date | Same operation ID/payload retained by mounted form; exact replay; no duplicate obligation. A newly selected date gets a new operation ID; refresh/owner change does not imply persistence (no schedule outbox promise) |
| W07 closed late correction | Accepted correction after local Monday close, then completed-to-partial | Closed current revision/asOf visible; actual correction after close labelled from acceptedAt evidence, not from revision watermark alone; totals match authoritative server |
| W08 timezone boundary | Sunday/Monday, spring23h/autumn25h, year boundary; change device timezone | Seven local dates; no reinterpretation of frozen occurrence timezone; next/current/previous week queries use explicit timezone; day change refreshes summary |

Inspect 320px overflow, table-contained horizontal scrolling, focus visibility,
headings/labels, native select/button names, `role=status/alert`, original-link
navigation and screenshot evidence. Unit/SSR rendering proves markup and helper
behavior only; it does not prove browser focus, touch, authorization or transport.
