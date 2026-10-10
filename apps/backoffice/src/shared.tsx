import { useState, type ReactNode } from 'react'
import type { Asset } from '@klisteniapp/b2b-contracts'
import { errorMessage, Field, Notice } from '@klisteniapp/b2b-ui'
import { MediaLibrary } from './MediaLibrary'

export function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('')
  async function run(action: () => Promise<void>, success = 'Cambios guardados.') { setBusy(true); setError(''); setMessage(''); try { await action(); setMessage(success); return true } catch (error) { setError(errorMessage(error)); return false } finally { setBusy(false) } }
  return { busy, error, message, run, clear: () => { setError(''); setMessage('') }, notices: <><Notice error>{error}</Notice><Notice>{message}</Notice></> }
}
export function Heading({ eyebrow = 'ESPACIO PROFESIONAL', title, description, children }: { eyebrow?: string; title: string; description: string; children?: ReactNode }) { return <div className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="muted">{description}</p></div>{children}</div> }
export function AssetEditor({ orgId, value, onChange, disabled = false, imagesOnly = false }: { orgId: string; value: Asset[]; onChange: (assets: Asset[]) => void; disabled?: boolean; imagesOnly?: boolean }) {
  const [url, setUrl] = useState(''), [label, setLabel] = useState(''), [kind, setKind] = useState<Asset['kind']>('image'), [attribution, setAttribution] = useState(''), [error, setError] = useState(''), [libraryOpen, setLibraryOpen] = useState(false)
  function append(asset: Asset) { if (value.some(item => item.id === asset.id)) return; if (value.length >= 10) { setError('Podés agregar hasta 10 recursos.'); return } setError(''); onChange([...value, asset]) }
  function add() { if (!label.trim() || !(/^https:\/\/[^\s]+$/.test(url) || /^\/(?!\/)[a-zA-Z0-9_./%-]+$/.test(url))) { setError('Indicá un nombre y una URL HTTPS o una ruta local válida.'); return } append({ id: crypto.randomUUID(), url, label: label.trim(), kind: imagesOnly ? 'image' : kind, attribution }); setUrl(''); setLabel(''); setAttribution('') }
  return <fieldset disabled={disabled} style={{ border: '1px solid var(--line)', padding: 16, borderRadius: 10, minWidth: 0 }}>
    <legend>{imagesOnly ? 'Galería de fotos' : 'Fotos, videos y modelos'}</legend>
    <p className="small muted">Elegí archivos del gimnasio o subí nuevos. Se vuelven públicos cuando publicás el contenido que los usa.</p>
    {value.map(asset => <div className="list-row" key={asset.id}><div><strong>{asset.label}</strong><p>{asset.kind === 'image' ? 'Foto' : asset.kind === 'video' ? 'Video' : 'Modelo 3D'} · {asset.attribution || 'Sin atribución'}</p></div><button type="button" className="text-button" onClick={() => onChange(value.filter(item => item.id !== asset.id))}>Quitar</button></div>)}
    <Notice error>{error}</Notice>
    {value.length < 10 && <><button type="button" className="button small" style={{ margin: '12px 0' }} onClick={() => setLibraryOpen(current => !current)}>{libraryOpen ? 'Ocultar biblioteca' : 'Elegir de mi biblioteca'}</button>
      {libraryOpen && <MediaLibrary orgId={orgId} disabled={disabled} imagesOnly={imagesOnly} selectedIds={value.map(asset => asset.id)} onChoose={append} />}
      <details style={{ marginTop: 16 }}><summary>Agregar un recurso por enlace</summary><div className="form-grid" style={{ marginTop: 16 }}>{!imagesOnly && <Field label="Tipo de recurso"><select value={kind} onChange={event => setKind(event.target.value as Asset['kind'])}><option value="image">Foto</option><option value="video">Video</option><option value="model3d">Modelo 3D</option></select></Field>}<Field label="Nombre del recurso"><input value={label} maxLength={200} onChange={event => setLabel(event.target.value)} /></Field><Field label="URL del recurso"><input value={url} maxLength={2048} onChange={event => setUrl(event.target.value)} placeholder="https://…" /></Field><Field label="Autor o licencia"><input value={attribution} maxLength={1000} onChange={event => setAttribution(event.target.value)} /></Field></div><button type="button" className="button small" style={{ marginTop: 12 }} onClick={add}>Agregar recurso</button></details>
    </>}
  </fieldset>
}
