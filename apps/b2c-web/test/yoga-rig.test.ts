import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { Matrix4, Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { YogaAsanaIdSchema } from '@klisteniapp/scene-schema';
import type { Side, Vec3 } from '@klisteniapp/geometry';
import { asanas } from '../src/data/yoga.ts';
import { createAnatomyRig, parseAnatomyLandmarks } from '../src/lib/anatomy-rig.ts';
import { mapAnatomyLandmarks } from '../src/lib/anatomy-variants.ts';
import { prepareAnatomy } from '../src/lib/anatomy-model.ts';
import { applyYogaPose, getYogaPose } from '../src/lib/yoga-rig.ts';

const source = parseAnatomyLandmarks(JSON.parse(readFileSync(new URL('../../../packages/model-assets/public/models/rig-landmarks.json', import.meta.url), 'utf8')));
const variants = ['male', 'female'] as const;
const sides: Side[] = ['left', 'right'];
const selectedSides = ['both', 'left', 'right'] as const;
const distance = (a: Vec3, b: Vec3) => new Vector3(...a).distanceTo(new Vector3(...b));
const near = (actual: number, expected: number, message = '', tolerance = 1e-7) =>
  assert.ok(Math.abs(actual - expected) < tolerance, `${message}: ${actual} should equal ${expected}`);

test('all 24 yoga poses preserve the actual male and female limb lengths and shoulder/hip widths', () => {
  assert.equal(YogaAsanaIdSchema.options.length, 24);
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    const fingerprints = new Set<string>();
    for (const id of YogaAsanaIdSchema.options) for (const selectedSide of selectedSides) {
      const pose = getYogaPose(landmarks, id, selectedSide);
      const label = `${variant} ${id} ${selectedSide}`;
      near(distance(pose.arms.left.start, pose.arms.right.start), distance(landmarks.left.shoulder, landmarks.right.shoulder), `${label} shoulders`);
      near(distance(pose.legs.left.start, pose.legs.right.start), distance(landmarks.left.hip, landmarks.right.hip), `${label} hips`);
      near(distance(pose.neck, pose.headTop), distance(landmarks.neck, landmarks.headTop), `${label} head`);
      for (const side of sides) {
        const arm = pose.arms[side], leg = pose.legs[side], limb = landmarks[side];
        near(distance(arm.start, arm.joint), distance(limb.shoulder, limb.elbow), `${label} ${side} upper arm`);
        near(distance(arm.joint, arm.end), distance(limb.elbow, limb.wrist), `${label} ${side} forearm`);
        near(distance(leg.start, leg.joint), distance(limb.hip, limb.knee), `${label} ${side} thigh`);
        near(distance(leg.joint, leg.end), distance(limb.knee, limb.ankle), `${label} ${side} shin`);
      }
      if (selectedSide === 'both') fingerprints.add(JSON.stringify([pose.pelvis, pose.neck, pose.headTop, pose.arms, pose.legs]));
    }
    assert.equal(fingerprints.size, 24, `${variant}: each asana needs a distinct pose`);
  }
});

test('all 17 GPU bones remain finite, orthogonal and unit scale without reflections or source mutations', () => {
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant), before = structuredClone(landmarks);
    const rig = createAnatomyRig(landmarks);
    const bindMatrices = rig.segments.map(segment => segment.bindMatrix.clone());
    assert.equal(rig.segments.length, 17);
    for (const id of YogaAsanaIdSchema.options) for (const side of selectedSides) {
      applyYogaPose(rig, id, side);
      for (const [index, segment] of rig.segments.entries()) {
        const label = `${variant} ${id} ${side} ${segment.key}`;
        assert.ok(segment.bone.matrix.elements.every(Number.isFinite), label);
        near(segment.bone.matrix.determinant(), 1, label);
        const x = new Vector3(), y = new Vector3(), z = new Vector3();
        segment.bone.matrix.extractBasis(x, y, z);
        for (const axis of [x, y, z]) near(axis.length(), 1, label);
        for (const pair of [[x, y], [y, z], [z, x]]) near(pair[0]!.dot(pair[1]!), 0, label);
        assert.deepEqual(segment.bindMatrix, bindMatrices[index], `${label} bind matrix changed`);
        assert.deepEqual(segment.bone.matrixWorld, segment.bone.matrix, `${label} stale GPU world matrix`);
      }
      assert.ok(rig.skeleton.boneMatrices);
      assert.ok(Array.from(rig.skeleton.boneMatrices).every(Number.isFinite));
    }
    assert.deepEqual(landmarks, before);
  }
});

test('choosing a unilateral side changes the anatomical side and mirrors positions without scaling the atlas', () => {
  const mirrored = (a: Vec3, b: Vec3, label: string) => {
    near(a[0], -b[0], label); near(a[1], b[1], label); near(a[2], b[2], label);
  };
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    for (const asana of asanas.filter(asana => !asana.bilateral)) {
      const left = getYogaPose(landmarks, asana.id, 'left'), right = getYogaPose(landmarks, asana.id, 'right');
      assert.deepEqual(getYogaPose(landmarks, asana.id, 'both'), right);
      for (const joint of ['pelvis', 'neck', 'headTop'] as const) mirrored(left[joint], right[joint], `${asana.id} ${joint}`);
      for (const limb of ['arms', 'legs'] as const) for (const point of ['start', 'joint', 'end'] as const) {
        mirrored(left[limb].left[point], right[limb].right[point], `${asana.id} left ${limb} ${point}`);
        mirrored(left[limb].right[point], right[limb].left[point], `${asana.id} right ${limb} ${point}`);
      }
    }
  }
});

test('standing bases and kneeling poses have explicit stationary floor supports on both variants', () => {
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    for (const id of ['tadasana', 'uttanasana', 'ardha-uttanasana', 'utkatasana', 'virabhadrasana-i', 'virabhadrasana-ii', 'trikonasana'] as const) {
      for (const selectedSide of sides) {
        const pose = getYogaPose(landmarks, id, selectedSide);
        for (const side of sides) near(pose.legs[side].end[1], landmarks[side].ankle[1], `${variant} ${id} ${side} foot`);
      }
    }
    for (const id of ['balasana', 'marjaryasana', 'bitilasana'] as const) {
      const pose = getYogaPose(landmarks, id);
      for (const side of sides) {
        near(pose.legs[side].joint[1], 0.105, `${variant} ${id} ${side} knee`);
        near(pose.arms[side].end[1], landmarks.support?.handHeight?.[side] ?? 0.065, `${variant} ${id} ${side} wrist`);
        assert.deepEqual(pose.hands[side]?.normal, [0, -1, 0]);
      }
    }
    for (const side of sides) {
      const tree = getYogaPose(landmarks, 'vrksasana', side), other = side === 'left' ? 'right' : 'left';
      near(tree.legs[side].end[1], landmarks[side].ankle[1], `${variant} tree support`);
      assert.ok(tree.legs[other].end[1] > 0.25 && tree.legs[other].end[1] < 0.37,
        'the opposite foot rests against the calf, below the supporting knee');
      const lunge = getYogaPose(landmarks, 'anjaneyasana', side);
      near(lunge.legs[side].end[1], landmarks[side].ankle[1], `${variant} low lunge foot`);
      near(lunge.legs[other].joint[1], 0.105, `${variant} low lunge knee`);
    }
  }
});

test('bridge keeps shoulders and head supported while its pelvis rises', () => {
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    // Surface-derived calibration can differ for each visual model.
    landmarks.support = { shoulderHeight: 0.12, headNeckHeight: 0.11, pelvisHeight: 0.17 };
    const bridge = getYogaPose(landmarks, 'setu-bandha-sarvangasana');
    near((bridge.arms.left.start[1] + bridge.arms.right.start[1]) / 2, 0.12);
    near((bridge.arms.left.start[2] + bridge.arms.right.start[2]) / 2, -0.47);
    near(bridge.neck[1], 0.11);
    assert.ok(bridge.pelvis[1] > 0.35);
    for (const side of sides) near(bridge.legs[side].end[1], landmarks[side].ankle[1]);
  }
});

test('props support elevated palms and each terminal bone retains its measured source length', () => {
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant), rig = createAnatomyRig(landmarks);
    for (const id of YogaAsanaIdSchema.options) for (const selectedSide of sides) {
      const pose = applyYogaPose(rig, id, selectedSide);
      for (const prop of pose.props) {
        const wrist = Object.values(pose.arms).map(arm => arm.end).find(wrist => Math.abs(wrist[0] - prop.position[0]) < 1e-7);
        assert.ok(wrist, `${id}: a support needs a corresponding hand`);
        near(prop.position[1] - prop.size[1] / 2, 0, `${id} block base`);
        near(wrist[1] - (landmarks.support?.handHeight?.left ?? 0.065), prop.position[1] + prop.size[1] / 2, `${id} palm contact`);
      }
      for (const segment of rig.segments.filter(segment => segment.segment === 'hand' || segment.segment === 'foot')) {
        const start = new Vector3().applyMatrix4(segment.bone.matrix);
        const end = new Vector3(0, segment.length, 0).applyMatrix4(segment.bone.matrix);
        near(start.distanceTo(end), segment.length, `${id} ${segment.key}`);
      }
    }
  }
});

test('lateral bends, twists and the two quadruped forms have genuinely distinct torso and head orientation', () => {
  const triangle = getYogaPose(source, 'trikonasana', 'left');
  assert.ok(triangle.neck[0] - triangle.pelvis[0] > 0.5);
  const twist = getYogaPose(source, 'ardha-matsyendrasana', 'left');
  assert.ok(Math.abs(twist.arms.left.start[2] - twist.arms.right.start[2]) > 0.15);
  near(twist.legs.left.start[2], twist.legs.right.start[2]);
  const cat = getYogaPose(source, 'marjaryasana'), cow = getYogaPose(source, 'bitilasana');
  assert.ok(cat.pelvisRotation.angleTo(cow.pelvisRotation) > 0.4);
  assert.ok(cat.headRotation.angleTo(cow.headRotation) > 0.7);
  const warrior = getYogaPose(source, 'virabhadrasana-ii', 'left');
  assert.ok(warrior.arms.left.end[0] > warrior.arms.left.start[0] + 0.5);
  assert.ok(warrior.headRotation.angleTo(warrior.torsoRotation) > 1.5);
});

test('Mountain restores the unmodified source atlas after any other yoga pose', () => {
  const rig = createAnatomyRig(source);
  applyYogaPose(rig, 'trikonasana', 'left');
  applyYogaPose(rig, 'tadasana');
  for (const segment of rig.segments) {
    const deformation = segment.bone.matrix.clone().multiply(segment.bindMatrix.clone().invert());
    deformation.elements.forEach((value, index) => near(value, new Matrix4().elements[index]!, segment.key));
  }
});

test('Warriors extend the rear leg while quadruped arms reach toward the floor without push-up elbows', () => {
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    for (const side of sides) for (const id of ['virabhadrasana-i', 'virabhadrasana-ii'] as const) {
      const pose = getYogaPose(landmarks, id, side), rear = side === 'left' ? 'right' : 'left';
      const leg = pose.legs[rear];
      near(distance(leg.start, leg.end), distance(leg.start, leg.joint) + distance(leg.joint, leg.end), `${id} ${rear} extension`, 0.00002);
    }
    for (const id of ['marjaryasana', 'bitilasana'] as const) {
      const pose = getYogaPose(landmarks, id);
      for (const side of sides) {
        const arm = pose.arms[side];
        assert.ok(distance(arm.start, arm.end) / (distance(arm.start, arm.joint) + distance(arm.joint, arm.end)) > 0.96);
      }
    }
  }
});

test('Dog and Triangle retain their characteristic long support lines in both morphologies and sides', () => {
  const extension = (limb: { start: Vec3; joint: Vec3; end: Vec3 }) =>
    distance(limb.start, limb.end) / (distance(limb.start, limb.joint) + distance(limb.joint, limb.end));
  for (const variant of variants) {
    const landmarks = mapAnatomyLandmarks(source, variant);
    const dog = getYogaPose(landmarks, 'adho-mukha-svanasana');
    for (const side of sides) {
      assert.ok(extension(dog.arms[side]) > 0.998, `${variant} dog: elbows should extend rather than lower into a push-up`);
      assert.ok(extension(dog.legs[side]) > 0.998, `${variant} dog: elongated support leg`);
      assert.ok(dog.pelvis[1] > dog.arms[side].start[1] + 0.3);
      assert.ok(dog.arms[side].end[2] > dog.pelvis[2] && dog.legs[side].end[2] < dog.pelvis[2]);
      const triangle = getYogaPose(landmarks, 'trikonasana', side);
      assert.ok(extension(triangle.arms[side]) > 0.995, `${variant} triangle: straight reaching arm`);
      for (const leg of Object.values(triangle.legs)) assert.ok(extension(leg) > 0.998, `${variant} triangle: straight leg`);
      near(triangle.arms[side].start[0], triangle.arms[side].end[0], 'stack supporting wrist below shoulder');
    }
  }
});

test('actual male and female skin clears the floor; reclined head and back retain calibrated surface contact', async () => {
  const file = readFileSync(new URL('../../../packages/model-assets/public/models/anatomy.glb', import.meta.url));
  const asset = await new GLTFLoader().parseAsync(file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength), '');
  const point = new Vector3();
  for (const variant of variants) {
    const anatomy = prepareAnatomy(asset.scene, source, variant);
    try {
      const skin = anatomy.batches.find(batch => batch.tissue === 'skin')!;
      const index = skin.mesh.geometry.index!;
      const occipital = skin.structures.filter(structure => structure.name.startsWith('Occipital region'));
      const scapular = skin.structures.filter(structure => structure.name.startsWith('Scapular region'));
      const minimum = (structures = skin.structures) => {
        let value = Infinity;
        for (const structure of structures) for (let face = structure.startFace * 3; face < structure.endFace * 3; face++) {
          skin.mesh.getVertexPosition(index.getX(face), point);
          value = Math.min(value, point.y);
        }
        return value;
      };
      assert.ok(occipital.length && scapular.length, 'audit actual atlas regions');
      for (const id of YogaAsanaIdSchema.options) {
        applyYogaPose(anatomy.rig, id);
        const bottom = minimum();
        assert.ok(bottom >= -0.001, `${variant} ${id}: skin penetrates mat by ${-bottom}m`);
        if (['savasana', 'supta-padangusthasana', 'setu-bandha-sarvangasana'].includes(id)) {
          near(minimum(occipital), 0.002, `${variant} ${id} occipital support`, 0.0001);
          assert.ok(minimum(scapular) < 0.02, `${variant} ${id}: upper back must remain supported`);
        }
      }
    } finally { anatomy.dispose(); }
  }
});
