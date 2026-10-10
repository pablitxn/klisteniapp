import {
  Box3,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SkinnedMesh,
  Sphere,
  Triangle,
  Uint16BufferAttribute,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { getExercisePose } from '@klisteniapp/geometry'
import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'
import { createAnatomyVariant } from './anatomy-variants.ts'
import {
  createAnatomyRig,
  inferredMetadata,
  segmentFrame,
  vertexInfluences,
  type AnatomyLandmarks,
  type AnatomyRig,
  type StructureMetadata,
  type SkinInfluence,
  type Tissue,
} from './anatomy-rig.ts'

export interface StructureRange {
  startFace: number
  endFace: number
  name: string
  muscleId: string | null
}
export interface AnatomyBatch {
  mesh: SkinnedMesh<BufferGeometry, MeshStandardMaterial>
  tissue: Tissue
  muscleId: string | null
  structures: StructureRange[]
}
export interface PreparedAnatomy {
  group: Group
  rig: AnatomyRig
  batches: AnatomyBatch[]
  sourceStructures: number
  vertexCount: number
  triangles: number
  dispose: () => void
}
/** Optional preparation hooks keep specialised educational rigs isolated. */
export interface AnatomyPreparationOptions {
  createRig?: (landmarks: AnatomyLandmarks) => AnatomyRig
  influences?: (
    rig: AnatomyRig,
    position: Vector3,
    metadata: StructureMetadata,
    structureCenter: Vector3,
  ) => SkinInfluence
}
interface PendingBatch {
  geometries: BufferGeometry[]
  tissue: Tissue
  muscleId: string | null
  structures: StructureRange[]
  faceCount: number
}

/** Bake each source transform exactly once, and retain its original anatomical faces/colors. */
function prepareGeometry(
  mesh: Mesh,
  rig: AnatomyRig,
  metadata: StructureMetadata,
  territory: number,
  options: AnatomyPreparationOptions,
): BufferGeometry {
  const source = mesh.geometry
  const geometry = new BufferGeometry()
  const sourcePosition = source.getAttribute('position')
  const positions = new Float32Array(sourcePosition.count * 3)
  const position = new Vector3()
  for (let i = 0; i < sourcePosition.count; i++) {
    position
      .fromBufferAttribute(sourcePosition, i)
      .applyMatrix4(mesh.matrixWorld)
    position.toArray(positions, i * 3)
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  // A rigid source structure must receive one transform for all its vertices.
  const structureCenter = new Vector3()
  if (options.influences && metadata.tissue === 'bone') {
    geometry.computeBoundingBox()
    geometry.boundingBox!.getCenter(structureCenter)
  }
  // Recomputing would erase creases and the original smooth shading. Transform source normals.
  const normal = source.getAttribute('normal')
  if (normal) {
    const normals = new Float32Array(normal.count * 3)
    const normalTransform = mesh.matrixWorld.clone().invert().transpose()
    for (let i = 0; i < normal.count; i++)
      position
        .fromBufferAttribute(normal, i)
        .transformDirection(normalTransform)
        .toArray(normals, i * 3)
    geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3))
  }
  const colors = new Float32Array(sourcePosition.count * 3),
    sourceColor = source.getAttribute('color')
  for (let i = 0; i < sourcePosition.count; i++) {
    colors[i * 3] = sourceColor?.getX(i) ?? 1
    colors[i * 3 + 1] = sourceColor?.getY(i) ?? 1
    colors[i * 3 + 2] = sourceColor?.getZ(i) ?? 1
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(
    source.index
      ? Array.from(source.index.array)
      : Array.from({ length: sourcePosition.count }, (_, i) => i),
  )
  if (!normal) geometry.computeVertexNormals()
  const skinIndices = new Uint16Array(sourcePosition.count * 4),
    skinWeights = new Float32Array(sourcePosition.count * 4)
  for (let i = 0; i < sourcePosition.count; i++) {
    position.fromArray(positions, i * 3)
    const influence = options.influences
      ? options.influences(rig, position, metadata, structureCenter)
      : vertexInfluences(rig, position, metadata)
    skinIndices.set(influence.indices, i * 4)
    skinWeights.set(influence.weights, i * 4)
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(skinIndices, 4))
  geometry.setAttribute(
    'skinWeight',
    new Float32BufferAttribute(skinWeights, 4),
  )
  if (metadata.tissue === 'skin')
    geometry.setAttribute(
      'skinTerritory',
      new Uint16BufferAttribute(
        new Uint16Array(sourcePosition.count).fill(territory),
        1,
      ),
    )
  return geometry
}

/** Contact planes come from the registered external surface, not mannequin radii. */
export function calibrateSurfaceSupports(
  source: Object3D,
  landmarks: AnatomyLandmarks,
): AnatomyLandmarks {
  const shoulderY =
    (landmarks.left.shoulder[1] + landmarks.right.shoulder[1]) / 2
  const shoulderZ =
    (landmarks.left.shoulder[2] + landmarks.right.shoulder[2]) / 2
  let shoulderBack = Infinity,
    headBack = Infinity,
    pelvisBack = Infinity,
    pelvisFront = -Infinity,
    proneTorsoBottom = Infinity
  const proneAngle = getExercisePose('prone-hip-extension', 0).torsoAngle
  const torsoProfile: [number, number, number][] = []
  const handBottom = { left: Infinity, right: Infinity }
  const bindRig = createAnatomyRig(landmarks)
  const flatHand = segmentFrame(
    new Vector3(),
    new Vector3(0, 0, 1),
    new Vector3(0, -1, 0),
  )
  const handTransforms = {
    left: flatHand
      .clone()
      .multiply(bindRig.byKey.get('hand.left')!.bindMatrix.clone().invert()),
    right: flatHand
      .clone()
      .multiply(bindRig.byKey.get('hand.right')!.bindMatrix.clone().invert()),
  }
  const position = new Vector3()
  const sides = { left: { ...landmarks.left }, right: { ...landmarks.right } }
  source.updateMatrixWorld(true)
  source.traverse((object) => {
    if (!(object instanceof Mesh)) return
    const metadata = inferredMetadata(
      { ...object.parent?.userData, ...object.userData },
      object.name,
    )
    if (metadata.bodySegment === 'scapula' && metadata.side) {
      const center = new Box3().setFromObject(object).getCenter(new Vector3())
      sides[metadata.side].scapula = [center.x, center.y, center.z]
    }
    if (metadata.tissue !== 'skin') return
    const vertices = object.geometry.getAttribute('position')
    if (!vertices) return
    for (let i = 0; i < vertices.count; i++) {
      position.fromBufferAttribute(vertices, i).applyMatrix4(object.matrixWorld)
      if (metadata.bodySegment === 'torso') {
        proneTorsoBottom = Math.min(proneTorsoBottom,
          (position.y - landmarks.pelvis[1]) * Math.cos(proneAngle)
          - (position.z - landmarks.pelvis[2]) * Math.sin(proneAngle))
        torsoProfile.push([0, position.y, position.z])
      }
      if (
        Math.abs(position.x) < 0.24 &&
        Math.abs(position.y - shoulderY) < 0.07
      )
        shoulderBack = Math.min(shoulderBack, position.z)
      if (position.y > landmarks.neck[1] + 0.025)
        headBack = Math.min(headBack, position.z)
      if (
        Math.abs(position.x) < 0.22 &&
        Math.abs(position.y - landmarks.pelvis[1]) < 0.115
      ) {
        pelvisBack = Math.min(pelvisBack, position.z)
        pelvisFront = Math.max(pelvisFront, position.z)
      }
      if (metadata.bodySegment === 'hand' && metadata.side) {
        const flat = position
          .clone()
          .applyMatrix4(handTransforms[metadata.side])
        handBottom[metadata.side] = Math.min(handBottom[metadata.side], flat.y)
      }
    }
  })
  bindRig.skeleton.dispose()
  if (![shoulderBack, headBack, pelvisBack].every(Number.isFinite))
    return landmarks
  const clearance = 0.002
  // The convex silhouette in the Y/Z plane has the same support extrema as
  // every torso vertex, with only a few points to check while animating.
  const points = torsoProfile.sort((a, b) => a[1] - b[1] || a[2] - b[2])
    .filter((value, index, all) => index === 0 || value[1] !== all[index - 1]![1] || value[2] !== all[index - 1]![2])
  const cross = (a: number[], b: number[], c: number[]) => (b[1]! - a[1]!) * (c[2]! - a[2]!) - (b[2]! - a[2]!) * (c[1]! - a[1]!)
  const half = (values: typeof torsoProfile) => {
    const hull: typeof torsoProfile = []
    for (const p of values) {
      while (hull.length > 1 && cross(hull.at(-2)!, hull.at(-1)!, p) <= 0) hull.pop()
      hull.push(p)
    }
    return hull.slice(0, -1)
  }
  const silhouette = [...half(points), ...half([...points].reverse())]
  return {
    ...landmarks,
    ...sides,
    support: {
      shoulderHeight: clearance + shoulderZ - shoulderBack,
      headNeckHeight: clearance + landmarks.neck[2] - headBack,
      pelvisHeight: clearance + landmarks.pelvis[2] - pelvisBack,
      ...(Number.isFinite(pelvisFront) ? { pronePelvisFloorHeight: clearance + pelvisFront - landmarks.pelvis[2] } : {}),
      ...(Number.isFinite(proneTorsoBottom) ? { pronePelvisHeight: clearance - proneTorsoBottom } : {}),
      torsoProfile: silhouette,
      ...(Number.isFinite(handBottom.left) && Number.isFinite(handBottom.right)
        ? {
            handHeight: {
              left: 0.002 - handBottom.left,
              right: 0.002 - handBottom.right,
            },
          }
        : {}),
    },
  }
}

/**
 * Source skin territories duplicate their shared boundary vertices. Give coincident
 * positions one common deformation, so raising a limb cannot open a skin seam.
 * Tolerance is 0.01 mm. Source positions/normals are unchanged; verified boundary
 * T-junctions split existing triangles to share their exact deformed vertex.
 */
export function harmonizeSkinSeams(
  geometry: BufferGeometry,
  structures: StructureRange[] = [],
): number {
  const position = geometry.getAttribute('position'),
    indices = geometry.getAttribute('skinIndex'),
    weights = geometry.getAttribute('skinWeight')
  const tolerance = 1e-5,
    toleranceSquared = tolerance * tolerance
  const cells = new Map<string, number[]>()
  const groups: number[][] = []
  const vertexGroup = new Uint32Array(position.count)
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i)
    const cx = Math.floor(x / tolerance),
      cy = Math.floor(y / tolerance),
      cz = Math.floor(z / tolerance)
    let found = -1
    for (let dx = -1; dx <= 1 && found < 0; dx++)
      for (let dy = -1; dy <= 1 && found < 0; dy++)
        for (let dz = -1; dz <= 1 && found < 0; dz++) {
          const candidates = cells.get(
            cx + dx + ':' + (cy + dy) + ':' + (cz + dz),
          )
          if (!candidates) continue
          for (const groupId of candidates) {
            const other = groups[groupId]![0]!
            if (
              (position.getX(other) - x) ** 2 +
                (position.getY(other) - y) ** 2 +
                (position.getZ(other) - z) ** 2 <=
              toleranceSquared
            ) {
              found = groupId
              break
            }
          }
        }
    if (found >= 0) {
      groups[found]!.push(i)
      vertexGroup[i] = found
    } else {
      const key = cx + ':' + cy + ':' + cz,
        groupId = groups.length
      groups.push([i])
      vertexGroup[i] = groupId
      const cell = cells.get(key)
      if (cell) cell.push(groupId)
      else cells.set(key, [groupId])
    }
  }
  const territory = geometry.getAttribute('skinTerritory')
  let joined = 0
  for (const matches of groups) {
    if (matches.length < 2) continue
    // Equal votes for source territories, independent of normal/color seam duplication.
    const territories = new Map<
      number,
      { count: number; weights: Map<number, number> }
    >()
    for (const vertex of matches) {
      const id = territory?.getX(vertex) ?? vertex
      let item = territories.get(id)
      if (!item) {
        item = { count: 0, weights: new Map() }
        territories.set(id, item)
      }
      item.count++
      for (let slot = 0; slot < 4; slot++) {
        const index = indices.getComponent(vertex, slot),
          weight = weights.getComponent(vertex, slot)
        if (weight > 0)
          item.weights.set(index, (item.weights.get(index) ?? 0) + weight)
      }
    }
    const combined = new Map<number, number>()
    for (const item of territories.values())
      for (const [index, weight] of item.weights)
        combined.set(index, (combined.get(index) ?? 0) + weight / item.count)
    const strongest = [...combined]
      .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      .slice(0, 4)
    const sum = strongest.reduce((total, [, weight]) => total + weight, 0)
    for (const vertex of matches)
      for (let slot = 0; slot < 4; slot++) {
        indices.setComponent(vertex, slot, strongest[slot]?.[0] ?? 0)
        weights.setComponent(vertex, slot, (strongest[slot]?.[1] ?? 0) / sum)
      }
    joined += matches.length
  }
  // A boundary vertex can meet the middle of a neighboring territory's edge.
  // Reconcile only genuinely coincident T-junctions; never bridge anatomical holes.
  const triangleIndex = geometry.index
  if (triangleIndex && territory) {
    type Edge = { a: number; b: number; territory: number; count: number }
    const allEdges = new Map<string, Edge>()
    for (let face = 0; face < triangleIndex.count; face += 3) {
      const triangle = [
        triangleIndex.getX(face),
        triangleIndex.getX(face + 1),
        triangleIndex.getX(face + 2),
      ]
      const owner = territory.getX(triangle[0]!)
      for (let corner = 0; corner < 3; corner++) {
        const first = vertexGroup[triangle[corner]!]!,
          second = vertexGroup[triangle[(corner + 1) % 3]!]!
        if (first === second) continue
        const a = Math.min(first, second),
          b = Math.max(first, second),
          key = owner + ':' + a + ':' + b
        const edge = allEdges.get(key)
        if (edge) edge.count++
        else allEdges.set(key, { a, b, territory: owner, count: 1 })
      }
    }
    const boundaryEdges = [...allEdges.values()].filter(
      (edge) => edge.count === 1,
    )
    const boundaryGroups = new Set(
      boundaryEdges.flatMap((edge) => [edge.a, edge.b]),
    )
    // The source atlas has 0.15–2.19 mm gaps between axillary territories.
    // Give a verified nearby boundary point and its neighboring triangle ONE
    // affine deformation. This preserves the original small gap without caps,
    // position welding, or a larger tolerance elsewhere in the body.
    const territoryNames = new Map<number, string>()
    for (const structure of structures)
      territoryNames.set(
        territory.getX(triangleIndex.getX(structure.startFace * 3)),
        structure.name,
      )
    const axillaryPair = (first: string, second: string) =>
      (/^Lateral region of thorax[.]/i.test(first) &&
        /^(Anterior region of arm|Posterior region of arm|Deltopectoral triangle)[.]/i.test(
          second,
        )) ||
      (/^Lateral region of thorax[.]/i.test(second) &&
        /^(Anterior region of arm|Posterior region of arm|Deltopectoral triangle)[.]/i.test(
          first,
        ))
    const axillaryTriangles: { vertices: number[]; name: string }[] = []
    for (let face = 0; face < triangleIndex.count; face += 3) {
      const vertices = [
        triangleIndex.getX(face),
        triangleIndex.getX(face + 1),
        triangleIndex.getX(face + 2),
      ]
      const name = territoryNames.get(territory.getX(vertices[0]!)) ?? ''
      if (
        /^(Lateral region of thorax|Anterior region of arm|Posterior region of arm|Deltopectoral triangle)[.]/i.test(
          name,
        )
      )
        axillaryTriangles.push({ vertices, name })
    }
    const parents = new Map<number, number>()
    const find = (id: number): number => {
      const parent = parents.get(id)
      if (parent === undefined) {
        parents.set(id, id)
        return id
      }
      if (parent === id) return id
      const root = find(parent)
      parents.set(id, root)
      return root
    }
    const unite = (first: number, second: number) => {
      const a = find(first),
        b = find(second)
      if (a !== b) parents.set(Math.max(a, b), Math.min(a, b))
    }
    const triangle = new Triangle(),
      point = new Vector3(),
      closest = new Vector3()
    for (const groupId of boundaryGroups) {
      const matches = groups[groupId]!,
        first = matches[0]!,
        owner = territory.getX(first)
      if (matches.some((vertex) => territory.getX(vertex) !== owner)) continue
      const name = territoryNames.get(owner) ?? ''
      point.fromBufferAttribute(position, first)
      let nearest = 0.003 ** 2,
        adjacent: number[] | undefined
      for (const candidate of axillaryTriangles) {
        if (!axillaryPair(name, candidate.name)) continue
        triangle.a.fromBufferAttribute(position, candidate.vertices[0]!)
        triangle.b.fromBufferAttribute(position, candidate.vertices[1]!)
        triangle.c.fromBufferAttribute(position, candidate.vertices[2]!)
        triangle.closestPointToPoint(point, closest)
        const squaredDistance = point.distanceToSquared(closest)
        if (squaredDistance < nearest) {
          nearest = squaredDistance
          adjacent = candidate.vertices
        }
      }
      if (adjacent)
        for (const vertex of adjacent) unite(groupId, vertexGroup[vertex]!)
    }
    const localGroups = new Map<number, number[]>()
    for (const id of parents.keys()) {
      const root = find(id),
        connected = localGroups.get(root) ?? []
      connected.push(id)
      localGroups.set(root, connected)
    }
    for (const connected of localGroups.values()) {
      const combined = new Map<number, number>()
      for (const id of connected) {
        const vertex = groups[id]![0]!
        for (let slot = 0; slot < 4; slot++) {
          const bone = indices.getComponent(vertex, slot),
            weight = weights.getComponent(vertex, slot)
          combined.set(bone, (combined.get(bone) ?? 0) + weight)
        }
      }
      const strongest = [...combined]
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
        .slice(0, 4)
      const sum = strongest.reduce((total, [, weight]) => total + weight, 0)
      for (const id of connected)
        for (const vertex of groups[id]!)
          for (let slot = 0; slot < 4; slot++) {
            indices.setComponent(vertex, slot, strongest[slot]?.[0] ?? 0)
            weights.setComponent(
              vertex,
              slot,
              (strongest[slot]?.[1] ?? 0) / sum,
            )
          }
    }
    // Conform the topology instead of interpolating LBS weights: under rotation,
    // interpolated weights do not put a point exactly on the deformed edge.
    const subdivisions = new Map<string, { amount: number; vertex: number }[]>()
    for (const groupId of boundaryGroups) {
      const matches = groups[groupId]!,
        first = matches[0]!
      const owners = new Set(matches.map((vertex) => territory.getX(vertex)))
      const x = position.getX(first),
        y = position.getY(first),
        z = position.getZ(first)
      for (const edge of boundaryEdges) {
        if (
          owners.has(edge.territory) ||
          edge.a === groupId ||
          edge.b === groupId
        )
          continue
        const a = groups[edge.a]![0]!,
          b = groups[edge.b]![0]!
        const ax = position.getX(a),
          ay = position.getY(a),
          az = position.getZ(a)
        const dx = position.getX(b) - ax,
          dy = position.getY(b) - ay,
          dz = position.getZ(b) - az
        const squaredLength = dx * dx + dy * dy + dz * dz
        if (squaredLength < 1e-12) continue
        const amount =
          ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / squaredLength
        if (amount <= 1e-6 || amount >= 1 - 1e-6) continue
        const distanceSquared =
          (x - ax - amount * dx) ** 2 +
          (y - ay - amount * dy) ** 2 +
          (z - az - amount * dz) ** 2
        if (distanceSquared > toleranceSquared) continue
        const key = edge.territory + ':' + edge.a + ':' + edge.b
        const split = subdivisions.get(key) ?? []
        split.push({ amount, vertex: first })
        subdivisions.set(key, split)
      }
    }
    const newIndex: number[] = [],
      faceCounts = new Array<number>(structures.length).fill(0)
    let structureIndex = 0
    for (let face = 0; face < triangleIndex.count; face += 3) {
      const original = [
        triangleIndex.getX(face),
        triangleIndex.getX(face + 1),
        triangleIndex.getX(face + 2),
      ]
      const owner = territory.getX(original[0]!)
      let triangles = [original]
      for (let corner = 0; corner < 3; corner++) {
        const startVertex = original[corner]!,
          endVertex = original[(corner + 1) % 3]!
        const startGroup = vertexGroup[startVertex]!,
          endGroup = vertexGroup[endVertex]!
        const a = Math.min(startGroup, endGroup),
          b = Math.max(startGroup, endGroup)
        const splits = subdivisions.get(owner + ':' + a + ':' + b)
        if (!splits) continue
        const ordered = [...splits].sort((first, second) =>
          startGroup === a
            ? first.amount - second.amount
            : second.amount - first.amount,
        )
        let previous = startVertex
        for (const split of ordered) {
          const next: number[][] = []
          for (const triangle of triangles) {
            const edgeStart = triangle.findIndex(
              (vertex, index) =>
                vertex === previous && triangle[(index + 1) % 3] === endVertex,
            )
            if (edgeStart < 0) {
              next.push(triangle)
              continue
            }
            const opposite = triangle[(edgeStart + 2) % 3]!
            next.push(
              [previous, split.vertex, opposite],
              [split.vertex, endVertex, opposite],
            )
          }
          triangles = next
          previous = split.vertex
        }
      }
      for (const triangle of triangles) newIndex.push(...triangle)
      while (
        structureIndex < structures.length - 1 &&
        face / 3 >= structures[structureIndex]!.endFace
      )
        structureIndex++
      if (structures.length) faceCounts[structureIndex]! += triangles.length
    }
    geometry.setIndex(newIndex)
    let nextFace = 0
    structures.forEach((structure, index) => {
      structure.startFace = nextFace
      nextFace += faceCounts[index]!
      structure.endFace = nextFace
    })
    joined += [...subdivisions.values()].reduce(
      (count, vertices) => count + vertices.length,
      0,
    )
  }
  geometry.deleteAttribute('skinTerritory')
  return joined
}

/** Hundreds of named anatomical structures become a small set of selectable GPU batches. */
export function prepareAnatomy(
  source: Object3D,
  landmarks: AnatomyLandmarks,
  modelVariant: AnatomicalModelVariant = 'male',
  options: AnatomyPreparationOptions = {},
): PreparedAnatomy {
  const variant = createAnatomyVariant(source, landmarks, modelVariant)
  try {
    const prepared = prepareRegisteredAnatomy(variant.source, variant.landmarks, options)
    prepared.group.userData.modelVariant = modelVariant
    prepared.group.name = `Registered anatomical atlas (${modelVariant})`
    return prepared
  } finally {
    variant.dispose()
  }
}

function prepareRegisteredAnatomy(
  source: Object3D,
  landmarks: AnatomyLandmarks,
  options: AnatomyPreparationOptions,
): PreparedAnatomy {
  source.updateMatrixWorld(true)
  const rig = (options.createRig ?? createAnatomyRig)(calibrateSurfaceSupports(source, landmarks)),
    group = new Group(),
    pending = new Map<string, PendingBatch>()
  group.name = 'Registered anatomical atlas'
  let sourceStructures = 0,
    vertexCount = 0,
    triangles = 0
  source.traverse((object) => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position'))
      return
    const metadata = inferredMetadata(
      { ...object.parent?.userData, ...object.userData },
      object.name,
    )
    const geometry = prepareGeometry(object, rig, metadata, sourceStructures, options)
    const key = metadata.tissue + ':' + (metadata.muscleId ?? 'unassigned')
    let batch = pending.get(key)
    if (!batch) {
      batch = {
        geometries: [],
        tissue: metadata.tissue,
        muscleId: metadata.muscleId,
        structures: [],
        faceCount: 0,
      }
      pending.set(key, batch)
    }
    const faces = geometry.index!.count / 3
    batch.geometries.push(geometry)
    batch.structures.push({
      startFace: batch.faceCount,
      endFace: batch.faceCount + faces,
      name: metadata.anatomyName,
      muscleId: metadata.muscleId,
    })
    batch.faceCount += faces
    sourceStructures++
    vertexCount += geometry.getAttribute('position').count
    triangles += faces
  })
  if (sourceStructures === 0)
    throw new Error('El archivo anatómico no contiene superficies válidas.')
  for (const segment of rig.segments) group.add(segment.bone)
  const batches: AnatomyBatch[] = []
  for (const batch of pending.values()) {
    const geometry = mergeGeometries(batch.geometries, false)
    for (const original of batch.geometries) original.dispose()
    if (!geometry)
      throw new Error('No se pudieron preparar las superficies anatómicas.')
    if (batch.tissue === 'skin') {
      harmonizeSkinSeams(geometry, batch.structures)
      triangles += geometry.index!.count / 3 - batch.faceCount
    }
    const material = new MeshStandardMaterial({
      color: '#ffffff',
      vertexColors: true,
      roughness:
        batch.tissue === 'bone' ? 0.48 : batch.tissue === 'skin' ? 0.65 : 0.59,
      metalness: 0,
    })
    const mesh = new SkinnedMesh(geometry, material)
    mesh.name = batch.tissue + ':' + (batch.muscleId ?? 'anatomy')
    mesh.bind(rig.skeleton, new Matrix4())
    // Conservative analytic bound covers all supported poses. Avoid a CPU vertex scan every frame.
    mesh.boundingSphere = new Sphere(new Vector3(0, 0.65, 0), 3)
    mesh.frustumCulled = false
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData = { tissue: batch.tissue, muscleId: batch.muscleId }
    group.add(mesh)
    batches.push({
      mesh,
      tissue: batch.tissue,
      muscleId: batch.muscleId,
      structures: batch.structures,
    })
  }
  return {
    group,
    rig,
    batches,
    sourceStructures,
    vertexCount,
    triangles,
    dispose: () => {
      for (const batch of batches) {
        batch.mesh.geometry.dispose()
        batch.mesh.material.dispose()
      }
      rig.skeleton.dispose()
    },
  }
}

/** Preserve exact original structure identification after merging geometry by region. */
export function structureAtFace(
  batch: AnatomyBatch,
  faceIndex: number,
): StructureRange | undefined {
  let lo = 0,
    hi = batch.structures.length - 1
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2),
      structure = batch.structures[mid]!
    if (faceIndex < structure.startFace) hi = mid - 1
    else if (faceIndex >= structure.endFace) lo = mid + 1
    else return structure
  }
}
