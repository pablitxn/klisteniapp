import { useEffect, useState } from 'react'
import type { Machine, Unit } from '@klisteniapp/b2b-contracts'
import { Empty, Notice } from '@klisteniapp/b2b-ui'
import QRCode from 'qrcode'
import { Heading } from './shared'
import { qrOriginReadiness, unitPublicationBlockers } from './equipmentReadiness'

function absoluteUnitUrl(unit: Unit) {
  return new URL(unit.publicPath, location.origin).href
}

export function QRCodes({
  units,
  machines,
  websitePublished,
  gymName,
  onGo,
}: {
  units: Unit[]
  machines: Machine[]
  websitePublished: boolean
  gymName: string
  onGo: (page: 'equipment' | 'website') => void
}) {
  const inventory = units.map((unit) => ({
    unit,
    blockers: unitPublicationBlockers(
      unit,
      machines.find((machine) => machine.id === unit.machineId),
      websitePublished,
    ),
  }))
  const eligible = inventory.filter(({ blockers }) => !blockers.length).map(({ unit }) => unit)
  const pending = inventory.filter(({ blockers, unit }) => blockers.length > 0 && !unit.archived)
  const origin = qrOriginReadiness(location.origin)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const selected = eligible.filter((unit) => selectedIds.includes(unit.id))
  const [codes, setCodes] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0)
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
            'No pudimos preparar las etiquetas. Reintentá la generación; conservamos tu selección.',
          )
      })
    return () => {
      live = false
    }
  }, [selectionKey, attempt])

  const ready = selected.length > 0 && selected.every((unit) => Boolean(codes[unit.id]))
  return (
    <section className="qr-page">
      <div className="no-print">
        <Heading
          title="Un acceso en cada equipo."
          description="Elegí las fichas públicas y prepará etiquetas con nombre, ubicación y enlace. Podés imprimirlas o guardar la hoja como PDF."
        />
        <Notice error>{error}</Notice>
        {error && (
          <button className="button" onClick={() => setAttempt((value) => value + 1)}>
            Reintentar códigos QR
          </button>
        )}
        <section className="card" style={{ marginBottom: 20 }}>
          <h2>{origin.ready ? 'Origen de las etiquetas' : 'Estas etiquetas son de prueba'}</h2>
          <p className="small" style={{ overflowWrap: 'anywhere' }}>
            <strong>{location.origin}</strong>
          </p>
          <p className="small muted">{origin.message}</p>
        </section>
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
            <p>
              <button className="button" onClick={() => onGo('equipment')}>
                Ir a Equipamiento
              </button>
            </p>
          </Empty>
        )}
        {pending.length > 0 && (
          <section className="card" style={{ marginTop: 24 }}>
            <h2>{pending.length} equipos pendientes de publicación</h2>
            <p className="small muted">
              Completá estos pasos para incluir sus etiquetas en el lote.
            </p>
            {pending.map(({ unit, blockers }) => (
              <div className="list-row" key={unit.id}>
                <div>
                  <strong>{unit.label}</strong>
                  <ul>
                    {blockers.map((blocker) => (
                      <li key={blocker.reason}>{blocker.reason}</li>
                    ))}
                  </ul>
                  <div className="row">
                    {[...new Set(blockers.map((blocker) => blocker.destination))].map((page) => (
                      <button key={page} className="text-button" onClick={() => onGo(page)}>
                        {page === 'website' ? 'Preparar website' : 'Preparar equipo'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}
        {selected.length > 0 && <h2 style={{ marginTop: 28 }}>Vista previa de las etiquetas</h2>}
        {selected.length > 0 && !ready && !error && <p role="status">Preparando códigos QR…</p>}
      </div>
      <div className="qr-print-sheet">
        {selected.map((unit) => (
          <article className="qr-label" key={unit.id}>
            {!origin.ready && <p className="small">ETIQUETA DE PRUEBA · ORIGEN NO VERIFICADO</p>}
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
