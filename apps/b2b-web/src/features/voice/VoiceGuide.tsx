import { useContext, useEffect, useRef, useState } from 'react'
import type { VoiceState } from './guidedSpeech'
import { GuidedSpeech, sideInstruction } from './guidedSpeech'
import { VoiceCapability } from './voiceCapability'

export function VoiceGuide({ name, instructions }: { name: string; instructions: string[] }) {
  const enabled = useContext(VoiceCapability)
  const [state, setState] = useState<VoiceState>('idle')
  const controller = useRef<GuidedSpeech | null>(null)
  const supported =
    typeof window !== 'undefined' &&
    typeof window.speechSynthesis?.speak === 'function' &&
    typeof window.SpeechSynthesisUtterance === 'function'
  const sideCue = sideInstruction(instructions)

  useEffect(() => {
    if (!supported || !enabled) return
    const guide = new GuidedSpeech(
      window.speechSynthesis,
      (text) => new SpeechSynthesisUtterance(text),
      setState,
    )
    controller.current = guide
    return () => {
      guide.stop()
      controller.current = null
    }
  }, [supported, enabled])

  if (!enabled) return null

  if (!supported) {
    return (
      <p className="small muted">
        La lectura en voz no está disponible en este navegador. Seguí las instrucciones escritas.
      </p>
    )
  }

  const playing = state === 'speaking' || state === 'paused'
  return (
    <section className="voice-guide" aria-label={`Voz guiada de ${name}`}>
      <p className="small muted">
        Escuchá estas instrucciones con la voz de tu navegador. El audio es opcional y no registra
        series.
      </p>
      <div className="row">
        {!playing ? (
          <button
            type="button"
            className="button small"
            onClick={() => controller.current?.start([name, ...instructions])}
          >
            {state === 'finished' ? 'Volver a escuchar' : 'Escuchar instrucciones'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="button small"
              onClick={() =>
                state === 'paused' ? controller.current?.resume() : controller.current?.pause()
              }
            >
              {state === 'paused' ? 'Reanudar voz' : 'Pausar voz'}
            </button>
            <button
              type="button"
              className="button small"
              onClick={() => controller.current?.stop()}
            >
              Detener voz
            </button>
          </>
        )}
        {sideCue && (
          <button
            type="button"
            className="text-button small"
            onClick={() => controller.current?.start([sideCue])}
          >
            Escuchar indicación de cambio de lado
          </button>
        )}
      </div>
      <p className="small" role="status">
        {state === 'speaking'
          ? 'Leyendo instrucciones.'
          : state === 'paused'
            ? 'Voz en pausa.'
            : state === 'finished'
              ? 'Lectura finalizada.'
              : state === 'error'
                ? 'No pudimos reproducir la voz. Podés reintentar o seguir el texto.'
                : ''}
      </p>
    </section>
  )
}
