import { Field } from '@klisteniapp/b2b-ui'
import type { Target } from './programmingModel'

export function NumericTargetEditor({
  label,
  value,
  min,
  max,
  integer = false,
  onChange,
}: {
  label: string
  value: Target | null
  min: number
  max: number
  integer?: boolean
  onChange: (value: Target | null) => void
}) {
  const input = (part: 'value' | 'min' | 'max', number: number) => (
    <Field
      label={`${label} · ${part === 'value' ? 'valor' : part === 'min' ? 'mínimo' : 'máximo'}`}
    >
      <input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        min={min}
        max={max}
        step={integer ? 1 : 'any'}
        value={number}
        onChange={(event) => {
          if (!event.target.value) onChange(null)
          else if (value) onChange({ ...value, [part]: Number(event.target.value) })
        }}
      />
    </Field>
  )
  return (
    <fieldset className="programming-target">
      <legend>{label}</legend>
      <Field label={`${label} · formato`}>
        <select
          value={value?.kind ?? ''}
          onChange={(event) => {
            const n = value ? (value.kind === 'fixed' ? value.value : value.min) : min
            onChange(
              event.target.value === 'fixed'
                ? { kind: 'fixed', value: n }
                : event.target.value === 'range'
                  ? { kind: 'range', min: n, max: n }
                  : null,
            )
          }}
        >
          <option value="">Sin definir</option>
          <option value="fixed">Valor fijo</option>
          <option value="range">Rango</option>
        </select>
      </Field>
      {value?.kind === 'fixed' && input('value', value.value)}
      {value?.kind === 'range' && (
        <>
          {input('min', value.min)}
          {input('max', value.max)}
          {value.min > value.max && <p role="alert">El mínimo debe ser menor o igual al máximo.</p>}
        </>
      )}
    </fieldset>
  )
}
