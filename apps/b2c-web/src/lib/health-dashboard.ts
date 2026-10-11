import {
  healthRecordCollections, summarizeSleepDays,
  type HealthData, type HealthSource, type MeasurementKey, type WorkoutLog,
} from '@klisteniapp/scene-schema';

export type DashboardPeriod = 7 | 30 | 90;
export type BodyTrend = {
  points: { date: string; value: number; recordedAt: string }[];
  latest: number | null;
  change: number | null;
};

const sourceLabels: Record<HealthSource['kind'], string> = {
  manual: 'Manual', 'samsung-health': 'Samsung Health', 'health-connect': 'Health Connect',
};
const collectionLabels: Record<(typeof healthRecordCollections)[number], string> = {
  measurements: 'Medidas corporales', sleep: 'Sueño', activity: 'Actividad',
  nutrition: 'Alimentación', supplements: 'Suplementos',
};
const sourceKey = (source: HealthSource): string => JSON.stringify([source.kind, source.device ?? '']);
const inRange = (date: string, from: string, to: string): boolean => date >= from && date <= to;

/** Calendar-day arithmetic in UTC avoids changing the window at DST transitions. */
function periodStart(today: string, period: DashboardPeriod): string {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - period + 1);
  return date.toISOString().slice(0, 10);
}

/** Observed account data only. Missing meals, nights, or supplement logs are not zeros. */
export function buildHealthDashboard(health: HealthData, workouts: readonly WorkoutLog[], today: string, period: DashboardPeriod) {
  const from = periodStart(today, period);
  const selected = (date: string) => inRange(date, from, today);
  const trainingDates = [...new Set(workouts.filter((entry) => selected(entry.date)).map((entry) => entry.date))].sort();
  // Detect duplicate nights before cutting the window: an overlapping interval can
  // be assigned to the previous observation date by another source.
  const sleepDays = summarizeSleepDays(health.sleep.filter((entry) => entry.date <= today)).filter((entry) => selected(entry.date));
  const validSleep = sleepDays.filter((entry) => entry.durationMinutes !== null);
  const nutrition = health.nutrition.filter((entry) => selected(entry.date));
  const energyRecords = nutrition.filter((entry) => entry.energyKcal !== undefined);
  const proteinRecords = nutrition.filter((entry) => entry.proteinG !== undefined);
  const supplementsByName = new Map<string, { name: string; taken: number; skipped: number; dates: Set<string> }>();
  for (const entry of health.supplements.filter((entry) => selected(entry.date))) {
    const key = entry.name.normalize('NFKC').trim().toLocaleLowerCase('es');
    const group = supplementsByName.get(key) ?? { name: entry.name, taken: 0, skipped: 0, dates: new Set<string>() };
    if (entry.taken) group.taken += 1;
    else group.skipped += 1;
    group.dates.add(entry.date);
    supplementsByName.set(key, group);
  }
  const measurements = health.measurements.filter((entry) => selected(entry.date));
  const sources = new Map<string, { key: string; label: string }>();
  for (const { source } of measurements) {
    const key = sourceKey(source);
    sources.set(key, { key, label: `${sourceLabels[source.kind]}${source.device ? ` · ${source.device}` : ''}` });
  }
  return {
    from, to: today, dayCount: period,
    training: { days: trainingDates.length, dates: trainingDates },
    sleep: {
      days: sleepDays,
      averageMinutes: validSleep.length ? validSleep.reduce((sum, entry) => sum + entry.durationMinutes!, 0) / validSleep.length : null,
      validDays: validSleep.length,
      ambiguousDays: sleepDays.length - validSleep.length,
    },
    nutrition: {
      recordCount: nutrition.length,
      days: new Set(nutrition.map((entry) => entry.date)).size,
      energyKcal: energyRecords.length ? energyRecords.reduce((sum, entry) => sum + entry.energyKcal!, 0) : null,
      energyRecords: energyRecords.length,
      proteinG: proteinRecords.length ? proteinRecords.reduce((sum, entry) => sum + entry.proteinG!, 0) : null,
      proteinRecords: proteinRecords.length,
    },
    supplements: [...supplementsByName.values()]
      .sort((a, b) => a.name.localeCompare(b.name, 'es'))
      .map(({ dates, ...entry }) => ({ ...entry, days: dates.size })),
    coverage: healthRecordCollections.map((key) => {
      const records = health[key].filter((entry) => selected(entry.date));
      return { key, label: collectionLabels[key], count: records.length, latestDate: records.reduce<string | null>((latest, entry) => latest === null || entry.date > latest ? entry.date : latest, null) };
    }),
    bodySources: [...sources.values()].sort((a, b) => a.label.localeCompare(b.label, 'es') || a.key.localeCompare(b.key)),
    measurementCount: measurements.length,
  };
}

/** One source/device per series and the latest observed value on each calendar date. */
export function getBodyTrend(health: HealthData, metric: MeasurementKey, selectedSource: string, from: string, to: string): BodyTrend {
  const observations = health.measurements.filter((entry) => inRange(entry.date, from, to)
    && sourceKey(entry.source) === selectedSource && entry[metric] !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date) || Date.parse(a.recordedAt) - Date.parse(b.recordedAt) || a.id.localeCompare(b.id));
  const byDate = new Map<string, BodyTrend['points'][number]>();
  for (const entry of observations) byDate.set(entry.date, { date: entry.date, value: entry[metric]!, recordedAt: entry.recordedAt });
  const points = [...byDate.values()];
  const latest = points.at(-1)?.value ?? null;
  return { points, latest, change: points.length > 1 ? latest! - points[0]!.value : null };
}
