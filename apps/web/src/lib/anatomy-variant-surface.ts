import { BufferGeometry, Float32BufferAttribute, Mesh, ShapeUtils, Vector2, Vector3, type Object3D } from 'three'

const sourceName = /^Urogenital region\.[lr]$/
const weldKey = (point: Vector3) => [point.x, point.y, point.z].map(value => Math.round(value * 1e6)).join(',')

/**
 * Replace the male atlas's external genital surface with two neutral educational
 * caps. This is an illustrative surface, not reconstructed female genital anatomy.
 * The two source territories must be joined before finding boundaries: their
 * shared midsagittal seam contains the male protrusion and must not be retained.
 * Every cap boundary position comes directly from the source, without rounding.
 * Returned meshes use world coordinates, identity transforms and shared materials;
 * the caller owns only their geometries. The source is never modified.
 */
export function createIllustrativePelvis(source: Object3D): Mesh[] {
  source.updateMatrixWorld(true)
  const territories: Mesh[] = []
  source.traverse(object => {
    if (!(object instanceof Mesh)) return
    const metadata = { ...object.parent?.userData, ...object.userData }
    if (sourceName.test(String(metadata.anatomyName ?? object.name))) territories.push(object)
  })
  if (!territories.length) return []
  if (territories.length !== 2) throw new Error('Illustrative pelvis requires both source surface territories')

  const points: Vector3[] = [], colors: number[][] = []
  const welded = new Map<string, number>()
  const edges = new Map<string, { from: number; to: number; count: number }>()
  for (const mesh of territories) {
    const position = mesh.geometry.getAttribute('position'), color = mesh.geometry.getAttribute('color')
    const vertices: number[] = []
    for (let vertex = 0; vertex < position.count; vertex++) {
      const point = new Vector3().fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld)
      const key = weldKey(point)
      let index = welded.get(key)
      if (index === undefined) {
        index = points.length
        welded.set(key, index)
        points.push(point)
        colors.push(color ? [color.getX(vertex), color.getY(vertex), color.getZ(vertex)] : [1, 1, 1])
      }
      vertices.push(index)
    }
    const index = mesh.geometry.index
    const count = index?.count ?? position.count
    for (let face = 0; face < count; face += 3) {
      const triangle = [0, 1, 2].map(corner => vertices[index ? index.getX(face + corner) : face + corner]!)
      for (let corner = 0; corner < 3; corner++) {
        const from = triangle[corner]!, to = triangle[(corner + 1) % 3]!
        const key = from < to ? `${from},${to}` : `${to},${from}`
        const existing = edges.get(key)
        if (existing) existing.count++
        else edges.set(key, { from, to, count: 1 })
      }
    }
  }
  if ([...edges.values()].some(edge => edge.count > 2)) throw new Error('Non-manifold source pelvic surface')
  const boundary = [...edges.values()].filter(edge => edge.count === 1)
  const next = new Map<number, number>()
  for (const edge of boundary) {
    if (next.has(edge.from)) throw new Error('Ambiguous source pelvic boundary')
    next.set(edge.from, edge.to)
  }
  const loops: number[][] = [], seen = new Set<number>()
  for (const start of next.keys()) {
    if (seen.has(start)) continue
    const loop: number[] = []
    let at = start
    while (!seen.has(at)) {
      seen.add(at)
      loop.push(at)
      const following = next.get(at)
      if (following === undefined) throw new Error('Open source pelvic boundary')
      at = following
    }
    if (at !== start || loop.length < 3) throw new Error('Invalid source pelvic boundary')
    loops.push(loop)
  }
  if (loops.length !== 2) throw new Error('Expected anterior and perineal source pelvic boundaries')
  loops.sort((a, b) => Math.max(...b.map(vertex => points[vertex]!.z)) - Math.max(...a.map(vertex => points[vertex]!.z)))

  return loops.map((loop, part) => {
    const normal = new Vector3()
    for (let vertex = 0; vertex < loop.length; vertex++) {
      const a = points[loop[vertex]!]!, b = points[loop[(vertex + 1) % loop.length]!]!
      normal.x += (a.y - b.y) * (a.z + b.z)
      normal.y += (a.z - b.z) * (a.x + b.x)
      normal.z += (a.x - b.x) * (a.y + b.y)
    }
    if (normal.lengthSq() < 1e-12) throw new Error('Degenerate source pelvic boundary')
    normal.normalize()
    const components = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)]
    const dominant = components.indexOf(Math.max(...components))
    const contour = loop.map(vertex => {
      const p = points[vertex]!
      return dominant === 0 ? new Vector2(p.y, p.z) : dominant === 1 ? new Vector2(p.x, p.z) : new Vector2(p.x, p.y)
    })
    const faces = ShapeUtils.triangulateShape(contour, [])
    if (faces.length !== loop.length - 2) throw new Error('Unable to triangulate source pelvic boundary')
    for (const face of faces) {
      const [a, b, c] = face.map(vertex => points[loop[vertex]!]!)
      const cross = new Vector3().subVectors(b!, a!).cross(new Vector3().subVectors(c!, a!))
      if (cross.lengthSq() < 1e-16) throw new Error('Degenerate illustrative pelvic triangle')
      // Match the oriented contour in its projection. A nonplanar perineal
      // triangle may tilt beyond the average normal; flipping that triangle
      // independently would tear the cap's winding along an internal edge.
      if (cross.getComponent(dominant) * normal.getComponent(dominant) < 0) [face[1], face[2]] = [face[2]!, face[1]!]
    }
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(loop.flatMap(vertex => points[vertex]!.toArray()), 3))
    geometry.setAttribute('color', new Float32BufferAttribute(loop.flatMap(vertex => colors[vertex]!), 3))
    geometry.setIndex(faces.flat())
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, territories[0]!.material)
    mesh.name = `Illustrative pelvic surface (${part === 0 ? 'anterior' : 'perineal'})`
    mesh.userData = {
      ...territories[0]!.parent?.userData, ...territories[0]!.userData,
      anatomyName: mesh.name, tissue: 'skin', bodySegment: 'pelvis', side: undefined,
      illustrativeSurface: true,
      sourceAnatomyNames: ['Urogenital region.l', 'Urogenital region.r'],
    }
    return mesh
  })
}
