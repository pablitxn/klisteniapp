import {
  AmbientLight,
  Box3,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  OrthographicCamera,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { AnatomicalModelVariantSchema, type AnatomicalModelVariant, type MuscleId } from '@klisteniapp/scene-schema'
import { prepareAnatomy } from './lib/anatomy-model'
import { parseAnatomyLandmarks } from './lib/anatomy-rig'
import { anatomyRendererOptions } from './lib/anatomy-render-settings'
import { bodyPreviewCameras, bodyPreviewPadding } from './lib/body-preview-config'

interface RegionCapture {
  modelVariant: AnatomicalModelVariant
  png: string
  structures: string[]
  triangles: number
  bounds: { min: number[]; max: number[] }
  camera: { position: number[]; target: number[]; height: number }
}

declare global {
  interface Window {
    __bodyCapture?: { frame: (id: MuscleId) => Promise<RegionCapture> }
  }
}

// Separate development entry: no application UI, accounts, analytics or exercise poses.
// Geometry, tendon colours, region identities and selected morphology use the live parser.
const modelVariant = AnatomicalModelVariantSchema.parse(new URLSearchParams(location.search).get('model') ?? 'male')
const [gltf, landmarks] = await Promise.all([
  new GLTFLoader().loadAsync('/models/anatomy.glb'),
  fetch('/models/rig-landmarks.json').then(response => {
    if (!response.ok) throw new Error('Unable to load anatomy landmarks')
    return response.json() as Promise<unknown>
  }),
])
const anatomy = prepareAnatomy(gltf.scene, parseAnatomyLandmarks(landmarks), modelVariant)
const regions = new Map<MuscleId, { mesh: Mesh; structures: string[]; triangles: number }>()
try {
  for (const [id, config] of Object.entries(bodyPreviewCameras) as [MuscleId, typeof bodyPreviewCameras[MuscleId]][]) {
    const batch = anatomy.batches.find(candidate => candidate.tissue === 'muscle' && candidate.muscleId === id)
    if (!batch?.mesh.geometry.index) throw new Error(`Missing muscle geometry: ${id}`)
    const structures = batch.structures.filter(structure => config.side === 'both' || structure.name.endsWith('.l'))
    const indices = structures.flatMap(structure => Array.from(batch.mesh.geometry.index!.array.slice(structure.startFace * 3, structure.endFace * 3)))
    if (!indices.length) throw new Error(`Empty muscle geometry: ${id}`)
    const indexed = batch.mesh.geometry.clone()
    indexed.setIndex(indices)
    indexed.deleteAttribute('skinIndex')
    indexed.deleteAttribute('skinWeight')
    // Expanding the selected indices excludes the other side from bounds as well as drawing.
    // This copies the selected variant's prepared faces without further remeshing or deformation.
    const geometry = indexed.toNonIndexed()
    indexed.dispose()
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
    const mesh = new Mesh(geometry, batch.mesh.material.clone())
    mesh.name = `Isolated anatomy region: ${id}`
    mesh.visible = false
    regions.set(id, { mesh, structures: structures.map(structure => structure.name), triangles: indices.length / 3 })
  }
} finally { anatomy.dispose() }

const scene = new Scene()
for (const { mesh } of regions.values()) scene.add(mesh)
// Fixed local studio lights; no remote textures, poses, floor or whole-body geometry.
scene.add(new AmbientLight('#ffffff', 0.32), new HemisphereLight('#f3f5f2', '#334343', 0.8))
for (const [position, intensity, colour] of [
  [[2.8, 4.5, 4], 2.8, '#fff1df'],
  [[-3, 2.5, 1.5], 1.2, '#d9e5f3'],
  [[1, 3, -3], 3.2, '#e9e4d4'],
] as const) {
  const light = new DirectionalLight(colour, intensity)
  light.position.set(position[0], position[1], position[2])
  scene.add(light)
}
const renderer = new WebGLRenderer({ ...anatomyRendererOptions, alpha: true, preserveDrawingBuffer: true })
renderer.toneMapping = anatomyRendererOptions.toneMapping
renderer.toneMappingExposure = anatomyRendererOptions.toneMappingExposure
renderer.setPixelRatio(1)
renderer.setSize(innerWidth, innerHeight)
renderer.setClearColor('#000000', 0)
document.body.append(renderer.domElement)
const camera = new OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 20)

function frameRegion(id: MuscleId): RegionCapture {
  const region = regions.get(id)
  if (!region) throw new Error(`Unknown muscle region: ${id}`)
  for (const [candidate, { mesh }] of regions) mesh.visible = candidate === id
  const bounds = region.mesh.geometry.boundingBox!
  const target = bounds.getCenter(new Vector3())
  camera.position.copy(target).addScaledVector(new Vector3(...bodyPreviewCameras[id].direction).normalize(), 3)
  camera.lookAt(target)
  camera.updateMatrixWorld(true)
  // Fit the actual visible vertices in camera space, rather than a full-body or broad 3D box.
  const projectedBounds = new Box3()
  const positions = region.mesh.geometry.getAttribute('position')
  const vertex = new Vector3()
  for (let index = 0; index < positions.count; index++) projectedBounds.expandByPoint(vertex.fromBufferAttribute(positions, index).applyMatrix4(camera.matrixWorldInverse))
  const projectedCentre = projectedBounds.getCenter(new Vector3())
  const offset = new Vector3(projectedCentre.x, projectedCentre.y, 0).applyQuaternion(camera.quaternion)
  target.add(offset)
  camera.position.add(offset)
  const size = projectedBounds.getSize(new Vector3())
  const aspect = innerWidth / innerHeight
  const height = Math.max(size.y, size.x / aspect) * bodyPreviewPadding
  camera.left = -height * aspect / 2
  camera.right = height * aspect / 2
  camera.top = height / 2
  camera.bottom = -height / 2
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
  renderer.render(scene, camera)
  return {
    modelVariant,
    png: renderer.domElement.toDataURL('image/png'),
    structures: region.structures,
    triangles: region.triangles,
    bounds: { min: bounds.min.toArray(), max: bounds.max.toArray() },
    camera: { position: camera.position.toArray(), target: target.toArray(), height },
  }
}

let capturing = false
window.__bodyCapture = {
  frame: async id => {
    if (capturing) throw new Error('Overlapping muscle captures')
    capturing = true
    try {
      // Warm shader compilation before the saved frame; no arbitrary wall-clock sleep.
      frameRegion(id)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
      return frameRegion(id)
    } finally { capturing = false }
  },
}
