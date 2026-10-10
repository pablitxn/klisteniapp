import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AssetSchema, type Asset } from '@klisteniapp/b2b-contracts'
import { errorMessage, Field, Notice } from '@klisteniapp/b2b-ui'
import { MediaLibrary } from './MediaLibrary'

export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('')
  const running = useRef(false)
  const mounted = useRef(false)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const clear = useCallback(() => {
    setError('')
    setMessage('')
  }, [])
  const run = useCallback(
    async (action: () => Promise<void>, success = 'Cambios guardados.') => {
      // A ref closes the gap before React renders disabled buttons.
      if (!mounted.current || running.current) return false
      running.current = true
      setBusy(true)
      clear()
      try {
        await action()
        if (!mounted.current) return false
        setMessage(success)
        return true
      } catch (error) {
        if (mounted.current) setError(errorMessage(error))
        return false
      } finally {
        running.current = false
        if (mounted.current) setBusy(false)
      }
    },
    [clear],
  )
  return {
    busy,
    error,
    message,
    run,
    clear,
    notices: (
      <>
        <Notice error>{error}</Notice>
        <Notice>{message}</Notice>
      </>
    ),
  }
}
export function Heading({
  eyebrow = 'ESPACIO PROFESIONAL',
  title,
  description,
  children,
}: {
  eyebrow?: string
  title: string
  description: string
  children?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {children}
    </div>
  )
}
export function AssetEditor({
  orgId,
  value,
  onChange,
  disabled = false,
  imagesOnly = false,
}: {
  orgId: string
  value: Asset[]
  onChange: (assets: Asset[]) => void
  disabled?: boolean
  imagesOnly?: boolean
}) {
  const [url, setUrl] = useState(''),
    [label, setLabel] = useState(''),
    [kind, setKind] = useState<Asset['kind']>('image'),
    [attribution, setAttribution] = useState(''),
    [error, setError] = useState(''),
    [libraryOpen, setLibraryOpen] = useState(false)
  function append(asset: Asset) {
    if (value.some((item) => item.id === asset.id)) return
    if (value.length >= 10) {
      setError('Podés agregar hasta 10 recursos.')
      return
    }
    setError('')
    onChange([...value, asset])
  }
  function add() {
    const parsed = AssetSchema.safeParse({
      id: crypto.randomUUID(),
      url,
      label: label.trim(),
      kind: imagesOnly ? 'image' : kind,
      attribution,
    })
    if (!parsed.success) {
      setError(
        'Revisá el nombre, el enlace y los datos del recurso. Usá una URL HTTPS o una ruta local válida.',
      )
      return
    }
    append(parsed.data)
    setUrl('')
    setLabel('')
    setAttribution('')
  }
  return (
    <fieldset
      disabled={disabled}
      style={{ border: '1px solid var(--line)', padding: 16, borderRadius: 10, minWidth: 0 }}
    >
      <legend>{imagesOnly ? 'Galería de fotos' : 'Fotos, videos y modelos'}</legend>
      <p className="small muted">
        Elegí archivos del gimnasio o subí nuevos. Se vuelven públicos cuando publicás el contenido
        que los usa.
      </p>
      {value.map((asset) => (
        <div className="list-row" key={asset.id}>
          <div>
            <strong>{asset.label}</strong>
            <p>
              {asset.kind === 'image' ? 'Foto' : asset.kind === 'video' ? 'Video' : 'Modelo 3D'} ·{' '}
              {asset.attribution || 'Sin atribución'}
            </p>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => onChange(value.filter((item) => item.id !== asset.id))}
          >
            Quitar
          </button>
        </div>
      ))}
      <Notice error>{error}</Notice>
      {value.length < 10 && (
        <>
          <button
            type="button"
            className="button small"
            style={{ margin: '12px 0' }}
            onClick={() => setLibraryOpen((current) => !current)}
          >
            {libraryOpen ? 'Ocultar biblioteca' : 'Elegir de mi biblioteca'}
          </button>
          {libraryOpen && (
            <MediaLibrary
              orgId={orgId}
              disabled={disabled}
              imagesOnly={imagesOnly}
              selectedIds={value.map((asset) => asset.id)}
              onChoose={append}
            />
          )}
          <details style={{ marginTop: 16 }}>
            <summary>Agregar un recurso por enlace</summary>
            <div className="form-grid" style={{ marginTop: 16 }}>
              {!imagesOnly && (
                <Field label="Tipo de recurso">
                  <select
                    value={kind}
                    onChange={(event) => {
                      const parsed = AssetSchema.shape.kind.safeParse(event.target.value)
                      if (parsed.success) setKind(parsed.data)
                    }}
                  >
                    <option value="image">Foto</option>
                    <option value="video">Video</option>
                    <option value="model3d">Modelo 3D</option>
                  </select>
                </Field>
              )}
              <Field label="Nombre del recurso">
                <input
                  value={label}
                  maxLength={200}
                  onChange={(event) => setLabel(event.target.value)}
                />
              </Field>
              <Field label="URL del recurso">
                <input
                  value={url}
                  maxLength={2048}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Autor o licencia">
                <input
                  value={attribution}
                  maxLength={1000}
                  onChange={(event) => setAttribution(event.target.value)}
                />
              </Field>
            </div>
            <button type="button" className="button small" style={{ marginTop: 12 }} onClick={add}>
              Agregar recurso
            </button>
          </details>
        </>
      )}
    </fieldset>
  )
}
