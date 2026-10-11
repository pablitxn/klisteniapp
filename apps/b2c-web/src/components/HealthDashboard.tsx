import { useTranslation } from 'react-i18next'
import i18n from '../i18n'
import { useId, useMemo, useState, type ReactNode } from 'react'
import type { HealthData, MeasurementKey, WorkoutLog } from '@klisteniapp/scene-schema'
import { buildHealthDashboard, getBodyTrend, type DashboardPeriod } from '../lib/health-dashboard'
import './health-dashboard.css'

type Destination = 'body' | 'recovery' | 'food' | 'import'
type Metric = { key: MeasurementKey; label: string; unit: string }
const number = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage === 'fr' ? 'fr-FR' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-AR', { maximumFractionDigits: 2 }).format(value)
const dateLabel = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString(i18n.resolvedLanguage === 'fr' ? 'fr-FR' : i18n.resolvedLanguage === 'en' ? 'en-US' : 'es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const dayTime = (date: string) => Date.parse(`${date}T12:00:00Z`)
const duration = (value: number) => { const minutes = Math.round(value); return `${Math.floor(minutes / 60)} h ${minutes % 60} min` }

export default function HealthDashboard({ health, workouts, today, metrics, goals, onSelect }: {
  health: HealthData; workouts: WorkoutLog[]; today: string; metrics: Metric[]; goals: ReactNode; onSelect: (tab: Destination) => void
}) {
  const { t } = useTranslation('health')
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
  return <section className="health-stack health-dashboard" aria-label={t("Dashboard personal")}>
    <div className="health-dashboard-toolbar">
      <div><span className="eyebrow">{t("TU HISTORIA EN PERSPECTIVA")}</span><h3>{t("Cómo venís")}</h3><p>{dateLabel(summary.from)} — {dateLabel(today)} · {period} {t("días, incluido hoy")}</p></div>
      <label>{t("Período del dashboard")}<select value={period} onChange={event => setPeriod(Number(event.target.value) as DashboardPeriod)}><option value={7}>{t("Últimos 7 días")}</option><option value={30}>{t("Últimos 30 días")}</option><option value={90}>{t("Últimos 90 días")}</option></select></label>
    </div>
    <div className="health-metrics">
      <Snapshot label={t("Días de fuerza")} value={`${summary.training.days} / ${period}`} note={t("Días distintos con sesiones guardadas. No cuenta actividad importada como otra sesión.")} />
      <Snapshot label={t("Descanso registrado")} value={summary.sleep.averageMinutes === null ? '—' : duration(summary.sleep.averageMinutes)} note={t("Promedio de {{value0}} días con datos utilizables. {{value1}}", { value0: summary.sleep.validDays, value1: summary.sleep.ambiguousDays ? t('{{value0}} días requieren revisión.', { value0: summary.sleep.ambiguousDays }) : t('Los días sin datos no cuentan.') })} />
      <Snapshot label={t("Días con comidas anotadas")} value={`${summary.nutrition.days} / ${period}`} note={t("{{value0}} registros de comidas. Anotar una comida no implica haber registrado el día completo.", { value0: summary.nutrition.recordCount })} />
    </div>
    {goals}
    <div className="health-dashboard-charts">
      <section className="health-card" aria-label={t("Evolución corporal")}>
        <div className="health-card-heading"><div><h3>{t("Tu evolución corporal")}</h3><p>{t("Una medida y una fuente a la vez.")}</p></div><button className="text-button" onClick={() => onSelect('body')}>{t("Registrar medidas")}</button></div>
        <div className="health-chart-controls">
          <label>{t("Medida del gráfico")}<select value={metric} onChange={event => setMetric(event.target.value as MeasurementKey)}>{metrics.map(item => <option value={item.key} key={item.key}>{item.label}</option>)}</select></label>
          <label>{t("Fuente de las medidas")}<select value={sourceKey} disabled={!summary.bodySources.length} onChange={event => setSource(event.target.value)}>{!summary.bodySources.length && <option value="">{t("Sin fuentes en este período")}</option>}{summary.bodySources.map(item => <option key={item.key} value={item.key}>{item.label.startsWith('Manual') ? t('Manual') + item.label.slice('Manual'.length) : item.label}</option>)}</select></label>
        </div>
        <div className="health-trend-value"><strong>{trend.latest === null ? '—' : `${number(trend.latest)} ${selectedMetric.unit}`}</strong><span>{trend.points.length ? t("Última: {{value0}}", { value0: dateLabel(trend.points.at(-1)!.date) }) : t("Sin medidas en este período")}</span></div>
        <p className="health-trend-change">{trend.change === null ? t("Dos fechas con mediciones permiten comparar cambios.") : t("{{value0}}{{value1}} {{value2}} entre {{value3}} y {{value4}}", { value0: trend.change > 0 ? '+' : '', value1: number(trend.change), value2: selectedMetric.unit === '%' ? t('puntos porcentuales') : selectedMetric.unit, value3: dateLabel(trend.points[0]!.date), value4: dateLabel(trend.points.at(-1)!.date) })}</p>
        <TimeChart points={trend.points} from={summary.from} to={today} label={selectedMetric.label} unit={selectedMetric.unit} />
        <p className="fine-print">{t("Última medición de cada día y fuente. Cada punto es un registro; no estimamos los días sin medición. La escala se ajusta a los valores visibles.")}</p>
        <DataTable label={t("Ver valores corporales")} points={trend.points} unit={selectedMetric.unit} />
      </section>
      <section className="health-card" aria-label={t("Descanso del período")}>
        <div className="health-card-heading"><div><h3>{t("El ritmo de tu descanso")}</h3><p>{t("Horas dormidas por fecha de despertar.")}</p></div><button className="text-button" onClick={() => onSelect('recovery')}>{t("Ver registros")}</button></div>
        <TimeChart points={sleepPoints} from={summary.from} to={today} label={t("Tiempo dormido")} unit="h" bars />
        <p className="fine-print">{summary.sleep.validDays} {t("de")} {period} {t("días con sueño utilizable. Un espacio vacío no equivale a cero horas.")}</p>
        {summary.sleep.ambiguousDays > 0 && <p className="health-note">{summary.sleep.ambiguousDays} {t("días excluidos por registros superpuestos o sin horarios suficientes. Revisalos en Sueño y actividad.")}</p>}
        <details className="health-data-table"><summary>{t("Ver registros de descanso")}</summary><div><table><caption>{t("Días con registros en el período")}</caption><thead><tr><th>{t("Fecha")}</th><th>{t("Tiempo dormido")}</th></tr></thead><tbody>{summary.sleep.days.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.durationMinutes === null ? t("Requiere revisión") : duration(day.durationMinutes)}</td></tr>)}</tbody></table>{!summary.sleep.days.length && <p>{t("Sin registros.")}</p>}</div></details>
      </section>
    </div>
    <section className="health-card" aria-label={t("Constancia de entrenamiento")}>
      <div className="health-card-heading"><div><h3>{t("Volver a entrenar también es avanzar")}</h3><p>{t("Tu historial de fuerza, día por día. Varias sesiones en una fecha cuentan como un día.")}</p></div><strong className="health-training-total">{summary.training.days} {t("días")}</strong></div>
      <div className="health-training-days" aria-label={t("Calendario de fuerza")}>{calendar.map(date => <span key={date} className={trainingDates.has(date) ? 'is-trained' : ''} role="img" aria-label={`${date}: ${trainingDates.has(date) ? t("fuerza registrada") : t("sin sesión registrada")}`} title={`${dateLabel(date)}: ${trainingDates.has(date) ? t("fuerza registrada") : t("sin sesión registrada")}`} />)}</div>
      <div className="health-calendar-caption"><span>{dateLabel(summary.from)}</span><span>{t("■ Fuerza registrada · □ Sin sesión registrada")}</span><span>{dateLabel(today)}</span></div>
      <details className="health-data-table"><summary>{t("Ver fechas de entrenamiento")}</summary><p>{summary.training.dates.length ? summary.training.dates.map(dateLabel).join(' · ') : t("No hay sesiones de fuerza en este período.")}</p></details>
    </section>
    <div className="health-grid">
      <section className="health-card" aria-label={t("Alimentación del período")}><div className="health-card-heading"><div><h3>{t("Lo que anotaste al comer")}</h3><p>{t("Totales de campos conocidos en este período.")}</p></div><button className="text-button" onClick={() => onSelect('food')}>{t("Registrar")}</button></div>
        <dl className="health-food-summary"><div><dt>{t("Energía registrada")}</dt><dd>{summary.nutrition.energyKcal === null ? t("Sin datos") : `${number(summary.nutrition.energyKcal)} kcal`}</dd><small>{summary.nutrition.energyRecords} {t("de")} {summary.nutrition.recordCount} {t("registros con este dato")}</small></div><div><dt>{t("Proteínas registradas")}</dt><dd>{summary.nutrition.proteinG === null ? t("Sin datos") : `${number(summary.nutrition.proteinG)} g`}</dd><small>{summary.nutrition.proteinRecords} {t("de")} {summary.nutrition.recordCount} {t("registros con este dato")}</small></div></dl>
        <p className="fine-print">{t("Son sumas de lo anotado, no tu consumo diario completo ni un cálculo de déficit.")}</p>
      </section>
      <section className="health-card" aria-label={t("Suplementos del período")}><h3>{t("Tu registro de suplementos")}</h3>{summary.supplements.length ? <div className="health-supplement-list">{summary.supplements.map(item => <div key={item.name}><strong>{item.name}</strong><span>{item.taken} {t("tomas registradas ·")} {item.skipped} {t("no tomadas")}</span><small>{item.days} {t("días con anotaciones")}</small></div>)}</div> : <p className="health-empty">{t("Cuando registres una toma, aparecerá acá.")}</p>}<p className="fine-print">{t("Sin un plan de tomas definido no calculamos adherencia ni sugerimos dosis.")}</p></section>
    </div>
    <details className="health-card health-coverage"><summary>{t("Qué datos alimentan este dashboard")}</summary><p className="fine-print">{t("Cantidad y última fecha de observación dentro del período. No representan una sincronización del reloj.")}</p><div className="health-data-table"><table><thead><tr><th>{t("Información")}</th><th>{t("Registros")}</th><th>{t("Última fecha")}</th></tr></thead><tbody>{summary.coverage.map(item => <tr key={item.key}><td>{t(item.label)}</td><td>{item.count}</td><td>{item.latestDate ? dateLabel(item.latestDate) : t("Sin datos")}</td></tr>)}</tbody></table></div></details>
    <div className="health-callout health-sync-note"><div><strong>{t("Tu reloj todavía no está conectado")}</strong>{t("Hoy podés cargar registros o importar un archivo compatible. La conexión automática necesita un puente Android entre Health Connect y tu cuenta.")}</div><button className="secondary-button" onClick={() => onSelect('import')}>{t("Importar datos")}</button></div>
  </section>
}

function Snapshot({ label, value, note }: { label: string; value: string; note: string }) {
  return <div className="health-metric"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
}

function TimeChart({ points, from, to, label, unit, bars = false }: { points: { date: string; value: number }[]; from: string; to: string; label: string; unit: string; bars?: boolean }) {
  const { t } = useTranslation('health')
  const id = useId()
  if (!points.length) return <div className="health-chart-empty">{t("Todavía no hay datos para graficar en estas fechas.")}</div>
  const values = points.map(point => point.value)
  const minimum = Math.min(...values), maximum = Math.max(...values)
  const padding = Math.max((maximum - minimum) * .2, maximum * .015, .5)
  const low = bars ? 0 : Math.max(0, minimum - padding), high = maximum + padding
  const x = (date: string) => 52 + ((dayTime(date) - dayTime(from)) / Math.max(86400000, dayTime(to) - dayTime(from))) * 480
  const y = (value: number) => 160 - (value - low) / (high - low) * 140
  const ticks = [low, (low + high) / 2, high]
  const barWidth = Math.min(22, 340 / ((dayTime(to) - dayTime(from)) / 86400000 + 1))
  return <figure className="health-time-chart"><svg viewBox="0 0 560 195" role="img" aria-labelledby={`${id}-title ${id}-description`}>
    <title id={`${id}-title`}>{label} {t("por fecha")}</title><desc id={`${id}-description`}>{points.length} {t("fechas con datos entre")} {from} {t("y")} {to}{t(". Valores en")} {unit}{t("; mínimo")} {number(minimum)}{t(", máximo")} {number(maximum)}{t(". Los valores están en la tabla siguiente, con hasta dos decimales.")}</desc>
    {ticks.map((tick, index) => <g key={index}><line x1="52" x2="532" y1={y(tick)} y2={y(tick)} className="health-chart-grid" /><text x="43" y={y(tick) + 4} textAnchor="end">{number(tick)}</text></g>)}
    {points.map(point => bars ? <rect key={point.date} x={x(point.date) - barWidth / 2} y={y(point.value)} width={barWidth} height={Math.max(0, 160 - y(point.value))} rx="2" className="health-chart-bar" /> : <circle key={point.date} cx={x(point.date)} cy={y(point.value)} r="4" className="health-chart-dot" />)}
    <text x="52" y="187">{dateLabel(from)}</text><text x="532" y="187" textAnchor="end">{dateLabel(to)}</text><text x="52" y="11">{unit}</text>
  </svg></figure>
}

function DataTable({ label, points, unit }: { label: string; points: { date: string; value: number }[]; unit: string }) {
  const { t } = useTranslation('health')
  return <details className="health-data-table"><summary>{label}</summary>{points.length ? <div><table><caption>{t("Última medición diaria de la fuente seleccionada")}</caption><thead><tr><th>{t("Fecha")}</th><th>{t("Valor (")}{unit})</th></tr></thead><tbody>{points.map(point => <tr key={point.date}><td>{point.date}</td><td>{number(point.value)}</td></tr>)}</tbody></table></div> : <p>{t("Sin mediciones.")}</p>}</details>
}
