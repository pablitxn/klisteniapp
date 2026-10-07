import {
  ProgressDataSchema,
  type CardioLog,
  type ProgressData,
  type WorkoutLog,
  type YogaLog,
} from '@klisteniapp/scene-schema';

export const PROGRESS_STORAGE_KEY = 'klisteniapp.progress.v1';

export function emptyProgress(): ProgressData {
  return { version: 1, workouts: [], cardio: [] };
}

export function localDateKey(date = new Date()): string {
  if (!Number.isFinite(date.getTime())) throw new RangeError('Fecha inválida');
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Use calendar arithmetic, not 24-hour durations: a DST day may have 23/25 hours. */
function shiftDateKey(key: string, days: number): string {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  date.setDate(date.getDate() + days);
  return localDateKey(date);
}

export function weekStartKey(now = new Date()): string {
  const mondayOffset = (now.getDay() + 6) % 7;
  return shiftDateKey(localDateKey(now), -mondayOffset);
}

export function parseProgress(raw: string | null | undefined): { data: ProgressData; error: string | null } {
  if (raw == null) return { data: emptyProgress(), error: null };
  try {
    const result = ProgressDataSchema.safeParse(JSON.parse(raw));
    if (!result.success) {
      return { data: emptyProgress(), error: 'No pudimos leer los registros guardados: su formato no es válido. El archivo original no se modificó.' };
    }
    return { data: result.data, error: null };
  } catch {
    return { data: emptyProgress(), error: 'No pudimos leer los registros guardados. El archivo original no se modificó.' };
  }
}

export function serializeProgress(data: ProgressData): string {
  return JSON.stringify(ProgressDataSchema.parse(data));
}

export type ProgressSummary = {
  /** Consecutive calendar days with logged activity, ending today or yesterday. */
  streak: number;
  weeklyWorkouts: number;
  weeklyActiveDays: number;
  weeklyCardioMinutes: number;
  totalWorkouts: number;
  totalSets: number;
  xp: number;
  level: number;
  /** Percentage to the next level. One level = 100 XP. */
  levelProgress: number;
  activeDays: string[];
};

export function computeProgress(
  workouts: readonly WorkoutLog[],
  cardio: readonly CardioLog[],
  now = new Date(),
  yoga: readonly YogaLog[] = [],
): ProgressSummary {
  const today = localDateKey(now);
  const monday = weekStartKey(now);
  const seenIds = new Set<string>();
  // Ignore future entries and duplicate ids defensively; imports are separately schema-validated.
  const counted = <T extends { id: string; date: string }>(logs: readonly T[]) => logs.filter((log) => {
    if (log.date > today || seenIds.has(log.id)) return false;
    seenIds.add(log.id);
    return true;
  });
  const completedWorkouts = counted(workouts);
  const completedCardio = counted(cardio);
  const completedYoga = counted(yoga);
  const activeDays = [...new Set([...completedWorkouts, ...completedCardio, ...completedYoga].map((log) => log.date))].sort();
  const activeSet = new Set(activeDays);
  let cursor = activeSet.has(today) ? today : shiftDateKey(today, -1);
  let streak = 0;
  while (activeSet.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  const totalSets = completedWorkouts.reduce((total, log) => total + log.exercises.reduce((sum, entry) => sum + entry.sets, 0), 0);
  const totalCardioMinutes = completedCardio.reduce((total, log) => total + log.minutes, 0);
  // Reward only actual logged work. No starter bonus, invented history, or missed-day penalty.
  const yogaMinutes = Math.floor(completedYoga.reduce((total, log) => total + log.durationSeconds, 0) / 60);
  const xp = totalSets * 10 + totalCardioMinutes + yogaMinutes;
  return {
    streak,
    weeklyWorkouts: completedWorkouts.filter((log) => log.date >= monday).length,
    weeklyActiveDays: activeDays.filter((date) => date >= monday).length,
    weeklyCardioMinutes: completedCardio.filter((log) => log.date >= monday).reduce((total, log) => total + log.minutes, 0),
    totalWorkouts: completedWorkouts.length,
    totalSets,
    xp,
    level: Math.floor(xp / 100) + 1,
    levelProgress: xp % 100,
    activeDays,
  };
}
