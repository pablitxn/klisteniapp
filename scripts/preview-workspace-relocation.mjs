// A workspace rename preserves existing capture evidence only when every input
// matches the separately recorded, mechanically verified relocation checkpoint.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const relocationReceipt = 'packages/model-assets/provenance/workspace-relocation-2026-10-11.json'
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

export async function readPreviewSources(root, paths, family, checking = false) {
  const actual = Object.fromEntries(await Promise.all(paths.map(async path =>
    [path, hash(await readFile(join(root, path)))])))
  // New captures always record the current physical paths and raw input hashes.
  if (!checking) return actual
  let receipt
  try { receipt = JSON.parse(await readFile(join(root, relocationReceipt), 'utf8')) }
  catch (error) { if (error.code === 'ENOENT') return actual; throw error }
  assert.equal(receipt.schemaVersion, 1)
  const proof = receipt.families[family]
  if (!proof || JSON.stringify(actual) !== JSON.stringify(proof.relocatedSources)) return actual
  console.log(`${family}: workspace relocation verified against exact current input hashes; original capture identities retained.`)
  return proof.originalSources
}
