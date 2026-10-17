import { z } from 'zod';
import {
  ActivityRecordSchema, BodyMeasurementSchema, HealthDataSchema,
  NutritionRecordSchema, SleepRecordSchema, SupplementRecordSchema, type HealthData,
} from './health.ts';
import { TimeZoneSchema } from './calendar.ts';
import { dateInTimeZone } from './index.ts';

export const HEALTH_IMPORT_MAX_BYTES = 2 * 1024 * 1024;
export const HEALTH_IMPORT_MAX_RECORDS = 10000;
export const healthImportCategories = ['measurements', 'sleep', 'activity', 'nutrition', 'supplements'] as const;
export type HealthImportCategory = typeof healthImportCategories[number];

/** Our versioned interchange format, not a Samsung export or Health Connect backup. */
export const HealthImportSchema = z.object({
  format: z.literal('klisteniapp.health'),
  version: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  timeZone: TimeZoneSchema,
  records: z.object({
    measurements: z.array(BodyMeasurementSchema).max(HEALTH_IMPORT_MAX_RECORDS),
    sleep: z.array(SleepRecordSchema).max(HEALTH_IMPORT_MAX_RECORDS),
    activity: z.array(ActivityRecordSchema).max(HEALTH_IMPORT_MAX_RECORDS),
    nutrition: z.array(NutritionRecordSchema).max(HEALTH_IMPORT_MAX_RECORDS),
    supplements: z.array(SupplementRecordSchema).max(HEALTH_IMPORT_MAX_RECORDS),
  }).strict(),
}).strict();

type ImportedRecord = HealthData[HealthImportCategory][number];
type CategoryCounts = Record<HealthImportCategory, { added: number; duplicates: number }>;
export type HealthImportPreview = {
  ok: true;
  health: HealthData;
  counts: { added: number; duplicates: number; total: number };
  byCategory: CategoryCounts;
  range: { from: string; to: string };
  sources: string[];
} | { ok: false; error: string };

const categoryLabel: Record<HealthImportCategory, string> = {
  measurements: 'medidas', sleep: 'sueño', activity: 'actividad', nutrition: 'comidas', supplements: 'suplementos',
};

function sourceKey(category: HealthImportCategory, record: ImportedRecord): string | null {
  return record.source.externalId
    ? JSON.stringify([category, record.source.kind, record.source.externalId])
    : null;
}

/** Key order and equivalent timestamp offsets do not turn an unchanged record into a conflict. */
function canonical(value: unknown, key?: string): unknown {
  if (typeof value === 'string' && ['recordedAt', 'modifiedAt', 'startAt', 'endAt'].includes(key ?? '')) {
    return new Date(value).toISOString();
  }
  if (Array.isArray(value)) return value.map((item) => canonical(item));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([name, child]) => name !== 'id' && child !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)).map(([name, child]) => [name, canonical(child, name)]));
  }
  return value;
}

function sameRecord(first: ImportedRecord, second: ImportedRecord): boolean {
  return JSON.stringify(canonical(first)) === JSON.stringify(canonical(second));
}

/** Pure, atomic preview: invalid rows or conflicts reject the whole file, without mutating current data. */
export function previewHealthImport(raw: string, current: HealthData, now = new Date()): HealthImportPreview {
  const fail = (error: string): HealthImportPreview => ({ ok: false, error });
  if (!Number.isFinite(now.getTime())) return fail('No se pudo verificar la fecha actual.');
  if (raw.length > HEALTH_IMPORT_MAX_BYTES || new TextEncoder().encode(raw).byteLength > HEALTH_IMPORT_MAX_BYTES) {
    return fail('El archivo supera el límite de 2 MiB. Dividilo por fechas y volvé a intentarlo.');
  }
  let input: unknown;
  try { input = JSON.parse(raw); } catch {
    return fail('El archivo no es JSON válido. Los CSV de Samsung y los ZIP de Health Connect todavía no son compatibles.');
  }
  const parsed = HealthImportSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(`Formato de salud inválido (${issue?.path.join('.') || 'archivo'}): ${issue?.message ?? 'revisá la plantilla'}. No se importó ningún registro.`);
  }
  const existing = HealthDataSchema.safeParse(current);
  if (!existing.success) return fail('Los datos actuales no son válidos. Exportalos antes de intentar una importación.');
  const file = parsed.data;
  if (Date.parse(file.exportedAt) > now.getTime()) return fail('La fecha de exportación está en el futuro. Revisá el reloj del dispositivo.');
  const total = healthImportCategories.reduce((sum, category) => sum + file.records[category].length, 0);
  if (total === 0) return fail('La plantilla está vacía. Agregá registros reales antes de importarla.');
  if (total > HEALTH_IMPORT_MAX_RECORDS) return fail('El archivo supera el límite de 10.000 registros. Dividilo por fechas.');

  const health = existing.data;
  const byCategory = Object.fromEntries(healthImportCategories.map((category) => [category, { added: 0, duplicates: 0 }])) as CategoryCounts;
  const sources = new Set<string>();
  const dates: string[] = [];
  let added = 0, duplicates = 0;
  for (const category of healthImportCategories) {
    const list: ImportedRecord[] = health[category];
    const byId = new Map(list.map((record) => [record.id, record]));
    const bySource = new Map(list.flatMap((record) => {
      const identity = sourceKey(category, record);
      return identity ? [[identity, record] as const] : [];
    }));
    for (const [index, record] of file.records[category].entries()) {
      // The wrapper explicitly supplies the fallback zone; persist it for later server checks.
      const incoming = { ...record, timeZone: record.timeZone ?? file.timeZone };
      const position = `${categoryLabel[category]}, registro ${index + 1}`;
      if (!incoming.source.externalId) return fail(`Falta source.externalId en ${position}. Se necesita un identificador estable para evitar duplicados.`);
      const today = dateInTimeZone(now, incoming.timeZone ?? file.timeZone);
      if (incoming.date > today || Date.parse(incoming.recordedAt) > now.getTime()
        || (incoming.modifiedAt !== undefined && Date.parse(incoming.modifiedAt) > now.getTime())
        || ('startAt' in incoming && incoming.startAt && Date.parse(incoming.startAt) > now.getTime())
        || ('endAt' in incoming && incoming.endAt && Date.parse(incoming.endAt) > now.getTime())) {
        return fail(`Hay una fecha futura en ${position}. No se importó ningún registro.`);
      }
      const identity = sourceKey(category, incoming)!;
      const previous = bySource.get(identity);
      const previousId = byId.get(incoming.id);
      if (previousId && sourceKey(category, previousId) !== identity) {
        return fail(`El identificador local ya pertenece a otro registro (${position}). No se reemplazó ningún dato.`);
      }
      if (previous) {
        if (!sameRecord(previous, incoming)) return fail(`El origen repite un identificador con contenido diferente (${position}). Revisá la corrección antes de importar; no se reemplazó ningún dato.`);
        duplicates++;
        byCategory[category].duplicates++;
      } else {
        list.push(incoming);
        bySource.set(identity, incoming);
        byId.set(incoming.id, incoming);
        added++;
        byCategory[category].added++;
      }
      sources.add(incoming.source.kind);
      dates.push(incoming.date);
    }
  }
  const merged = HealthDataSchema.safeParse(health);
  if (!merged.success) return fail(`La importación excede los límites o entra en conflicto con tus datos (${merged.error.issues[0]?.path.join('.') || 'salud'}). No se importó ningún registro.`);
  dates.sort();
  return {
    ok: true, health: merged.data, counts: { added, duplicates, total }, byCategory,
    range: { from: dates[0]!, to: dates[dates.length - 1]! }, sources: [...sources].sort(),
  };
}

/** Deliberately empty: downloading a template never seeds invented personal measurements. */
export function createHealthImportTemplate(now = new Date(), timeZone = 'UTC'): string {
  return JSON.stringify(HealthImportSchema.parse({
    format: 'klisteniapp.health', version: 1, exportedAt: now.toISOString(), timeZone,
    records: { measurements: [], sleep: [], activity: [], nutrition: [], supplements: [] },
  }), null, 2);
}

/** Pure format capabilities for an explicitly requested manual import. */
export type HealthImportAdapter = {
  readonly format: string;
  readonly version: number;
  readonly manualOnly: true;
  readonly categories: readonly HealthImportCategory[];
  readonly maxBytes: number;
  readonly maxRecords: number;
  readonly preview: typeof previewHealthImport;
  readonly createTemplate: typeof createHealthImportTemplate;
};

export const klisteniHealthImportAdapter: HealthImportAdapter = {
  format: 'klisteniapp.health',
  version: 1,
  manualOnly: true,
  categories: healthImportCategories,
  maxBytes: HEALTH_IMPORT_MAX_BYTES,
  maxRecords: HEALTH_IMPORT_MAX_RECORDS,
  preview: previewHealthImport,
  createTemplate: createHealthImportTemplate,
};
