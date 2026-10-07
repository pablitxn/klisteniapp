import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Matrix4, Quaternion, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { YogaAsanaIdSchema } from '@klisteniapp/scene-schema';
import type { Vec3 } from '@klisteniapp/geometry';
import { createAnatomyRig, parseAnatomyLandmarks } from '../src/lib/anatomy-rig.ts';
import { prepareAnatomy } from '../src/lib/anatomy-model.ts';
import { mapAnatomyLandmarks } from '../src/lib/anatomy-variants.ts';
import { asanas } from '../src/data/yoga.ts';
import { applyYogaPose, getYogaPose } from '../src/lib/yoga-rig.ts';
import { applyYogaMotion, createYogaMotion, YOGA_HOLD_PHASE, YOGA_MOTION_DURATION_SECONDS, yogaMotionTimeline } from '../src/lib/yoga-motion.ts';

const source = parseAnatomyLandmarks(JSON.parse(readFileSync(new URL('../public/models/rig-landmarks.json', import.meta.url), 'utf8')));
const variants = ['male', 'female'] as const, sides = ['left', 'right'] as const;
const distance = (a: Vec3, b: Vec3) => new Vector3(...a).distanceTo(new Vector3(...b));
const near = (actual: number, expected: number, label: string, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${label}: ${actual} vs ${expected}`);

test('all 24 motion demonstrations articulate real joints, close their loop and preserve both source morphologies', () => {
  assert.equal(YOGA_MOTION_DURATION_SECONDS, 12);
  assert.equal(yogaMotionTimeline[0].start, 0);
  assert.equal(yogaMotionTimeline.at(-1)!.end, 1);
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    for (const id of YogaAsanaIdSchema.options) for (const selectedSide of ['both', ...sides] as const) {
      const motion = createYogaMotion(landmarks, id, selectedSide), first = motion.sample(0), goal = motion.sample(YOGA_HOLD_PHASE);
      const delta = Math.max(...sides.flatMap(s => ['arms', 'legs'].flatMap(limb => {
        const key = limb as 'arms' | 'legs';
        return [distance(first[key][s].joint, goal[key][s].joint), distance(first[key][s].end, goal[key][s].end)];
      })), distance(first.headTop, goal.headTop), distance(first.pelvis, goal.pelvis));
      assert.ok(delta > 0.025, `${variant} ${id}: movement needs to be visible in joints`);
      assert.deepEqual(motion.sample(0), motion.sample(1), `${id}: cycle closure`);
      let previous = first;
      for (let frame = 0; frame <= 120; frame++) {
        const pose = motion.sample(frame / 120), label = `${variant} ${id} ${selectedSide} ${frame}`;
        assert.equal(pose.side, selectedSide === 'both' ? 'right' : selectedSide);
        for (const side of sides) {
          const arm = pose.arms[side], leg = pose.legs[side], source = landmarks[side];
          near(distance(arm.start, arm.joint), distance(source.shoulder, source.elbow), `${label} arm`);
          near(distance(arm.joint, arm.end), distance(source.elbow, source.wrist), `${label} forearm`);
          near(distance(leg.start, leg.joint), distance(source.hip, source.knee), `${label} thigh`);
          near(distance(leg.joint, leg.end), distance(source.knee, source.ankle), `${label} shin`);
          for (const limb of ['arms', 'legs'] as const) for (const point of ['start', 'joint', 'end'] as const)
            assert.ok(distance(pose[limb][side][point], previous[limb][side][point]) < 0.105, `${label}: discontinuity in ${side} ${limb} ${point}`);
        }
        previous = pose;
      }
    }
  }
});

test('motion uses the same 17 rigid GPU bones and converges to the static asana at the poster phase', () => {
  for (const variant of variants) {
    const rig = createAnatomyRig(mapAnatomyLandmarks(source, variant));
    for (const id of YogaAsanaIdSchema.options) {
      const motion = createYogaMotion(rig.landmarks, id);
      applyYogaPose(rig, id);
      const still = rig.segments.map(segment => segment.bone.matrix.clone());
      applyYogaMotion(rig, motion, YOGA_HOLD_PHASE);
      rig.segments.forEach((segment, index) => segment.bone.matrix.elements.forEach((value, axis) =>
        near(value, still[index]!.elements[axis]!, `${id} ${segment.key} static equivalence`, 0.0002)));
      for (const phase of [0, 0.15, 0.22, 0.3, 0.5, 0.74, 0.88, 1]) {
        applyYogaMotion(rig, motion, phase);
        for (const segment of rig.segments) {
          assert.ok(segment.bone.matrix.elements.every(Number.isFinite));
          near(segment.bone.matrix.determinant(), new Matrix4().determinant(), `${id} rigid ${segment.key}`);
        }
      }
    }
  }
});

test('standing, tabletop and supine motions keep their relevant supports and lift the selected anatomical side', () => {
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    for (const side of sides) for (const id of YogaAsanaIdSchema.options) {
      const motion = createYogaMotion(landmarks, id, side), goal = getYogaPose(landmarks, id, side);
      for (let frame = 0; frame <= 40; frame++) {
        const pose = motion.sample(frame / 40);
        for (const s of sides) {
          const movingFoot = id === 'salabhasana' || id === 'supta-padangusthasana' && s === side || id === 'vrksasana' && s !== side;
          if (!movingFoot) near(distance(pose.legs[s].end, goal.legs[s].end), 0, `${variant} ${id} ${side} ${frame} ${s} planted foot`, 0.00005);
          if (['balasana', 'marjaryasana', 'bitilasana', 'adho-mukha-svanasana', 'bhujangasana', 'setu-bandha-sarvangasana'].includes(id))
            near(distance(pose.arms[s].end, goal.arms[s].end), 0, `${variant} ${id} ${frame} ${s} planted hand`, 0.00005);
        }
        if (['setu-bandha-sarvangasana', 'supta-padangusthasana', 'savasana'].includes(id))
          near(distance(pose.neck, goal.neck), 0, `${id} supported head`);
        if (id === 'balasana') for (const s of sides) near(distance(pose.legs[s].joint, goal.legs[s].joint), 0, `${id} anchored knee`, 0.00005);
        if (id === 'anjaneyasana') {
          const rear = side === 'left' ? 'right' : 'left';
          near(distance(pose.legs[rear].joint, goal.legs[rear].joint), 0, `${id} anchored rear knee`, 0.00005);
        }
      }
    }
  }
});

test('chair and lunges actually lower the pelvis from a less flexed preparation', () => {
  for (const id of ['utkatasana', 'virabhadrasana-i', 'virabhadrasana-ii', 'anjaneyasana'] as const) {
    const motion = createYogaMotion(source, id);
    assert.ok(motion.sample(0).pelvis[1] > motion.sample(0.5).pelvis[1] + 0.03, `${id}: knees cannot start in the final flexion`);
  }
});

test('palms, soles and all other bones rotate continuously without terminal-frame flips', () => {
  const rig = createAnatomyRig(source);
  for (const id of YogaAsanaIdSchema.options) {
    const motion = createYogaMotion(source, id);
    let previous: Quaternion[] | undefined;
    for (let frame = 0; frame <= 240; frame++) {
      applyYogaMotion(rig, motion, frame / 240);
      const current = rig.segments.map(segment => new Quaternion().setFromRotationMatrix(segment.bone.matrix));
      if (previous) current.forEach((rotation, index) => assert.ok(rotation.angleTo(previous![index]!) < 0.20,
        `${id} ${frame / 240} ${rig.segments[index]!.key}: sudden rotational jump`));
      previous = current;
    }
  }
});

test('unilateral entrances preserve anatomical laterality throughout the whole cycle', () => {
  const mirror = (a: Vec3, b: Vec3, label: string) => {
    near(a[0], -b[0], label); near(a[1], b[1], label); near(a[2], b[2], label);
  };
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    for (const asana of asanas.filter(asana => !asana.bilateral)) {
      const left = createYogaMotion(landmarks, asana.id, 'left'), right = createYogaMotion(landmarks, asana.id, 'right');
      for (let frame = 0; frame <= 48; frame++) {
        const a = left.sample(frame / 48), b = right.sample(frame / 48);
        for (const joint of ['pelvis', 'neck', 'headTop'] as const) mirror(a[joint], b[joint], `${asana.id} ${frame} ${joint}`);
        for (const limb of ['arms', 'legs'] as const) for (const point of ['start', 'joint', 'end'] as const) {
          mirror(a[limb].left[point], b[limb].right[point], `${asana.id} ${frame} left ${limb} ${point}`);
          mirror(a[limb].right[point], b[limb].left[point], `${asana.id} ${frame} right ${limb} ${point}`);
        }
      }
    }
  }
});

test('representative movement samples keep the actual male and female external surface above the mat', async () => {
  const file = readFileSync(new URL('../public/models/anatomy.glb', import.meta.url));
  const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const point = new Vector3(), failures: string[] = [];
  for (const variant of variants) {
    const anatomy = prepareAnatomy(asset.scene, source, variant);
    try {
      const skin = anatomy.batches.find(batch => batch.tissue === 'skin')!.mesh;
      const vertices = skin.geometry.getAttribute('position').count;
      for (const id of YogaAsanaIdSchema.options) {
        const motion = createYogaMotion(anatomy.rig.landmarks, id);
        for (const phase of [0, 0.15, 0.22, 0.3, 0.5]) {
          applyYogaMotion(anatomy.rig, motion, phase);
          let bottom = Infinity;
          for (let vertex = 0; vertex < vertices; vertex++) { skin.getVertexPosition(vertex, point); bottom = Math.min(bottom, point.y); }
          if (bottom < -0.001) failures.push(`${variant} ${id} phase${phase}: ${bottom.toFixed(4)}m`);
        }
      }
    } finally { anatomy.dispose(); }
  }
  assert.deepEqual(failures, []);
});
