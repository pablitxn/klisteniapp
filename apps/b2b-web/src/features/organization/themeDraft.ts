import type { Theme } from '@klisteniapp/b2b-contracts'

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/** Recovery accepts unfinished text/URLs; the API still validates publication. */
export function isThemeDraft(value: unknown): value is Theme {
  if (!record(value) || !record(value.brand) || !record(value.palette)) return false
  const brand = value.brand,
    palette = value.palette
  return (
    ['name', 'description', 'color', 'logoUrl', 'contact', 'address'].every(
      (key) => typeof brand[key] === 'string',
    ) &&
    ['primary', 'background', 'surface', 'text', 'accent'].every(
      (key) => typeof palette[key] === 'string',
    ) &&
    ['font', 'radius', 'layout', 'loginTitle', 'loginDescription', 'heroImageUrl'].every(
      (key) => typeof value[key] === 'string',
    )
  )
}
