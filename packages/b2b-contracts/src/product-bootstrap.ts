import { z } from 'zod'
import { IdSchema, RevisionSchema } from './common.ts'
import { OrganizationRoleV2Schema } from './product-common.ts'

/** Authenticated discovery, before selecting a branch. Choices are server-derived;
 * no choice or bootstrap field grants an operational capability. */
export const ProductBootstrapSchema = z
  .object({
    schemaVersion: z.literal(2),
    user: z.object({ id: IdSchema, name: z.string(), email: z.email() }).strict(),
    realm: z
      .object({ mode: z.enum(['unified', 'white-label', 'legacy']), key: z.string().min(1) })
      .strict(),
    memberships: z.array(
      z
        .object({
          organizationId: IdSchema,
          name: z.string(),
          role: OrganizationRoleV2Schema,
          activated: z.boolean(),
          accessMode: z.enum(['active', 'export-only']),
          accessRevision: RevisionSchema,
          choices: z.array(
            z
              .object({ branchId: IdSchema, name: z.string(), role: OrganizationRoleV2Schema })
              .strict(),
          ),
        })
        .strict(),
    ),
  })
  .strict()
export type ProductBootstrap = z.infer<typeof ProductBootstrapSchema>
