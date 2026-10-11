import { useEffect, type CSSProperties, type ReactNode } from 'react'
import type { BrandContext, Me, Role } from '@klisteniapp/b2b-contracts'
import { Field } from './components.tsx'

function luminance(hex: string) {
  const channels = [1, 3, 5]
    .map((index) => parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722
}
function contrast(a: string, b: string) {
  const first = luminance(a),
    second = luminance(b)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}
function readable(background: string, preferred: string) {
  if (contrast(background, preferred) >= 4.5) return preferred
  return contrast(background, '#ffffff') > contrast(background, '#111111') ? '#ffffff' : '#111111'
}

/** Only published, validated design tokens enter the shared surfaces. */
export function BrandThemeProvider({
  context,
  children,
  metadata = true,
}: {
  context: BrandContext | null
  children: ReactNode
  metadata?: boolean
}) {
  const name = context?.theme.brand.name
  const primary = context?.theme.palette.primary
  useEffect(() => {
    if (!metadata || !name || !primary) return
    const previousTitle = document.title
    document.title = name
    const existing = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const previousColor = existing?.content
    const meta = existing ?? document.createElement('meta')
    meta.name = 'theme-color'
    meta.content = primary
    if (!existing) document.head.append(meta)
    return () => {
      document.title = previousTitle
      if (existing) meta.content = previousColor ?? ''
      else meta.remove()
    }
  }, [metadata, name, primary])
  if (!context) return children
  const { palette, font, radius, layout } = context.theme
  const style = {
    '--brand': palette.primary,
    '--background': palette.background,
    '--surface': palette.surface,
    '--ink': readable(palette.background, palette.text),
    '--surface-ink': readable(palette.surface, palette.text),
    '--muted': readable(palette.background, palette.text),
    '--on-brand': readable(palette.primary, '#ffffff'),
    '--link': readable(palette.background, palette.primary),
    '--accent': palette.accent,
    '--soft': palette.accent,
    '--on-accent': readable(palette.accent, palette.text),
    '--line': `${palette.text}33`,
    '--radius': radius === 'square' ? '2px' : radius === 'round' ? '26px' : '12px',
    fontFamily:
      font === 'humanist'
        ? 'Georgia, "Times New Roman", serif'
        : font === 'geometric'
          ? 'Avenir, "Century Gothic", sans-serif'
          : 'system-ui, sans-serif',
  } as CSSProperties
  return (
    <div
      className="brand-theme"
      data-brand={context.organization.id}
      data-theme-layout={layout}
      style={style}
    >
      {children}
    </div>
  )
}

const roleLabels: Record<Role, string> = {
  admin: 'Administración',
  coach: 'Entrenador',
  member: 'Socio',
}

export function WorkContextSelector({
  access,
  branchId,
  role,
  onChange,
  dirty = false,
}: {
  access: NonNullable<Me['whiteLabel']>
  branchId: string
  role: Role | ''
  onChange: (branchId: string, role: Role) => void
  dirty?: boolean
}) {
  const choices = access.branches
    .filter(({ branch }) => branch.status === 'active')
    .flatMap(({ branch, roles }) =>
      roles.map((choiceRole) => ({
        branch,
        role: choiceRole,
        value: `${branch.id}:${choiceRole}`,
      })),
    )
  return (
    <Field label="Sede y función">
      <select
        aria-label="Sede y función"
        value={branchId && role ? `${branchId}:${role}` : ''}
        onChange={(event) => {
          const selected = choices.find((choice) => choice.value === event.target.value)
          if (!selected) return
          if (
            dirty &&
            !window.confirm(
              'Tenés cambios sin guardar. ¿Querés descartarlos y cambiar de sede o función?',
            )
          )
            return
          onChange(selected.branch.id, selected.role)
        }}
      >
        <option value="" disabled>
          {choices.length ? 'Elegí dónde querés trabajar' : 'Sin acceso operativo a sedes'}
        </option>
        {choices.map((choice) => (
          <option key={choice.value} value={choice.value}>
            {choice.branch.name} · {roleLabels[choice.role]}
          </option>
        ))}
      </select>
    </Field>
  )
}
