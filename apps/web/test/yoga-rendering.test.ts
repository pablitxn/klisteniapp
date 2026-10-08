import assert from 'node:assert/strict'
import test from 'node:test'
import { Box3, OrthographicCamera, Vector3 } from 'three'
import { YogaAsanaIdSchema } from '@klisteniapp/scene-schema'
import { fitYogaCamera, yogaCameraDirection } from '../src/lib/yoga-rendering.ts'

test('every yoga camera retains complete off-centre movement bounds in narrow and wide viewers', () => {
  // A cycle can extend above the held pose and behind the origin. In particular,
  // a seated forward fold must keep its upright preparation inside the frame.
  const bounds = new Box3(new Vector3(-0.92, -0.002, -1.18), new Vector3(1.14, 2.05, 0.83))
  for (const id of YogaAsanaIdSchema.options) for (const side of ['left', 'right'] as const) {
    for (const view of ['perspective', 'front', 'side', 'back'] as const) for (const aspect of [0.6, 4 / 3, 2.6]) {
      const camera = new OrthographicCamera()
      const frame = fitYogaCamera(camera, bounds, aspect, id, view, side)
      assert.ok(frame.height > 0 && frame.position.toArray().every(Number.isFinite))
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const projected = new Vector3(x, y, z).project(camera)
        assert.ok(Math.abs(projected.x) < 0.86 && Math.abs(projected.y) < 0.86,
          `${id} ${side} ${view} ${aspect}: movement clips the padded frame`)
        assert.ok(Math.abs(projected.z) < 1, `${id}: depth clips the body`)
      }
    }
  }
})

test('quadruped cameras reveal the spinal silhouette and unilateral cameras follow the active side', () => {
  for (const id of ['marjaryasana', 'bitilasana'] as const) {
    const direction = yogaCameraDirection(id)
    assert.ok(Math.asin(direction.y) < Math.PI / 10, `${id}: camera should reveal the back at a low angle`)
    assert.ok(Math.abs(direction.x) > 0.9, `${id}: camera should show the side silhouette`)
  }
  for (const id of ['virabhadrasana-i', 'virabhadrasana-ii', 'trikonasana', 'janu-sirsasana', 'supta-padangusthasana'] as const) {
    const left = yogaCameraDirection(id, 'perspective', 'left')
    const right = yogaCameraDirection(id, 'perspective', 'right')
    assert.equal(left.x, -right.x)
    assert.equal(left.y, right.y)
    assert.equal(left.z, right.z)
  }
})
