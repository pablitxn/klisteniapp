import { z } from 'zod'
import { IdSchema, RevisionSchema, RoleSchema, TimestampSchema, VersionSchema } from './common.ts'
import { AssetSchema } from './media.ts'
import { BrandInputSchema } from './organization.ts'
import { WebsiteInputSchema } from './website.ts'

export const BranchRoleSchema = z.enum(['coach', 'member'])
export type BranchRole = z.infer<typeof BranchRoleSchema>
export const BranchInputSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    name: z.string().trim().min(1).max(100),
    address: z.string().max(300).default(''),
    contact: z.string().max(200).default(''),
    timezone: z
      .string()
      .min(1)
      .max(100)
      .default('UTC')
      .refine((value) => {
        try {
          new Intl.DateTimeFormat('en', { timeZone: value })
          return true
        } catch {
          return false
        }
      }, 'Use a valid IANA timezone'),
    openingHours: WebsiteInputSchema.shape.openingHours,
    status: z.enum(['active', 'archived']).default('active'),
    public: z.boolean().default(false),
  })
  .strict()
export const BranchUpdateSchema = BranchInputSchema.extend({
  expectedRevision: RevisionSchema,
})
export const BranchSchema = BranchInputSchema.extend({
  id: IdSchema,
  organizationId: IdSchema,
  address: BranchInputSchema.shape.address.removeDefault(),
  contact: BranchInputSchema.shape.contact.removeDefault(),
  timezone: z.string().min(1),
  openingHours: BranchInputSchema.shape.openingHours.removeDefault(),
  status: BranchInputSchema.shape.status.removeDefault(),
  public: BranchInputSchema.shape.public.removeDefault(),
  revision: RevisionSchema,
})
export type Branch = z.infer<typeof BranchSchema>
export type BranchInput = z.input<typeof BranchInputSchema>
export type BranchUpdateInput = z.input<typeof BranchUpdateSchema>
export const BranchGrantInputSchema = z
  .object({
    userId: IdSchema,
    branchId: IdSchema,
    role: BranchRoleSchema,
    active: z.boolean(),
  })
  .strict()
export const BranchGrantSchema = BranchGrantInputSchema.extend({
  organizationId: IdSchema,
})
export type BranchGrant = z.infer<typeof BranchGrantSchema>
export type BranchGrantInput = z.input<typeof BranchGrantInputSchema>
export const BranchAccessSchema = z
  .object({ branch: BranchSchema, roles: z.array(RoleSchema).min(1) })
  .strict()
export const WhiteLabelMeSchema = z
  .object({
    organizationId: IdSchema,
    branches: z.array(BranchAccessSchema),
    brandAdmin: z.boolean(),
  })
  .strict()

const ColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/)
export const ThemeInputSchema = z
  .object({
    brand: z.lazy(() => BrandInputSchema),
    palette: z
      .object({
        primary: ColorSchema.default('#235c4b'),
        background: ColorSchema.default('#ffffff'),
        surface: ColorSchema.default('#f4f7f5'),
        text: ColorSchema.default('#16241e'),
        accent: ColorSchema.default('#b9dfca'),
      })
      .strict()
      .default({
        primary: '#235c4b',
        background: '#ffffff',
        surface: '#f4f7f5',
        text: '#16241e',
        accent: '#b9dfca',
      }),
    font: z.enum(['system', 'humanist', 'geometric']).default('system'),
    radius: z.enum(['square', 'soft', 'round']).default('soft'),
    layout: z.enum(['editorial', 'energetic']).default('editorial'),
    loginTitle: z.string().max(150).default(''),
    loginDescription: z.string().max(1000).default(''),
    heroImageUrl: z.union([AssetSchema.shape.url, z.literal('')]).default(''),
  })
  .strict()
export const ThemeUpdateSchema = ThemeInputSchema.extend({
  expectedRevision: RevisionSchema,
})
export const ThemeRestoreSchema = z
  .object({ version: VersionSchema, expectedRevision: RevisionSchema })
  .strict()
export const UnitTransferSchema = z
  .object({ branchId: IdSchema, expectedRevision: RevisionSchema })
  .strict()
export const ThemeSchema = z
  .object({
    draft: ThemeInputSchema,
    published: ThemeInputSchema,
    revision: RevisionSchema,
    publishedVersion: VersionSchema,
  })
  .strict()
export const ThemeVersionSchema = z
  .object({
    version: VersionSchema,
    data: ThemeInputSchema,
    createdAt: TimestampSchema,
  })
  .strict()
export type ThemeInput = z.input<typeof ThemeInputSchema>
export type Theme = z.infer<typeof ThemeInputSchema>
export type ThemeState = z.infer<typeof ThemeSchema>

export const MODULE_IDS = ['website', 'equipment', 'floorPlan', 'media', 'voice'] as const
export const ModuleIdSchema = z.enum(MODULE_IDS)
export type ModuleId = z.infer<typeof ModuleIdSchema>
export const EffectiveModulesSchema = z
  .object({
    website: z.boolean(),
    equipment: z.boolean(),
    floorPlan: z.boolean(),
    media: z.boolean(),
    voice: z.boolean(),
  })
  .strict()
export type EffectiveModules = z.infer<typeof EffectiveModulesSchema>
export const ModuleConfigurationSchema = z
  .object({
    module: ModuleIdSchema,
    platformEnabled: z.boolean(),
    brandEnabled: z.boolean(),
  })
  .strict()
export const ModuleUpdateSchema = z
  .object({ module: ModuleIdSchema, enabled: z.boolean() })
  .strict()
export const BranchCatalogSchema = z
  .object({
    kind: z.enum(['machine', 'exercise']),
    resourceId: IdSchema,
    enabled: z.boolean(),
  })
  .strict()

export const BrandContextSchema = z
  .object({
    organization: z
      .object({
        id: IdSchema,
        slug: z.string().min(1),
        brand: z.lazy(() => BrandInputSchema),
      })
      .strict(),
    theme: ThemeInputSchema,
    themeVersion: VersionSchema,
    branches: z.array(
      BranchSchema.pick({
        id: true,
        slug: true,
        name: true,
        address: true,
        contact: true,
        timezone: true,
      }),
    ),
    modules: EffectiveModulesSchema,
    canonicalOrigin: z.url(),
    websitePublished: z.boolean(),
  })
  .strict()
export type BrandContext = z.infer<typeof BrandContextSchema>

/** Historic JSON remains immutable: attach authoritative relational context when decoding. */
export function withHistoricalBranch<T extends object>(
  snapshot: T,
  branchId: string,
): T & { branchId: string } {
  return { ...snapshot, branchId: IdSchema.parse(branchId) }
}
