import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColorTheme } from '@klisteniapp/scene-schema'
import { colorThemes } from '../lib/color-themes'
import Icon from './Icon'
import './color-theme-picker.css'

export default function ColorThemePicker({ value, disabled, onChange }: {
  value: ColorTheme
  disabled: boolean
  onChange: (value: ColorTheme) => void
}) {
  const { t } = useTranslation('settings')
  const hintId = useId()
  return (
    <fieldset className="color-theme-picker" aria-busy={disabled} aria-describedby={hintId}>
      <legend>{t('Paleta de colores')}</legend>
      <p id={hintId} className="fine-print">{t('Cada paleta tiene su versión clara y oscura. Elegí la onda que más te guste.')}</p>
      <div className="color-theme-grid">
        {colorThemes.map(palette => (
          <button
            type="button"
            key={palette.id}
            className="color-theme-choice"
            aria-pressed={value === palette.id}
            aria-disabled={disabled}
            aria-label={t(palette.name)}
            onClick={() => { if (!disabled) onChange(palette.id) }}
          >
            <span className="color-theme-previews" aria-hidden="true">
              {(['light', 'dark'] as const).map(mode => (
                <span className="color-theme-preview" key={mode}>
                  <span className="color-theme-miniature" style={{ backgroundColor: palette.swatches[mode][0] }}>
                    <span style={{ backgroundColor: palette.swatches[mode][1] }} />
                    <span style={{ backgroundColor: palette.swatches[mode][2] }} />
                  </span>
                  <span className="color-theme-mode">{t(mode === 'light' ? 'Claro' : 'Oscuro')}</span>
                </span>
              ))}
            </span>
            <span className="color-theme-name">
              <strong>{t(palette.name)}</strong>
              {value === palette.id && <Icon name="check" size={16} />}
            </span>
            <span className="color-theme-description">{t(palette.description)}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
