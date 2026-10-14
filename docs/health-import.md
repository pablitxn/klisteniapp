<a id="perfil-de-salud-e-importación-de-registros"></a>

# Health profile and record import

**Salud** records body/sleep/activity/meals/supplements/personal goals. Free demo
browser storage; instance account server while cloud access current. Preview local;
confirmation writes active destination. No analytics data/demo API queries.

<a id="qué-funciona-en-esta-versión"></a>

## Available in this version

- Manual observations/goals with date/source.
- Explicit `klisteniapp.health` v1 JSON import below.
- Preview new/duplicate counts/categories/sources/date range.
- Detect duplicates/conflicts before save; invalid import writes no rows.
- Health in full personal v2 backup, restored through Ajustes/local-active account;
  distinct from exchange JSON here.

**No automatic Samsung Health/Health Connect synchronization.** Normalized Klisteni
contract, not native Samsung/Android export. No Samsung CSV/Health Connect.zip
converter. Downloadable empty template seeds no example profile data.

<a id="qué-permite-cada-plataforma"></a>

## Platform capabilities

Official-doc review October 4, 2026; actual phone/app versions/permissions/measurements determine availability.

| Source | Documented scope | Klisteni consequence |
| --- | --- | --- |
| Watch→Samsung Health→Health Connect | Watch to phone; Health Connect Android phone, not Wear OS | Future phone Android bridge; current browser lacks it |
| Samsung→Health Connect | Weight/fat/height/basal metabolism/sleep/nutrition/exercise/pulse among types, version-dependent | Not everything on watch necessarily available |
| Samsung Health Data SDK | `BodyCompositionType` distinguishes weight/fat/fat-free/skeletal muscle/water/etc. | Muscle may need SDK/verified export; never lean→muscle conversion |

[Samsung FAQ](https://developer.samsung.com/health/health-connect-faq.html),
[sync table](https://developer.samsung.com/health/blog/en/accessing-samsung-health-data-through-health-connect),
[Android SDK](https://developer.android.com/health-and-fitness/health-connect/get-started),
[BodyCompositionType](https://developer.samsung.com/health/data/api-reference/-shd/com.samsung.android.sdk.health.data.request/-data-type/-body-composition-type/index.html).
`LeanBodyMassRecord` **not skeletal muscle mass**. Samsung table does not list
latter; no promised route coverage, inspect actual arrival. [Types](https://developer.android.com/health-and-fitness/health-connect/data-types).

<a id="obtener-una-copia-de-origen"></a>

## Obtain source copy

Samsung phone menu→Ajustes→Descargar datos personales→Descargar; Mis archivos→
Descargas→Samsung Health. Download, never Borrar datos personales. Support page
provides no stable CSV/JSON contract sufficient without sample inspection.
[Official download](https://www.samsung.com/us/support/answer/ANS10001379/).

Android 14+ Settings→Health Connect→Manage data→Backup and restore
(localized Spanish labels: `Ajustes`, `Gestionar datos`, `Copia de seguridad y restauración`),
usually Health Connect.zip for native restore. **Current importer cannot accept ZIP.**
[Backup/restore](https://support.google.com/android/answer/15323271?hl=en).

Future Samsung adapter needs small anonymized actual sample: headers/units/IDs/one-two
records/type, timezone/structure retained. No renamed fields/row-position IDs/guessed
percent-kg-calorie units. Declare unsupported types/keep original/reject ambiguity.

<a id="formato-normalizado-soportado"></a>

## Supported normalized format

[health-import.ts](../apps/b2c-web/src/lib/health-import.ts), [shared health.ts](../packages/scene-schema/src/health.ts).
All following fields required:

```json
{
  "format": "klisteniapp.health",
  "version": 1,
  "exportedAt": "2026-10-04T12:00:00Z",
  "timeZone": "Europe/Paris",
  "records": {
    "measurements": [],
    "sleep": [],
    "activity": [],
    "nutrition": [],
    "supplements": []
  }
}
```

At least one actual observation. exportedAt file creation; explicit IANA timeZone
fallback per record, retained on save.

| Field | Meaning |
| --- | --- |
| `id` | Stable local≤200 characters/unique across observations-goals; not row number |
| `date` | Observed local YYYY-MM-DD, never UTC reinterpretation |
| `recordedAt` | Original capture/create ISO8601 Z/offset; may differ for retrospective entry; stable across exports |
| `modifiedAt` | Optional manual-correction ISO Z/offset, not original/source replacement, not future |
| `source.kind` | manual/samsung-health/health-connect, declared metadata, not device-measurement certification |
| `source.externalId` | Required stable source ID≤200, distinguish source app/type if IDs reused |
| `source.device` | Optional label≤200 |
| `timeZone` | Optional record IANA, overrides file |
| `notes` | Optional≤2,000 |

<a id="unidades-y-campos-por-categoría"></a>

### Category units and fields

Field names define units. JSON numbers, not strings such as "81 kg"; no conversion/
missing estimates. Unknown keys rejected, not silently discarded.

| Category | Fields |
| --- | --- |
| `measurements` | weightKg/bodyFatPercent/skeletalMuscleKg/fatMassKg/bodyWaterPercent; cm waistCm/hipsCm/chestCm/neckCm/leftArmCm/rightArmCm/leftThighCm/rightThighCm/leftCalfCm/rightCalfCm;≥one |
| `sleep` | Required actual durationMinutes; paired optional startAt-endAt/deepMinutes/remMinutes/awakeMinutes/score0–100. Sleep+awake≤interval, deep+REM≤asleep |
| `activity` | ≥one steps/activeMinutes/activeEnergyKcal/restingHeartRateBpm/averageHeartRateBpm/maxHeartRateBpm; activityLabel/workoutId identify/associate actual Klisteni training |
| `nutrition` | meal and/or observed energyKcal/proteinG/carbsG/fatG/fiberG; unknown calories absent |
| `supplements` | Required name/taken; paired optional dose/unit; recorded intake, not recommendation |

Total daily calories not activeEnergyKcal. No lean mass/liters-water/all sleep phases/
raw pulse series/all micronutrients. Exporter declares omissions/retains originals,
never substitutes similar metric. **Synthetic explanatory** measurements example;
replace with actual record. Original placeholder retained as fixture value:

```json
{
  "id": "measurement-example-1",
  "date": "2026-10-03",
  "recordedAt": "2026-10-03T09:00:00+02:00",
  "timeZone": "Europe/Paris",
  "source": {
    "kind": "samsung-health",
    "externalId": "REEMPLAZAR-POR-ID-REAL",
    "device": "Galaxy Watch 8"
  },
  "weightKg": 81.5,
  "bodyFatPercent": 24.2,
  "skeletalMuscleKg": 32.1
}
```

<a id="duplicados-conflictos-y-límites"></a>

### Duplicates, conflicts and limits

Source identity **category+source.kind+source.externalId**. Identical reimport adds
nothing. JSON key order/local ID/same instant offset representation not differences;
first local ID retained. Other data incl notes/device/timezone must match. Different
values same identity reject whole file/no overwrite; user reviews version. Local
ID cannot switch source/category. Different origins stay separate even equal values,
no inferred same measurement. Manual correction keeps source/original instant/adds
modifiedAt; old reimport conflicts, never reverses notes/device/correction.

**2 MiB UTF-8/10,000 total records/import**, personal max10,000/category. Future
observations/instants, impossible dates/inconsistent intervals/out-of-range/unknown
fields reject. API revalidates instance saves.

<a id="procedimiento-de-importación-y-recuperación"></a>

## Import and recovery

1. Personal export before important-history mutation.
2. Actual normalized records/original retained; template structure, no conversion.
3. Select JSON in Salud/review dates/categories/counts.
4. Confirm: local browser or account reviewed revision. Account change requires new preview.
5. Verify save/history; valid preview alone not storage/API acknowledgment.
6. Retain file/correct indicated field-conflict; no zeroing/blind deletion. Rejection preserves old records.

No automatic supplement recommendation/calorie deficit. Declared trend observations,
not diagnosis/exercise-causality. Samsung SDK wellness/fitness scope.
[SDK scope](https://developer.samsung.com/health/data/overview.html).

<a id="trabajo-pendiente-para-sincronización-android-real"></a>

## Pending actual Android synchronization

Chosen-data Android SDK bridge, availability/revocation/actual history. Default
other-source reads30 days before first permission; older history extra/version-dependent
permission, no all-history promise. [Android read/history](https://developer.android.com/health-and-fitness/health-connect/read-data).
Background permission/compatibility checked, no extrapolated obsolete foreground
restriction. [Permissions/types](https://developer.android.com/health-and-fitness/health-connect/data-types).

Keep IDs/source app/page reads/explicit units/active-vs-total energy/reviewable
corrections-deletions. First version can emit JSON/use current preview; later sync
needs consent/last-read-last-save/revision/account-change handling, no analytics payload.
Actual authorized phone tests needed. Current contract tests boundaries/atomic
rejection/dedup, not watch connection/sensor accuracy/uninspected Samsung fidelity.

```sh
node --test apps/b2c-web/test/health-import.test.ts
```

<a id="verificación-reproducible"></a>

## Reproducible verification

```sh
# Validate the domain and exchange contract
pnpm --filter @klisteniapp/scene-schema test
pnpm --filter @klisteniapp/b2c-web exec node --test test/health-store.test.ts test/health-import.test.ts test/account-api.test.ts

# Forms, goals, import, conflicts and mobile view on port 43174
pnpm --filter @klisteniapp/b2c-web exec playwright test --config playwright.health.config.ts

# Account isolation and actual persistence; requires disposable PostgreSQL
# TEST_DATABASE_URL must be configured in the environment and never point to production.
pnpm --filter @klisteniapp/b2c-api exec node --test --test-concurrency=1 tests/*.test.ts
pnpm test:accounts

# Also check that health data does not reach the analytics visit
pnpm test:analytics
```

Health suite temporary build/43174 avoids anatomy viewer; fictional data/intercepted
account responses. Actual persistence separately API/account suite. No Samsung sync/
production claim. [Sync architecture](health-sync.md), [personal dashboard](health-dashboard.md)
use local/active account records.

<a id="capacidad-del-historial"></a>

## History capacity

Cumulative health JSON UTF-8 max4 MiB plus2 MiB/import. Validate merged result;
split files cannot bypass. Overflow no rows/revision changes, margin below5 MiB
save request for correction/deletion.

Ajustes restore preserves observation linked to absent workout without association;
never restores deleted workouts, existing account historical links retained.
Normalization does not permit new invalid form links.

<a id="disponibilidad-de-conexiones-externas"></a>

## External connection availability

Manual import/dashboard available free local demo. No active Google Health auto
connection: [status/requirements](health-integrations.md). Instance cloud
[subscriptions](subscriptions.md).
