#!/usr/bin/env node
/** Export exactly the live Yoga skinning and motion as editable Blender inputs. */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import assert from 'node:assert/strict'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { asanas } from '../apps/web/src/data/yoga.ts'
import { prepareYogaAnatomy } from '../apps/web/src/lib/yoga-anatomy.ts'
import { parseAnatomyLandmarks } from '../apps/web/src/lib/anatomy-rig.ts'
import { applyYogaMotion, createYogaMotion, YOGA_MOTION_DURATION_SECONDS } from '../apps/web/src/lib/yoga-motion.ts'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const requireWeb = createRequire(join(root, 'apps/web/package.json'))
const { AnimationClip, AnimationMixer, Group, Quaternion, QuaternionKeyframeTrack, Vector3, VectorKeyframeTrack } =
  await import(pathToFileURL(join(dirname(requireWeb.resolve('three')), 'three.module.js')))
const { GLTFLoader } = await import(requireWeb.resolve('three/addons/loaders/GLTFLoader.js'))
const { GLTFExporter } = await import(requireWeb.resolve('three/addons/exporters/GLTFExporter.js'))

// GLTFExporter only needs this small Blob bridge in Node; no browser or network.
globalThis.FileReader = class {
  async readAsArrayBuffer(blob) {
    this.result = await blob.arrayBuffer()
    this.onloadend?.()
  }
  async readAsDataURL(blob) {
    this.result = `data:${blob.type};base64,${Buffer.from(await blob.arrayBuffer()).toString('base64')}`
    this.onloadend?.()
  }
}

const output = resolve(process.argv[2] ?? join(root, 'artifacts/yoga-quality/blender'))
await mkdir(output, { recursive: true })
const file = await readFile(join(root, 'packages/model-assets/public/models/anatomy.glb'))
const source = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '')
const landmarks = parseAnatomyLandmarks(JSON.parse(await readFile(join(root, 'packages/model-assets/public/models/rig-landmarks.json'), 'utf8')))
const sourcePaths = [
  'packages/anatomy-viewer/package.json',
  'packages/model-assets/package.json',
  'packages/catalog-base/package.json',
  'packages/anatomy-viewer/src/anatomy-model.ts',
  'packages/anatomy-viewer/src/anatomy-rig.ts',
  'packages/anatomy-viewer/src/anatomy-variants.ts',
  'packages/anatomy-viewer/src/anatomy-variant-surface.ts',
  'packages/model-assets/src/index.ts',
  'packages/model-assets/src/vite.ts',
  'apps/web/src/lib/yoga-anatomy.ts', 'apps/web/src/lib/yoga-rig.ts', 'apps/web/src/lib/yoga-motion.ts',
  'apps/web/src/lib/anatomy-model.ts', 'apps/web/src/lib/anatomy-rig.ts', 'apps/web/src/lib/anatomy-variants.ts',
  'apps/web/src/lib/anatomy-variant-surface.ts', 'packages/model-assets/public/models/anatomy.glb', 'packages/model-assets/public/models/rig-landmarks.json',
  'apps/web/src/data/yoga.ts', 'packages/model-assets/public/models/anatomy-manifest.json', 'packages/model-assets/public/models/LICENSE-anatomy.txt',
  'packages/geometry/src/index.ts', 'packages/scene-schema/src/index.ts',
  'packages/scene-schema/src/yoga.ts', 'pnpm-lock.yaml', 'scripts/export-yoga-blender.mjs']
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const sources = Object.fromEntries(await Promise.all(sourcePaths.map(async path => [path, sha(await readFile(join(root, path)))])))
const manifest = { fps: 24, durationSeconds: YOGA_MOTION_DURATION_SECONDS, source: 'Live YogaStage source geometry, weights and motion', sources, sourceHash: sha(JSON.stringify(sources)), models: [] }
for (const variant of ['male', 'female']) {
  const anatomy = prepareYogaAnatomy(source.scene, landmarks, variant)
  const scene = new Group()
  scene.name = `Klisteni Yoga ${variant}`
  scene.add(anatomy.group)
  const clips = []
  const poses = {}, motions = []
  const position = new Vector3(), rotation = new Quaternion(), scale = new Vector3()
  for (const segment of anatomy.rig.segments) segment.bone.name = `yoga_${variant}_${segment.key.replaceAll('.', '_')}`
  for (const asana of asanas) for (const side of asana.bilateral ? ['both'] : ['left', 'right']) {
    const motion = createYogaMotion(anatomy.rig.landmarks, asana.id, side)
    motions.push(motion)
    poses[`${asana.id}.${side}`] = { asanaId: asana.id, side, props: motion.sample(0.5).props }
    const frames = motion.durationSeconds * manifest.fps
    const times = Float32Array.from({ length: frames + 1 }, (_, frame) => frame / manifest.fps)
    const data = anatomy.rig.segments.map(() => ({ positions: [], rotations: [], previous: null }))
    for (let frame = 0; frame <= frames; frame++) {
      applyYogaMotion(anatomy.rig, motion, frame / frames)
      anatomy.rig.segments.forEach((segment, index) => {
        segment.bone.matrix.decompose(position, rotation, scale)
        const values = data[index]
        // Keep the quaternion hemisphere continuous in exported f-curves.
        if (values.previous && rotation.dot(values.previous) < 0) {
          rotation.set(-rotation.x, -rotation.y, -rotation.z, -rotation.w)
        }
        values.positions.push(...position.toArray())
        values.rotations.push(...rotation.toArray())
        values.previous = rotation.clone()
      })
    }
    const tracks = anatomy.rig.segments.flatMap((segment, index) => [
      new VectorKeyframeTrack(`${segment.bone.name}.position`, times, data[index].positions),
      new QuaternionKeyframeTrack(`${segment.bone.name}.quaternion`, times, data[index].rotations),
    ])
    clips.push(new AnimationClip(`${asana.id}.${side}`, motion.durationSeconds, tracks))
  }
  for (const segment of anatomy.rig.segments) {
    segment.bone.matrix.copy(segment.bindMatrix)
    segment.bindMatrix.decompose(segment.bone.position, segment.bone.quaternion, segment.bone.scale)
    segment.bone.matrixAutoUpdate = true
  }
  scene.updateMatrixWorld(true)
  const exporter = new GLTFExporter().register(writer => ({
    afterParse() {
      // These independently driven frames are siblings. Three assumes its first
      // joint is every other joint's ancestor; omit that optional skeleton hint
      // so glTF consumers infer the actual common parent instead of the pelvis.
      const rootNode = writer.json.nodes[writer.nodeMap.get(anatomy.group)]
      for (const skin of writer.json.skins ?? []) {
        assert.ok(skin.joints.every(joint => rootNode.children.includes(joint)), 'Exported joints lost their common parent')
        delete skin.skeleton
      }
    },
  }))
  const glb = await exporter.parseAsync(scene, { binary: true, animations: clips, onlyVisible: false })
  const name = `yoga-${variant}.glb`
  // Round-trip the actual exported animation to catch exporter/binding errors.
  const imported = await new GLTFLoader().parseAsync(glb, '')
  assert.equal(imported.animations.length, clips.length)
  const mixer = new AnimationMixer(imported.scene)
  anatomy.rig.segments.forEach(segment => { segment.bone.matrixAutoUpdate = false })
  for (const [index, clip] of imported.animations.entries()) {
    const action = mixer.clipAction(clip).play()
    for (const phase of [0.25, 0.5, 0.75]) {
      mixer.setTime(phase * clip.duration)
      imported.scene.updateMatrixWorld(true)
      applyYogaMotion(anatomy.rig, motions[index], phase)
      for (const segment of anatomy.rig.segments) {
        const actual = imported.scene.getObjectByName(segment.bone.name)
        assert.ok(actual, `${name}: exported bone missing: ${segment.key}`)
        actual.matrixWorld.elements.forEach((value, element) => assert.ok(
          Math.abs(value - segment.bone.matrix.elements[element]) < 0.00001,
          `${name} ${clip.name} phase${phase} ${segment.key}: export differs from live pose`))
      }
    }
    action.stop()
    mixer.setTime(0)
  }
  mixer.uncacheRoot(imported.scene)
  await writeFile(join(output, name), Buffer.from(glb))
  manifest.models.push({ variant, file: name, sha256: sha(Buffer.from(glb)), bones: anatomy.rig.segments.length,
    actions: clips.map(clip => clip.name), poses, verifiedClipSamples: clips.length * 3 })
  anatomy.dispose()
  console.log(`${name}: ${clips.length} full motion clips, ${manifest.fps} fps`)
}
for (const [path, expected] of Object.entries(sources)) assert.equal(sha(await readFile(join(root, path))), expected, `Source changed during export: ${path}`)
await writeFile(join(output, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
