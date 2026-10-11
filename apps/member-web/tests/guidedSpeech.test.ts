import assert from 'node:assert/strict'
import test from 'node:test'
import { GuidedSpeech, sideInstruction } from '../src/components/guidedSpeech.ts'
import type { SpeechEngine, VoiceState } from '../src/components/guidedSpeech.ts'

function speechDevice() {
  const utterances: SpeechSynthesisUtterance[] = []
  const actions: string[] = []
  const engine: SpeechEngine = {
    speak: (utterance) => {
      utterances.push(utterance)
      actions.push('speak')
    },
    pause: () => {
      actions.push('pause')
    },
    resume: () => {
      actions.push('resume')
    },
    cancel: () => {
      actions.push('cancel')
    },
    getVoices: () => [],
  }
  const create = (text: string) =>
    ({
      text,
      lang: '',
      voice: null,
      onend: null,
      onerror: null,
    }) as unknown as SpeechSynthesisUtterance
  const states: VoiceState[] = []
  const guide = new GuidedSpeech(engine, create, (state) => states.push(state))
  return { engine, create, guide, states, actions, utterances }
}

test('voice reads only requested text in order, can pause/resume, and finishes', () => {
  const { guide, utterances, actions, states } = speechDevice()
  assert.equal(utterances.length, 0)
  guide.start(['Ejercicio', 'Primera instrucción.', 'Segunda instrucción.'])
  assert.equal(utterances[0].text, 'Ejercicio')
  assert.equal(utterances[0].lang, 'es-AR')
  utterances[0].onend?.({} as SpeechSynthesisEvent)
  assert.equal(utterances[1].text, 'Primera instrucción.')
  guide.pause()
  guide.pause()
  assert.equal(actions.filter((action) => action === 'pause').length, 1)
  assert.equal(states.at(-1), 'paused')
  guide.resume()
  assert.equal(states.at(-1), 'speaking')
  utterances[1].onend?.({} as SpeechSynthesisEvent)
  utterances[2].onend?.({} as SpeechSynthesisEvent)
  assert.equal(states.at(-1), 'finished')
})

test('cancelled callbacks cannot resume speech, and disposing an old guide cannot stop the new one', () => {
  const { guide, engine, create, utterances, actions } = speechDevice()
  guide.start(['First exercise', 'Must never play'])
  const delayedEnd = utterances[0].onend!
  const next = new GuidedSpeech(engine, create, () => undefined)
  next.start(['Second exercise'])
  assert.equal(utterances.length, 2)
  delayedEnd.call(utterances[0], {} as SpeechSynthesisEvent)
  assert.equal(utterances.length, 2)
  const cancellations = actions.filter((action) => action === 'cancel').length
  guide.stop()
  assert.equal(actions.filter((action) => action === 'cancel').length, cancellations)
  next.stop()
  assert.equal(actions.filter((action) => action === 'cancel').length, cancellations + 1)
})

test('voice failures return a recoverable error without advancing instructions', () => {
  const { guide, utterances, states } = speechDevice()
  guide.start(['First instruction', 'Second instruction'])
  const lateEnd = utterances[0].onend!
  utterances[0].onerror?.({} as SpeechSynthesisErrorEvent)
  assert.equal(states.at(-1), 'error')
  lateEnd.call(utterances[0], {} as SpeechSynthesisEvent)
  assert.equal(utterances.length, 1)
  guide.start(['Retry'])
  assert.equal(utterances[1].text, 'Retry')
})

test('side cues repeat explicit authored instructions without inventing technique', () => {
  assert.equal(sideInstruction(['Apoyá la mano derecha.', 'Mové los brazos.']), undefined)
  const instruction = 'Repetí la secuencia del otro lado.'
  assert.equal(sideInstruction(['Ajustá el apoyo.', instruction]), instruction)
  assert.equal(sideInstruction(['Cambiá de lado al terminar.']), 'Cambiá de lado al terminar.')
})
