import type { ColorTheme } from '@klisteniapp/scene-schema'

export interface ColorThemeDefinition {
  id: ColorTheme
  /** Spanish source strings are translated by the appearance picker. */
  name: string
  description: string
  swatches: {
    light: readonly [background: string, primary: string, secondary: string]
    dark: readonly [background: string, primary: string, secondary: string]
  }
}

export const colorThemes = [
  {
    id: 'sage',
    name: 'Salvia',
    description: 'Natural y tranquila',
    swatches: { light: ['#f7f8f5', '#62547f', '#516a3e'], dark: ['#151c18', '#cbbbdf', '#b5d197'] },
  },
  {
    id: 'ocean',
    name: 'Océano',
    description: 'Fresca y serena',
    swatches: { light: ['#f3f8fa', '#285879', '#2c695f'], dark: ['#101e27', '#a5d1f2', '#9bd5c7'] },
  },
  {
    id: 'sunset',
    name: 'Atardecer',
    description: 'Cálida y enérgica',
    swatches: { light: ['#fbf7f1', '#88482d', '#785c24'], dark: ['#251b16', '#f0b79b', '#e4ca8a'] },
  },
  {
    id: 'lavender',
    name: 'Lavanda',
    description: 'Suave y soñadora',
    swatches: { light: ['#f7f5fb', '#6a438c', '#485e91'], dark: ['#1c1827', '#d4b5ef', '#b4c8f4'] },
  },
  {
    id: 'rose',
    name: 'Rosa',
    description: 'Dulce y expresiva',
    swatches: { light: ['#fcf5f7', '#8b3c62', '#8b513e'], dark: ['#261a22', '#f1b3ce', '#efbea6'] },
  },
  {
    id: 'graphite',
    name: 'Grafito',
    description: 'Sobria y minimalista',
    swatches: { light: ['#f5f7f9', '#465a72', '#496369'], dark: ['#171c23', '#c1d0e5', '#b7cfd0'] },
  },
] as const satisfies readonly ColorThemeDefinition[]
