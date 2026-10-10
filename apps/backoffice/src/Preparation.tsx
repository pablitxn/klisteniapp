import type { SetupProgress } from '@klisteniapp/b2b-contracts'
import { Heading } from './shared'

export type PreparationPage = 'brand' | 'equipment' | 'catalog' | 'website' | 'media' | 'qr'
const destinations: Record<SetupProgress['checks'][number]['id'], PreparationPage> = { brand: 'brand', inventory: 'equipment', content: 'catalog', activities: 'website', hours: 'website', gallery: 'website', website: 'website' }
const descriptions: Record<SetupProgress['checks'][number]['id'], string> = {
  brand: 'Nombre, identidad visual y datos de contacto que acompañan a tu comunidad.',
  inventory: 'Elegí modelos de la biblioteca y registrá cada unidad física con sus ajustes.',
  content: 'Adaptá ejercicios para tus equipos, revisá las instrucciones y publicá el contenido.',
  activities: 'Presentá las actividades y clases que ofrece tu gimnasio.',
  hours: 'Informá los días y horarios en los que pueden encontrarte.',
  gallery: 'Sumá fotos reales del espacio desde tu biblioteca de archivos.',
  website: 'Revisá el conjunto y publicá la web que recibirán tus visitantes.',
}
export function Preparation({ progress, readyQrCount, onGo }: { progress: SetupProgress; readyQrCount: number; onGo: (page: PreparationPage) => void }) {
  return <><Heading title="Preparemos tu gimnasio." description="Un recorrido para cargar el espacio, reutilizar la biblioteca y dejar cada equipo listo para probar. El avance se calcula con lo que ya guardaste." />
    <section className="card" style={{ marginBottom: 24 }}><div className="row spread"><h2 style={{ margin: 0 }}>{progress.completed} de {progress.total} pasos completos</h2><span className="pill">{Math.round(progress.completed / Math.max(1, progress.total) * 100)} %</span></div><div className="progress-track" role="progressbar" aria-label="Preparación del gimnasio" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed}><span style={{ width: `${progress.completed / Math.max(1, progress.total) * 100}%` }} /></div></section>
    <div className="grid two">{progress.checks.map((step, index) => <article className="card preparation-step" key={step.id}><span className={`step-number ${step.complete ? 'complete' : ''}`} aria-hidden="true">{step.complete ? '✓' : index + 1}</span><div><span className="small muted">{step.complete ? 'Completo' : 'Por preparar'}</span><h2 style={{ fontSize: '1.3rem', marginTop: 6 }}>{step.label}</h2><p className="muted small">{descriptions[step.id]}</p><button className="text-button" onClick={() => onGo(destinations[step.id])}>{step.complete ? 'Revisar este paso' : 'Preparar este paso'} →</button></div></article>)}</div>
    <section className="card" style={{ marginTop: 24 }}><p className="eyebrow">DEL WEBSITE AL ESPACIO FÍSICO</p><h2>{readyQrCount ? `${readyQrCount} equipos listos para imprimir` : 'El último paso: tus etiquetas QR'}</h2><p className="muted">Cada QR abre la ficha pública de una unidad concreta. Prepará un lote, imprimilo y comprobá cada enlace con un teléfono antes de pegar las etiquetas.</p><div className="row"><button className="button primary" onClick={() => onGo('qr')}>Preparar etiquetas QR</button><button className="text-button" onClick={() => onGo('media')}>Administrar archivos del gimnasio</button></div></section>
  </>
}
