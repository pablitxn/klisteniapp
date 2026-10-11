import { z } from 'zod'
import { ContentStatusSchema, IdSchema, RevisionSchema } from './common.ts'
import { AssetSchema, ResponseAssetSchema } from './media.ts'

const ContentFields = {
  id: IdSchema,
  scope: z.enum(['base', 'organization']),
  status: ContentStatusSchema,
  version: RevisionSchema,
  revision: RevisionSchema,
}

export const MachineInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    type: z.string().trim().min(1).max(100),
    manufacturer: z.string().max(100).default(''),
    model: z.string().max(100).default(''),
    instructions: z.string().max(5000).default(''),
    assets: z.array(AssetSchema).max(10).default([]),
    derivedFromId: IdSchema.nullable().default(null),
    derivedFromVersion: z.number().int().positive().nullable().default(null),
  })
  .strict()

export const MachineUpdateSchema = MachineInputSchema.extend({
  expectedRevision: z.number().int().nonnegative(),
})

export const MachineSchema = MachineInputSchema.extend({
  ...ContentFields,
  manufacturer: MachineInputSchema.shape.manufacturer.removeDefault(),
  model: MachineInputSchema.shape.model.removeDefault(),
  instructions: MachineInputSchema.shape.instructions.removeDefault(),
  assets: z.array(ResponseAssetSchema),
  derivedFromId: MachineInputSchema.shape.derivedFromId.removeDefault(),
  derivedFromVersion: MachineInputSchema.shape.derivedFromVersion.removeDefault(),
})

export type Machine = z.infer<typeof MachineSchema>

export const UnitInputSchema = z
  .object({
    machineId: IdSchema,
    label: z.string().trim().min(1).max(100),
    location: z.string().max(200).default(''),
    assets: z.array(AssetSchema).max(10).default([]),
    adjustments: z.string().max(3000).default(''),
    archived: z.boolean().default(false),
    public: z.boolean().default(true),
  })
  .strict()

export const UnitUpdateSchema = UnitInputSchema.extend({
  expectedRevision: z.number().int().nonnegative(),
})

export const UnitBatchSchema = z
  .object({ id: IdSchema, units: z.array(UnitInputSchema).min(1).max(20) })
  .strict()

export const UnitSchema = UnitInputSchema.extend({
  id: IdSchema,
  publicPath: z.string().regex(/^\/g\/[a-z0-9-]+\/units\/[a-zA-Z0-9_-]+$/),
  revision: RevisionSchema,
  location: UnitInputSchema.shape.location.removeDefault(),
  assets: z.array(ResponseAssetSchema),
  adjustments: UnitInputSchema.shape.adjustments.removeDefault(),
  archived: UnitInputSchema.shape.archived.removeDefault(),
  public: UnitInputSchema.shape.public.removeDefault(),
})

export type Unit = z.infer<typeof UnitSchema>

export const ExerciseInputSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    description: z.string().max(3000).default(''),
    instructions: z.array(z.string().trim().min(1).max(1000)).min(1).max(30),
    equipment: z.string().max(150).default('none'),
    machineId: IdSchema.nullable().default(null),
    compatibleMachineIds: z.array(IdSchema).max(30).default([]),
    pattern: z.string().max(150).default(''),
    muscles: z.array(z.string().max(100)).max(30).default([]),
    animationId: IdSchema.nullable().default(null),
    assets: z.array(AssetSchema).max(10).default([]),
    baseExerciseId: IdSchema.nullable().default(null),
  })
  .strict()

export const ExerciseUpdateSchema = ExerciseInputSchema.extend({
  expectedRevision: z.number().int().nonnegative(),
})

export const ExerciseSchema = ExerciseInputSchema.extend({
  ...ContentFields,
  description: ExerciseInputSchema.shape.description.removeDefault(),
  equipment: ExerciseInputSchema.shape.equipment.removeDefault(),
  machineId: ExerciseInputSchema.shape.machineId.removeDefault(),
  compatibleMachineIds: ExerciseInputSchema.shape.compatibleMachineIds.removeDefault(),
  pattern: ExerciseInputSchema.shape.pattern.removeDefault(),
  muscles: ExerciseInputSchema.shape.muscles.removeDefault(),
  animationId: ExerciseInputSchema.shape.animationId.removeDefault(),
  assets: z.array(ResponseAssetSchema),
  baseExerciseId: ExerciseInputSchema.shape.baseExerciseId.removeDefault(),
})

export type Exercise = z.infer<typeof ExerciseSchema>

/** Request payloads may omit fields that the parser supplies with defaults. */
export type MachineInput = z.input<typeof MachineInputSchema>
export type MachineUpdateInput = z.input<typeof MachineUpdateSchema>
export type UnitInput = z.input<typeof UnitInputSchema>
export type UnitUpdateInput = z.input<typeof UnitUpdateSchema>
export type UnitBatchInput = z.input<typeof UnitBatchSchema>
export type ExerciseInput = z.input<typeof ExerciseInputSchema>
export type ExerciseUpdateInput = z.input<typeof ExerciseUpdateSchema>
