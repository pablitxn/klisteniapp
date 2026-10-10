import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { Group, Mesh, Vector3 } from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { createIllustrativePelvis } from '../src/lib/anatomy-variant-surface.ts'

test('neutral pelvic caps preserve the actual atlas perimeter while removing the male protrusion', async () => {
  const buffer = readFileSync(new URL('../../../packages/model-assets/public/models/anatomy.glb', import.meta.url))
  const asset = await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), '')
  const original: Mesh[] = []
  asset.scene.traverse(object => {
    if (object instanceof Mesh && /^Urogenital region\.[lr]$/.test(object.userData.anatomyName)) original.push(object)
  })
  assert.equal(original.length, 2)
  const savedPositions = original.map(mesh => Array.from(mesh.geometry.getAttribute('position').array))
  const caps = createIllustrativePelvis(asset.scene)
  try {
    assert.deepEqual(caps.map(mesh => mesh.name), [
      'Illustrative pelvic surface (anterior)', 'Illustrative pelvic surface (perineal)',
    ])
    const coordinate = (point: Vector3) => point.toArray().map(value => Math.round(value * 1e6)).join(',')
    const boundaryEdges = (meshes: Mesh[]) => {
      const edges = new Map<string, { count: number; direction: string }>()
      for (const mesh of meshes) {
        const position = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index!
        for (let face = 0; face < indices.count; face += 3) {
          const vertices = [0, 1, 2].map(corner => coordinate(new Vector3().fromBufferAttribute(position, indices.getX(face + corner)).applyMatrix4(mesh.matrixWorld)))
          for (let corner = 0; corner < 3; corner++) {
            const a = vertices[corner]!, b = vertices[(corner + 1) % 3]!
            const key = [a, b].sort().join('|'), entry = edges.get(key)
            if (entry) entry.count++
            else edges.set(key, { count: 1, direction: `${a}|${b}` })
          }
        }
      }
      return [...edges.values()].filter(edge => edge.count === 1).map(edge => edge.direction).sort()
    }
    const sourceBoundary = boundaryEdges(original)
    assert.equal(sourceBoundary.length, 48)
    // Direction also preserves outward source orientation around both holes.
    assert.deepEqual(boundaryEdges(caps), sourceBoundary)
    const sourcePositions = new Set(original.flatMap(mesh => {
      const position = mesh.geometry.getAttribute('position')
      return Array.from({ length: position.count }, (_, vertex) => new Vector3().fromBufferAttribute(position, vertex).toArray().join(','))
    }))
    for (const cap of caps) {
      assert.equal(cap.userData.illustrativeSurface, true)
      assert.equal(cap.userData.bodySegment, 'pelvis')
      assert.equal(cap.userData.tissue, 'skin')
      assert.equal(cap.material, original[0]!.material)
      assert.equal(cap.matrix.equals(new Group().matrix), true)
      const position = cap.geometry.getAttribute('position'), normals = cap.geometry.getAttribute('normal'), indices = cap.geometry.index!
      assert.equal(cap.geometry.getAttribute('color').count, position.count)
      for (let vertex = 0; vertex < position.count; vertex++) {
        assert.ok(sourcePositions.has(new Vector3().fromBufferAttribute(position, vertex).toArray().join(',')), 'boundary coordinate retained exactly from the source')
        const normal = new Vector3().fromBufferAttribute(normals, vertex)
        assert.ok(Math.abs(normal.length() - 1) < 1e-5, 'finite unit surface normal')
      }
      for (let face = 0; face < indices.count; face += 3) {
        const [a, b, c] = [0, 1, 2].map(corner => new Vector3().fromBufferAttribute(position, indices.getX(face + corner)))
        assert.ok(b!.sub(a!).cross(c!.sub(a!)).lengthSq() > 1e-16, 'no collapsed replacement triangles')
      }
    }
    assert.equal(caps[0]!.geometry.getAttribute('position').count, 28)
    assert.equal(caps[1]!.geometry.getAttribute('position').count, 20)
    assert.ok(caps[0]!.geometry.boundingBox!.max.z < 0.073)
    assert.ok(caps[0]!.geometry.boundingBox!.min.y > 0.842)
    assert.ok(Math.max(...savedPositions.flatMap(positions => positions.filter((_, i) => i % 3 === 2))) > 0.116)
    for (let mesh = 0; mesh < original.length; mesh++) assert.deepEqual(Array.from(original[mesh]!.geometry.getAttribute('position').array), savedPositions[mesh])
  } finally {
    caps.forEach(mesh => mesh.geometry.dispose())
  }
})

test('synthetic scenes without the original territories need no replacement', () => {
  assert.deepEqual(createIllustrativePelvis(new Group()), [])
})
