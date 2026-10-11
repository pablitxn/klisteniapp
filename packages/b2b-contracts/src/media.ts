import { z } from 'zod'
import { IdSchema, TimestampSchema } from './common.ts'

export const AssetSchema = z
  .object({
    id: IdSchema,
    kind: z.enum(['image', 'video', 'model3d']),
    url: z
      .string()
      .max(2048)
      .refine(
        (value) => /^https:\/\/[^\s]+$/.test(value) || /^\/(?!\/)[a-zA-Z0-9_./%-]+$/.test(value),
        'Use HTTPS or a local asset path',
      ),
    label: z.string().trim().min(1).max(200),
    attribution: z.string().max(1000).default(''),
  })
  .strict()

export type Asset = z.infer<typeof AssetSchema>

export const ResponseAssetSchema = AssetSchema.extend({
  attribution: AssetSchema.shape.attribution.removeDefault(),
})

export const MediaUploadSchema = z
  .object({
    kind: AssetSchema.shape.kind,
    label: AssetSchema.shape.label,
    attribution: AssetSchema.shape.attribution,
  })
  .strict()

export const MediaSchema = ResponseAssetSchema.extend({
  mime: z.string().min(1),
  bytes: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: TimestampSchema,
})

export type Media = z.infer<typeof MediaSchema>

/** Request payloads may omit fields that the parser supplies with defaults. */
export type AssetInput = z.input<typeof AssetSchema>
export type MediaUploadInput = z.input<typeof MediaUploadSchema>
