import {
  AssetSchema,
  ExerciseInputSchema,
  type Asset,
  type Exercise,
} from '@klisteniapp/b2b-contracts'

const DraftAssetSchema = AssetSchema.extend({
  attribution: AssetSchema.shape.attribution.removeDefault(),
})

/** Editor text intentionally accepts unfinished values; API validation happens on save. */
export type ExerciseDraft = {
  name: string
  description: string
  instructions: string
  equipment: string
  pattern: string
  muscles: string
  machineId: string
  animationId: string
  machineIds: string[]
  assets: Asset[]
}

export function exerciseDraft(exercise?: Exercise): ExerciseDraft {
  return {
    name: exercise?.name ?? '',
    description: exercise?.description ?? '',
    instructions: exercise?.instructions.join('\n') ?? '',
    equipment: exercise?.equipment ?? 'none',
    pattern: exercise?.pattern ?? '',
    muscles: exercise?.muscles.join(', ') ?? '',
    machineId: exercise?.machineId ?? '',
    animationId: exercise?.animationId ?? '',
    machineIds: [...(exercise?.compatibleMachineIds ?? [])],
    assets: exercise?.assets.map((asset) => ({ ...asset })) ?? [],
  }
}

export function isExerciseDraft(value: unknown): value is ExerciseDraft {
  if (!value || typeof value !== 'object') return false
  return (
    'name' in value &&
    typeof value.name === 'string' &&
    'description' in value &&
    typeof value.description === 'string' &&
    'instructions' in value &&
    typeof value.instructions === 'string' &&
    'equipment' in value &&
    typeof value.equipment === 'string' &&
    'pattern' in value &&
    typeof value.pattern === 'string' &&
    'muscles' in value &&
    typeof value.muscles === 'string' &&
    'machineId' in value &&
    typeof value.machineId === 'string' &&
    'animationId' in value &&
    typeof value.animationId === 'string' &&
    'machineIds' in value &&
    Array.isArray(value.machineIds) &&
    value.machineIds.length <= 30 &&
    value.machineIds.every((id) => typeof id === 'string') &&
    'assets' in value &&
    Array.isArray(value.assets) &&
    value.assets.length <= 10 &&
    value.assets.every((asset) => DraftAssetSchema.safeParse(asset).success)
  )
}

function splitText(value: string, separator: string) {
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function exerciseInput(draft: ExerciseDraft, source?: Exercise) {
  return ExerciseInputSchema.parse({
    name: draft.name,
    description: draft.description,
    instructions: splitText(draft.instructions, '\n'),
    equipment: draft.equipment,
    pattern: draft.pattern,
    muscles: splitText(draft.muscles, ','),
    machineId: draft.machineId || null,
    compatibleMachineIds: draft.machineIds,
    animationId: draft.animationId || null,
    assets: draft.assets,
    baseExerciseId: source?.scope === 'base' ? source.id : (source?.baseExerciseId ?? null),
  })
}
