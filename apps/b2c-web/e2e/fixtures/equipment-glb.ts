/** A tiny test triangle, not an authored exercise/machine asset. */
export function equipmentGLB() {
  const model = { asset: { version: '2.0' }, buffers: [{ byteLength: 42 }],
    bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 36 }, { buffer: 0, byteOffset: 36, byteLength: 6 }],
    accessors: [{ bufferView: 0, componentType: 5126, count: 3, type: 'VEC3', min: [0, 0, 0], max: [1, 1, 0] }, { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }], nodes: [{ mesh: 0 }], scenes: [{ nodes: [0] }], scene: 0 }
  const json = Buffer.from(JSON.stringify(model))
  const padded = Buffer.alloc(Math.ceil(json.length / 4) * 4, 0x20)
  json.copy(padded)
  const header = Buffer.alloc(20)
  header.write('glTF'); header.writeUInt32LE(2, 4); header.writeUInt32LE(20 + padded.length + 52, 8)
  header.writeUInt32LE(padded.length, 12); header.writeUInt32LE(0x4e4f534a, 16)
  const binary = Buffer.alloc(52)
  binary.writeUInt32LE(44); binary.writeUInt32LE(0x004e4942, 4)
  ;[0, 0, 0, 1, 0, 0, 0, 1, 0].forEach((value, index) => binary.writeFloatLE(value, 8 + index * 4))
  ;[0, 1, 2].forEach((value, index) => binary.writeUInt16LE(value, 44 + index * 2))
  return Buffer.concat([header, padded, binary])
}
