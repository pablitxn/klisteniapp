<a id="sincronización-de-salud-ruta-propuesta-y-requisitos"></a>

# Health synchronization: proposed route and requirements

Public demo retains local recording/import/dashboards. Future server-saving connection
belongs to operator-configured instance; no automatic provider/user/credential
connection. [Modes/configuration](deployment.md).

Status on **October 4, 2026**: Klisteniapp records health/imports [normalized JSON](health-import.md).
**No Android connector, Samsung/Google linking or automatic synchronization implemented.**
This is a proposal/dependencies; third-party capabilities checked against official
docs on that date. No Galaxy Watch/physical phone tested.

<a id="ruta-recomendada-para-galaxy-watch8"></a>

## Recommended Galaxy Watch8 route

```text
Galaxy Watch8
  → Samsung Health on phone
  → Health Connect on that phone
  → Klisteni Android app reading selected permissions
  → authenticated Klisteni API
  → private account dashboard, also accessible from web
```

Health Connect stores device data/provides Android API. Google login grants no
storage access. Current web requires Android app to read/send authorized records;
OAuth button alone does not complete route. [Android/cloud API distinction](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq).

Start with reads into Klisteni/retain manual notes. Sending Klisteni changes back
to Samsung requires another contract/permissions, outside first stage.

<a id="qué-necesitamos-en-cinco-pasos"></a>

## Five required steps

1. **Check phone/data.** Record Android/Samsung Health/Health Connect versions.
   Verify real watch measurement in Samsung Health then Health Connect. Samsung
   Health → Ajustes → Health Connect configures link/user sharing.
   [Samsung configuration](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect).
2. **Create/install Android bridge.** Small app handles permissions/initial read/
   synchronization/status while main UI stays web. Health Connect integrated from
   Android14, separately installed on earlier compatible versions. Check availability/
   features at runtime, not version alone. [Setup/compatibility](https://developer.android.com/health-and-fitness/health-connect/get-started).
3. **Link Klisteni account.** Authenticated pairing, e.g. one-use code approved from
   account session. Revocable device credentials with sync scope/expiry/secure
   storage. Proposed only; backend does not yet issue them.
4. **Read accessible history then changes.** Category permissions; extra history/
   background permissions where available. Display actual imported range/missing
   fields/server confirmation. First import cannot promise all Samsung history.
   [Reads/history](https://developer.android.com/health-and-fitness/health-connect/read-data).
5. **Maintain sync/visibility.** On opening/manual button/periodic jobs, with retry/
   offline queue/revocation. Distinguish last measurement/phone read/confirmed save;
   submission attempt is not save.

Google Play publication needs Data Safety/health-app declaration, justified data
types/privacy policy. Validate development build on real phone first; public
distribution requires publication process. [Google Play](https://developer.android.com/health-and-fitness/health-connect/publish).

<a id="frecuencia-y-alcance-reales"></a>

## Actual frequency and scope

Automatic sync will be **periodic**, variable delays. WorkManager minimum15 minutes;
Android schedules by constraints/optimization and may defer/skip. Initial proposal:
hourly plus on opening/on demand; measure before adjusting. No hourly guarantee.
[Periodic scheduling](https://developer.android.com/develop/background-work/background-tasks/persistent/getting-started/define-work).

Samsung controls watch→phone: may sync on reconnect/open/refresh; continuous pulse
not immediate for battery reasons. Watch receipt/bridge execution are separate
delays. Docs list weight/body fat/steps/pulse/sleep/exercise/nutrition; version-dependent.
[Samsung sync](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect).

Background reads require `READ_HEALTH_DATA_IN_BACKGROUND`/feature check; otherwise
sync on opening. Default reads start30 days before initial permission;
`READ_HEALTH_DATA_HISTORY` extends when available/authorized. Reinstall revokes/
changes reference. Permission does not establish full Samsung transfer. Current
Android guide supports background; some older Samsung articles say foreground only.
[Read rules](https://developer.android.com/health-and-fitness/health-connect/read-data).

<a id="datos-y-diferencias-que-debe-conservar-el-adaptador"></a>

## Adapter data distinctions

| Information | Proposed treatment |
| --- | --- |
| Weight/body-fat percentage | Available observations with date/unit/source/stable identity |
| Sleep | Preserve source sessions/phases before summary; avoid overlapping double count. Current JSON retains summary, not all phases |
| Steps | Appropriate aggregation/explicit origin policy; do not sum phone/watch as separate activity. Android recommends cumulative-step `aggregate()` |
| Pulse | Current contract accepts summaries; detailed sessions need timestamped samples/intervals/coverage model |
| Meals | Known nutrients; missing remains absent, not zero consumption |
| Circumferences/supplements | Manual until verified compatible source |

[Reading/aggregation](https://developer.android.com/health-and-fitness/health-connect/read-data),
[current contract](health-import.md).

Health Connect has `LeanBodyMassRecord`, no equivalent Klisteni **skeletal muscle
mass** field. Lean mass/skeletal muscle are not interchangeable. Never fill
`skeletalMuscleKg` with lean mass or difference estimate. [Data types](https://developer.android.com/health-and-fitness/health-connect/data-types).

Samsung Health Data SDK exposes `SKELETAL_MUSCLE_MASS` in kg/other composition
fields: later alternative for fuller Samsung integration, actual-data verification
pending. Distribution requires Samsung approval/package/signature registration;
development mode tests only. [Body composition](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-body-composition-type/index.html),
[Samsung process](https://developer.samsung.com/health/data/process.html).

<a id="protocolo-incremental-pendiente"></a>

## Pending incremental protocol

Health Connect adds/corrects through `UpsertionChange`, deletes through
`DeletionChange`. Deletion contains only ID; retain type/own-record mapping.
Android recommends per-type tokens; unused token expires within30 days. Expiry
requires reread/reconciliation of accessible range without duplicates.
[Changes/recovery](https://developer.android.com/health-and-fitness/health-connect/sync-data).

Proposed Klisteni design:

- Cursor before initial read; paginate history/process changes during read. Save
  cursor only after batch persistence or durable guaranteed-redelivery queue.
- Identify by account/connection/source app/type/ID; distinguish observation/source
  modification/receipt. Idempotent batches/verifiable acknowledgment.
- Incremental upserts/deletion tombstones prevent retries restoring deleted data.
  Do not overwrite user notes/corrections with provider change: retain both layers
  or expose conflict.
- Expired token: reread authorized window/reconcile only complete read. Never infer
  deletion from revoked permission/pending pages/offline/out-of-range data; declare
  incomplete coverage.
- Pause revoked category; separate disconnect/history deletion. Account change
  isolates credentials/queue/cursors to prevent cross-person submission.

Observed backend saves whole `health` in `personal_state.settings` through
`PUT /api/me/health`/expected revision. JSON importer rejects changed content for
same source identity. Protects current edits, **not** automatic provider correction/
deletion protocol. Missing: device pairing/credentials, incremental ingestion,
structured source identity/version, health tombstones/persisted sync state.
Training tombstones do not cover health. [API](../apps/b2c-api/src/http.ts),
[persistence](../apps/b2c-api/src/state.ts), [importer](../apps/b2c-web/src/lib/health-import.ts).

<a id="google-health-api-y-google-fit"></a>

## Google Health API and Google Fit

Separate Google OAuth2.0 cloud API replaces Fitbit Web API; restricted health
permissions require review. At documented review, **new projects were not being
onboarded**, so not initial dependency. [Overview](https://developers.google.com/health/about),
[published availability](https://developers.google.com/health/get-started).

Not limited necessarily to Fitbit/Pixel Watch: reference includes Health Connect
origin. If access opens, validate actual categories/provenance/Samsung coverage
before offering cloud route. [Origins](https://developers.google.com/health/reference/rest/v4/users.dataTypes.dataPoints/list).

Google Fit stopped new registration May1,2024; retirement announced for2026, no
exact day in consulted FAQ. Fitbit Web API support ended September 30, 2026; shutdown
planned October 30, 2026. Separate APIs/calendars. [Fit FAQ](https://developer.android.com/health-and-fitness/health-connect/migration/fit/faq),
[Fitbit timeline](https://developers.google.com/health/about).

<a id="verificación-antes-de-habilitar-la-sincronización"></a>

## Verification before enabling synchronization

Authorized phone data: initial read/pagination/partial-revoked permissions/history
>30 days where available/repeated batch/source correction-deletion/network interruption/
expired token/app close-restart/account change. Compare samples/intervals against
Samsung Health/Health Connect; record missing fields. Dashboard marks saved only
on API acknowledgment.

Private charts use account data for owner. Product visit analytics such as Umami
must receive no measurements/sleep/meals/notes/goals/credentials/connector payload.
Private trend analysis remains possible. Visit consent/sync permissions separate.

Current JSON tests verify Klisteni contract, not Samsung connection/history coverage/
watch accuracy. Sync criteria remain pending Android bridge/real hardware testing.
