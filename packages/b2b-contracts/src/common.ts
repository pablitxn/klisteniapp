import { z } from 'zod'

export const API_PREFIX = '/api/b2b'

export const IdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/)

export const RoleSchema = z.enum(['admin', 'coach', 'member'])

export type Role = z.infer<typeof RoleSchema>

export const ContentStatusSchema = z.enum(['draft', 'reviewed', 'published'])

export type ContentStatus = z.infer<typeof ContentStatusSchema>

export const TimestampSchema = z.iso.datetime({ offset: true })

export const RevisionSchema = z.number().int().nonnegative()

export const VersionSchema = z.number().int().positive()

export const PublishSchema = z.object({ expectedRevision: z.number().int().nonnegative() }).strict()

/** Request payloads may omit fields that the parser supplies with defaults. */
export type PublishInput = z.input<typeof PublishSchema>
