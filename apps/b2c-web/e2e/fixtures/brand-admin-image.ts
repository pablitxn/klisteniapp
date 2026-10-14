import { deflateSync } from 'node:zlib'
function chunk(type: string, body: Buffer) {
  const out = Buffer.alloc(12 + body.length)
  out.writeUInt32BE(body.length)
  out.write(type, 4)
  body.copy(out, 8)
  let crc = 0xffffffff
  for (const byte of out.subarray(4, -4)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, out.length - 4)
  return out
}
export function brandAdminImage() {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(1)
  header.writeUInt32BE(1, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from([0, 255, 0, 0, 255]))),
    chunk('IEND', Buffer.alloc(0)),
  ])
}
