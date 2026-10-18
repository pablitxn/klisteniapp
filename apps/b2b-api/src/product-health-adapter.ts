import { HealthDataSchema } from '@klisteniapp/scene-schema';
import { klisteniHealthImportAdapter } from '@klisteniapp/scene-schema/health-import';
import { NormalizedHealthSchema } from '@klisteniapp/b2b-contracts/product-v2';

/** Canonical semantic validation stays at the API boundary. Contract parsing
 * alone is insufficient for health measurements, units, dates or conflicts. */
export function parseProductHealth(input: unknown) {
  return NormalizedHealthSchema.parse(HealthDataSchema.parse(input));
}
/** Pure preview only: no database, identity, consent or network side effects.
 * WP05 supplies owner authorization, revision/hash binding and atomic commit. */
export function previewProductHealthImport(raw: string, current: unknown, now: Date) {
  const preview = klisteniHealthImportAdapter.preview(raw, HealthDataSchema.parse(current), now);
  return preview.ok
    ? { ...preview, health: NormalizedHealthSchema.parse(preview.health) }
    : preview;
}
export const productHealthImportFormat = {
  format: klisteniHealthImportAdapter.format,
  version: klisteniHealthImportAdapter.version,
  manualOnly: klisteniHealthImportAdapter.manualOnly,
  categories: klisteniHealthImportAdapter.categories,
  maxBytes: klisteniHealthImportAdapter.maxBytes,
  maxRecords: klisteniHealthImportAdapter.maxRecords,
} as const;
