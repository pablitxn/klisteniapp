import { z } from 'zod';

export const MovementFamilySchema = z.enum([
  'horizontal-push', 'overhead-push', 'bilateral-squat', 'reverse-lunge', 'lateral-lunge',
  'supine-hip-extension', 'standing-hip-hinge', 'supine-limb-control',
  'quadruped-limb-control', 'high-plank-knee-drive', 'trunk-curl',
  'prone-scapular-raise', 'standing-calf-raise', 'horizontal-pull', 'split-squat',
  'forward-lunge', 'prone-hip-extension', 'high-plank-shoulder-tap',
]);
export const PlanningRoleSchema = z.enum([
  'horizontal-push', 'overhead-push', 'knee-dominant', 'hip-extension',
  'hip-hinge-practice', 'trunk-stability', 'trunk-flexion', 'scapular-accessory',
  'ankle-strength', 'horizontal-pull',
]);
export const ExercisePositionSchema = z.enum([
  'standing', 'supine', 'prone', 'quadruped', 'kneeling-plank', 'high-plank', 'pike', 'inclined-supine',
]);
export const ExerciseSupportSchema = z.enum([
  'palms', 'knees', 'forefeet', 'feet', 'pelvis', 'upper-back', 'back', 'chest', 'grip',
]);
export const BalanceDemandSchema = z.enum(['stable-base', 'weight-shift', 'reduced-support']);
export const TechnicalCapabilitySchema = z.enum([
  'controlled-knee-pushup', 'controlled-full-pushup', 'high-plank-control', 'pike-support-control',
  'standing-weight-shift-control', 'hip-hinge-control', 'supine-trunk-control',
  'quadruped-trunk-control', 'secure-bodyweight-grip',
  'controlled-bodyweight-squat', 'controlled-glute-bridge', 'single-leg-balance',
  'single-leg-pelvis-control', 'scapular-overhead-control',
  'high-plank-weight-shift-control',
]);
export const PlanningRelationConditionSchema = z.enum([
  'target-requirements-confirmed', 'use-target-dose', 'accept-higher-demand', 'accept-lower-demand',
  'accept-different-supports',
  'accept-different-balance', 'accept-different-laterality', 'accept-different-emphasis',
]);

export type MovementFamily = z.infer<typeof MovementFamilySchema>;
export type PlanningRole = z.infer<typeof PlanningRoleSchema>;
export type ExercisePosition = z.infer<typeof ExercisePositionSchema>;
export type ExerciseSupport = z.infer<typeof ExerciseSupportSchema>;
export type BalanceDemand = z.infer<typeof BalanceDemandSchema>;
export type TechnicalCapability = z.infer<typeof TechnicalCapabilitySchema>;
export type PlanningRelationCondition = z.infer<typeof PlanningRelationConditionSchema>;

/** An editorial policy, not a biomechanical equivalence or measured training effect. */
export const MOVEMENT_PLANNING_ROLES: Record<MovementFamily, readonly PlanningRole[]> = {
  'horizontal-push': ['horizontal-push'],
  'overhead-push': ['overhead-push'],
  'bilateral-squat': ['knee-dominant'],
  'reverse-lunge': ['knee-dominant'],
  'lateral-lunge': ['knee-dominant'],
  'supine-hip-extension': ['hip-extension'],
  'standing-hip-hinge': ['hip-extension', 'hip-hinge-practice'],
  'supine-limb-control': ['trunk-stability'],
  'quadruped-limb-control': ['trunk-stability'],
  'high-plank-knee-drive': ['trunk-stability'],
  'trunk-curl': ['trunk-flexion'],
  'prone-scapular-raise': ['scapular-accessory'],
  'standing-calf-raise': ['ankle-strength'],
  'horizontal-pull': ['horizontal-pull'],
  'split-squat': ['knee-dominant'],
  'forward-lunge': ['knee-dominant'],
  'prone-hip-extension': ['hip-extension'],
  'high-plank-shoulder-tap': ['trunk-stability'],
};

const unique = <T>(values: T[]) => new Set(values).size === values.length;
const nonEmptyUnique = <T extends z.ZodType>(schema: T) => z.array(schema).min(1).refine(unique, 'Valores duplicados');

/** Inject the canonical ID schema to avoid a circular import or a second ID registry. */
export function createExercisePlanningSchema<T extends z.ZodType<string>>(exerciseId: T) {
  return z.object({
    movementFamily: MovementFamilySchema,
    planningRoles: nonEmptyUnique(PlanningRoleSchema),
    requirements: z.object({
      position: ExercisePositionSchema,
      supports: nonEmptyUnique(ExerciseSupportSchema),
      balance: BalanceDemandSchema,
      capabilities: z.array(TechnicalCapabilitySchema).refine(unique, 'Capacidades duplicadas'),
    }),
    laterality: z.enum(['bilateral', 'alternating', 'unilateral']),
    relations: z.array(z.object({
      targetId: exerciseId,
      type: z.enum(['alternative', 'regression', 'progression']),
      preservesRole: PlanningRoleSchema,
      conditions: nonEmptyUnique(PlanningRelationConditionSchema),
      rationale: z.string().trim().min(1),
    })).superRefine((relations, ctx) => {
      const targets = new Set<string>();
      relations.forEach((relation, index) => {
        // Zod's generic object output does not expose a generic field until T is instantiated.
        const targetId = (relation as { targetId: string }).targetId;
        if (targets.has(targetId)) ctx.addIssue({ code: 'custom', path: [index, 'targetId'], message: 'Relación duplicada para el mismo destino' });
        targets.add(targetId);
        for (const condition of ['target-requirements-confirmed', 'use-target-dose'] as const) {
          if (!relation.conditions.includes(condition)) ctx.addIssue({ code: 'custom', path: [index, 'conditions'], message: `Falta la condición ${condition}` });
        }
        const demand = relation.type === 'progression' ? 'accept-higher-demand' : relation.type === 'regression' ? 'accept-lower-demand' : undefined;
        if (demand && !relation.conditions.includes(demand)) ctx.addIssue({ code: 'custom', path: [index, 'conditions'], message: `Falta la condición ${demand}` });
        if (relation.conditions.includes('accept-higher-demand') && relation.type !== 'progression'
          || relation.conditions.includes('accept-lower-demand') && relation.type !== 'regression') ctx.addIssue({ code: 'custom', path: [index, 'conditions'], message: 'La condición de demanda contradice el tipo de relación' });
      });
    }),
    review: z.object({
      basis: z.literal('editorial'),
      reviewedOn: z.iso.date(),
      sourceUrls: nonEmptyUnique(z.url()),
      scope: z.literal('movement-classification-not-effect-equivalence'),
      adaptationNote: z.string().trim().min(1).optional(),
    }),
  }).superRefine((planning, ctx) => {
    for (const [index, role] of planning.planningRoles.entries()) {
      if (!MOVEMENT_PLANNING_ROLES[planning.movementFamily].includes(role)) ctx.addIssue({ code: 'custom', path: ['planningRoles', index], message: 'Rol incompatible con la familia de movimiento' });
    }
  });
}

type PlanningMetadata = z.infer<ReturnType<typeof createExercisePlanningSchema<z.ZodString>>>;
export interface PlanningCatalogExercise {
  id: string;
  reps: { perSide: boolean };
  sources: readonly { url: string }[];
  planning: PlanningMetadata;
}
export interface ExercisePlanningIssue {
  exerciseId: string;
  code: 'duplicate-id' | 'invalid-metadata' | 'laterality' | 'missing-target' | 'self-relation' | 'role-mismatch' | 'family-mismatch' | 'support-condition' | 'balance-condition' | 'laterality-condition' | 'unlisted-source';
  message: string;
}

/** Validate references across a parsed catalog; no eligibility decisions about a person. */
export function validateExercisePlanningCatalog(catalog: readonly PlanningCatalogExercise[]): ExercisePlanningIssue[] {
  const issues: ExercisePlanningIssue[] = [];
  const ids = new Map(catalog.map((exercise) => [exercise.id, exercise]));
  const seen = new Set<string>();
  const metadataSchema = createExercisePlanningSchema(z.string().min(1));
  for (const exercise of catalog) {
    const add = (code: ExercisePlanningIssue['code'], message: string) => issues.push({ exerciseId: exercise.id, code, message });
    if (seen.has(exercise.id)) add('duplicate-id', 'ID repetido en el catálogo');
    seen.add(exercise.id);
    const parsed = metadataSchema.safeParse(exercise.planning);
    if (!parsed.success) {
      add('invalid-metadata', parsed.error.issues.map((issue) => issue.message).join('; '));
      continue;
    }
    const planning = parsed.data;
    if (planning.review.sourceUrls.some((url) => !exercise.sources.some((source) => source.url === url))) add('unlisted-source', 'La revisión cita una fuente ausente de la ficha');
    if ((planning.laterality !== 'bilateral') !== exercise.reps.perSide) add('laterality', 'La lateralidad no coincide con el conteo por lado');
    for (const relation of planning.relations) {
      if (relation.targetId === exercise.id) add('self-relation', 'Un ejercicio no puede sustituirse a sí mismo');
      const target = ids.get(relation.targetId);
      if (!target) { add('missing-target', `No existe ${relation.targetId} en el catálogo`); continue; }
      const parsedTarget = metadataSchema.safeParse(target.planning);
      if (!parsedTarget.success) continue;
      if (!planning.planningRoles.includes(relation.preservesRole) || !parsedTarget.data.planningRoles.includes(relation.preservesRole)) add('role-mismatch', `El rol preservado no existe en ambos extremos: ${relation.targetId}`);
      // The initial contract deliberately accepts swaps only within the same specific family.
      if (planning.movementFamily !== parsedTarget.data.movementFamily) add('family-mismatch', `La relación cruza familias de movimiento: ${relation.targetId}`);
      const supportsChange = planning.requirements.position !== parsedTarget.data.requirements.position
        || [...planning.requirements.supports].sort().join('|') !== [...parsedTarget.data.requirements.supports].sort().join('|');
      if (supportsChange && !relation.conditions.includes('accept-different-supports')) add('support-condition', `Falta aceptar el cambio de apoyos: ${relation.targetId}`);
      if (planning.requirements.balance !== parsedTarget.data.requirements.balance && !relation.conditions.includes('accept-different-balance')) add('balance-condition', `Falta aceptar el cambio de equilibrio: ${relation.targetId}`);
      if (planning.laterality !== parsedTarget.data.laterality && !relation.conditions.includes('accept-different-laterality')) add('laterality-condition', `Falta aceptar el cambio de lateralidad: ${relation.targetId}`);
    }
  }
  return issues;
}
