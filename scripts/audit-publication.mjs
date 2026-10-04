#!/usr/bin/env node
/** Read-only publication audit. Findings contain locations/categories, never values.
 * node scripts/audit-publication.mjs [--root .] [--dist apps/web/dist]
 *   [--private-patterns /path/outside/repository/patterns.json] [--self-test]
 * Private pattern format: {tokens:[{category:"personal-name",value:"..."}],
 * patterns:[{category:"private-location",pattern:"...",flags:"i"}]}.
 * Patterns add detections, never exceptions. Keep their file outside the public tree.
 * External rules also inspect statically reconstructed JS/TS/JSX/TSX/JSON strings.
 * See publication-static-strings.mjs for supported syntax and hard resource limits.
 * Locations identify the original expression range (UTF-16 offsets); a trailing
 * +offset identifies a match within its decoded value, never executable content.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, lstatSync } from 'node:fs'
import { resolve, relative, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { isIP } from 'node:net'
import { gzipSync, gunzipSync, inflateSync, zstdDecompressSync, zstdCompressSync, deflateSync } from 'node:zlib'
import { staticStringsIn, staticStringLimits } from './publication-static-strings.mjs'

const maxBytes = 128 * 1024 * 1024
const decodeOptions = { maxOutputLength: 256 * 1024 * 1024 }
const escapeRegex = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi
const rules = [
  // Null terminates paths in decoded binary metadata.
  // eslint-disable-next-line no-control-regex
  { category: 'local-home-path', regex: /\/(?:Users|home)\/[^\s\x00"'<>]+|[A-Z]:[\\/]Users[\\/][^\s\x00"'<>]+/g },
  { category: 'private-network-address', regex: /(?<![\w.])(?:10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?:\/\d{1,2})?(?![\w.])/g },
  { category: 'private-network-address', regex: /\b(?:fc[0-9a-f]{2}|fd[0-9a-f]{2}):[0-9a-f:]+(?:\/\d{1,3})?\b/gi },
  { category: 'personal-email', regex: emailRegex },
  { category: 'private-key', regex: /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g },
  { category: 'credential-token', regex: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\b(?:gh[pousr]_|github_pat_|glpat-|xox[baprs]-|sk_live_|sk_test_|APP_USR-)[A-Za-z0-9_-]{16,}\b/g },
  { category: 'credential-token', regex: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/g },
  { category: 'credential-assignment', regex: /\b(?:api[_-]?key|access[_-]?token|client[_-]?secret|password|secret|token)\s*[:=]\s*["'][A-Za-z0-9_+/.=-]{24,}["']/gi },
  { category: 'credential-url', regex: /\b(?:postgres(?:ql)?|mysql|redis|amqps?):\/\/[^\s:/]+:[^\s@]+@[^\s"'`]+/gi },
]
const sha256 = value => createHash('sha256').update(value).digest('hex')
// Exact public fixtures/copyright only. Hashes keep the detector's own source
// free of credential-shaped values and operator-specific personal information.
const approvedFixtures = new Map([
  [
    ".gitlab-ci.yml:credential-url",
    [
      "48ccffacf6fea106c8c6377968afa94fdff216da5505c7fc5ac44e2d0728225d"
    ]
  ],
  [
    "apps/api/.env.example:credential-url",
    [
      "478537ba773bf14447b01ebc4f10ff7962471d93ee02685decd0ed07112d7226"
    ]
  ],
  [
    "apps/api/tests/config.test.ts:credential-url",
    [
      "b5f0a9c039ee1ba43c1138622af522115bbbe7b27bb436be4d2dcf539b5c5e24"
    ]
  ],
  [
    "apps/api/tests/billing.test.ts:personal-email",
    [
      "3b0dd28b4721f1dc5b68a54f6869b67ad7e3132b2cfd06e2d064d8da59075e8d"
    ]
  ],
  [
    "apps/api/tests/access.test.ts:credential-assignment",
    [
      "75cb221139b4c884b1f6caaa9539d869f703188f998d65d1d5a2ff8f53abe99f",
      "afd9f3145334bd96cd225310b6ccde7950686638c0b8cd74e4f1fc61e5627242"
    ]
  ],
  [
    "apps/api/tests/administration.test.ts:credential-assignment",
    [
      "227978979841b3c3594bf535f356dbd294a4675bedd94419ce7e25e18a204fc5",
      "bf2ab383069a15768a65a56d90c1230c5eadcfd1ed7c82e2ad3c570475e8bd1c"
    ]
  ],
  [
    "apps/api/tests/billing.test.ts:credential-assignment",
    [
      "7d49da17708b4a0b5de5c82eb3082630e18a82f5bb9bf1bddc1b4816ed95adb2"
    ]
  ],
  [
    "apps/api/tests/integration.test.ts:credential-assignment",
    [
      "de268e90e0ea117afba3fca092db560d71ac5819f2cec7f7ab11c2f52e078230"
    ]
  ],
  [
    "apps/api/tests/public-recovery.test.ts:credential-assignment",
    [
      "50d26a54ecb52ed9566f883381bfe7fd33cc73a941b351699e631f00a5fb3244",
      "a3a67862c969c5f7119a7dc41b3203d10d2a5a17ebe39fca172a9c39b2f5f97f"
    ]
  ],
  [
    "apps/web/e2e/account-access.spec.ts:credential-assignment",
    [
      "a1556618166b07250fe5511bdbaf86b6ede5fc1d0f55f0649cfea82f2593c152"
    ]
  ],
  [
    "apps/web/test/deployment.test.ts:credential-assignment",
    [
      "ed09ce2a32698821980c800f64d26a8071d43ed0f1101b2c4f4934aeb691b6c9"
    ]
  ]
])
const approvedCopyrightHash = 'fbc9ef3f9fe7564bf4cb0782d30eaf26e61b38e317d28bfaa84db9a06b95d412'

function allowed(category, match, line, path) {
  // Minified JavaScript labels can resemble an IPv6 prefix. Only valid
  // addresses qualify; a matching private address/CIDR is never exempted.
  if (category === 'private-network-address' && isIP(match.split('/')[0]) === 0) return true
  if (category === 'personal-email') {
    const domain = match.slice(match.lastIndexOf('@') + 1).toLowerCase()
    if (/^(?:example\.(?:com|net|org)|(?:[a-z0-9-]+\.)*(?:test|invalid|localhost))$/.test(domain)) return true
    // Exact upstream attribution; no global exemption for copyright/URLs.
    const upstream = ['hello', 'umami.is'].join('@')
    if (path === 'apps/web/e2e/fixtures/umami-LICENSE.txt' &&
        line === `Copyright (c) 2022 Umami Software, Inc. <${upstream}>`) return true
  }
  if (['personal-name', 'private-token'].includes(category) && path === 'LICENSE' && sha256(line) === approvedCopyrightHash) return true
  if (approvedFixtures.get(`${path}:${category}`)?.includes(sha256(match))) return true
  return false
}

function findingsIn(text, path, location, activeRules = rules) {
  const found = []
  for (const { category, regex } of activeRules) {
    regex.lastIndex = 0
    for (const match of text.matchAll(regex)) {
      const before = text.slice(0, match.index)
      const line = text.slice(before.lastIndexOf('\n') + 1, text.indexOf('\n', match.index) < 0 ? text.length : text.indexOf('\n', match.index)).replace(/\r$/, '')
      if (allowed(category, match[0], line, path)) continue
      found.push({ path, category, location: location === 'text' ? `line:${before.split('\n').length}` : `${location}+${match.index}` })
    }
  }
  return found
}

function staticFindingsIn(text, path, privateRules = []) {
  // Generic negative fixtures deliberately construct private-address/key shapes.
  // Only operator-supplied policy applies to reconstructed strings.
  if (!privateRules.length) return { supported: false, strings: 0, findings: [] }
  const result = staticStringsIn(text, path)
  return {
    supported: result.supported,
    strings: result.units.length,
    findings: [
      ...result.issues.map(item => ({ path, ...item })),
      ...result.units.flatMap(unit => findingsIn(unit.value, path, unit.location, privateRules)),
    ],
  }
}

// Read frame boundaries, not magic bytes inside compressed payloads. Node 24
// can stop at the first frame or accept an incomplete final frame. Supplying
// one structurally complete frame at a time avoids version-dependent coverage.
// Format: https://github.com/facebook/zstd/blob/dev/doc/zstd_compression_format.md
function zstdFrame(buffer, start, remaining) {
  let offset = start
  const take = size => {
    if (offset + size > buffer.length) throw new Error('truncated-zstd-frame')
    const position = offset
    offset += size
    return position
  }
  const magic = buffer.readUInt32LE(take(4))
  // Blender uses a skippable seek table. Expose these user-metadata payloads
  // for inspection instead of silently discarding them like the codec does.
  if (magic >= 0x184d2a50 && magic <= 0x184d2a5f) {
    const size = buffer.readUInt32LE(take(4))
    if (size > remaining) throw new Error('zstd-output-limit')
    const metadataOffset = take(size)
    return { end: offset, metadata: buffer.subarray(metadataOffset, offset), metadataOffset }
  }
  if (magic !== 0xfd2fb528) throw new Error('invalid-zstd-frame-magic')
  const descriptor = buffer[take(1)]
  if (descriptor & 8) throw new Error('reserved-zstd-header-bit')
  const single = Boolean(descriptor & 32)
  let windowSize
  if (!single) {
    const window = buffer[take(1)], base = 2 ** (10 + (window >>> 3))
    windowSize = base + base / 8 * (window & 7)
    if (windowSize > decodeOptions.maxOutputLength) throw new Error('zstd-window-limit')
  }
  take([0, 1, 2, 4][descriptor & 3])
  const sizeBytes = [single ? 1 : 0, 2, 4, 8][descriptor >>> 6]
  let expectedSize
  if (sizeBytes) {
    const position = take(sizeBytes)
    expectedSize = sizeBytes === 8 ? buffer.readBigUInt64LE(position) : BigInt(buffer.readUIntLE(position, sizeBytes))
    if (sizeBytes === 2) expectedSize += 256n
    if (expectedSize > BigInt(remaining)) throw new Error('zstd-output-limit')
    if (single) windowSize = Number(expectedSize)
  }
  let last = false
  while (!last) {
    const header = buffer.readUIntLE(take(3), 3)
    last = Boolean(header & 1)
    const type = (header >>> 1) & 3, size = header >>> 3
    if (type === 3) throw new Error('reserved-zstd-block-type')
    if (size > Math.min(128 * 1024, windowSize)) throw new Error('zstd-block-limit')
    take(type === 1 ? 1 : size)
  }
  if (descriptor & 4) take(4)
  return { end: offset, expectedSize }
}

function decompressZstdFrames(buffer, maxOutputLength = decodeOptions.maxOutputLength, skippableMetadata = []) {
  if (!Number.isSafeInteger(maxOutputLength) || maxOutputLength < 0 || maxOutputLength > decodeOptions.maxOutputLength || !buffer.length) throw new Error('invalid-zstd-limit-or-input')
  const chunks = []
  let offset = 0, total = 0, metadataBytes = 0, frames = 0
  while (offset < buffer.length) {
    if (++frames > 16_384) throw new Error('zstd-frame-count-limit')
    const remaining = maxOutputLength - total - metadataBytes
    const frame = zstdFrame(buffer, offset, remaining)
    if (frame.metadata) {
      metadataBytes += frame.metadata.length
      skippableMetadata.push({ buffer: frame.metadata, location: `zstd-skippable-byte:${frame.metadataOffset}` })
      offset = frame.end
      continue
    }
    const decoded = zstdDecompressSync(buffer.subarray(offset, frame.end), { info: true, maxOutputLength: Math.max(1, remaining) })
    if (decoded.engine.bytesWritten !== frame.end - offset || decoded.buffer.length > remaining) throw new Error('incomplete-zstd-frame')
    if (frame.expectedSize !== undefined && BigInt(decoded.buffer.length) !== frame.expectedSize) throw new Error('zstd-content-size-mismatch')
    chunks.push(decoded.buffer)
    total += decoded.buffer.length
    offset = frame.end
  }
  return Buffer.concat(chunks, total)
}

function metadataUnits(buffer, extension) {
  const units = []
  const add = (bytes, location, wide = false) => {
    units.push({ text: bytes.toString('utf8'), location })
    if (wide) units.push({ text: bytes.toString('utf16le'), location: `${location}:utf16le` })
  }
  if (extension === '.blend') {
    let decoded = buffer
    if (buffer.readUInt32LE(0) === 0xfd2fb528) {
      const skippable = []
      decoded = decompressZstdFrames(buffer, decodeOptions.maxOutputLength, skippable)
      for (const item of skippable) add(item.buffer, item.location, true)
    }
    else if (buffer[0] === 0x1f && buffer[1] === 0x8b) decoded = gunzipSync(buffer, decodeOptions)
    if (decoded.subarray(0, 7).toString() !== 'BLENDER') throw new Error('invalid-blend')
    // Latin-1 keeps byte offsets exact. Scan printable runs, not compressed bytes.
    for (const match of decoded.toString('latin1').matchAll(/[\x20-\x7e]{4,}/g)) units.push({ text: match[0], location: `blend-decoded-byte:${match.index}` })
  } else if (extension === '.glb') {
    if (buffer.toString('ascii', 0, 4) !== 'glTF' || buffer.readUInt32LE(4) !== 2 || buffer.readUInt32LE(8) !== buffer.length) throw new Error('invalid-glb')
    const binaryChunks = []
    let document
    for (let offset = 12; offset < buffer.length;) {
      const size = buffer.readUInt32LE(offset), type = buffer.readUInt32LE(offset + 4)
      const chunk = buffer.subarray(offset + 8, offset + 8 + size)
      if (chunk.length !== size) throw new Error('truncated-glb')
      if (type === 0x4e4f534a) { document = JSON.parse(chunk.toString()); add(chunk, 'glb-json') }
      else if (type === 0x004e4942) binaryChunks.push(chunk)
      offset += 8 + size
    }
    if (!document) throw new Error('missing-glb-json')
    for (const image of document.images || []) {
      if (image.bufferView === undefined) continue
      const view = document.bufferViews[image.bufferView]
      const binary = binaryChunks[view.buffer || 0]
      if (!binary) throw new Error('invalid-glb-image')
      const extension = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' }[image.mimeType]
      if (!extension) throw new Error('unsupported-glb-image')
      units.push(...metadataUnits(binary.subarray(view.byteOffset || 0, (view.byteOffset || 0) + view.byteLength), extension))
    }
  } else if (extension === '.png') {
    if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('invalid-png')
    for (let offset = 8; offset < buffer.length;) {
      const size = buffer.readUInt32BE(offset), type = buffer.toString('ascii', offset + 4, offset + 8)
      const data = buffer.subarray(offset + 8, offset + 8 + size)
      if (offset + size + 12 > buffer.length) throw new Error('truncated-png')
      if (type === 'tEXt' || type === 'eXIf') add(data, `png-${type}:${offset}`, type === 'eXIf')
      if (type === 'zTXt' || type === 'iCCP') {
        const zero = data.indexOf(0); if (zero < 0 || data[zero + 1] !== 0) throw new Error('invalid-png-metadata')
        add(data.subarray(0, zero), `png-${type}-label:${offset}`)
        add(inflateSync(data.subarray(zero + 2), decodeOptions), `png-${type}:${offset}`, true)
      }
      if (type === 'iTXt') {
        const zero = data.indexOf(0), flag = data[zero + 1], method = data[zero + 2]
        const langEnd = data.indexOf(0, zero + 3), translatedEnd = data.indexOf(0, langEnd + 1)
        if (zero < 0 || langEnd < 0 || translatedEnd < 0 || method !== 0 || flag > 1) throw new Error('invalid-png-metadata')
        add(data.subarray(0, translatedEnd), `png-iTXt-label:${offset}`)
        add(flag ? inflateSync(data.subarray(translatedEnd + 1), decodeOptions) : data.subarray(translatedEnd + 1), `png-iTXt:${offset}`)
      }
      offset += size + 12
      if (type === 'IEND') break
    }
  } else if (extension === '.webp') {
    if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP' || buffer.readUInt32LE(4) + 8 !== buffer.length) throw new Error('invalid-webp')
    for (let offset = 12; offset < buffer.length;) {
      const type = buffer.toString('ascii', offset, offset + 4), size = buffer.readUInt32LE(offset + 4)
      if (offset + 8 + size > buffer.length) throw new Error('truncated-webp')
      if (['EXIF', 'XMP ', 'ICCP'].includes(type)) add(buffer.subarray(offset + 8, offset + 8 + size), `webp-${type.trim()}:${offset}`, true)
      offset += 8 + size + size % 2
    }
  } else if (extension === '.gif') {
    if (!/^GIF8[79]a$/.test(buffer.toString('ascii', 0, 6))) throw new Error('invalid-gif')
    let offset = 13 + (buffer[10] & 128 ? 3 * 2 ** ((buffer[10] & 7) + 1) : 0)
    const subblocks = () => {
      const blocks = []
      for (;;) {
        if (offset >= buffer.length) throw new Error('truncated-gif')
        const size = buffer[offset++]
        if (!size) return Buffer.concat(blocks)
        if (offset + size > buffer.length) throw new Error('truncated-gif')
        blocks.push(buffer.subarray(offset, offset + size)); offset += size
      }
    }
    while (offset < buffer.length) {
      const marker = buffer[offset++]
      if (marker === 0x3b) break
      if (marker === 0x21) {
        const type = buffer[offset++], start = offset, data = subblocks()
        if (type === 0xfe || type === 0xff || type === 0x01) add(data, `gif-extension:${start}`)
      } else if (marker === 0x2c) {
        const packed = buffer[offset + 8]; offset += 9
        if (packed & 128) offset += 3 * 2 ** ((packed & 7) + 1)
        offset++; subblocks()
      } else throw new Error('invalid-gif-block')
    }
  } else if (['.jpg', '.jpeg'].includes(extension)) {
    if (buffer.readUInt16BE(0) !== 0xffd8) throw new Error('invalid-jpeg')
    for (let offset = 2; offset < buffer.length;) {
      if (buffer[offset++] !== 255) throw new Error('invalid-jpeg-marker')
      const marker = buffer[offset++]
      if (marker === 0xda || marker === 0xd9) break
      const size = buffer.readUInt16BE(offset)
      if (size < 2 || offset + size > buffer.length) throw new Error('truncated-jpeg')
      if ((marker >= 0xe0 && marker <= 0xef) || marker === 0xfe) add(buffer.subarray(offset + 2, offset + size), `jpeg-metadata:${offset}`, true)
      offset += size
    }
  } else throw new Error('unsupported-binary')
  return units
}

function selfTest() {
  const path = ['/', 'Users/', 'example-person/project'].join('')
  const ip = ['10', '42', '0', '7'].join('.')
  const email = ['person', 'audit-demonstration.tld'].join('@')
  const tests = [
    ['home', findingsIn(path, 'sample.txt', 'text').some(x => x.category === 'local-home-path')],
    ['private-ip', findingsIn(ip, 'sample.txt', 'text').some(x => x.category === 'private-network-address')],
    ['hex-lookup-table-is-not-ip', findingsIn(['0f', '10', '11', '12', '13', '14'].join('.'), 'bundle.js', 'text').length === 0],
    ['invalid-ipv6-js-label', findingsIn(['fd12', 'abcd'].join(':'), 'bundle.js', 'text').length === 0],
    ['valid-private-ipv6', findingsIn(['fd12', '', '1'].join(':'), 'sample.txt', 'text').some(x => x.category === 'private-network-address')],
    ['email', findingsIn(email, 'sample.txt', 'text').some(x => x.category === 'personal-email')],
    ['reserved-email', findingsIn(['demo', 'example.test'].join('@'), 'sample.txt', 'text').length === 0],
    ['provider-key', findingsIn('AKIA' + 'A'.repeat(16), 'sample.txt', 'text').some(x => x.category === 'credential-token')],
    ['legal-url', findingsIn('https://creativecommons.org/licenses/by-sa/4.0/', 'NOTICE', 'text').length === 0],
    ['google-api-path', findingsIn('https://health.googleapis.com/v4/users/me/dataTypes', 'sample.txt', 'text').length === 0],
    ['private-pattern', findingsIn('person demo', 'sample.txt', 'text', [{ category: 'personal-name', regex: /person demo/g }]).length === 1],
    ['truncated-glb', (() => { try { metadataUnits(Buffer.from('glTF'), '.glb'); return false } catch { return true } })()],
  ]
  const blend = Buffer.from(`BLENDER-v500\0${path}\0`)
  tests.push(['blend-metadata', metadataUnits(blend, '.blend').some(x => findingsIn(x.text, 'scene.blend', x.location).length)])
  tests.push(['compressed-blend-metadata', metadataUnits(zstdCompressSync(blend), '.blend').some(x => findingsIn(x.text, 'scene.blend', x.location).length)])
  const checkEmail = (buffer, ext) => metadataUnits(buffer, ext).some(x => findingsIn(x.text, `image${ext}`, x.location).some(y => y.category === 'personal-email'))
  // Minimal metadata containers exercise parsers; this is not an image decoder.
  const pngChunk = (type, data) => { const size = Buffer.alloc(4); size.writeUInt32BE(data.length); return Buffer.concat([size, Buffer.from(type), data, Buffer.alloc(4)]) }
  tests.push(['png-compressed-metadata', checkEmail(Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), pngChunk('zTXt', Buffer.concat([Buffer.from('Author\0\0'), deflateSync(email)])), pngChunk('IEND', Buffer.alloc(0))]), '.png')])
  const webpData = Buffer.from(email), webp = Buffer.alloc(20 + webpData.length + webpData.length % 2)
  webp.write('RIFF'); webp.writeUInt32LE(webp.length - 8, 4); webp.write('WEBP', 8); webp.write('EXIF', 12); webp.writeUInt32LE(webpData.length, 16); webpData.copy(webp, 20)
  tests.push(['webp-metadata', checkEmail(webp, '.webp')])
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([1, 0, 1, 0, 0, 0, 0, 0x21, 0xfe, email.length]), Buffer.from(email), Buffer.from([0, 0x3b])])
  tests.push(['gif-comment', checkEmail(gif, '.gif')])
  let json = Buffer.from(JSON.stringify({ asset: { version: '2.0', copyright: email } }))
  json = Buffer.concat([json, Buffer.alloc((4 - json.length % 4) % 4, 32)])
  const glb = Buffer.alloc(20 + json.length); glb.write('glTF'); glb.writeUInt32LE(2, 4); glb.writeUInt32LE(glb.length, 8); glb.writeUInt32LE(json.length, 12); glb.writeUInt32LE(0x4e4f534a, 16); json.copy(glb, 20)
  tests.push(['glb-json', checkEmail(glb, '.glb')])
  tests.push(['scope-does-not-exempt-a-different-file', !allowed('credential-url', 'unapproved', '', '.env.example')])
  // All regression identifiers are invented. Never embed operator policy here.
  const fakePolicy = [{ category: 'private-token', regex: /sample-operator\.invalid/g }]
  const residualBlend = Buffer.from('BLENDER-v500\0//\0sample-operator.invalid\0')
  for (const [name, buffer] of [
    ['blend-private-token-after-nul', residualBlend],
    ['zstd-blend-private-token-after-nul', zstdCompressSync(residualBlend)],
    ['gzip-blend-private-token-after-nul', gzipSync(residualBlend)],
  ]) tests.push([name, metadataUnits(buffer, '.blend').some(unit => findingsIn(unit.text, 'fixture.blend', unit.location, fakePolicy).some(item => item.category === 'private-token'))])
  const firstFrame = zstdCompressSync(Buffer.from('BLENDER-v500\0//\0'))
  const laterContent = Buffer.from('sample-operator.invalid\0')
  const laterFrame = zstdCompressSync(laterContent)
  const concatenated = Buffer.concat([firstFrame, laterFrame])
  const expectedFrames = Buffer.concat([Buffer.from('BLENDER-v500\0//\0'), laterContent])
  const rejectsZstd = (input, limit) => { try { decompressZstdFrames(input, limit); return false } catch { return true } }
  tests.push(['zstd-concatenated-frame-content', decompressZstdFrames(concatenated).equals(expectedFrames)])
  tests.push(['zstd-private-token-in-later-frame', metadataUnits(concatenated, '.blend').some(unit => findingsIn(unit.text, 'fixture.blend', unit.location, fakePolicy).some(item => item.category === 'private-token'))])
  tests.push(['zstd-trailing-junk-rejected', rejectsZstd(Buffer.concat([concatenated, Buffer.from('junk')]))])
  tests.push(['zstd-truncated-later-frame-one-byte', rejectsZstd(concatenated.subarray(0, concatenated.length - 1))])
  tests.push(['zstd-truncated-later-frame-two-bytes', rejectsZstd(concatenated.subarray(0, concatenated.length - 2))])
  tests.push(['zstd-cumulative-limit', rejectsZstd(concatenated, expectedFrames.length - 1)])
  tests.push(['zstd-exact-cumulative-limit', decompressZstdFrames(concatenated, expectedFrames.length).equals(expectedFrames)])
  const skippable = Buffer.alloc(8 + laterContent.length)
  skippable.writeUInt32LE(0x184d2a50); skippable.writeUInt32LE(laterContent.length, 4); laterContent.copy(skippable, 8)
  tests.push(['zstd-skippable-metadata-inspected', metadataUnits(Buffer.concat([firstFrame, skippable]), '.blend').some(unit => unit.location.startsWith('zstd-skippable-byte:') && findingsIn(unit.text, 'fixture.blend', unit.location, fakePolicy).some(item => item.category === 'private-token'))])
  tests.push(['zstd-skippable-truncation-rejected', rejectsZstd(Buffer.concat([firstFrame, skippable.subarray(0, skippable.length - 1)]))])
  tests.push(['zstd-skippable-cumulative-limit', rejectsZstd(Buffer.concat([firstFrame, skippable]), expectedFrames.length - 1)])
  const reconstructed = source => staticFindingsIn(source, 'synthetic-fixture.ts', fakePolicy).findings
  const syntheticSources = [
    ['private-concat', 'const value = "sample-" + "operator.invalid"'],
    ['private-join', 'const value = ["sample-operator", "invalid"].join(".")'],
    ['private-escaped-literal', String.raw`const value = "\u0073ample-\x6fperator.invalid"`],
    ['private-nested-expression', 'const value = (["sample-", ("operator" as const)].join("") + ".invalid")'],
  ]
  for (const [name, source] of syntheticSources) tests.push([name, reconstructed(source).some(item => item.category === 'private-token')])
  tests.push(['private-json-escapes', staticFindingsIn(String.raw`{"value":"\u0073ample-operator.invalid"}`, 'synthetic.json', fakePolicy).findings.some(item => item.category === 'private-token')])
  const located = reconstructed('// fixture\nconst value = "sample-" + "operator.invalid"')
  tests.push(['private-source-location', located.some(item => item.location.startsWith('line:2:column:15:source:25-'))])
  tests.push(['private-diagnostics-redact-values', !JSON.stringify(located).includes('sample-operator.invalid')])
  tests.push(['private-policy-only', staticFindingsIn('const value = ["10", "42", "0", "7"].join(".")', 'fixture.js').findings.length === 0])
  tests.push(['private-no-identifier-resolution', reconstructed('const prefix = "sample-"; const value = prefix + "operator.invalid"').length === 0])
  tests.push(['private-no-dynamic-separator', reconstructed('const value = ["sample-operator", "invalid"].join(getSeparator())').length === 0])
  const probe = '__publicationStaticProbe'
  const previous = Object.getOwnPropertyDescriptor(globalThis, probe)
  try {
    Object.defineProperty(globalThis, probe, { value: 0, configurable: true, writable: true })
    const dynamic = 'globalThis.__publicationStaticProbe = 1; (() => { throw new Error("source must remain data") })(); const value = getPrefix() + "operator.invalid"'
    tests.push(['private-never-executes-source', reconstructed(dynamic).length === 0 && globalThis[probe] === 0])
    tests.push(['private-never-invokes-getters', reconstructed('const value = ({get join(){globalThis.__publicationStaticProbe = 2}}).join(".")').length === 0 && globalThis[probe] === 0])
  } finally {
    if (previous) Object.defineProperty(globalThis, probe, previous)
    else delete globalThis[probe]
  }
  const bounded = (source, override, category) => staticStringsIn(source, 'fixture.js', { ...staticStringLimits, ...override }).issues.some(item => item.category === category)
  tests.push(['static-source-limit', bounded('const value = "fixture"', { sourceBytes: 8 }, 'static-analysis-size-limit')])
  tests.push(['static-node-limit', bounded('const value = "fixture"', { nodes: 2 }, 'static-analysis-node-limit')])
  tests.push(['static-depth-limit', bounded('const value = "a" + "b" + "c"', { depth: 2 }, 'static-analysis-depth-limit')])
  const wrappedArray = '('.repeat(66) + '["synthetic-", "marker.invalid"]' + ')'.repeat(66)
  tests.push(['static-join-unwrap-depth-limit', staticFindingsIn(`// fixture\nconst value = ${wrappedArray}.join("")`, 'fixture.js', fakePolicy).findings.some(item => item.category === 'static-analysis-depth-limit' && item.location.startsWith('line:2:column:15:source:25-'))])
  tests.push(['static-value-limit', bounded('const value = "abcd" + "efgh"', { valueChars: 6 }, 'static-analysis-value-limit')])
  tests.push(['static-array-limit', bounded('const value = ["a", "b"].join("")', { arrayElements: 1 }, 'static-analysis-array-limit')])
  tests.push(['static-total-limit', bounded('const a = "abcd"; const b = "efgh"', { totalChars: 6 }, 'static-analysis-output-limit')])
  tests.push(['static-malformed-source', bounded('const value = "unterminated', {}, 'static-analysis-parse-error')])
  tests.push(['static-unsupported-extension', !staticStringsIn('"sample-" + "operator.invalid"', 'fixture.md').supported])
  const copyright = readFileSync(new URL('../LICENSE', import.meta.url), 'utf8').split('\n').find(line => sha256(line) === approvedCopyrightHash)
  tests.push(['copyright-exception-still-exact', !!copyright && allowed('personal-name', '', copyright, 'LICENSE') && !allowed('personal-name', '', copyright, 'fixture.js')])
  if (tests.some(([, passed]) => !passed)) throw new Error('self-test-failed:' + tests.filter(([, p]) => !p).map(([name]) => name).join(','))
  return { selfTests: tests.length, passed: tests.length }
}

function main() {
  const { values } = parseArgs({ options: { root: { type: 'string', default: '.' }, dist: { type: 'string', multiple: true }, 'private-patterns': { type: 'string' }, 'self-test': { type: 'boolean' } } })
  if (values['self-test']) { console.log(JSON.stringify(selfTest())); return }
  const root = resolve(values.root)
  const activeRules = [...rules], privateRules = []
  if (values['private-patterns']) {
    const configPath = resolve(values['private-patterns'])
    if (!relative(root, configPath).startsWith(`..${sep}`)) throw new Error('private-pattern-file-must-be-outside-public-root')
    const config = JSON.parse(readFileSync(configPath, 'utf8'))
    for (const item of [...(config.tokens || []).map(x => ({ ...x, pattern: escapeRegex(x.value), flags: 'i' })), ...(config.patterns || [])]) {
      if (!/^[a-z][a-z0-9-]{0,39}$/.test(item.category) || !item.pattern) throw new Error('invalid-private-pattern')
      privateRules.push({ category: item.category, regex: new RegExp(item.pattern, [...new Set((item.flags || '') + 'g')].join('')) })
    }
    activeRules.push(...privateRules)
  }
  const files = new Set(execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean))
  function walk(path) {
    const info = lstatSync(path)
    if (info.isSymbolicLink()) { files.add(relative(root, path)); return }
    if (info.isDirectory()) for (const entry of readdirSync(path)) walk(resolve(path, entry))
    else files.add(relative(root, path))
  }
  for (const dir of values.dist || []) {
    const path = resolve(root, dir)
    if (relative(root, path).startsWith('..') || path === root) throw new Error('dist-must-be-inside-public-root')
    walk(path)
  }
  const findings = [], coverage = { text: 0, blend: 0, glb: 0, png: 0, webp: 0, gif: 0, jpeg: 0, metadataUnits: 0, staticFiles: 0, staticStrings: 0 }
  const binaryExtensions = new Set(['.blend', '.glb', '.png', '.webp', '.gif', '.jpg', '.jpeg'])
  for (const path of [...files].sort()) {
    const absolute = resolve(root, path)
    let info
    try { info = lstatSync(absolute) } catch (error) { if (error.code === 'ENOENT') continue; throw error }
    if (info.isSymbolicLink()) { findings.push({ path, category: 'uninspected-symlink', location: 'file' }); continue }
    if (!info.isFile()) continue
    if (info.size > maxBytes) { findings.push({ path, category: 'uninspected-large-file', location: 'file' }); continue }
    const buffer = readFileSync(absolute), extension = extname(path).toLowerCase()
    try {
      if (binaryExtensions.has(extension)) {
        const units = metadataUnits(buffer, extension)
        coverage[extension === '.jpg' ? 'jpeg' : extension.slice(1)]++
        coverage.metadataUnits += units.length
        for (const unit of units) findings.push(...findingsIn(unit.text, path, unit.location, activeRules))
      } else {
        if (buffer.includes(0)) { findings.push({ path, category: 'unsupported-binary', location: 'file' }); continue }
        coverage.text++
        const text = buffer.toString('utf8')
        findings.push(...findingsIn(text, path, 'text', activeRules))
        const reconstructed = staticFindingsIn(text, path, privateRules)
        if (reconstructed.supported) coverage.staticFiles++
        coverage.staticStrings += reconstructed.strings
        findings.push(...reconstructed.findings)
      }
    } catch { findings.push({ path, category: 'unreadable-binary-metadata', location: 'file' }) }
  }
  const unique = [...new Map(findings.map(x => [JSON.stringify(x), x])).values()]
  // Even sensitive filenames must not leak detected values into audit output.
  const redactPath = path => activeRules.reduce((value, rule) => value.replace(rule.regex, '[redacted]'), path)
  console.log(JSON.stringify({ ok: unique.length === 0, coverage, findings: unique.map(x => ({ ...x, path: redactPath(x.path) })), limitations: [
    'Scans current Git tracked/unignored candidates; ignored build output is included only with --dist. Git history is not inspected.',
    'Checks text and structured binary metadata, not rendered pixels/OCR, audio, or geometric meaning. Review screenshots visually.',
    'Common credential signatures are not a proof that all secrets are absent; use external private patterns for instance names, locations and identifiers.',
    'External policy additionally checks decoded JS/TS/JSX/TSX/JSON string literals, string concatenation and literal-array join with a literal separator. It never executes source or resolves identifiers, dynamic calls, template substitutions, encoded payloads or control flow. Other formats receive the original raw/metadata scan.',
    'Static limits per file: 8 MiB source, 500000 syntax nodes, depth 64, 1024 join elements, 128 Ki UTF-16 characters per value and 16 Mi total decoded characters. Parser/resource failures are findings. Source locations use original UTF-16 expression offsets.',
    'Zstd Blender streams are decoded frame by frame with a cumulative 256 MiB decoded-data/metadata budget, a 256 MiB window limit and at most 16384 frames. Skippable payloads receive UTF-8/UTF-16 metadata scanning; trailing data and truncated frames are rejected.',
    'Unrecognized binary files, malformed metadata, symlinks and size limits fail closed. No files are changed.',
  ] }, null, 2))
  process.exitCode = unique.length ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main() } catch { console.error(JSON.stringify({ ok: false, error: 'audit-could-not-complete', valuesRedacted: true })); process.exitCode = 2 }
}

export { findingsIn, staticFindingsIn, metadataUnits, decompressZstdFrames, selfTest }
