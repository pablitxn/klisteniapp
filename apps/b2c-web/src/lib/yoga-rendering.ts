import { Box3, OrthographicCamera, Vector3 } from 'three'
import type { YogaAsanaId, YogaPracticeStep } from '@klisteniapp/scene-schema'
import type { PreparedAnatomy } from './anatomy-model.ts'
import { yogaPreviewSide } from './yoga-preview-assets.ts'

export type YogaSide = YogaPracticeStep['side']
export type YogaLayer = 'skin' | 'muscles' | 'skeleton' | 'combined'
export type YogaView = 'perspective' | 'front' | 'side' | 'back'
export const yogaCameraPadding = 1.18
export const yogaCameraDistance = 6

const standing = new Set<YogaAsanaId>([
  'tadasana', 'uttanasana', 'ardha-uttanasana', 'utkatasana',
  'virabhadrasana-i', 'virabhadrasana-ii', 'trikonasana', 'vrksasana',
])
const profile = new Set<YogaAsanaId>([
  'balasana', 'marjaryasana', 'bitilasana', 'adho-mukha-svanasana',
  'uttanasana', 'ardha-uttanasana', 'utkatasana', 'virabhadrasana-i',
  'anjaneyasana', 'dandasana', 'paschimottanasana', 'janu-sirsasana',
  'bhujangasana', 'salabhasana', 'setu-bandha-sarvangasana',
])

export function yogaFloorExercise(id: YogaAsanaId) { return !standing.has(id) }

/** The camera side follows the active anatomical side, never a mirrored image. */
export function yogaCameraDirection(id: YogaAsanaId, view: YogaView = 'perspective', side: YogaSide = 'both') {
  const sign = yogaPreviewSide(id, side) === 'right' ? -1 : 1
  if (view === 'front') return new Vector3(0, 0.08, 1)
  if (view === 'back') return new Vector3(0, 0.08, -1)
  if (view === 'side') return new Vector3(sign, 0.08, 0)
  if (id === 'supta-padangusthasana') return new Vector3(sign * 5.2, 2.2, 1.6).normalize()
  if (id === 'savasana') return new Vector3(sign * 3.5, 4.2, 2.2).normalize()
  // Low side views expose the spine's curve, elbow extension and hip hinge;
  // looking down at these poses obscures the very alignment being taught.
  if (id === 'marjaryasana' || id === 'bitilasana') return new Vector3(sign * 5.2, 1.25, 1.45).normalize()
  if (id === 'balasana' || id === 'bhujangasana' || id === 'salabhasana') return new Vector3(sign * 5.2, 1.7, 2).normalize()
  if (profile.has(id)) return new Vector3(sign * 4.8, yogaFloorExercise(id) ? 1.9 : 1.25, 2).normalize()
  if (id === 'virabhadrasana-ii' || id === 'trikonasana') return new Vector3(sign * 1.2, 1.2, 5.4).normalize()
  if (id === 'ardha-matsyendrasana') return new Vector3(sign * 3, 2.8, 5).normalize()
  return new Vector3(sign * 1.9, yogaFloorExercise(id) ? 2.4 : 1, 5.2).normalize()
}

/** Measure the actual posed vertices, including the selected visual morphology. */
export function measureYogaBounds(anatomy: PreparedAnatomy): Box3 {
  anatomy.group.updateMatrixWorld(true)
  anatomy.rig.skeleton.update()
  const bounds = new Box3()
  for (const { mesh } of anatomy.batches) {
    if (!mesh.visible) continue
    // SkinnedMesh.computeBoundingBox samples deformed vertices, not the bind pose.
    mesh.computeBoundingBox()
    if (mesh.boundingBox) bounds.union(mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld))
  }
  if (bounds.isEmpty()) throw new Error('No visible anatomy to frame')
  return bounds
}

/** Shared live/capture camera framing with padding at every viewport aspect. */
export function fitYogaCamera(camera: OrthographicCamera, bounds: Box3, aspect: number, id: YogaAsanaId, view: YogaView = 'perspective', side: YogaSide = 'both') {
  if (bounds.isEmpty() || !Number.isFinite(aspect) || aspect <= 0) throw new Error('Invalid yoga camera bounds or aspect')
  const target = bounds.getCenter(new Vector3())
  camera.position.copy(target).addScaledVector(yogaCameraDirection(id, view, side), yogaCameraDistance)
  camera.up.set(0, 1, 0)
  camera.lookAt(target)
  camera.updateMatrixWorld(true)
  const projected = new Box3()
  const corner = new Vector3()
  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) projected.expandByPoint(corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse))
    }
  }
  const center = projected.getCenter(new Vector3())
  const offset = new Vector3(center.x, center.y, 0).applyQuaternion(camera.quaternion)
  target.add(offset)
  camera.position.add(offset)
  const size = projected.getSize(new Vector3())
  const height = Math.max(size.y, size.x / aspect, 0.3) * yogaCameraPadding
  camera.left = -height * aspect / 2
  camera.right = height * aspect / 2
  camera.top = height / 2
  camera.bottom = -height / 2
  camera.near = 0.01
  camera.far = 80
  camera.zoom = 1
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  return { target, height, position: camera.position.clone() }
}
