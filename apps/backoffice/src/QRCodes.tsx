import { useEffect, useState } from 'react'
import type { Unit } from '@klisteniapp/b2b-contracts'
import { Empty, Notice } from '@klisteniapp/b2b-ui'
import QRCode from 'qrcode'
import { Heading } from './shared'

function absoluteUnitUrl(unit: Unit) {
  return new URL(unit.publicPath, location.origin).href
}

export function QRCodes({ units, gymName }: { units: Unit[]; gymName: string }) {
  const eligible = units.filter((unit) => unit.public && !unit.archived)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selected = eligible.filter((unit) => selectedIds.includes(unit.id))
  const [codes, setCodes] = useState<Record<string, string>>({}),
    [error, setError] = useState('')
  const selectionKey = selected.map((unit) => `${unit.id}:${unit.publicPath}`).join('|')

  useEffect(() => {
    let live = true
    setError('')
    setCodes({})
    void Promise.all(
      selected.map(
        async (unit) =>
          [
            unit.id,
            await QRCode.toDataURL(absoluteUnitUrl(unit), {
              width: 420,
              margin: 3,
              errorCorrectionLevel: 'M',
              color: { dark: '#183d32', light: '#ffffff' },
            }),
          ] as const,
      ),
    )
      .then((entries) => {
        if (live) setCodes(Object.fromEntries(entries))
      })
      .catch(() => {
        if (live)
          setError(
            'No pudimos preparar las etiquetas. Volvé a seleccionar los equipos para intentar otra vez.',
          )
      })
    return () => {
      live = false
    }
  }, [selectionKey])

  const ready = selected.length > 0 && selected.every((unit) => Boolean(codes[unit.id]))
  return (
    <section className="qr-page">
      <div className="no-print">
        <Heading
          title="Un acceso en cada equipo."
          description="Elegí las fichas públicas y prepará etiquetas con nombre, ubicación y enlace. Podés imprimirlas o guardar la hoja como PDF."
        />
        <Notice error>{error}</Notice>
        <p className="small muted">
          Antes de pegar una etiqueta, escaneala con el teléfono y comprobá que abra la ficha del
          equipo correcto. Las unidades internas o retiradas no se incluyen.
        </p>
        <div className="row spread" style={{ marginBottom: 20 }}>
          <div className="row">
            <button
              className="button"
              onClick={() => setSelectedIds(eligible.map((unit) => unit.id))}
              disabled={!eligible.length}
            >
              Seleccionar todos los QR
            </button>
            <button
              className="text-button"
              onClick={() => setSelectedIds([])}
              disabled={!selected.length}
            >
              Limpiar selección
            </button>
          </div>
          <button className="button primary" disabled={!ready} onClick={() => window.print()}>
            Imprimir {selected.length || ''} etiquetas
          </button>
        </div>
        {eligible.length ? (
          <div className="qr-selection card">
            {eligible.map((unit) => (
              <label className="check" key={unit.id}>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(unit.id)}
                  onChange={(event) =>
                    setSelectedIds((current) =>
                      event.target.checked
                        ? [...current, unit.id]
                        : current.filter((id) => id !== unit.id),
                    )
                  }
                />
                <span>
                  <strong>{unit.label}</strong>
                  <br />
                  <small className="muted">{unit.location || 'Sin ubicación indicada'}</small>
                </span>
              </label>
            ))}
          </div>
        ) : (
          <Empty title="Primero, publicá una ficha">
            Registrá un equipo, revisá sus instrucciones y habilitá su ficha pública desde
            Equipamiento.
          </Empty>
        )}
        {selected.length > 0 && <h2 style={{ marginTop: 28 }}>Vista previa de las etiquetas</h2>}
        {selected.length > 0 && !ready && !error && <p role="status">Preparando códigos QR…</p>}
      </div>
      <div className="qr-print-sheet">
        {selected.map((unit) => (
          <article className="qr-label" key={unit.id}>
            <p className="eyebrow">{gymName}</p>
            <h2>{unit.label}</h2>
            <p>{unit.location || 'Conocé este equipo'}</p>
            {codes[unit.id] && (
              <img src={codes[unit.id]} width={210} height={210} alt={`QR de ${unit.label}`} />
            )}
            <strong>Escaneá para ver cómo usarlo</strong>
            <a className="qr-absolute-url" href={absoluteUnitUrl(unit)}>
              {absoluteUnitUrl(unit)}
            </a>
          </article>
        ))}
      </div>
    </section>
  )
}
