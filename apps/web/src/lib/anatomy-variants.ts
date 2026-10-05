import { Group, Mesh, Vector3, type BufferGeometry, type Object3D } from 'three'
import type { AnatomicalModelVariant } from '@klisteniapp/scene-schema'
import type { Vec3 } from '@klisteniapp/geometry'
import { inferredMetadata, type AnatomyLandmarks, type SideLandmarks } from './anatomy-rig.ts'
import { createIllustrativePelvis } from './anatomy-variant-surface.ts'

/** Artistic presets, not anthropometric measurements or sex-specific medical data.
 * Keep all layers registered by applying one continuous field to geometry and rig.
 * Height and floor remain unchanged so exercise framing and equipment are shared.
 */
export const anatomyVariantParameters = {
  male: { shoulderWidth: 1, waistWidth: 1, pelvisWidth: 1, chestSurface: 0 },
  female: { shoulderWidth: 0.9, waistWidth: 0.92, pelvisWidth: 1.16, chestSurface: 0.055 },
} as const satisfies Record<AnatomicalModelVariant, object>

const smooth = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t * t * (3 - 2 * t)
}
const band = (height: number, center: number, radius: number) =>
  1 - smooth(Math.abs(height - center) / radius)

/** Pure point mapping; equal source points always remain coincident. */
export function mapAnatomyPoint(point: Vec3, variant: AnatomicalModelVariant, skin = false): Vec3 {
  if (variant === 'male') return [...point]
  const [x, y, z] = point
  const parameters = anatomyVariantParameters[variant]
  const shoulder = band(y, 1.45, 0.24)
  const waist = band(y, 1.12, 0.18)
  const pelvis = band(y, 0.88, 0.32)
  const width = 1 + (parameters.shoulderWidth - 1) * shoulder
    + (parameters.waistWidth - 1) * waist + (parameters.pelvisWidth - 1) * pelvis
  // Surface-only breast contour. Underlying pectorals remain muscle tissue;
  // no new gland, organ, attachment or clinical label is invented.
  const chest = skin ? parameters.chestSurface
    * band(y, 1.335, 0.115) * band(Math.abs(x), 0.09, 0.085)
    * smooth((z - 0.025) / 0.055) : 0
  return [x * width, y, z + chest]
}

export function mapAnatomyLandmarks(landmarks: AnatomyLandmarks, variant: AnatomicalModelVariant): AnatomyLandmarks {
  if (variant === 'male') return structuredClone(landmarks)
  const side = (values: SideLandmarks): SideLandmarks => Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, mapAnatomyPoint(value, variant)]),
  ) as unknown as SideLandmarks
  return {
    version: landmarks.version,
    pelvis: mapAnatomyPoint(landmarks.pelvis, variant),
    neck: mapAnatomyPoint(landmarks.neck, variant),
    headTop: mapAnatomyPoint(landmarks.headTop, variant),
    left: side(landmarks.left),
    right: side(landmarks.right),
    // Contact supports are recalibrated from the transformed external surface.
  }
}

/** Own only temporary geometry. Never mutate or dispose the cached GLTF source. */
export function createAnatomyVariant(source: Object3D, landmarks: AnatomyLandmarks, variant: AnatomicalModelVariant) {
  if (variant === 'male') return { source, landmarks, dispose: () => {} }
  source.updateMatrixWorld(true)
  const group = new Group()
  const geometries: BufferGeometry[] = []
  const point = new Vector3()
  const replacements = createIllustrativePelvis(source)
  const prepare = (object: Object3D) => {
    if (!(object instanceof Mesh) || !object.geometry.getAttribute('position')) return
    const metadata = { ...object.parent?.userData, ...object.userData }
    const tissue = inferredMetadata(metadata, object.name).tissue
    const geometry = object.geometry.clone()
    geometry.applyMatrix4(object.matrixWorld)
    const position = geometry.getAttribute('position')
    for (let vertex = 0; vertex < position.count; vertex++) {
      point.fromBufferAttribute(position, vertex)
      const mapped = mapAnatomyPoint([point.x, point.y, point.z], variant, tissue === 'skin')
      position.setXYZ(vertex, ...mapped)
    }
    // Transform original smooth normals by the field's inverse-transpose
    // Jacobian, retaining anatomical creases and seams from the source atlas.
    const normal = geometry.getAttribute('normal')
    if (normal) {
      const original = object.geometry.getAttribute('position')
      const epsilon = 0.00001
      for (let vertex = 0; vertex < position.count; vertex++) {
        point.fromBufferAttribute(original, vertex).applyMatrix4(object.matrixWorld)
        const p: Vec3 = [point.x, point.y, point.z]
        const derivative = (axis: number) => {
          const before: Vec3 = [...p], after: Vec3 = [...p]
          before[axis] -= epsilon; after[axis] += epsilon
          const a = mapAnatomyPoint(before, variant, tissue === 'skin')
          const b = mapAnatomyPoint(after, variant, tissue === 'skin')
          return new Vector3(...b).sub(new Vector3(...a)).multiplyScalar(1 / (2 * epsilon))
        }
        const dx = derivative(0), dy = derivative(1), dz = derivative(2)
        const nx = normal.getX(vertex), ny = normal.getY(vertex), nz = normal.getZ(vertex)
        const transformed = new Vector3().crossVectors(dy, dz).multiplyScalar(nx)
          .add(new Vector3().crossVectors(dz, dx).multiplyScalar(ny))
          .add(new Vector3().crossVectors(dx, dy).multiplyScalar(nz)).normalize()
        normal.setXYZ(vertex, transformed.x, transformed.y, transformed.z)
      }
    }
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    geometries.push(geometry)
    const mesh = new Mesh(geometry, object.material)
    mesh.name = object.name
    mesh.userData = metadata
    group.add(mesh)
  }
  try {
    source.traverse(object => {
      const name = object.userData.anatomyName ?? object.parent?.userData.anatomyName ?? object.name
      if (replacements.length && /^Urogenital region\.[lr]$/.test(name)) return
      prepare(object)
    })
    replacements.forEach(prepare)
  } finally {
    replacements.forEach(mesh => mesh.geometry.dispose())
  }
  return { source: group, landmarks: mapAnatomyLandmarks(landmarks, variant), dispose: () => geometries.forEach(geometry => geometry.dispose()) }
}
