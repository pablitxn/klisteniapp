import { z } from 'zod';
import { createExercisePlanningSchema } from './exercise-planning.ts';
import { HealthDataSchema, createEmptyHealthData } from './health.ts';
export * from './exercise-planning.ts';
export * from './health.ts';

export const ExerciseIdSchema = z.enum([
  'pushup', 'squat', 'row', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise',
  'full-pushup', 'pike-pushup', 'reverse-lunge', 'lateral-lunge',
  'good-morning', 'bird-dog', 'mountain-climber', 'crunch',
  'quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup',
  'dead-bug-heel-tap', 'quadruped-leg-extension', 'prone-t-raise', 'prone-y-raise',
  'split-squat', 'single-leg-calf-raise', 'bridge-march', 'single-leg-glute-bridge',
  'bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift',
  'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension',
  'supine-march', 'supine-heel-slide', 'plank-shoulder-tap',
]);
export type ExerciseId = z.infer<typeof ExerciseIdSchema>;
export const ExercisePlanningSchema = createExercisePlanningSchema(ExerciseIdSchema);
export type ExercisePlanning = z.infer<typeof ExercisePlanningSchema>;

export const MuscleIdSchema = z.enum([
  'pectorals', 'deltoids', 'triceps', 'lats', 'biceps', 'upper-back',
  'abdominals', 'obliques', 'glutes', 'quadriceps', 'hamstrings', 'calves',
]);
export type MuscleId = z.infer<typeof MuscleIdSchema>;

export const MuscleSchema = z.object({
  id: MuscleIdSchema,
  name: z.string().min(1),
  region: z.string().min(1),
  description: z.string().min(1),
});
export type Muscle = z.infer<typeof MuscleSchema>;

const VariantSchema = z.object({ name: z.string().min(1), description: z.string().min(1) });
export const ExerciseSchema = z.object({
  id: ExerciseIdSchema,
  name: z.string().min(1),
  englishName: z.string().min(1),
  shortName: z.string().min(1),
  pattern: z.enum(['Empuje', 'Sentadilla', 'Tracción', 'Cadera', 'Estabilidad', 'Escápulas', 'Tobillo']),
  description: z.string().min(1),
  equipment: z.enum(['none', 'bar-or-rings']),
  difficulty: z.enum(['Inicial', 'Intermedio']),
  defaultSets: z.number().int().min(1).max(10),
  reps: z.object({
    min: z.number().int().positive(),
    max: z.number().int().positive(),
    perSide: z.boolean(),
  }).refine(({ min, max }) => min <= max, 'Rango de repeticiones inválido'),
  restSeconds: z.number().int().min(15).max(600),
  tempo: z.string().min(1),
  setup: z.array(z.string().min(1)).min(1),
  steps: z.array(z.string().min(1)).min(2),
  cues: z.array(z.string().min(1)).min(1),
  mistakes: z.array(z.string().min(1)).min(1),
  easier: VariantSchema,
  harder: VariantSchema,
  primaryMuscles: z.array(MuscleIdSchema).min(1),
  secondaryMuscles: z.array(MuscleIdSchema),
  sources: z.array(z.object({ title: z.string().min(1), url: z.url() })).min(1),
  planning: ExercisePlanningSchema,
  note: z.string().optional(),
});
export type Exercise = z.infer<typeof ExerciseSchema>;

/** Calendar dates are saved as entered locally; never convert them through UTC. */
export const LocalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Fecha de calendario inválida');

export const CompletedExerciseSchema = z.object({
  exerciseId: ExerciseIdSchema,
  sets: z.number().int().min(1).max(30),
  /** Repetitions per completed set, per side when the exercise specifies it. */
  reps: z.number().int().min(1).max(1000),
});
export type CompletedExercise = z.infer<typeof CompletedExerciseSchema>;

/** Accept supported IANA names (including UTC), never a device-derived numeric offset. */
export const TimeZoneSchema = z.string().min(1).max(100).refine((value) => {
  if (!/^[A-Za-z][A-Za-z0-9._+-]*(?:\/[A-Za-z0-9._+-]+)*$/.test(value)) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, 'Zona horaria inválida');

export const PersonalRoutineSchema = z.object({
  id: z.string().min(1).max(200),
  name: z.string().trim().min(1).max(100),
  exerciseIds: z.array(ExerciseIdSchema).min(1).max(50).refine(
    (ids) => new Set(ids).size === ids.length, 'Hay ejercicios duplicados',
  ),
  sets: z.number().int().min(1).max(10),
});
export type PersonalRoutine = z.infer<typeof PersonalRoutineSchema>;

export const WorkoutLogSchema = z.object({
  id: z.string().min(1).max(200),
  date: LocalDateSchema,
  completedAt: z.iso.datetime({ offset: true }),
  // The session records one entry per set so different repetition counts survive.
  // Match the largest supported routine: 50 movements with 10 sets each.
  exercises: z.array(CompletedExerciseSchema).min(1).max(500),
  durationMinutes: z.number().positive().max(1440),
  /** Optional for legacy v1 logs. A saved date is never recalculated from this zone. */
  timeZone: TimeZoneSchema.optional(),
  routineSnapshot: PersonalRoutineSchema.optional(),
});
export type WorkoutLog = z.infer<typeof WorkoutLogSchema>;

export const CardioActivitySchema = z.enum(['walk', 'run', 'bike', 'other']);
export type CardioActivity = z.infer<typeof CardioActivitySchema>;
export const CardioLogSchema = z.object({
  id: z.string().min(1).max(200),
  date: LocalDateSchema,
  activity: CardioActivitySchema,
  minutes: z.number().int().min(1).max(1440),
  distanceKm: z.number().positive().max(2000).optional(),
  timeZone: TimeZoneSchema.optional(),
});
export type CardioLog = z.infer<typeof CardioLogSchema>;

export const ProgressDataSchema = z.object({
  version: z.literal(1),
  workouts: z.array(WorkoutLogSchema).max(10000),
  cardio: z.array(CardioLogSchema).max(10000),
}).refine(({ workouts, cardio }) => {
  const ids = [...workouts, ...cardio].map(({ id }) => id);
  return new Set(ids).size === ids.length;
}, 'Hay registros duplicados');
export type ProgressData = z.infer<typeof ProgressDataSchema>;


/** Monday = 1, Sunday = 7. A revision applies to a whole calendar week. */
export const TrainingPlanSchema = z.object({
  id: z.string().min(1).max(200),
  effectiveFrom: LocalDateSchema.refine((value) => {
    return new Date(`${value}T12:00:00Z`).getUTCDay() === 1;
  }, 'El plan debe empezar un lunes'),
  weekdays: z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(
    (days) => new Set(days).size === days.length, 'Hay días duplicados',
  ),
  routineId: z.string().min(1).max(200),
});
export type TrainingPlan = z.infer<typeof TrainingPlanSchema>;

export const ColorThemeSchema = z.enum(['sage', 'ocean', 'sunset', 'lavender', 'rose', 'graphite']);
export type ColorTheme = z.infer<typeof ColorThemeSchema>;

export const PersonalSettingsSchema = z.object({
  /** Absent in legacy backups; omission must never clear existing health data. */
  health: HealthDataSchema.optional(),
  profile: z.object({
    displayName: z.string().trim().min(1).max(100),
    timeZone: TimeZoneSchema,
    /** Optional so older account data and portable v2 backups remain valid. */
    language: z.enum(['es', 'en', 'fr']).optional(),
    theme: z.enum(['light', 'dark', 'system']).optional(),
    colorTheme: ColorThemeSchema.optional(),
  }),
  routines: z.array(PersonalRoutineSchema).min(1).max(100),
  activeRoutineId: z.string().min(1).max(200),
  plans: z.array(TrainingPlanSchema).max(1000),
}).superRefine(({ routines, activeRoutineId, plans }, ctx) => {
  const routineIds = new Set(routines.map(({ id }) => id));
  if (routineIds.size !== routines.length) {
    ctx.addIssue({ code: 'custom', path: ['routines'], message: 'Hay rutinas duplicadas' });
  }
  if (!routineIds.has(activeRoutineId)) {
    ctx.addIssue({ code: 'custom', path: ['activeRoutineId'], message: 'La rutina activa no existe' });
  }
  if (new Set(plans.map(({ id }) => id)).size !== plans.length) {
    ctx.addIssue({ code: 'custom', path: ['plans'], message: 'Hay planes duplicados' });
  }
  if (new Set(plans.map(({ effectiveFrom }) => effectiveFrom)).size !== plans.length) {
    ctx.addIssue({ code: 'custom', path: ['plans'], message: 'Hay varias revisiones para la misma semana' });
  }
  for (const [index, plan] of plans.entries()) {
    if (!routineIds.has(plan.routineId)) {
      ctx.addIssue({ code: 'custom', path: ['plans', index, 'routineId'], message: 'La rutina del plan no existe' });
    }
  }
});
export type PersonalSettings = z.infer<typeof PersonalSettingsSchema>;

/** Omission by older clients is never a request to clear optional personal data. */
export function preserveOptionalPersonalSettings(current: PersonalSettings, next: PersonalSettings): PersonalSettings {
  return {
    ...next,
    ...(next.health === undefined && current.health !== undefined ? { health: current.health } : {}),
    profile: {
      ...next.profile,
      ...(next.profile.language === undefined && current.profile.language !== undefined ? { language: current.profile.language } : {}),
      ...(next.profile.theme === undefined && current.profile.theme !== undefined ? { theme: current.profile.theme } : {}),
      ...(next.profile.colorTheme === undefined && current.profile.colorTheme !== undefined ? { colorTheme: current.profile.colorTheme } : {}),
    },
  };
}

export const PersonalDataSchema = z.object({
  version: z.literal(2),
  settings: PersonalSettingsSchema,
  progress: ProgressDataSchema,
});
export type PersonalData = z.infer<typeof PersonalDataSchema>;

export const ServerStateSchema = z.object({
  data: PersonalDataSchema,
  revision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
});
export type ServerState = z.infer<typeof ServerStateSchema>;

export function createDefaultPersonalData(displayName: string, timeZone = 'UTC'): PersonalData {
  return PersonalDataSchema.parse({
    version: 2,
    settings: {
      health: createEmptyHealthData(),
      profile: { displayName, timeZone },
      routines: [{
        id: 'starter', name: 'Mi rutina',
        exerciseIds: ['pushup', 'squat', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise'],
        sets: 2,
      }],
      activeRoutineId: 'starter',
      plans: [],
    },
    progress: { version: 1, workouts: [], cardio: [] },
  });
}

/** Derive today in the account's tracking zone without moving existing saved dates. */
export function dateInTimeZone(now: Date, timeZone: string): string {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Fecha inválida');
  TimeZoneSchema.parse(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find(({ type }) => type === name)?.value;
  return LocalDateSchema.parse(`${part('year')?.padStart(4, '0')}-${part('month')}-${part('day')}`);
}

/** UTC is only used for calendar arithmetic; no timestamp conversion of stored dates. */
function shiftCalendarDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function planWeekStart(date: string): string {
  LocalDateSchema.parse(date);
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  return shiftCalendarDate(date, -((day + 6) % 7));
}

/** The first plan can start this week. Later edits take effect next Monday. */
export function nextPlanEffectiveDate(plans: readonly TrainingPlan[], today: string): string {
  const monday = planWeekStart(today);
  return plans.length === 0 ? monday : shiftCalendarDate(monday, 7);
}

/** Server-side guard: clients cannot rewrite begun weeks or introduce a backdated plan. */
export function isPlanHistoryPreserved(
  previous: readonly TrainingPlan[], next: readonly TrainingPlan[], today: string,
): boolean {
  const monday = planWeekStart(today);
  const earliestNewDate = nextPlanEffectiveDate(previous, today);
  const samePlan = (a: TrainingPlan, b: TrainingPlan) => a.id === b.id
    && a.effectiveFrom === b.effectiveFrom && a.routineId === b.routineId
    && [...a.weekdays].sort().join(',') === [...b.weekdays].sort().join(',');
  for (const plan of previous) {
    if (plan.effectiveFrom <= monday && !next.some((candidate) => samePlan(plan, candidate))) return false;
  }
  return next.every((plan) => previous.some((candidate) => samePlan(plan, candidate))
    || plan.effectiveFrom >= earliestNewDate);
}

export type PlanProgress = {
  weekStart: string;
  weeklyCompleted: number;
  weeklyTarget: number;
  fulfilledWeeksStreak: number;
  scheduledDates: string[];
  completedDates: string[];
};

/**
 * A goal means distinct strength-training days within a Monday–Sunday week. Moving
 * a session within its week is allowed. Multiple sessions on one day count once;
 * cardio stays in activity metrics and does not silently complete a strength plan.
 * An unfinished current week preserves the streak of fulfilled preceding weeks.
 */
export function computePlanProgress(
  plans: readonly TrainingPlan[], workouts: readonly WorkoutLog[], today: string,
): PlanProgress {
  const weekStart = planWeekStart(today);
  const orderedPlans = [...plans].sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom));
  const forWeek = (monday: string) => orderedPlans.find(({ effectiveFrom }) => effectiveFrom <= monday);
  const seenIds = new Set<string>();
  const dates = new Set(workouts.filter(({ id, date }) => {
    if (date > today || seenIds.has(id)) return false;
    seenIds.add(id);
    return true;
  }).map(({ date }) => date));
  const datesInWeek = (monday: string) => {
    const nextMonday = shiftCalendarDate(monday, 7);
    return [...dates].filter((date) => date >= monday && date < nextMonday).sort();
  };
  const currentPlan = forWeek(weekStart);
  const weeklyTarget = currentPlan?.weekdays.length ?? 0;
  const completedDates = datesInWeek(weekStart);
  const weeklyCompleted = Math.min(completedDates.length, weeklyTarget);
  let fulfilledWeeksStreak = 0;
  let cursor = weeklyTarget > 0 && weeklyCompleted >= weeklyTarget ? weekStart : shiftCalendarDate(weekStart, -7);
  while (true) {
    const plan = forWeek(cursor);
    if (!plan || datesInWeek(cursor).length < plan.weekdays.length) break;
    fulfilledWeeksStreak += 1;
    cursor = shiftCalendarDate(cursor, -7);
  }
  return {
    weekStart, weeklyCompleted, weeklyTarget, fulfilledWeeksStreak,
    scheduledDates: (currentPlan?.weekdays ?? []).map((day) => shiftCalendarDate(weekStart, day - 1)).sort(),
    completedDates,
  };
}
