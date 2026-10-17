import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'

/** Deterministic content hashing only: identical UTF-8/SHA-256 bytes in HTTPS,
 * synthetic HTTP and Node. This is not authentication or credential encryption. */
export function workoutContentHash(value: string | Uint8Array): string {
  return bytesToHex(sha256(typeof value === 'string' ? utf8ToBytes(value) : value))
}
/** Training identities still require the browser CSPRNG. getRandomValues is
 * available on ordinary HTTP; no Math.random or browser-security override exists. */
export function newWorkoutId(
  source: Pick<Crypto, 'getRandomValues'> | undefined = globalThis.crypto,
): string {
  if (!source || typeof source.getRandomValues !== 'function')
    throw new Error(
      'Este navegador no puede crear identificadores seguros para el registro. Conservá o exportá tu trabajo y usá un navegador compatible.',
    )
  const bytes = source.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = bytesToHex(bytes)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
