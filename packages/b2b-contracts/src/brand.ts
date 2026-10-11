import { z } from 'zod'
import { AssetSchema } from './media.ts'

/** Shared identity contract, independent of sessions and white-label context. */
export const BrandInputSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(2000).default(''),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .default('#235c4b'),
    logoUrl: z.union([AssetSchema.shape.url, z.literal('')]).default(''),
    contact: z.string().max(200).default(''),
    address: z.string().max(300).default(''),
  })
  .strict()

export type Brand = z.infer<typeof BrandInputSchema>
export const ResponseBrandSchema = BrandInputSchema.extend({
  description: BrandInputSchema.shape.description.removeDefault(),
  color: BrandInputSchema.shape.color.removeDefault(),
  logoUrl: BrandInputSchema.shape.logoUrl.removeDefault(),
  contact: BrandInputSchema.shape.contact.removeDefault(),
  address: BrandInputSchema.shape.address.removeDefault(),
})
