import { z } from 'zod'
import { ExerciseSchema, MachineSchema, UnitSchema } from './catalog.ts'
import { OrganizationSchema } from './organization.ts'
import { ResponseWebsiteContentSchema } from './website.ts'

const PublicOrganizationSchema = OrganizationSchema.pick({ id: true, slug: true, brand: true })

export const PublicSiteSchema = z
  .object({
    organization: PublicOrganizationSchema,
    website: ResponseWebsiteContentSchema,
    units: z.array(UnitSchema),
    machines: z.array(MachineSchema),
    exercises: z.array(ExerciseSchema),
  })
  .strict()

export type PublicSite = z.infer<typeof PublicSiteSchema>

export const PublicUnitSchema = z
  .object({
    organization: PublicOrganizationSchema,
    unit: UnitSchema,
    machine: MachineSchema,
    exercises: z.array(ExerciseSchema),
  })
  .strict()

export type PublicUnit = z.infer<typeof PublicUnitSchema>
