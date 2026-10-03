import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY, distance, getExercisePose, getHeadPose, solveLimb, torsoPoint } from '../src/index.ts';

const exercises = ['pushup', 'squat', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise', 'row'];
const close = (actual: number, expected: number, epsilon = 1e-6) => assert.ok(Math.abs(actual - expected) < epsilon, `${actual} ≠ ${expected}`);

test('every animation preserves upper/lower limb lengths throughout its cycle', () => {
  for (const exercise of exercises) for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose(exercise, frame / 100);
    for (const side of ['left', 'right'] as const) {
      const arm = pose.arms[side];
      const leg = pose.legs[side];
      close(distance(arm.start, arm.joint), BODY.upperArm);
      close(distance(arm.joint, arm.end), BODY.forearm);
      close(distance(leg.start, leg.joint), BODY.thigh);
      close(distance(leg.joint, leg.end), BODY.shin);
      for (const limb of [arm, leg]) for (const point of Object.values(limb)) {
        assert.ok(point.every(Number.isFinite), `${exercise}: finite coordinates`);
        assert.ok(point[1] >= 0.035, `${exercise}: limb joint stays above floor, ${point}`);
      }
    }
  }
});

test('knee push-ups keep the knees supported and head/hip/knee aligned', () => {
  for (const phase of [0, 0.25, 0.5, 0.75, 1]) {
    const pose = getExercisePose('pushup', phase);
    close(pose.legs.left.joint[1], 0.11);
    close(pose.legs.left.joint[2], -0.64);
    const shoulder = torsoPoint(pose, 0, BODY.torso);
    const torsoSlope = (shoulder[1] - pose.pelvis[1]) / (shoulder[2] - pose.pelvis[2]);
    const thighSlope = (pose.pelvis[1] - 0.11) / (pose.pelvis[2] + 0.64);
    close(torsoSlope, thighSlope);
    close(pose.arms.left.end[1], 0.065);
  }
});

test('bridge keeps shoulders and feet supported as the pelvis rises', () => {
  const start = getExercisePose('glute-bridge', 0);
  const top = getExercisePose('glute-bridge', 0.5);
  assert.ok(top.pelvis[1] > start.pelvis[1] + 0.2);
  for (const pose of [start, top]) {
    close(torsoPoint(pose, 0, BODY.torso)[1], 0.19);
    close(pose.legs.left.end[1], 0.085);
  }
  assert.deepEqual(getHeadPose('glute-bridge', start), getHeadPose('glute-bridge', top));
});

test('the full head volume remains above the mat throughout every exercise', () => {
  for (const exercise of exercises) for (let frame = 0; frame <= 100; frame++) {
    const head = getHeadPose(exercise, getExercisePose(exercise, frame / 100));
    const center = head.neck[1] + 0.157 * Math.cos(head.angle) - 0.005 * Math.sin(head.angle);
    const verticalRadius = Math.hypot(0.142 * Math.cos(head.angle), 0.107 * Math.sin(head.angle));
    assert.ok(center - verticalRadius > 0.018, `${exercise}: head must not intersect mat`);
  }
});

test('dead bug extends opposite arm and leg, and alternates sides', () => {
  const first = getExercisePose('dead-bug', 0.25);
  const second = getExercisePose('dead-bug', 0.75);
  assert.ok(first.legs.left.end[2] > first.legs.right.end[2]);
  assert.ok(first.arms.right.end[2] < first.arms.left.end[2]);
  assert.ok(second.legs.right.end[2] > second.legs.left.end[2]);
  assert.ok(second.arms.left.end[2] < second.arms.right.end[2]);
});

test('prone W raises the arms a small amount without lifting the torso', () => {
  const low = getExercisePose('prone-w', 0);
  const high = getExercisePose('prone-w', 0.5);
  assert.deepEqual(high.pelvis, low.pelvis);
  assert.deepEqual(high.arms.left.start, low.arms.left.start);
  const rise = high.arms.left.end[1] - low.arms.left.end[1];
  assert.ok(rise > 0.05 && rise < 0.12);
  assert.ok(high.arms.left.joint[1] < high.pelvis[1] + 0.13);
});

test('calf raises elevate the body without bending the knees further', () => {
  const low = getExercisePose('calf-raise', 0);
  const high = getExercisePose('calf-raise', 0.5);
  close(high.pelvis[1] - low.pelvis[1], 0.085);
  close(high.legs.left.end[1] - low.legs.left.end[1], 0.085);
  close(distance(high.legs.left.start, high.legs.left.end), distance(low.legs.left.start, low.legs.left.end));
});

test('all cycles close without pose discontinuities', () => {
  for (const exercise of exercises) assert.deepEqual(getExercisePose(exercise, 0), getExercisePose(exercise, 1));
});

test('IK handles unreachable targets and collinear bend hints without stretching', () => {
  for (const target of [[0, 4, 0], [0, 0, 0], [0, 0.001, 0]] as [number, number, number][]) {
    const limb = solveLimb([0, 0, 0], target, 0.3, 0.29, [0, 1, 0]);
    close(distance(limb.start, limb.joint), 0.3);
    close(distance(limb.joint, limb.end), 0.29);
    assert.ok(limb.joint.every(Number.isFinite));
  }
});
