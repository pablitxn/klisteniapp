import { z } from 'zod';
import { LocalDateSchema, TimeZoneSchema } from './calendar.ts';

export const YogaAsanaIdSchema = z.enum([
  'tadasana', 'sukhasana', 'balasana', 'marjaryasana', 'bitilasana',
  'adho-mukha-svanasana', 'uttanasana', 'ardha-uttanasana', 'utkatasana',
  'virabhadrasana-i', 'virabhadrasana-ii', 'trikonasana', 'vrksasana',
  'anjaneyasana', 'dandasana', 'baddha-konasana', 'paschimottanasana',
  'janu-sirsasana', 'bhujangasana', 'salabhasana', 'setu-bandha-sarvangasana',
  'ardha-matsyendrasana', 'supta-padangusthasana', 'savasana',
]);
export type YogaAsanaId = z.infer<typeof YogaAsanaIdSchema>;
export const YogaSideSchema = z.enum(['both', 'left', 'right']);
const IdentifierSchema = z.string().trim().min(1).max(200);

export const YogaPracticeStepSchema = z.object({
  id: IdentifierSchema,
  asanaId: YogaAsanaIdSchema,
  durationSeconds: z.number().int().min(5).max(3600),
  side: YogaSideSchema,
});
export type YogaPracticeStep = z.infer<typeof YogaPracticeStepSchema>;

export const YogaPracticeSchema = z.object({
  id: IdentifierSchema,
  name: z.string().trim().min(1).max(100),
  intention: z.string().trim().max(1000),
  // Repeated asanas are intentional: step IDs identify each occurrence and side.
  steps: z.array(YogaPracticeStepSchema).min(1).max(100),
}).superRefine(({ steps }, ctx) => {
  if (new Set(steps.map(step => step.id)).size !== steps.length) {
    ctx.addIssue({ code: 'custom', path: ['steps'], message: 'Hay pasos con identificadores duplicados.' });
  }
  if (steps.reduce((total, step) => total + step.durationSeconds, 0) > 14400) {
    ctx.addIssue({ code: 'custom', path: ['steps'], message: 'La práctica no puede superar cuatro horas.' });
  }
});
export type YogaPractice = z.infer<typeof YogaPracticeSchema>;

export const YogaCompletedStepSchema = z.object({
  stepId: IdentifierSchema,
  asanaId: YogaAsanaIdSchema,
  durationSeconds: z.number().int().min(1).max(3600),
  side: YogaSideSchema,
});
export type YogaCompletedStep = z.infer<typeof YogaCompletedStepSchema>;

export const YogaLogSchema = z.object({
  id: IdentifierSchema,
  date: LocalDateSchema,
  completedAt: z.iso.datetime({ offset: true }),
  timeZone: TimeZoneSchema.optional(),
  practiceSnapshot: YogaPracticeSchema,
  completedSteps: z.array(YogaCompletedStepSchema).min(1).max(100),
  /** Actual recorded practice time; excludes paused and skipped steps. */
  durationSeconds: z.number().int().min(1).max(14400),
  notes: z.string().trim().max(3000).optional(),
}).superRefine(({ practiceSnapshot, completedSteps, durationSeconds }, ctx) => {
  const planned = new Map(practiceSnapshot.steps.map((step, index) => [step.id, { step, index }]));
  let previousIndex = -1;
  for (const [index, completed] of completedSteps.entries()) {
    const match = planned.get(completed.stepId);
    if (!match || match.index <= previousIndex || match.step.asanaId !== completed.asanaId
      || match.step.side !== completed.side || completed.durationSeconds > match.step.durationSeconds) {
      ctx.addIssue({ code: 'custom', path: ['completedSteps', index], message: 'El paso completado no corresponde a la secuencia de esta práctica.' });
    }
    if (match) previousIndex = match.index;
  }
  if (completedSteps.reduce((total, step) => total + step.durationSeconds, 0) !== durationSeconds) {
    ctx.addIssue({ code: 'custom', path: ['durationSeconds'], message: 'La duración debe coincidir con el tiempo realmente practicado.' });
  }
});
export type YogaLog = z.infer<typeof YogaLogSchema>;

export const YOGA_DATA_MAX_BYTES = 4 * 1024 * 1024;
export const YogaDataSchema = z.object({
  practices: z.array(YogaPracticeSchema).max(100),
  logs: z.array(YogaLogSchema).max(10000),
}).superRefine((value, ctx) => {
  const { practices, logs } = value;
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > YOGA_DATA_MAX_BYTES) {
    ctx.addIssue({ code: 'custom', message: 'El historial de yoga supera el máximo acumulado de 4 MiB.' });
    return;
  }
  for (const [key, records] of [['practices', practices], ['logs', logs]] as const) {
    if (new Set(records.map(record => record.id)).size !== records.length) {
      ctx.addIssue({ code: 'custom', path: [key], message: 'Hay identificadores de yoga duplicados.' });
    }
  }
});
export type YogaData = z.infer<typeof YogaDataSchema>;
export function createEmptyYogaData(): YogaData { return { practices: [], logs: [] }; }
