import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { computeProgress, localDateKey } from '../lib/progress'
import { useAppStore } from '../lib/store'
import { getExercise } from '../data/exercises'
import { computePlanProgress, dateInTimeZone, planWeekStart } from '@klisteniapp/scene-schema'
import Icon from './Icon'
const labels: Record<string, string> = {
  walk: 'Caminata',
  run: 'Trote',
  bike: 'Bici',
  other: 'Actividad aeróbica',
}
function dateLabel(date: string, locale: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
  })
}
export default function Progress({
  onCardio,
  onStart,
}: {
  onCardio: () => void
  onStart: () => void
}) {
  const { t, i18n } = useTranslation('core')

  const data = useAppStore((s) => s.progress),
    remove = useAppStore((s) => s.removeLog),
    preferences = useAppStore((s) => s.preferences),
    [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const timeZone = useAppStore(s => s.personalData?.settings.profile.timeZone)
  const plans = useAppStore(s => s.personalData?.settings.plans)
  const todayKey = timeZone ? dateInTimeZone(new Date(), timeZone) : localDateKey()
  const today = new Date(`${todayKey}T12:00:00`)
  const stats = computeProgress(data.workouts, data.cardio, today)
  const planStats = plans ? computePlanProgress(plans, data.workouts, todayKey) : null
  const monday = new Date(`${planWeekStart(todayKey)}T12:00:00`)
  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    return {
      key: localDateKey(day),
      label: day.toLocaleDateString(i18n.resolvedLanguage ?? 'es', { weekday: 'narrow' }),
      number: day.getDate(),
    }
  })
  const logs = [
    ...data.workouts.map((log) => ({ ...log, kind: 'workout' as const })),
    ...data.cardio.map((log) => ({ ...log, kind: 'cardio' as const })),
  ].sort((a, b) => b.date.localeCompare(a.date))
  return (
    <section className="progress-section">
      {error && <p role="alert" className="form-error">{error}</p>}
      <div className="progress-top">
        <div className="week-card">
          <div className="section-heading">
            <h2>{t("Una semana a tu ritmo")}</h2>
            <span className="pill">{t("{{count}} días activos", { count: stats.weeklyActiveDays })}</span>
          </div>
          <div className="week-days">
            {days.map((day) => (
              <div
                key={day.key}
                className={`${stats.activeDays.includes(day.key) ? 'done' : ''} ${day.key === localDateKey(today) ? 'today' : ''} ${planStats?.scheduledDates.includes(day.key) ? 'planned' : ''}`}
                title={planStats?.scheduledDates.includes(day.key) ? t("Día previsto para entrenar") : undefined}
              >
                <small>{day.label}</small>
                <span>
                  {stats.activeDays.includes(day.key) ? (
                    <Icon name="check" size={20} />
                  ) : (
                    day.number
                  )}
                </span>
                <i />
              </div>
            ))}
          </div>
          <p>
            {planStats ? planStats.weeklyTarget === 0 ? t("Elegí tus días en Mi cuenta y planificación para empezar a seguir tu semana.") : planStats.weeklyCompleted >= planStats.weeklyTarget ? t("Cumpliste tu plan semanal. También hay lugar para descansar.") : t("Tu plan: {{completed}} de {{target}} días de fuerza. Los días previstos se marcan con un punto.", { completed: planStats.weeklyCompleted, target: planStats.weeklyTarget }) : stats.weeklyWorkouts >= preferences.weeklyGoal
              ? t("Cumpliste tu objetivo semanal. También hay lugar para descansar.")
              : t("Tu objetivo: {{count}} sesiones de fuerza. El descanso es parte del proceso.", { count: preferences.weeklyGoal })}
          </p>
        </div>
        <div className="xp-card">
          <Icon name="spark" size={32} />
          <span className="eyebrow">{t("APRENDIZ DE MOVIMIENTO")}</span>
          <h2>{t("Nivel")} {stats.level}</h2>
          <div className="xp-track">
            <span style={{ width: `${stats.levelProgress}%` }} />
          </div>
          <p>{t("{{count}} / 100 XP al próximo nivel", { count: stats.levelProgress })}</p>
          <small>{t("Fuerza: 10 XP por serie registrada.")}<br />{t("Aeróbico: 1 XP por minuto registrado.")}</small>
        </div>
      </div>
      <div className="section-heading">
        <h2>{t("Tu historia de movimiento")}</h2>
        <button className="text-button" onClick={onCardio}>
          <Icon name="plus" size={16} /> {t("Agregar actividad")}</button>
      </div>
      {logs.length === 0 ? (
        <div className="empty-state">
          <span className="empty-illustration">
            <Icon name="walk" size={46} />
          </span>
          <h3>{t("Tu primer paso todavía está por escribir.")}</h3>
          <p>{t("Cuando termines una rutina o registres actividad aeróbica,")}<br />{t("vas a encontrarla acá. Sin apuro.")}</p>
          <button className="primary-button" onClick={onStart}>{t("Explorar mi rutina")}<Icon name="arrow" size={17} />
          </button>
        </div>
      ) : (
        <div className="activity-history">
          {logs.map((log) => (
            <article key={log.id}>
              <span
                className={`stat-icon ${log.kind === 'workout' ? 'purple' : 'green'}`}
              >
                <Icon name={log.kind === 'workout' ? 'body' : 'walk'} />
              </span>
              <div className="history-copy">
                <h3>
                  {log.kind === 'workout'
                    ? t("Rutina de fuerza")
                    : t(labels[log.activity]!)}
                </h3>
                <p>
                  {log.kind === 'workout'
                    ? t("{{exercises}} ejercicios · {{sets}} series · {{minutes}} min", { exercises: new Set(log.exercises.map((e) => e.exerciseId)).size, sets: log.exercises.reduce((n, e) => n + e.sets, 0), minutes: Math.max(1, Math.round(log.durationMinutes)) })
                    : `${log.minutes.toLocaleString(i18n.resolvedLanguage ?? 'es')} min${log.distanceKm ? ` · ${log.distanceKm.toLocaleString(i18n.resolvedLanguage ?? 'es')} km` : ''}`}
                </p>
                {log.kind === 'workout' && (
                  <details>
                    <summary>{t("Ver series")}</summary>
                    {log.exercises.map((e, i) => (
                      <p key={i}>
                        {t(getExercise(e.exerciseId)?.shortName ?? e.exerciseId)} · {e.sets} ×{' '}
                        {e.reps}
                        {getExercise(e.exerciseId)?.reps.perSide
                          ? t(" por lado")
                          : ''}
                      </p>
                    ))}
                  </details>
                )}
              </div>
              <time dateTime={log.date}>{dateLabel(log.date, i18n.resolvedLanguage ?? 'es')}</time>
              {deleting === log.id ? (
                <div className="delete-confirm">
                  <span>{t("¿Eliminar registro?")}</span>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true)
                      const failure = await remove(log.id)
                      setError(failure ?? '')
                      setBusy(false)
                      if (!failure) setDeleting(null)
                    }}
                  >{t("Sí, eliminar")}</button>
                  <button
                    className="text-button"
                    onClick={() => setDeleting(null)}
                  >{t("Cancelar")}</button>
                </div>
              ) : (
                <button
                  className="icon-button"
                  aria-label={t("Eliminar {{activity}} del {{date}}", { activity: log.kind === 'workout' ? t("rutina") : t(labels[log.activity]!), date: dateLabel(log.date, i18n.resolvedLanguage ?? 'es') })}
                  onClick={() => setDeleting(log.id)}
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="fine-print">{t("La racha cuenta días locales consecutivos con actividad registrada. Descansar puede cortar la racha, pero no quita XP ni progreso. No es una recomendación de entrenar a diario.")}</p>
    </section>
  )
}
