import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { colorThemes } from '../src/lib/color-themes.ts'

const stylesheet = readFileSync(new URL('../src/themes.css', import.meta.url), 'utf8')
const modes = ['light', 'dark'] as const
const tokens = [
  'background', 'ink', 'muted', 'muted-soft', 'line', 'line-strong',
  'purple', 'purple-soft', 'purple-dark', 'purple-strong', 'purple-line',
  'green', 'green-soft', 'green-dark', 'green-strong', 'surface', 'surface-soft',
  'peach', 'peach-soft', 'peach-dark', 'peach-line', 'error',
]

function palette(id: string, mode: typeof modes[number]): Record<string, string> {
  const selector = `:root[data-color-theme='${id}']${mode === 'dark' ? "[data-theme='dark']" : ''}`
  const declaration = stylesheet.split(`${selector} {`)[1]?.split('}')[0]
  assert.ok(declaration, `${id}/${mode} has its own palette`)
  return Object.fromEntries([...declaration.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/g)]
    .map((match) => [match[1], match[2]]))
}

function luminance(hex: string): number {
  const linear = [1, 3, 5].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}

function contrast(first: string, second: string): number {
  const [low, high] = [luminance(first), luminance(second)].sort((a, b) => a - b)
  return (high + 0.05) / (low + 0.05)
}

function mixSrgb(first: string, second: string, firstWeight: number): string {
  return '#' + [1, 3, 5].map((offset) => {
    const firstChannel = Number.parseInt(first.slice(offset, offset + 2), 16)
    const secondChannel = Number.parseInt(second.slice(offset, offset + 2), 16)
    return Math.round(firstChannel * firstWeight + secondChannel * (1 - firstWeight)).toString(16).padStart(2, '0')
  }).join('')
}

test('all six color families define both complete appearances and accurate picker previews', () => {
  assert.equal(colorThemes.length, 6)
  assert.equal(new Set(colorThemes.map((theme) => theme.id)).size, 6)
  const appearances = new Set<string>()
  for (const theme of colorThemes) {
    for (const mode of modes) {
      const colors = palette(theme.id, mode)
      assert.deepEqual(Object.keys(colors).sort(), [...tokens].sort(), `${theme.id}/${mode} covers every semantic color`)
      assert.deepEqual(theme.swatches[mode], [colors.background, colors['purple-dark'], colors['green-dark']])
      appearances.add(JSON.stringify(colors))
    }
  }
  assert.equal(appearances.size, 12, 'every family and appearance has distinct colors')
})

// These are the existing UI's text/surface combinations: cards and navigation,
// subdued captions, selected buttons, guidance badges, and validation errors.
const textSurfaces: Record<string, string[]> = {
  ink: ['background', 'surface', 'surface-soft', 'green', 'green-soft', 'purple', 'purple-soft', 'peach-soft'],
  muted: ['background', 'surface', 'surface-soft', 'green', 'green-soft', 'purple', 'purple-soft', 'peach-soft'],
  'muted-soft': ['background', 'surface', 'surface-soft', 'green', 'green-soft'],
  'purple-dark': ['background', 'surface', 'surface-soft', 'purple', 'purple-soft'],
  'green-dark': ['background', 'surface', 'green', 'green-soft'],
  'peach-dark': ['background', 'surface', 'peach-soft'],
  error: ['background', 'surface', 'purple-soft', 'peach-soft'],
}
const focusSurfaces = ['background', 'surface', 'surface-soft', 'green', 'green-soft', 'purple', 'purple-soft', 'peach-soft']

for (const theme of colorThemes) {
  for (const mode of modes) {
    test(`${theme.name}/${mode} keeps text and keyboard focus readable`, () => {
      const colors = palette(theme.id, mode)
      for (const [foreground, backgrounds] of Object.entries(textSurfaces)) {
        for (const background of backgrounds) {
          const ratio = contrast(colors[foreground], colors[background])
          assert.ok(ratio >= 4.5, `${foreground} on ${background}: ${ratio.toFixed(2)}:1 (minimum 4.5:1)`)
        }
      }
      for (const background of focusSurfaces) {
        const ratio = contrast(colors['purple-line'], colors[background])
        assert.ok(ratio >= 3, `keyboard focus on ${background}: ${ratio.toFixed(2)}:1 (minimum 3:1)`)
      }
      // Health success notices/callouts and account state badges use this mix.
      const secondaryText = mixSrgb(colors['green-dark'], colors.ink, 0.85)
      for (const background of ['background', 'surface', 'green-soft']) {
        const ratio = contrast(secondaryText, colors[background])
        assert.ok(ratio >= 4.5, `mixed secondary text on ${background}: ${ratio.toFixed(2)}:1 (minimum 4.5:1)`)
      }
    })
  }
}
