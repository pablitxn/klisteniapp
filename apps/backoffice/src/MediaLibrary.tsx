import { useRef, useState } from 'react'
import type { Asset, Media } from '@klisteniapp/b2b-contracts'
import { Empty, errorMessage, Field, Notice, useAccountApi, useLoad } from '@klisteniapp/b2b-ui'

export function mediaAsset(media: Media): Asset {
  return { id: media.id, kind: media.kind, url: media.url, label: media.label, attribution: media.attribution }
}
const fileTypes: Record<string, { kind: Asset['kind']; mime: string; limit: number }> = {
  jpg: { kind: 'image', mime: 'image/jpeg', limit: 8 }, jpeg: { kind: 'image', mime: 'image/jpeg', limit: 8 },
  png: { kind: 'image', mime: 'image/png', limit: 8 }, webp: { kind: 'image', mime: 'image/webp', limit: 8 },
  mp4: { kind: 'video', mime: 'video/mp4', limit: 32 }, webm: { kind: 'video', mime: 'video/webm', limit: 32 },
  glb: { kind: 'model3d', mime: 'model/gltf-binary', limit: 24 },
}

export function UploadMedia({ orgId, disabled = false, onUploaded, imagesOnly = false }: { orgId: string; disabled?: boolean; onUploaded: (media: Media) => void; imagesOnly?: boolean }) {
  const api = useAccountApi(), input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null), [label, setLabel] = useState(''), [attribution, setAttribution] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  async function upload() {
    const type = fileTypes[file?.name.split('.').at(-1)?.toLowerCase() ?? '']
    if (!file || !type || imagesOnly && type.kind !== 'image') { setError('Elegí un archivo del tipo indicado.'); return }
    if (!label.trim()) { setError('Agregá un nombre para reconocer el archivo.'); return }
    if (!file.size || file.size > type.limit * 1024 * 1024) { setError(`El archivo debe tener contenido y pesar hasta ${type.limit} MB.`); return }
    setBusy(true); setError(''); setMessage('')
    try {
      const query = new URLSearchParams({ kind: type.kind, label: label.trim(), attribution: attribution.trim() })
      const result = await api<{ media: Media }>(`/orgs/${orgId}/media?${query}`, 'POST', new Blob([file], { type: type.mime }))
      onUploaded(result.media); setFile(null); setLabel(''); setAttribution(''); if (input.current) input.current.value = ''
      setMessage('Archivo guardado en la biblioteca del gimnasio.')
    } catch (error) { setError(errorMessage(error)) } finally { setBusy(false) }
  }
  return <fieldset className="upload-zone" disabled={disabled || busy} style={{ border: 0, minWidth: 0 }}>
    <legend>Subir un archivo</legend>
    <Field label="Archivo del gimnasio" hint={imagesOnly ? 'JPG, PNG o WebP · hasta 8 MB.' : 'Fotos JPG, PNG o WebP hasta 8 MB; videos MP4 o WebM hasta 32 MB; modelos GLB hasta 24 MB.'}>
      <input ref={input} type="file" accept={imagesOnly ? '.jpg,.jpeg,.png,.webp' : '.jpg,.jpeg,.png,.webp,.mp4,.webm,.glb'} onChange={event => { const selected = event.target.files?.[0] ?? null; setFile(selected); setLabel(selected?.name.replace(/\.[^.]+$/, '') ?? ''); setError(''); setMessage('') }} />
    </Field>
    {file && <><div className="form-grid"><Field label="Nombre del archivo"><input value={label} maxLength={200} onChange={event => setLabel(event.target.value)} /></Field><Field label="Autor o licencia del archivo"><input value={attribution} maxLength={1000} onChange={event => setAttribution(event.target.value)} placeholder="Ej.: foto del equipo de nuestro gimnasio" /></Field></div><p className="small muted">{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p><button type="button" className="button" onClick={() => void upload()}>{busy ? 'Subiendo archivo…' : 'Subir a la biblioteca'}</button></>}
    <Notice error>{error}</Notice><Notice>{message}</Notice>
  </fieldset>
}

export function MediaLibrary({ orgId, disabled = false, onChoose, selectedIds = [], imagesOnly = false }: { orgId: string; disabled?: boolean; onChoose?: (asset: Asset) => void; selectedIds?: string[]; imagesOnly?: boolean }) {
  const api = useAccountApi()
  const [query, setQuery] = useState('')
  const { data, error, loading, reload } = useLoad(() => api<{ media: Media[]; usage?: { bytes: number; quotaBytes: number } }>(`/orgs/${orgId}/media`), orgId)
  const items = data?.media.filter(media => (!imagesOnly || media.kind === 'image') && media.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())) ?? []
  return <div>
    {data?.usage && <p className="small muted">Biblioteca: {(data.usage.bytes / 1024 / 1024).toFixed(1)} MB de {(data.usage.quotaBytes / 1024 / 1024).toFixed(0)} MB utilizados.</p>}
    <UploadMedia orgId={orgId} imagesOnly={imagesOnly} disabled={disabled} onUploaded={media => { reload(); onChoose?.(mediaAsset(media)) }} />
    <Field label="Buscar en la biblioteca de archivos"><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Nombre del archivo" /></Field>
    <Notice error>{error}</Notice>{error && <button type="button" className="text-button" onClick={reload}>Reintentar biblioteca</button>}
    {loading && <p role="status">Cargando archivos del gimnasio…</p>}
    {!loading && !items.length && <Empty title="La biblioteca está lista para tus archivos">Subí fotos de tu espacio, videos de instrucciones o modelos que ya tengas. Después podés reutilizarlos sin volver a subirlos.</Empty>}
    <div className="media-library-grid" style={{ marginTop: 16 }}>{items.map(media => <article className="media-library-item" key={media.id}>
      {media.kind === 'image' ? <img src={media.url} alt={media.label} loading="lazy" /> : <div className="media-file-placeholder" aria-hidden="true">{media.kind === 'video' ? '▷' : '◇'}</div>}
      <strong>{media.label}</strong><small className="muted">{media.kind === 'image' ? 'Foto' : media.kind === 'video' ? 'Video' : 'Modelo 3D'} · {(media.bytes / 1024 / 1024).toFixed(2)} MB</small>
      {media.attribution && <small className="muted">{media.attribution}</small>}
      {onChoose ? <button type="button" className="button small" style={{ marginTop: 12 }} disabled={disabled || selectedIds.includes(media.id)} onClick={() => onChoose(mediaAsset(media))}>{selectedIds.includes(media.id) ? 'Agregado' : 'Usar archivo'}</button> : <a className="text-button small" style={{ display: 'inline-block', marginTop: 12 }} href={media.url} target="_blank" rel="noreferrer">Abrir archivo ↗</a>}
    </article>)}</div>
  </div>
}
