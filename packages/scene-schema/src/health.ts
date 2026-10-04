import { z } from 'zod';
import type { WorkoutLog } from './index.ts';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Fecha de calendario inválida');
const timestamp = z.iso.datetime({ offset: true });
const timeZone = z.string().min(1).max(100).refine((value) => {
  if (!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; }
}, 'Zona horaria inválida');
const bounded = (min: number, max: number) => z.number().finite().min(min).max(max);
const notes = z.string().trim().max(2000).optional();

export const HealthSourceSchema = z.object({
  kind: z.enum(['manual', 'samsung-health', 'health-connect']),
  device: z.string().trim().min(1).max(200).optional(),
  externalId: z.string().trim().min(1).max(200).optional(),
}).strict();
export type HealthSource = z.infer<typeof HealthSourceSchema>;
const record = {
  id: z.string().min(1).max(200), date,
  /** When the entry was captured or created; date remains the observation date. */
  recordedAt: timestamp, modifiedAt: timestamp.optional(), source: HealthSourceSchema, timeZone: timeZone.optional(), notes,
};
export const HealthProfileSchema = z.object({
  birthDate: date.optional(), heightCm: bounded(30, 300).optional(),
  sex: z.enum(['female', 'male', 'intersex', 'prefer-not-to-say']).optional(),
  context: z.string().trim().max(2000).optional(),
}).strict();
export type HealthProfile = z.infer<typeof HealthProfileSchema>;

export const measurementFields = {
  weightKg: bounded(1, 700), bodyFatPercent: bounded(0, 100),
  skeletalMuscleKg: bounded(0, 300), fatMassKg: bounded(0, 500), bodyWaterPercent: bounded(0, 100),
  waistCm: bounded(1, 400), hipsCm: bounded(1, 400), chestCm: bounded(1, 400), neckCm: bounded(1, 150),
  leftArmCm: bounded(1, 200), rightArmCm: bounded(1, 200), leftThighCm: bounded(1, 250),
  rightThighCm: bounded(1, 250), leftCalfCm: bounded(1, 200), rightCalfCm: bounded(1, 200),
};
export type MeasurementKey = keyof typeof measurementFields;
export const measurementKeys = Object.keys(measurementFields) as MeasurementKey[];
export const BodyMeasurementSchema = z.object({
  ...record, ...Object.fromEntries(Object.entries(measurementFields).map(([key, schema]) => [key, schema.optional()])) as {
    [Key in MeasurementKey]: z.ZodOptional<(typeof measurementFields)[Key]>;
  },
}).strict().superRefine((value, ctx) => {
  if (!measurementKeys.some((key) => value[key] !== undefined)) ctx.addIssue({ code: 'custom', message: 'Ingresá al menos una medida' });
  for (const key of ['skeletalMuscleKg', 'fatMassKg'] as const) {
    if (value.weightKg !== undefined && value[key] !== undefined && value[key] > value.weightKg) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'La masa no puede superar el peso total' });
    }
  }
});
export type BodyMeasurement = z.infer<typeof BodyMeasurementSchema>;

export const SleepRecordSchema = z.object({
  ...record, durationMinutes: bounded(1, 1440), startAt: timestamp.optional(), endAt: timestamp.optional(),
  deepMinutes: bounded(0, 1440).optional(), remMinutes: bounded(0, 1440).optional(),
  awakeMinutes: bounded(0, 1440).optional(), score: bounded(0, 100).optional(),
}).strict().superRefine((value, ctx) => {
  if (Boolean(value.startAt) !== Boolean(value.endAt)) ctx.addIssue({ code: 'custom', message: 'Completá el inicio y el fin del sueño' });
  if ((value.deepMinutes ?? 0) + (value.remMinutes ?? 0) > value.durationMinutes) ctx.addIssue({ code: 'custom', message: 'Las fases superan la duración del sueño' });
  if (value.startAt && value.endAt) {
    const elapsed = (Date.parse(value.endAt) - Date.parse(value.startAt)) / 60000;
    if (elapsed <= 0 || elapsed > 1440 || value.durationMinutes + (value.awakeMinutes ?? 0) > elapsed + 0.02) {
      ctx.addIssue({ code: 'custom', message: 'La duración no coincide con el intervalo de sueño' });
    }
  }
});
export type SleepRecord = z.infer<typeof SleepRecordSchema>;
export type SleepDaySummary = { date: string; durationMinutes: number | null; recordCount: number };
/** Do not add two sources' estimates of the same night, or guess untimed entries are naps. */
export function summarizeSleepDays(records: readonly SleepRecord[]): SleepDaySummary[] {
  const grouped = new Map<string, SleepRecord[]>();
  for (const entry of records) grouped.set(entry.date, [...(grouped.get(entry.date) ?? []), entry]);
  const overlappingDates = new Set<string>();
  const intervals = records.filter((entry) => entry.startAt && entry.endAt)
    .map((entry) => ({ date: entry.date, start: Date.parse(entry.startAt!), end: Date.parse(entry.endAt!) }))
    .sort((a, b) => a.start - b.start);
  let furthest: (typeof intervals)[number] | undefined;
  for (const interval of intervals) {
    if (furthest && interval.start < furthest.end) {
      overlappingDates.add(furthest.date); overlappingDates.add(interval.date);
    }
    if (!furthest || interval.end > furthest.end) furthest = interval;
  }
  return [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => {
    const total = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
    const ambiguous = overlappingDates.has(date) || total > 1440
      || (entries.length > 1 && entries.some((entry) => !entry.startAt || !entry.endAt));
    return { date, durationMinutes: ambiguous ? null : total, recordCount: entries.length };
  });
}
const activityFields = {
  steps: bounded(0, 200000).int().optional(), activeMinutes: bounded(0, 1440).optional(),
  activeEnergyKcal: bounded(0, 20000).optional(), restingHeartRateBpm: bounded(20, 250).optional(),
  averageHeartRateBpm: bounded(20, 300).optional(), maxHeartRateBpm: bounded(20, 300).optional(),
};
export const ActivityRecordSchema = z.object({
  ...record, ...activityFields,
  workoutId: z.string().min(1).max(200).optional(),
  activityLabel: z.string().trim().min(1).max(150).optional(),
}).strict().superRefine((value, ctx) => {
  if (!(Object.keys(activityFields) as (keyof typeof activityFields)[]).some((key) => value[key] !== undefined)) {
    ctx.addIssue({ code: 'custom', message: 'Ingresá al menos un dato de actividad' });
  }
  if (value.averageHeartRateBpm !== undefined && value.maxHeartRateBpm !== undefined && value.averageHeartRateBpm > value.maxHeartRateBpm) {
    ctx.addIssue({ code: 'custom', message: 'La frecuencia promedio supera la máxima' });
  }
});
export type ActivityRecord = z.infer<typeof ActivityRecordSchema>;
export const NutritionRecordSchema = z.object({
  ...record, meal: z.string().trim().min(1).max(300).optional(), energyKcal: bounded(0, 20000).optional(),
  proteinG: bounded(0, 2000).optional(), carbsG: bounded(0, 3000).optional(),
  fatG: bounded(0, 2000).optional(), fiberG: bounded(0, 1000).optional(),
}).strict().refine((value) => ['meal', 'energyKcal', 'proteinG', 'carbsG', 'fatG', 'fiberG'].some((key) => value[key as keyof typeof value] !== undefined), 'Ingresá una comida o un dato nutricional');
export type NutritionRecord = z.infer<typeof NutritionRecordSchema>;
export const SupplementRecordSchema = z.object({
  ...record, name: z.string().trim().min(1).max(150), dose: bounded(0.0001, 100000).optional(),
  unit: z.string().trim().min(1).max(40).optional(), taken: z.boolean(),
}).strict().refine((value) => (value.dose === undefined) === (value.unit === undefined), 'Completá la dosis y su unidad');
export type SupplementRecord = z.infer<typeof SupplementRecordSchema>;
export const HealthGoalMetricSchema = z.enum([...measurementKeys, 'sleepMinutes', 'weeklyTrainingDays']);
export type HealthGoalMetric = z.infer<typeof HealthGoalMetricSchema>;
export const HealthGoalSchema = z.object({
  id: z.string().min(1).max(200), title: z.string().trim().min(1).max(150), metric: HealthGoalMetricSchema,
  target: z.number().finite(), startDate: date, targetDate: date.optional(), notes,
}).strict().superRefine((value, ctx) => {
  const metricSchema = value.metric === 'sleepMinutes' ? bounded(1, 1440)
    : value.metric === 'weeklyTrainingDays' ? bounded(1, 7).int() : measurementFields[value.metric];
  if (!metricSchema.safeParse(value.target).success) ctx.addIssue({ code: 'custom', path: ['target'], message: 'Objetivo fuera de rango' });
  if (value.targetDate && value.targetDate < value.startDate) ctx.addIssue({ code: 'custom', path: ['targetDate'], message: 'El plazo es anterior al inicio' });
});
export type HealthGoal = z.infer<typeof HealthGoalSchema>;

/** Bound the full saved state below the API's 5 MiB request limit, including UTF-8. */
export const HEALTH_DATA_MAX_BYTES = 4 * 1024 * 1024;
export const healthRecordCollections = ['measurements', 'sleep', 'activity', 'nutrition', 'supplements'] as const;
export const HealthDataSchema = z.object({
  version: z.literal(1), profile: HealthProfileSchema.default({}),
  measurements: z.array(BodyMeasurementSchema).max(10000).default([]),
  sleep: z.array(SleepRecordSchema).max(10000).default([]),
  activity: z.array(ActivityRecordSchema).max(10000).default([]),
  nutrition: z.array(NutritionRecordSchema).max(10000).default([]),
  supplements: z.array(SupplementRecordSchema).max(10000).default([]),
  goals: z.array(HealthGoalSchema).max(100).default([]),
}).strict().superRefine((value, ctx) => {
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > HEALTH_DATA_MAX_BYTES) {
    ctx.addIssue({ code: 'custom', message: 'El historial de salud supera el máximo acumulado de 4 MiB' });
    return;
  }
  const ids = new Set<string>();
  for (const collection of [...healthRecordCollections, 'goals'] as const) {
    const origins = new Set<string>();
    value[collection].forEach((entry, index) => {
      if (ids.has(entry.id)) ctx.addIssue({ code: 'custom', path: [collection, index, 'id'], message: 'Identificador duplicado' });
      ids.add(entry.id);
      if ('source' in entry && entry.source.externalId) {
        const key = JSON.stringify([entry.source.kind, entry.source.externalId]);
        if (origins.has(key)) ctx.addIssue({ code: 'custom', path: [collection, index, 'source'], message: 'Registro de origen duplicado' });
        origins.add(key);
      }
    });
  }
});
export type HealthData = z.infer<typeof HealthDataSchema>;
export function createEmptyHealthData(): HealthData { return HealthDataSchema.parse({ version: 1 }); }

/** Runtime validation uses the account calendar and server clock, never client today. */
export function healthHasFutureObservations(health: HealthData, today: string, now: Date): boolean {
  if (health.profile.birthDate && health.profile.birthDate > today) return true;
  const localToday = (zone?: string) => {
    if (!zone) return today;
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
    const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(({ type }) => type === name)?.value;
    return `${part('year')?.padStart(4, '0')}-${part('month')}-${part('day')}`;
  };
  return healthRecordCollections.some((collection) => health[collection].some((entry) =>
    entry.date > localToday(entry.timeZone) || Date.parse(entry.recordedAt) > now.getTime()
    || (entry.modifiedAt !== undefined && Date.parse(entry.modifiedAt) > now.getTime())
    || ('startAt' in entry && entry.startAt !== undefined && Date.parse(entry.startAt) > now.getTime())
    || ('endAt' in entry && entry.endAt !== undefined && Date.parse(entry.endAt) > now.getTime())));
}

export type HealthGoalProgress = {
  baseline: number | null; current: number | null; change: number | null;
  percent: number | null; achieved: boolean; observationDate: string | null;
};
const emptyProgress: HealthGoalProgress = { baseline: null, current: null, change: null, percent: null, achieved: false, observationDate: null };
function monday(value: string): string {
  const parsed = new Date(`${value}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() - (parsed.getUTCDay() + 6) % 7);
  return parsed.toISOString().slice(0, 10);
}
/** Actual observations only: no prediction, prescribed target, or causal health claim. */
export function computeHealthGoalProgress(goal: HealthGoal, health: HealthData, workouts: readonly WorkoutLog[], today: string): HealthGoalProgress {
  if (goal.startDate > today) return { ...emptyProgress };
  if (goal.metric === 'weeklyTrainingDays') {
    const week = monday(today);
    const dates = new Set(workouts.filter((entry) => entry.date >= week && entry.date >= goal.startDate && entry.date <= today).map((entry) => entry.date));
    const current = dates.size;
    return { baseline: 0, current, change: current, percent: Math.min(100, current / goal.target * 100), achieved: current >= goal.target, observationDate: today };
  }
  const sleepDays = summarizeSleepDays(health.sleep).filter((entry) => entry.date >= goal.startDate && entry.date <= today);
  if (goal.metric === 'sleepMinutes' && sleepDays.at(-1)?.durationMinutes === null) {
    return { ...emptyProgress, baseline: sleepDays.find((entry) => entry.durationMinutes !== null)?.durationMinutes ?? null, observationDate: sleepDays.at(-1)!.date };
  }
  const observations: { date: string; recordedAt: string; id: string; value: number }[] = goal.metric === 'sleepMinutes'
    ? sleepDays.flatMap((entry) => entry.durationMinutes === null ? [] : [{ date: entry.date, recordedAt: `${entry.date}T12:00:00Z`, id: entry.date, value: entry.durationMinutes }])
    : health.measurements.flatMap((entry) => {
      const value = entry[goal.metric as MeasurementKey];
      return value === undefined ? [] : [{ date: entry.date, recordedAt: entry.recordedAt, id: entry.id, value }];
    });
  const sorted = observations.filter((entry) => entry.date >= goal.startDate && entry.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id));
  const first = sorted[0]; const last = sorted.at(-1);
  if (!first || !last) return { ...emptyProgress };
  const delta = goal.target - first.value;
  const achieved = delta === 0 ? last.value === goal.target : delta > 0 ? last.value >= goal.target : last.value <= goal.target;
  const percent = delta === 0 ? (achieved ? 100 : 0) : Math.min(100, Math.max(0, (last.value - first.value) / delta * 100));
  return { baseline: first.value, current: last.value, change: last.value - first.value, percent, achieved, observationDate: last.date };
}
