import type { PublicProfile } from '../../config/deployment'

declare const __KLISTENI_INSTANCE_MODE__: boolean
declare const __KLISTENI_PUBLIC_PROFILE__: PublicProfile | null

// Vite replaces these constants before tree shaking; no runtime profile fetch.
export const instanceMode = __KLISTENI_INSTANCE_MODE__
export const publicProfile = __KLISTENI_PUBLIC_PROFILE__
