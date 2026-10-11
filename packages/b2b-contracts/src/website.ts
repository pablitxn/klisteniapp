import { z } from 'zod'
import { IdSchema, RevisionSchema, TimestampSchema } from './common.ts'
import { AssetSchema, ResponseAssetSchema } from './media.ts'

export const WebsiteInputSchema = z
  .object({
    headline: z.string().trim().max(200).default(''),
    introduction: z.string().max(4000).default(''),
    activities: z
      .array(
        z
          .object({
            id: IdSchema,
            name: z.string().trim().min(1).max(100),
            description: z.string().max(1000).default(''),
            schedule: z.string().max(300).default(''),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    openingHours: z
      .array(
        z
          .object({
            id: IdSchema,
            days: z.string().trim().min(1).max(100),
            hours: z.string().trim().min(1).max(150),
          })
          .strict(),
      )
      .max(21)
      .default([]),
    gallery: z.array(AssetSchema).max(20).default([]),
  })
  .strict()

export type WebsiteInput = z.infer<typeof WebsiteInputSchema>

export const WebsiteUpdateSchema = WebsiteInputSchema.extend({
  expectedRevision: z.number().int().nonnegative(),
})

export const ResponseWebsiteContentSchema = WebsiteInputSchema.extend({
  headline: WebsiteInputSchema.shape.headline.removeDefault(),
  introduction: WebsiteInputSchema.shape.introduction.removeDefault(),
  activities: z.array(
    z
      .object({ id: IdSchema, name: z.string(), description: z.string(), schedule: z.string() })
      .strict(),
  ),
  openingHours: WebsiteInputSchema.shape.openingHours.removeDefault(),
  gallery: z.array(ResponseAssetSchema),
})

export const WebsiteSchema = z
  .object({
    draft: ResponseWebsiteContentSchema,
    revision: RevisionSchema,
    publishedRevision: RevisionSchema.nullable(),
    publishedAt: TimestampSchema.nullable(),
  })
  .strict()

export type Website = z.infer<typeof WebsiteSchema>

export const SetupProgressSchema = z
  .object({
    completed: RevisionSchema,
    total: RevisionSchema,
    websitePublished: z.boolean(),
    checks: z.array(
      z
        .object({
          id: z.enum([
            'brand',
            'inventory',
            'content',
            'activities',
            'hours',
            'gallery',
            'website',
          ]),
          label: z.string(),
          complete: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()

export type SetupProgress = z.infer<typeof SetupProgressSchema>

/** Request payloads may omit fields that the parser supplies with defaults. */
export type WebsiteDraftInput = z.input<typeof WebsiteInputSchema>
export type WebsiteUpdateInput = z.input<typeof WebsiteUpdateSchema>
