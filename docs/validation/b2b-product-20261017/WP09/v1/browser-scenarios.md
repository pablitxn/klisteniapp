# WP09 browser scenario requests

QA exclusively owns `b2b-product-sync.spec.ts`, `b2b-product-alternatives.spec.ts`
and their task fixtures. These scenarios are requests, **not passing browser
acceptance**. Use the parent-accepted composition and actual WP06 access API.
Run unified/member and scoped-brand flows at 320x740, 430x932 touch and 1440x1000,
Chromium/WebKit 1.63. Preserve valid-trust HTTPS/Secure-cookie as a separate gate.

| Requested ID | Required assertions | Existing feature evidence |
| --- | --- | --- |
| WP09-S01 | Loaded form offline edits survive reload; zero sets remain draft; no offline-start/service-worker claim | trainingOutbox, native IndexedDB probe |
| WP09-S02 | Reconnect automatically sends locally durable work; acknowledgement changes sync status only | trainingSync, direct API probe |
| WP09-S03 | Server commit with dropped response; same ID/hash/payload on retry; exactly one receipt/revision | trainingSync, direct API probe |
| WP09-S04 | Edit while request is delayed; original payload stays frozen; successor binds accepted revision | trainingSync slow-send test |
| WP09-S05 | Two tabs local CAS: one winner; loser sees storage conflict and can export or explicitly reload/archive its copy | trainingOutbox, native probe |
| WP09-S06 | Two devices stale server revision: show local/server snapshots; explicit server/local choice; no merge or overwrite | trainingSync, sessionEdit, direct API probe |
| WP09-S07 | Quota/denied/blocked upgrade: visible error; no false local-save/sync success; in-memory export remains available | trainingOutbox; native blocked-upgrade still needs QA |
| WP09-S08 | Logout/account/brand/branch switch mid-request: abort and hide former owner; late ack cannot repopulate departed form | trainingSync cancellation |
| WP09-S09 | Inactivate/revoke queued member: restricted recovery/export only; payload retained; no write; explicit revalidation on reactivation | trainingSync, direct API probe |
| WP09-S10 | Partial save/autosave never completes; positive below-target actuals may explicitly complete; editing renews intent | sessionEdit |
| WP09-S11 | Completed-to-partial, performed-time correction and void require reasons; revisions/history retained | sessionEdit, WP03 API suite |
| WP09-S12 | Legacy readable draft/pending POST/unreadable bytes retain exact identity and source backup; no invented reviewed provenance | sessionDraft migration cases |
| WP09-A01 | Record source actuals, switch reps to time/per-side target: retain source, independent target dose/load, minimum count per side | sessionSegments |
| WP09-A02 | Fixed/range targets, extra allowed sets, RPE/notes/rest and independent load; missing target side/count prevents completion | sessionSegments, WP03/WP04 domain/API suites |
| WP09-A03 | Restore retained source explicitly without losing either segment's actuals or silently completing | sessionSegments |
| WP09-A04 | Reviewed directional relations only; blocked/empty notices; all target conditions and equipment acknowledged | sessionSegments, WP04 component/domain |
| WP09-A05 | Current target/source catalog withdrawal returns 409 INVALID_INPUT/unavailable: keep work and identity, no logout | trainingSync, WP03 catalog races |
| WP09-A06 | Restore source, explicitly archive unaccepted rejected target into recovery, then submit corrected new operation; accepted segments cannot be archived | sessionSegments, trainingOutbox |

For every state assert focus/labels/live status, keyboard/touch controls and no
horizontal overflow. Include back/reload and errors. Capture source/head,
actual counts/skips and screenshots; the isolated native probe is not a substitute
for this matrix, real HTTP authorization or physical-device acceptance.
