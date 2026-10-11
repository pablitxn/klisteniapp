import { createHash } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

function matchesSettings(actual, expected) {
  if (expected && typeof expected === 'object' && !Array.isArray(expected)) {
    return Boolean(actual && typeof actual === 'object' && Object.entries(expected).every(([key, value]) => matchesSettings(actual[key], value)))
  }
  return isDeepStrictEqual(actual, expected)
}

/** Resume only exact current captures. Expected filenames come from the trusted
 * catalog, never from the manifest. Reading does not update capture provenance.
 */
export async function reusableCapture({ entry, expected, files, output, now = Date.now() }) {
  const generatedAt = typeof entry?.generatedAt === 'string' ? Date.parse(entry.generatedAt) : NaN
  // Captures use UTC ISO timestamps. Allow only a small clock difference between
  // capture hosts; a fabricated future date is never evidence of a completed run.
  if (!Number.isFinite(generatedAt) || new Date(generatedAt).toISOString() !== entry.generatedAt || generatedAt > now + 5 * 60_000) return false
  if (!matchesSettings(entry, expected) || !Object.keys(files).length) return false
  for (const [kind, file] of Object.entries(files)) {
    const record = entry[kind]
    if (record?.file !== file) return false
    let bytes
    try { bytes = await readFile(join(output, file)) }
    catch (error) { if (error.code === 'ENOENT') return false; throw error }
    if (bytes.length !== record.bytes || createHash('sha256').update(bytes).digest('hex') !== record.sha256) return false
  }
  return true
}

/** Stage the complete provenance before touching published assets. A failed
 * manifest write (including ENOSPC) leaves the old capture intact. Renames across
 * several URLs cannot be one transaction: an interruption is detected by hashes
 * and repaired by regeneration, never by accepting incomplete provenance.
 */
export async function publishCapture({ manifest, manifestPath, stagedManifestPath, assets, removedFiles = [] }) {
  try {
    await writeFile(stagedManifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
    for (const { staged, published } of assets) await rename(staged, published)
    for (const path of removedFiles) await rm(path, { force: true })
    await rename(stagedManifestPath, manifestPath)
  } finally {
    await rm(stagedManifestPath, { force: true })
  }
}
