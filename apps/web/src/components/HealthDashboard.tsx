import { useId, useMemo, useState, type ReactNode } from 'react'
import type { HealthData, MeasurementKey, WorkoutLog } from '@klisteniapp/scene-schema'
import { buildHealthDashboard, getBodyTrend, type DashboardPeriod } from '../lib/health-dashboard'
import './health-dashboard.css'

type Destination = 'body' | 'recovery' | 'food' | 'import'
type Metric = { key: MeasurementKey; label: string; unit: string }
const number = (value: number) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayTime = (date: string) => Date.parse(`${date}T12:00:00Z`)
const duration = (value: number) => { const minutes = Math.round(value); return `${Math.floor(minutes / 60)} h ${minutes % 60} min` }

export default function HealthDashboard({ health, workouts, today, metrics, goals, onSelect }: {
  health: HealthData; workouts: WorkoutLog[]; today: string; metrics: Metric[]; goals: ReactNode; onSelect: (tab: Destination) => void
}) {
  const [period, setPeriod] = useState<DashboardPeriod>(30)
  const [metric, setMetric] = useState<MeasurementKey>('weightKg')
  const [source, setSource] = useState('')
  const summary = useMemo(() => buildHealthDashboard(health, workouts, today, period), [health, workouts, today, period])
  const sourceKey = summary.bodySources.some(item => item.key === source) ? source : summary.bodySources[0]?.key ?? ''
  const selectedMetric = metrics.find(item => item.key === metric)!
  const trend = useMemo(() => getBodyTrend(health, metric, sourceKey, summary.from, summary.to), [health, metric, sourceKey, summary.from, summary.to])
  const trainingDates = new Set(summary.training.dates)
  const calendar = Array.from({ length: period }, (_, index) => new Date(dayTime(summary.from) + index * 86400000).toISOString().slice(0, 10))
  const sleepPoints = summary.sleep.days.filter(day => day.durationMinutes !== null).map(day => ({ date: day.date, value: day.durationMinutes! / 60 }))
  return <section className="health-stack health-dashboard" aria-label="Dashboard personal">
    <div className="health-dashboard-toolbar">
      <div><span className="eyebrow">TU HISTORIA EN PERSPECTIVA</span><h3>Cómo venís</h3><p>{dateLabel(summary.from)} — {dateLabel(today)} · {period} días, incluido hoy</p></div>
      <label>Período del dashboard<select value={period} onChange={event => setPeriod(Number(event.target.value) as DashboardPeriod)}><option value={7}>Últimos 7 días</option><option value={30}>Últimos 30 días</option><option value={90}>Últimos 90 días</option></select></label>
    </div>
    <div className="health-metrics">
      <Snapshot label="Días de fuerza" value={`${summary.training.days} / ${period}`} note="Días distintos con sesiones guardadas. No cuenta actividad importada como otra sesión." />
      <Snapshot label="Descanso registrado" value={summary.sleep.averageMinutes === null ? '—' : duration(summary.sleep.averageMinutes)} note={`Promedio de ${summary.sleep.validDays} días con datos utilizables. ${summary.sleep.ambiguousDays ? `${summary.sleep.ambiguousDays} días requieren revisión.` : 'Los días sin datos no cuentan.'}`} />
      <Snapshot label="Días con comidas anotadas" value={`${summary.nutrition.days} / ${period}`} note={`${summary.nutrition.recordCount} registros de comidas. Anotar una comida no implica haber registrado el día completo.`} />
    </div>
    {goals}
    <div className="health-dashboard-charts">
      <section className="health-card" aria-label="Evolución corporal">
        <div className="health-card-heading"><div><h3>Tu evolución corporal</h3><p>Una medida y una fuente a la vez.</p></div><button className="text-button" onClick={() => onSelect('body')}>Registrar medidas</button></div>
        <div className="health-chart-controls">
          <label>Medida del gráfico<select value={metric} onChange={event => setMetric(event.target.value as MeasurementKey)}>{metrics.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
          <label>Fuente de las medidas<select value={sourceKey} disabled={!summary.bodySources.length} onChange={event => setSource(event.target.value)}>{!summary.bodySources.length && <option value="">Sin fuentes en este período</option>}{summary.bodySources.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label>
        </div>
        <div className="health-trend-value"><strong>{trend.latest === null ? '—' : `${number(trend.latest)} ${selectedMetric.unit}`}</strong><span>{trend.points.length ? `Última: ${dateLabel(trend.points.at(-1)!.date)}` : 'Sin medidas en este período'}</span></div>
        <p className="health-trend-change">{trend.change === null ? 'Dos fechas con mediciones permiten comparar cambios.' : `${trend.change > 0 ? '+' : ''}${number(trend.change)} ${selectedMetric.unit === '%' ? 'puntos porcentuales' : selectedMetric.unit} entre ${dateLabel(trend.points[0]!.date)} y ${dateLabel(trend.points.at(-1)!.date)}`}</p>
        <TimeChart points={trend.points} from={summary.from} to={today} label={selectedMetric.label} unit={selectedMetric.unit} />
        <p className="fine-print">Última medición de cada día y fuente. Cada punto es un registro; no estimamos los días sin medición. La escala se ajusta a los valores visibles.</p>
        <DataTable label="Ver valores corporales" points={trend.points} unit={selectedMetric.unit} />
      </section>
      <section className="health-card" aria-label="Descanso del período">
        <div className="health-card-heading"><div><h3>El ritmo de tu descanso</h3><p>Horas dormidas por fecha de despertar.</p></div><button className="text-button" onClick={() => onSelect('recovery')}>Ver registros</button></div>
        <TimeChart points={sleepPoints} from={summary.from} to={today} label="Tiempo dormido" unit="h" bars />
        <p className="fine-print">{summary.sleep.validDays} de {period} días con sueño utilizable. Un espacio vacío no equivale a cero horas.</p>
        {summary.sleep.ambiguousDays > 0 && <p className="health-note">{summary.sleep.ambiguousDays} días excluidos por registros superpuestos o sin horarios suficientes. Revisalos en Sueño y actividad.</p>}
        <details className="health-data-table"><summary>Ver registros de descanso</summary><div><table><caption>Días con registros en el período</caption><thead><tr><th>Fecha</th><th>Tiempo dormido</th></tr></thead><tbody>{summary.sleep.days.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.durationMinutes === null ? 'Requiere revisión' : duration(day.durationMinutes)}</td></tr>)}</tbody></table>{!summary.sleep.days.length && <p>Sin registros.</p>}</div></details>
      </section>
    </div>
    <section className="health-card" aria-label="Constancia de entrenamiento">
      <div className="health-card-heading"><div><h3>Volver a entrenar también es avanzar</h3><p>Tu historial de fuerza, día por día. Varias sesiones en una fecha cuentan como un día.</p></div><strong className="health-training-total">{summary.training.days} días</strong></div>
      <div className="health-training-days" aria-label="Calendario de fuerza">{calendar.map(date => <span key={date} className={trainingDates.has(date) ? 'is-trained' : ''} role="img" aria-label={`${date}: ${trainingDates.has(date) ? 'fuerza registrada' : 'sin sesión registrada'}`} title={`${dateLabel(date)}: ${trainingDates.has(date) ? 'fuerza registrada' : 'sin sesión registrada'}`} />)}</div>
      <div className="health-calendar-caption"><span>{dateLabel(summary.from)}</span><span>■ Fuerza registrada · □ Sin sesión registrada</span><span>{dateLabel(today)}</span></div>
      <details className="health-data-table"><summary>Ver fechas de entrenamiento</summary><p>{summary.training.dates.length ? summary.training.dates.map(dateLabel).join(' · ') : 'No hay sesiones de fuerza en este período.'}</p></details>
    </section>
    <div className="health-grid">
      <section className="health-card" aria-label="Alimentación del período"><div className="health-card-heading"><div><h3>Lo que anotaste al comer</h3><p>Totales de campos conocidos en este período.</p></div><button className="text-button" onClick={() => onSelect('food')}>Registrar</button></div>
        <dl className="health-food-summary"><div><dt>Energía registrada</dt><dd>{summary.nutrition.energyKcal === null ? 'Sin datos' : `${number(summary.nutrition.energyKcal)} kcal`}</dd><small>{summary.nutrition.energyRecords} de {summary.nutrition.recordCount} registros con este dato</small></div><div><dt>Proteínas registradas</dt><dd>{summary.nutrition.proteinG === null ? 'Sin datos' : `${number(summary.nutrition.proteinG)} g`}</dd><small>{summary.nutrition.proteinRecords} de {summary.nutrition.recordCount} registros con este dato</small></div></dl>
        <p className="fine-print">Son sumas de lo anotado, no tu consumo diario completo ni un cálculo de déficit.</p>
      </section>
      <section className="health-card" aria-label="Suplementos del período"><h3>Tu registro de suplementos</h3>{summary.supplements.length ? <div className="health-supplement-list">{summary.supplements.map(item => <div key={item.name}><strong>{item.name}</strong><span>{item.taken} tomas registradas · {item.skipped} no tomadas</span><small>{item.days} días con anotaciones</small></div>)}</div> : <p className="health-empty">Cuando registres una toma, aparecerá acá.</p>}<p className="fine-print">Sin un plan de tomas definido no calculamos adherencia ni sugerimos dosis.</p></section>
    </div>
    <details className="health-card health-coverage"><summary>Qué datos alimentan este dashboard</summary><p className="fine-print">Cantidad y última fecha de observación dentro del período. No representan una sincronización del reloj.</p><div className="health-data-table"><table><thead><tr><th>Información</th><th>Registros</th><th>Última fecha</th></tr></thead><tbody>{summary.coverage.map(item => <tr key={item.key}><td>{item.label}</td><td>{item.count}</td><td>{item.latestDate ? dateLabel(item.latestDate) : 'Sin datos'}</td></tr>)}</tbody></table></div></details>
    <div className="health-callout health-sync-note"><div><strong>Tu reloj todavía no está conectado</strong>Hoy podés cargar registros o importar un archivo compatible. La conexión automática necesita un puente Android entre Health Connect y tu cuenta.</div><button className="secondary-button" onClick={() => onSelect('import')}>Importar datos</button></div>
  </section>
}

function Snapshot({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="health-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function TimeChart({ points, from, to, label, unit, bars = false }: { points: { date: string; value: number }[]; from: string; to: string; label: string; unit: string; bars?: boolean }) {
  const id = useId()
  if (!points.length) return <div className="health-chart-empty">Todavía no hay datos para graficar en estas fechas.</div>
  const values = points.map(point => point.value)
  const minimum = Math.min(...values), maximum = Math.max(...values)
  const padding = Math.max((maximum - minimum) * .2, maximum * .015, .5)
  const low = bars ? 0 : Math.max(0, minimum - padding), high = maximum + padding
  const x = (date: string) => 52 + ((dayTime(date) - dayTime(from)) / Math.max(86400000, dayTime(to) - dayTime(from))) * 480
  const y = (value: number) => 160 - (value - low) / (high - low) * 140
  const ticks = [low, (low + high) / 2, high]
  const barWidth = Math.min(22, 340 / ((dayTime(to) - dayTime(from)) / 86400000 + 1))
  return <figure className="health-time-chart"><svg viewBox="0 0 560 195" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{label} por fecha</title><desc id={`${id}-description`}>{points.length} fechas con datos entre {from} y {to}. Valores en {unit}; mínimo {number(minimum)}, máximo {number(maximum)}. Los valores están en la tabla siguiente, con hasta dos decimales.</desc>
    {ticks.map((tick, index) => <g key={index}><line x1="52" x2="532" y1={y(tick)} y2={y(tick)} className="health-chart-grid" /><text x="43" y={y(tick) + 4} textAnchor="end">{number(tick)}</text></g>)}
    {points.map(point => bars ? <rect key={point.date} x={x(point.date) - barWidth / 2} y={y(point.value)} width={barWidth} height={Math.max(0, 160 - y(point.value))} rx="2" className="health-chart-bar" /> : <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r="4" className="health-chart-dot" />)}
    <text x="52" y="187">{dateLabel(from)}</text><text x="532" y="187" textAnchor="end">{dateLabel(to)}</text><text x="52" y="11">{unit}</text>
  </svg></figure>
}

function DataTable({ label, points, unit }: { label: string; points: { date: string; value: number }[]; unit: string }) {
  return <details className="health-data-table"><summary>{label}</summary>{points.length ? <div><table><caption>Última medición diaria de la fuente seleccionada</caption><thead><tr><th>Fecha</th><th>Valor ({unit})</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{number(point.value)}</td></tr>)}</tbody></table></div> : <p>Sin mediciones.</p>}</details>
}
