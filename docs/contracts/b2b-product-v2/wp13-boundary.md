# WP13 health parser reservation

Reserved by WP00 CONTRACT/INTEGRATION on 2026-10-17 from plan
`447d77ebb5587e319018e7b56003f0ef7299bb6c` and application baseline
`d65261d18de4522fb9a66104aabb5750104fb8b8`.

## Exclusive source ownership

WP13 may edit:

- `packages/scene-schema/src/health-import.ts` (new pure module).
- `packages/scene-schema/tests/health-import.test.ts` and dedicated synthetic fixtures.
- `apps/b2c-web/src/lib/health-import.ts` (compatibility re-export).
- `apps/b2c-web/test/health-import.test.ts` only for parity coverage, preserving existing cases.
- Its task-specific evidence under `docs/validation/b2b-product-20261017/WP13/v1/`.

WP00/INTEGRATION retains package manifests, public export maps/barrels,
`pnpm-lock.yaml`, boundary checker and all B2B contracts/client/API registration.
There is no implicit shared-file lease. WP13 supplies exact export/dependency
requests; it must not edit them concurrently. No other worker owns the pure module.

## Public API

Expose through `@klisteniapp/scene-schema/health-import`. Preserve the existing
public symbols and their semantics from the B2C importer:

`HEALTH_IMPORT_MAX_BYTES`, `HEALTH_IMPORT_MAX_RECORDS`, `healthImportCategories`,
`HealthImportCategory`, `HealthImportSchema`, `HealthImportPreview`,
`previewHealthImport(raw: string, current: HealthData, now?: Date): HealthImportPreview`,
`createHealthImportTemplate(now?: Date, timeZone?: string): string`.

The compatibility wrapper must re-export those symbols without changing callers.
Preserve supported format `klisteniapp.health` version 1, normalized values,
source identity/dedup/conflict semantics, bounds, atomic failure and current
localized errors. Do not add vendor formats or reinterpret source provenance.

Add exported `HealthImportAdapter` and `klisteniHealthImportAdapter` with:

```ts
type HealthImportAdapter = {
  readonly format: string
  readonly version: number
  readonly manualOnly: true
  readonly categories: readonly HealthImportCategory[]
  readonly maxBytes: number
  readonly maxRecords: number
  readonly preview: typeof previewHealthImport
  readonly createTemplate: typeof createHealthImportTemplate
}
```

The descriptor has exact existing format/version/limits and no connection,
network, account, consent, storage, DOM or provider behavior. Use direct internal
health/calendar imports where possible. Do not export the new module from the
root index if that creates a cycle; the reserved subpath is sufficient.

The B2B API will call the adapter at its composition boundary and map normalized
JSON into B2B-owned transport/storage envelopes. B2B contracts/domain/client/web
must not import scene-schema or the B2C application. API-only scene-schema
dependency/boundary allowance is applied by INTEGRATION after WP13 passes parity
checks, not an authorization to relax other layers.

## Acceptance

Run existing B2C importer/store and scene-schema health tests plus new Node-only
parity cases. Cover equivalent timestamp offsets, duplicates, conflicting source
IDs, malformed/oversized/empty/future data, unsupported CSV/ZIP, timezone fallback,
nonmutation of current data and exact template shape. Keep the parser pure and
no supported-format claims beyond normalized Klisteni JSON. No production,
provider access, credentials, paid calls or automatic health import.

This reservation unblocks independent WP13 extraction when the parent dispatches
it. It is not the overall WP00 contract-freeze or implementation-completion receipt.
