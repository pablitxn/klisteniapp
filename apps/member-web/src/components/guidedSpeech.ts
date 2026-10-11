export type VoiceState = 'idle' | 'speaking' | 'paused' | 'finished' | 'error'
export type SpeechEngine = Pick<
  SpeechSynthesis,
  'speak' | 'cancel' | 'pause' | 'resume' | 'getVoices'
>
type CreateUtterance = (text: string) => SpeechSynthesisUtterance

const activeGuides = new WeakMap<SpeechEngine, GuidedSpeech>()

/** Speak only authored text. Timers and speech never create training records. */
export function sideInstruction(instructions: string[]): string | undefined {
  return instructions.find((instruction) =>
    /(?:otro\s+lado|otra\s+(?:pierna|mano)|cambi\p{L}*\s+(?:de\s+)?lado|altern\p{L}*\s+(?:los\s+)?lados)/iu.test(
      instruction,
    ),
  )
}

/** Own a single browser voice queue, ignoring callbacks from cancelled instructions. */
export class GuidedSpeech {
  private generation = 0
  private state: VoiceState = 'idle'
  private utterance: SpeechSynthesisUtterance | null = null
  private readonly engine: SpeechEngine
  private readonly createUtterance: CreateUtterance
  private readonly onState: (state: VoiceState) => void

  constructor(
    engine: SpeechEngine,
    createUtterance: CreateUtterance,
    onState: (state: VoiceState) => void,
  ) {
    this.engine = engine
    this.createUtterance = createUtterance
    this.onState = onState
  }

  private update(state: VoiceState) {
    this.state = state
    this.onState(state)
  }

  start(instructions: string[]) {
    activeGuides.get(this.engine)?.stop()
    this.stop()
    const text = instructions.map((line) => line.trim()).filter(Boolean)
    if (!text.length) return
    activeGuides.set(this.engine, this)
    const generation = this.generation
    this.update('speaking')
    const speak = (index: number) => {
      if (generation !== this.generation) return
      if (index >= text.length) {
        this.utterance = null
        activeGuides.delete(this.engine)
        this.update('finished')
        return
      }
      const utterance = this.createUtterance(text[index])
      this.utterance = utterance
      utterance.lang = 'es-AR'
      const voices = this.engine.getVoices()
      const voice =
        voices.find((item) => item.lang.toLowerCase() === 'es-ar') ??
        voices.find((item) => item.lang.toLowerCase().startsWith('es'))
      if (voice) utterance.voice = voice
      utterance.onend = () => speak(index + 1)
      utterance.onerror = () => {
        if (generation !== this.generation) return
        this.generation += 1
        this.utterance = null
        activeGuides.delete(this.engine)
        this.update('error')
      }
      try {
        this.engine.speak(utterance)
      } catch {
        if (generation === this.generation) {
          this.generation += 1
          this.utterance = null
          activeGuides.delete(this.engine)
          this.update('error')
        }
      }
    }
    speak(0)
  }

  pause() {
    if (this.state !== 'speaking') return
    this.engine.pause()
    this.update('paused')
  }

  resume() {
    if (this.state !== 'paused') return
    this.engine.resume()
    this.update('speaking')
  }

  stop() {
    this.generation += 1
    if (this.utterance) {
      this.utterance.onend = null
      this.utterance.onerror = null
    }
    if (activeGuides.get(this.engine) === this) {
      activeGuides.delete(this.engine)
      // Some engines retain their paused flag after cancel; release it before reuse.
      this.engine.cancel()
      this.engine.resume()
    }
    this.utterance = null
    this.update('idle')
  }
}
