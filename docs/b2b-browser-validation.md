<a id="validación-de-navegador-b2b"></a>

# B2B browser validation

Suite uses real product/disposable PostgreSQL. Each project owns random schema/API/
media directory/independent origin; publication/retirement/session in one engine
cannot change next scenario. Cases serial per project, automatic retries disabled.

| Project | Engine/input | Test origin |
| --- | --- | --- |
| `chromium-desktop` | Chromium1440×1000, keyboard/mouse | `http://127.0.0.1:4202` |
| `chromium-touch` | Chromium Pixel7 touch profile | `http://127.0.0.1:4204` |
| `webkit-touch` | WebKit iPhone13 touch profile | `http://127.0.0.1:4206` |

All three execute **every** `b2b*.spec.ts`: readiness/publication/labels/permissions/
catalog/prescription/execution/substitution/drafts/conflicts/lost responses/session
cancellation. QR uses touch `tap()` where supported. PDF export Chromium only;
WebKit checks labels/destinations with print styles.

<a id="escenario-de-referencia"></a>

## Reference scenario

Atlas/Sur equivalent capabilities, isolated identities/content:

- Administrator, member-assigned trainer, trainer without assigned members.
- `*-cable-01`, `*-cable-02` units of `base-cable-station-v1`, independent settings/long second name.
- Published unanimated `*-cable-row`, private `*-cable-row-draft` absent from public card.
- Assigned `*-starter`, explicit `quarter-squat`/`row` alternatives/published snapshot.

Idempotent seed retains identities. Empty scenario requires explicit demo reset
or suite's fresh schemas. Development accounts in `pnpm dev:b2b` private generated
file; no credentials copied to docs/captures.

<a id="ejecutar-y-revisar"></a>

## Run and review

Node 24+, locked dependencies, disposable PostgreSQL DB name containing `b2b`/`test`,
connection able to create/drop schemas; space for builds/engines/traces.

```sh
pnpm --filter @klisteniapp/b2c-web exec playwright install --with-deps chromium webkit
# Configure B2B_TEST_DATABASE_URL with a disposable test database.
pnpm test:b2b:e2e
```

Runner rejects imposed schema in `options`/non-test DB names. Cleanup own schemas/
media only. Product has no reset endpoint. Repeat project/file:

```sh
pnpm test:b2b:e2e --project=webkit-touch
pnpm test:b2b:e2e b2b-accessibility.spec.ts
```

Visual comparisons: two stable surfaces/project, empty member entry/long-unit
public header, `apps/b2c-web/e2e/snapshots/b2b/`. No dates/records/credentials.
Stable es-AR/UTC/light/reduced motion;0.2% pixel antialias tolerance, content/size
still compared.

```sh
# Only after reviewing an intentional visual change:
pnpm test:b2b:e2e b2b-accessibility.spec.ts --update-snapshots
# Then confirm the comparison without updating reference images:
pnpm test:b2b:e2e b2b-accessibility.spec.ts
```

Local HTML/results `.cache/b2b/browser-report`, `.cache/b2b/browser-results`.
GitLab `b2b-integration-tests` retains reports/artifacts7 days even on success;
traces on failure. Official Playwright image matches lockfile version.

<a id="ejecuciones-verificadas-del-11-de-octubre-de-2026"></a>

## Verified October 11, 2026 runs

Full matrix **84/84** desktop Chromium/touch Chromium/touch WebKit,
`.cache/roadmap-b2b-matrix-verified.log`. After viewer-loading correction, two
journeys rerun three projects **6/6**, `.cache/roadmap-b2b-viewer-final.log`.
Targeted regression, not six extra unique matrix cases.

[Release verification](b2b-release.md#estado-de-verificación-al-11-de-octubre-de-2026)
separates original B2C run/retests, final code-build-publication checks, eight runtime
smoke groups on clean `508e9e1`. Full previews deferred by user until 3D models ready;
not code-closeout blocker. Logs local evidence; no published credentials/private traces.

<a id="alcance-de-la-evidencia"></a>

## Evidence scope

Emulated touch/keyboard/focus/reduced motion/no WebGL/both engines; exact unit-QR
destinations/retirement permissions. Reproducible code regressions.

Printed-camera QR/real Safari-iOS/final model performance/movement technique need
actual phone/resource/pilot HTTPS origin. Local loopback QR unusable from another
phone. Blender authoring outside code delivery.
