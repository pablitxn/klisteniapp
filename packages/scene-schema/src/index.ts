import { z } from 'zod';

export const ExerciseIdSchema = z.enum([
  'pushup', 'squat', 'row', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise',
]);
export type ExerciseId = z.infer<typeof ExerciseIdSchema>;

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

export const WorkoutLogSchema = z.object({
  id: z.string().min(1).max(200),
  date: LocalDateSchema,
  completedAt: z.iso.datetime({ offset: true }),
  exercises: z.array(CompletedExerciseSchema).min(1).max(50),
  durationMinutes: z.number().positive().max(1440),
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
