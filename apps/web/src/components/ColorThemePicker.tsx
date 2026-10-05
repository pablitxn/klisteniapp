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
  const selectedPalette = colorThemes.find(palette => palette.id === value) ?? colorThemes[0]
  return (
    <fieldset className="color-theme-picker" aria-busy={disabled} aria-describedby={hintId}>
      <legend>{t('Paleta de colores')}</legend>
      <p id={hintId} className="fine-print">{t('Elegí un color para hacerla tuya. Funciona en modo claro y oscuro.')}</p>
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
            <span className="color-theme-swatches" aria-hidden="true">
              <span style={{ backgroundColor: palette.swatches.light[1] }} />
              <span style={{ backgroundColor: palette.swatches.dark[1] }} />
              <span style={{ backgroundColor: palette.swatches.light[2] }} />
            </span>
            <span className="color-theme-name">{t(palette.name)}</span>
            {value === palette.id && <span className="color-theme-check"><Icon name="check" size={12} /></span>}
          </button>
        ))}
      </div>
      <div className="color-theme-selected">
        <div className="color-theme-selected-copy" aria-live="polite" aria-atomic="true">
          <span className="color-theme-preview-label">{t('Vista previa')}</span>
          <strong>{t(selectedPalette.name)}</strong>
          <span>{t(selectedPalette.description)}</span>
        </div>
        <div className="color-theme-sample" aria-hidden="true">
          <div className="color-theme-sample-heading">
            <span>{t('Mi rutina')}</span>
            <Icon name="spark" size={16} />
          </div>
          <div className="color-theme-sample-row">
            <span className="color-theme-sample-icon"><Icon name="body" size={22} /></span>
            <span className="color-theme-sample-lines"><span /><span /></span>
            <span className="color-theme-sample-dot" />
          </div>
          <span className="color-theme-sample-action"><Icon name="play" size={14} />{t('Empezar')}</span>
        </div>
      </div>
    </fieldset>
  )
}
