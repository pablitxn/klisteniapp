import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { checkB2BBoundaries } from './check-b2b-boundaries.mjs'

function fixture(t, definitions) {
  const root = mkdtempSync(join(tmpdir(), 'klisteni-boundaries-'))
  t.after(() => rmSync(root, { recursive: true, force: true }))
  for (const [name, definition] of Object.entries(definitions)) {
    const directory = join(root, 'packages', name)
    const { files = {}, ...manifest } = definition
    mkdirSync(join(directory, 'src'), { recursive: true })
    writeFileSync(
      join(directory, 'package.json'),
      JSON.stringify({
        name: `@klisteniapp/${name}`,
        private: true,
        exports: { '.': './src/index.ts' },
        ...manifest,
      }),
    )
    writeFileSync(join(directory, 'src/index.ts'), 'export const value = 1')
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(join(directory, path, '..'), { recursive: true })
      writeFileSync(join(directory, path), content)
    }
  }
  return root
}

test('accepts declared public entrypoints and type-only module cycles', (t) => {
  const root = fixture(t, {
    'b2b-contracts': {
      files: {
        'src/index.ts': "export type { Input } from './input.ts'",
        'src/input.ts':
          "import type { Input as Prior } from './index.ts'; export type Input = { value: string }",
      },
    },
    'b2b-client': {
      dependencies: { '@klisteniapp/b2b-contracts': 'workspace:*' },
      files: {
        'src/index.ts':
          "import type { Input } from '@klisteniapp/b2b-contracts'; export const send = (value: Input) => value",
      },
    },
  })
  assert.deepEqual(checkB2BBoundaries(root), [])
})

test('rejects hidden source imports, including dynamic and type imports', (t) => {
  const root = fixture(t, {
    'b2b-contracts': { files: { 'src/private.ts': 'export type Secret = string' } },
    'b2b-client': {
      dependencies: { '@klisteniapp/b2b-contracts': 'workspace:*' },
      files: {
        'src/index.ts':
          "import type { Secret } from '@klisteniapp/b2b-contracts/src/private.ts'; export const load = () => import('../../b2b-contracts/src/private.ts')",
      },
    },
  })
  const errors = checkB2BBoundaries(root)
  assert.ok(errors.some((error) => error.includes('not exported')))
  assert.ok(errors.some((error) => error.includes('crosses workspace boundary')))
})

test('runtime imports cannot rely on a dev dependency', (t) => {
  const root = fixture(t, {
    'b2b-contracts': {},
    'b2b-client': {
      devDependencies: { '@klisteniapp/b2b-contracts': 'workspace:*' },
      files: {
        'src/index.ts': "import { value } from '@klisteniapp/b2b-contracts'; export { value }",
      },
    },
  })
  assert.ok(
    checkB2BBoundaries(root).some((error) => error.includes('undeclared runtime dependency')),
  )
})

test('UI cannot regain a client dependency and pure rules cannot access browser or Node APIs', (t) => {
  const root = fixture(t, {
    'b2b-client': {},
    'b2b-ui': {
      dependencies: { '@klisteniapp/b2b-client': 'workspace:*' },
      files: { 'src/index.ts': "export { value } from '@klisteniapp/b2b-client'" },
    },
    'b2b-domain': {
      files: {
        'src/index.ts':
          "import fs from 'node:fs'; export const read = () => localStorage.getItem('draft')",
      },
    },
  })
  const errors = checkB2BBoundaries(root)
  assert.ok(errors.some((error) => error.includes('forbidden layer dependency')))
  assert.ok(errors.some((error) => error.includes('cannot access localStorage')))
  assert.ok(errors.some((error) => error.includes('Node runtime')))
})

test('rejects runtime module and workspace dependency cycles', (t) => {
  const root = fixture(t, {
    'b2b-contracts': {
      dependencies: { '@klisteniapp/b2b-domain': 'workspace:*' },
      files: {
        'src/index.ts': "export { value } from './other.ts'",
        'src/other.ts': "import { value } from './index.ts'; export { value }",
      },
    },
    'b2b-domain': { dependencies: { '@klisteniapp/b2b-contracts': 'workspace:*' } },
  })
  const errors = checkB2BBoundaries(root)
  assert.ok(errors.some((error) => error.includes('Module import cycle')))
  assert.ok(errors.some((error) => error.includes('Workspace dependency cycle')))
})

test('internal packages must expose existing explicit entrypoints', (t) => {
  const root = fixture(t, {
    'b2b-contracts': { private: false, exports: { '.': './src/missing.ts', './*': './src/*.ts' } },
  })
  const errors = checkB2BBoundaries(root)
  assert.ok(errors.some((error) => error.includes('must be private')))
  assert.ok(errors.some((error) => error.includes('missing export')))
  assert.ok(errors.some((error) => error.includes('explicit local entrypoints')))
})

test('rejects unprefixed Node builtins and undeclared external imports in pure layers', (t) => {
  const root = fixture(t, {
    'b2b-domain': {
      files: {
        'src/index.ts':
          "import { readFileSync } from 'fs'; import { useState } from 'react'; export { readFileSync, useState }",
      },
    },
  })
  const errors = checkB2BBoundaries(root)
  assert.ok(errors.some((error) => error.includes('Node runtime (fs)')))
  assert.ok(errors.some((error) => error.includes('undeclared external dependency react')))
  assert.ok(errors.some((error) => error.includes('forbidden external layer dependency react')))
})

test('record fields named like browser globals do not introduce environment dependencies', (t) => {
  const root = fixture(t, {
    'b2b-domain': {
      files: {
        'src/index.ts':
          'export const describe = (input: { document: string }) => ({ document: input.document })',
      },
    },
  })
  assert.deepEqual(checkB2BBoundaries(root), [])
})
