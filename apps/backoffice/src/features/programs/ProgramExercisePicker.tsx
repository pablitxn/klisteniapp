import { useState } from 'react'
import type { Exercise } from '@klisteniapp/b2b-contracts'
import { Field } from '@klisteniapp/b2b-ui'

type ProgramExercisePickerProps = {
  published: Exercise[]
  stepCount: number
  onAdd: (exerciseId: string) => void
}

export function ProgramExercisePicker({ published, stepCount, onAdd }: ProgramExercisePickerProps) {
  const [selected, setSelected] = useState('')
  const [query, setQuery] = useState('')
  const filtered = published.filter((exercise) =>
    exercise.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  )
  const selectedAvailable = filtered.some((exercise) => exercise.id === selected)
  return (
    <section className="card form-stack">
      <h2>Sumar un movimiento</h2>
      <Field label="Filtrar catálogo para la rutina">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Buscá un movimiento publicado"
        />
      </Field>
      <Field label="Ejercicio para agregar">
        <select value={selected} onChange={(event) => setSelected(event.target.value)}>
          <option value="">Elegí del catálogo</option>
          {filtered.map((exercise) => (
            <option value={exercise.id} key={exercise.id}>
              {exercise.name}
              {exercise.scope === 'organization' ? ' · propio' : ''}
            </option>
          ))}
        </select>
      </Field>
      <button
        type="button"
        className="button"
        disabled={!selectedAvailable || stepCount >= 100}
        onClick={() => {
          if (!selectedAvailable || stepCount >= 100) return
          onAdd(selected)
          setSelected('')
        }}
      >
        + Agregar movimiento
      </button>
    </section>
  )
}
