import { useEffect, useState } from 'react'
import { formatRest, pauseRest, remainingRest, resumeRest, startRest } from './restClock'
import type { RestClock } from './restClock'

export function RestTimer({ seconds, movement }: { seconds: number; movement: string }) {
  const [clock, setClock] = useState<RestClock | null>(null)
  const [now, setNow] = useState(Date.now)
  const remaining = clock ? remainingRest(clock, now) : seconds * 1000
  const running = Boolean(clock?.deadline !== null && clock && remaining > 0)
  const paused = clock?.deadline === null && remaining > 0
  const finished = Boolean(clock && remaining === 0)

  useEffect(() => {
    if (!running) return
    const update = () => setNow(Date.now())
    const interval = window.setInterval(update, 250)
    document.addEventListener('visibilitychange', update)
    window.addEventListener('focus', update)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', update)
      window.removeEventListener('focus', update)
    }
  }, [running])

  if (seconds <= 0) return null

  return (
    <section className="rest-timer" aria-label={`Descanso de ${movement}`}>
      <div>
        <strong>Descanso</strong>{' '}
        <span className="rest-time" role="timer" aria-label="Tiempo de descanso restante">
          {formatRest(remaining)}
        </span>
        <p className="small muted" role="status">
          {finished
            ? 'Terminó el descanso. Continuá cuando estés listo.'
            : paused
              ? 'Descanso en pausa.'
              : running
                ? 'El tiempo sigue contando aunque cambies de pestaña.'
                : 'El temporizador no marca series ni guarda la sesión.'}
        </p>
      </div>
      <div className="row">
        {!clock || finished ? (
          <button
            type="button"
            className="button small"
            onClick={() => {
              const timestamp = Date.now()
              setNow(timestamp)
              setClock(startRest(seconds, timestamp))
            }}
          >
            {finished ? 'Repetir descanso' : 'Iniciar descanso'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="button small"
              onClick={() => {
                const timestamp = Date.now()
                setNow(timestamp)
                setClock(paused ? resumeRest(clock, timestamp) : pauseRest(clock, timestamp))
              }}
            >
              {paused ? 'Reanudar descanso' : 'Pausar descanso'}
            </button>
            <button type="button" className="text-button small" onClick={() => setClock(null)}>
              Detener descanso
            </button>
          </>
        )}
      </div>
    </section>
  )
}
