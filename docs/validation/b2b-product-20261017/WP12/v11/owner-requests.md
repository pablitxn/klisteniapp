# WP12 v11: actionable requests for the next composed candidate

New accepted executable source: `7dcf45753591da83ee0bfbde2e2c50dca218ff9b`.
Integration evidence: `4b9541c2f205642d6e0b9bef2f1c6a23a6c5ec47`,
INTEGRATION/v9 and amendment011, read before this handoff. These requests use
actual authenticated reproductions on prior source00b9f85 and source inspection
of7dcf457. New-source browser execution is pending; earlier runs are not relabeled.
QA owns the real browser scenarios and will rerun the returned combined source.
The parent routes implementation and owns shared/application changes.

## WP09/root: incomplete completion feedback is cleared

Classification: application defect in the prior executed candidate; the same
relevant catch-and-continue behavior remains in7dcf457. It is independent of the
corrected QA calendar clock. Reproduction: `B2BP-ALTERNATIVES-009`, using actual
synthetic member password admission, `/app?view=history`, the selected week and
the real issued-session action. Record source work, select an actual reviewed
per-side alternative through its conditions/dose controls, record only the left
side, and click `Completar sesión explícitamente`.

Expected: actionable missing-right-side feedback stays visible, the session
remains partial and no invalid completion is sent. Actual prior result: partial
is preserved, but no alert remains and the screen says synchronized. The original
alert assertion fails. See WP12/v7 ALTERNATIVES-009 context and v9 raw result.

In7dcf457 `useProductTrainingSession.ts:239`, `serialize` catches task errors,
sets the error and resolves. `save` at435 awaits it and unconditionally calls
`synchronize`; synchronization at357 clears the error after preparing unchanged
valid partial content. Request: preserve the failed validation result and stop
that explicit save before synchronization. Keep local durability, per-side/set
minimums, authority cancellation and idempotency unchanged. Also check invalid
void/correction feedback through that shared path. Do not remove the browser
assertion or mark partial as completed. Ordinary Close success is a separate seam.

## Root/health: explicit reconnect can expose an unusable display action

Classification: application readiness/lifetime defect observed on00b9f85; the
health implementation and relevant gate/outer-guard arrangement are unchanged
in7dcf457. It does not use `showWeek` or the former fixed Date clock. Reproduction:
`B2BP-HEALTH-005`. The member visits `/app?view=health`, imports the supported
synthetic JSON and explicitly grants sharing. A separate authenticated cover
coach visits `/manage?view=shared-health`, selects that member and clicks
`Validar y mostrar datos`. Initial measurements appear.

Use native context offline: measurements disappear and persistent-store checks
find no health marker. Return online, click `Volver a validar consentimiento`,
then the actual enabled `Validar y mostrar datos`. Actual: generic operation error,
no `Medidas` heading and no new health fetch after the explicit controls. The
prior trace shows successful initial health/SSE responses, not admission429s.
Data remains hidden, so this is availability/readiness evidence, not a leak.

Request: bind the usable trainer display action to both its renewed consent/view
lifetime and the outer workspace request guard. `TrainerHealthGate` uses its own
stream readiness; `healthClient` obtains `context.requestSignal` from the outer
root stream guard. A race between those gates is a source-supported explanation,
not a proven internal cause. Reproduce and make explicit revalidation/display
settle truthfully without stale authority, persistent health caching, bypassing
the guard, extra automatic consent or unlimited retries. Keep offline/revoke
hiding and the existing browser assertions.

## WP09/root/UI: narrow local-storage error controls overflow

Classification: application layout defect on00b9f85. Training CSS is unchanged
in7dcf457. Reproduction: `B2BP-SYNC-009`, real member workout opened through
`/app?view=history`. The test deliberately throws native `QuotaExceededError`
only for actual readwrite transactions involving `workouts-v2`, then enters
quantity3. This is a local storage fault, not a fabricated DTO/response.

The storage warning, retained input, unchanged accepted actuals and exact opaque
old-byte preservation all pass. The final320px check measures inner/document/body
width345px. The error state includes `Recargar copia local y archivar cambios de
esta pantalla`. Training controls have `max-width:100%`, but shared `.button`
uses `white-space:nowrap`. Request: make the actual recovery/error controls wrap
and fit their narrow container; retain touch target, visible feedback, retry and
owner export. Verify at320px in both engines and also430px. Scope the application
style fix to these real controls as appropriate; QA does not edit shared CSS.

## Root/history/UI: measured resume button causes history overflow

Classification: application layout defect, independently reproduced in
Chromium/WebKit320 after the advancing-clock correction. Reproduction:
`B2BP-WEEK-012` or `B2BP-WEEK-008`: open a real owner workout, complete/correct
through the authorized flow, return to `/app?view=history` with its durable
selected-workout recovery available. The semantic actual/adherence assertions
pass, then the final width assertion fails.

R19 WebKit identifies the actual button `Retomar trabajo guardado en este
dispositivo`: right354.9375px, width336.9375px, innerWidth320, document/body355.
Chromium expands inner/document/body to355px. See
`WP12/v10/r19-history-viewport-measurements.json` and both native traces.
The relevant resume JSX and CSS are unchanged by the Close binding amendment.
Request: let this real root button wrap and fit its narrow container while
preserving its explicit resume action, pointer binding and touch/keyboard access.
Rerun320px in both engines and430px. Keep the width assertion and real resume UI.

## Clarifications preventing unnecessary feature work

- ROLES-006 keyboard audit was a QA scoped-response assumption. The corrected
  drawer/focus/Escape and cross-organization denial case passed inR17.
- SYNC-001 offline reload was a QA assumption about automatic reopening. Actual
  explicit resume, retained values and partial acknowledgement passed inR18.
- ROLES-003 needed actual selected-context admission before navigation. The full
  real invitation/activation/fresh acceptance flow then passed inR18.
- SYNC-008 and the intermediate WEEK-008 reconnect stalls were caused by QA's
  frozen wall clock. Advancing native system time resolves those semantics in
  both engines inR19. Do not relax application guard/backoff behavior for them.
- The missing reviewed duration-target direction remains a separate accepted
  catalog/fixture/provenance gap. QA must not invent a reviewed target or count
  the opposite time-to-repetitions switch as the required direction.

These are independent from actual authenticated normal-Close acceptance on the
new source, which proceeds in this wave. No HTTPS bypass, application feature
fix, main merge or real-user/provider data is authorized by this QA handoff.
