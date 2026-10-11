import {
  MODULE_IDS,
  type EffectiveModules,
  type ModuleId,
  type Theme,
} from '@klisteniapp/b2b-contracts'

export const MODULE_POLICY = {
  website: { dependencies: [], disabled: 'hide-public-keep-drafts' },
  equipment: { dependencies: [], disabled: 'read-existing-block-writes-and-qr' },
  floorPlan: { dependencies: ['equipment', 'media'], disabled: 'hide-current-keep-history' },
  media: { dependencies: [], disabled: 'read-existing-block-uploads' },
  voice: { dependencies: [], disabled: 'stop-optional-guidance' },
} as const

/** Preference can only remove a capability; it can never grant one. */
export function effectiveModules(
  configuration: { module: ModuleId; platformEnabled: boolean; brandEnabled: boolean }[],
  branch: Partial<Record<ModuleId, boolean>> = {},
): EffectiveModules {
  const result = Object.fromEntries(
    MODULE_IDS.map((module) => {
      const item = configuration.find((row) => row.module === module)
      return [
        module,
        Boolean(item?.platformEnabled && item.brandEnabled && branch[module] !== false),
      ]
    }),
  ) as EffectiveModules
  result.floorPlan = result.floorPlan && result.equipment && result.media
  return result
}

function luminance(color: string): number {
  const channels = [1, 3, 5].map((start) => {
    const value = Number.parseInt(color.slice(start, start + 2), 16) / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
export function contrastRatio(first: string, second: string): number {
  const a = luminance(first),
    b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}
export function accessibleTheme(theme: Theme): boolean {
  return (
    contrastRatio(theme.palette.text, theme.palette.background) >= 4.5 &&
    contrastRatio(theme.palette.text, theme.palette.surface) >= 4.5 &&
    Math.max(
      contrastRatio(theme.palette.primary, '#ffffff'),
      contrastRatio(theme.palette.primary, '#000000'),
    ) >= 4.5
  )
}
