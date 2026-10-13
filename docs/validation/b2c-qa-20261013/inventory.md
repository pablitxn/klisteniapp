# B2C inventory before case selection

Initial revision 7172041102a8a7029af5fb3e2527a1fa51611a86. Inspected 2026-10-13.

Sources: AppRoot.tsx, App.tsx, account-route.ts, SettingsPanel.tsx, AccountPanel.tsx,
Forms.tsx, YogaPage.tsx, YogaPracticeEditor.tsx, YogaSession.tsx, HealthPage.tsx,
Progress.tsx, BillingPanel.tsx; docs/accounts.md, subscriptions.md, ui-iteration.md,
roadmap-implementacion.md. Atlas wiki/klisteniapp.md and source-of-truth policy.

## Routes

- `/`: B2C instance; `?account=login` opens account, `?billing=return` opens billing.
- `/privacy`: privacy policy/preferences; return/back/forward.
- `/account/activate`: targeted invitation, fragment token removed from URL.
- `/account/join`: limited shareable link; email/name/password/confirmation.
- `/account/recover`: new password with ephemeral token.
- `/account/forgot-password`: generic request; fixture SMTP disabled.
- Six `/` areas are UI state, not independent history routes.
- `/app`, `/manage`, `/g/:slug` belong to B2B, not B2C capabilities.

## Accessible actions

| Area | Actions/states to cover |
| --- | --- |
| Mi rutina | Select exercise, instructions/technique/variants, edit order/add/remove/sets/save/cancel; start/reps/rest-skip/complete/confirm abandonment/cardio |
| Ejercicios | Search/pattern-difficulty-equipment filters/clear/empty/open card/add to routine |
| Mi cuerpo | Search/filter regions/expand/exercise-mobility-yoga links; viewer excluded |
| Yoga | Explore/search/filter/educational card; create/edit/copy/delete practice/order-add-remove steps/duration-side; start/pause/resume/next/finish/abandon/save-delete history |
| Mi progreso | Empty/strength-cardio-yoga histories/weekly summary/confirm-cancel deletion; no progress for exploration/abandonment |
| Mi salud | Summary/periods-sources/body-profile-measurements/sleep-activity/meals-supplements/goals; add-edit-delete-cancel/validation-conflict; normalized JSON/template/preview/confirm/deduplicate/limits |
| Cuenta y planificacion | Login/logout/trial-lifetime-paid-expired/name-timezone/select named routine-copy/days/effective date; explicit local migration/change password/revoke other sessions/non-admin permissions |
| Billing | State/plans/create-resume sandbox/refresh-cancel; return grants no access; real backend provider disabled/sandbox mocks without external connection |
| Apariencia | ES/EN/FR/palette/mode/account persistence/conflict |
| Datos | Account export/JSON v1-v2/history restore/optional settings/cancel/invalid/delete; separate local data retained |
| Configuracion inicial | Optional profile/measurement/skip-repeat/drafts-conflicts |
| Privacidad | Local consent/withdrawal/links/focus/modal scroll |

## Cross-cutting cases

Happy path/empty/validation/error/double submit/reload-back-forward/lost response/
cancellation/expired session/concurrent revision/accounts A-B/second device/timezone.
Verify persistence through real API/export; identify mocks separately. No physical
phone or authoring/preview/model tests.
