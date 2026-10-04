import test from 'node:test';
import assert from 'node:assert/strict';
import { BODY, EXERCISE_PHASES, distance, getExercisePose, getHeadPose, solveLimb, torsoPoint } from '../src/index.ts';

const additionalExercises = ['quarter-squat', 'paused-squat', 'knee-narrow-pushup', 'narrow-pushup', 'dead-bug-heel-tap', 'quadruped-leg-extension', 'prone-t-raise', 'prone-y-raise', 'split-squat', 'single-leg-calf-raise', 'bridge-march', 'single-leg-glute-bridge'];
const expandedExercises = ['bent-knee-row', 'dead-bug-arm-only', 'sumo-squat', 'single-leg-deadlift', 'forward-lunge', 'quadruped-arm-raise', 'prone-hip-extension', 'supine-march', 'supine-heel-slide', 'plank-shoulder-tap'];
const exercises = ['pushup', 'squat', 'glute-bridge', 'dead-bug', 'prone-w', 'calf-raise', 'row', 'full-pushup', 'pike-pushup', 'reverse-lunge', 'lateral-lunge', 'good-morning', 'bird-dog', 'mountain-climber', 'crunch', ...additionalExercises, ...expandedExercises];
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

test('full push-ups pivot a straight body around planted toes with both hands on the mat', () => {
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('full-pushup', frame / 100);
    for (const side of ['left', 'right'] as const) {
      const arm = pose.arms[side], leg = pose.legs[side];
      close(arm.end[1], 0.065);
      close(arm.end[2], 0.36);
      close(leg.end[1], 0.16);
      close(leg.end[2], -0.985);
      close(distance(leg.start, leg.end), BODY.thigh + BODY.shin);
      const shoulder = torsoPoint(pose, 0, BODY.torso);
      close((shoulder[1] - pose.pelvis[1]) / (shoulder[2] - pose.pelvis[2]),
        (leg.start[1] - leg.end[1]) / (leg.start[2] - leg.end[2]));
    }
  }
  assert.ok(getExercisePose('full-pushup', 0.5).arms.left.start[1] < getExercisePose('full-pushup', 0).arms.left.start[1] - 0.25);
});

test('pike push-ups descend between fixed hands and toes while retaining high hips and straight legs', () => {
  const top = getExercisePose('pike-pushup', 0);
  const bottom = getExercisePose('pike-pushup', 0.5);
  assert.ok(getHeadPose('pike-pushup', bottom).neck[1] < getHeadPose('pike-pushup', top).neck[1] - 0.15);
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('pike-pushup', frame / 100);
    assert.ok(pose.pelvis[1] > pose.arms.left.start[1] + 0.25);
    for (const side of ['left', 'right'] as const) {
      close(distance(pose.legs[side].start, pose.legs[side].end), BODY.thigh + BODY.shin);
      close(distance(pose.legs[side].end, top.legs[side].end), 0);
      close(distance(pose.arms[side].end, top.arms[side].end), 0);
    }
  }
});

test('reverse lunges plant before lowering, lift the returning foot, and complete both sides', () => {
  for (const [offset, rearSide, frontSide] of [[0, 'left', 'right'], [0.5, 'right', 'left']] as const) {
    const stepped = getExercisePose('reverse-lunge', offset + 0.125);
    const low = getExercisePose('reverse-lunge', offset + 0.25);
    const raised = getExercisePose('reverse-lunge', offset + 0.375);
    assert.ok(low.pelvis[1] < stepped.pelvis[1] - 0.2);
    for (const pose of [stepped, low, raised]) {
      close(pose.legs[rearSide].end[2], -0.54);
      close(pose.legs[rearSide].end[1], 0.16);
      close(pose.legs[frontSide].end[2], 0.11);
      close(pose.legs[frontSide].end[1], 0.085);
    }
    for (const phase of [offset + 0.0625, offset + 0.4375]) {
      const stepping = getExercisePose('reverse-lunge', phase);
      assert.ok(stepping.legs[rearSide].end[1] > 0.20);
      close(stepping.legs[frontSide].end[1], 0.085);
    }
  }
});

test('lateral lunges keep a wide planted stance and alternate the bent knee', () => {
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('lateral-lunge', frame / 100);
    for (const side of ['left', 'right'] as const) {
      close(pose.legs[side].end[0], side === 'left' ? -0.55 : 0.55);
      close(pose.legs[side].end[1], 0.085);
      close(pose.legs[side].end[2], 0.08);
    }
  }
  for (const [phase, active, other] of [[0.25, 'left', 'right'], [0.75, 'right', 'left']] as const) {
    const pose = getExercisePose('lateral-lunge', phase);
    assert.ok(distance(pose.legs[active].start, pose.legs[active].end) < 0.57);
    close(distance(pose.legs[other].start, pose.legs[other].end), 0.859);
    close(pose.pelvis[0], active === 'left' ? -0.26 : 0.26);
  }
});

test('good mornings hinge backward with a fixed knee bend and planted feet', () => {
  const upright = getExercisePose('good-morning', 0);
  const hinged = getExercisePose('good-morning', 0.5);
  assert.ok(hinged.pelvis[2] < upright.pelvis[2] - 0.29);
  assert.ok(hinged.torsoAngle > upright.torsoAngle + 0.9);
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('good-morning', frame / 100);
    for (const side of ['left', 'right'] as const) {
      close(distance(pose.legs[side].start, pose.legs[side].end), 0.835);
      close(distance(pose.legs[side].end, upright.legs[side].end), 0);
    }
  }
});

test('bird dog alternates opposite limbs while the other hand and knee support the torso', () => {
  for (const [phase, legSide, armSide] of [[0.25, 'left', 'right'], [0.75, 'right', 'left']] as const) {
    const pose = getExercisePose('bird-dog', phase);
    assert.ok(pose.arms[armSide].end[2] > pose.arms[armSide].start[2] + 0.57);
    assert.ok(pose.legs[legSide].end[2] < pose.pelvis[2] - 0.85);
    close(pose.arms[legSide].end[1], 0.065);
    close(pose.arms[legSide].end[2], 0.48);
    close(pose.legs[armSide].joint[1], 0.11);
    close(pose.legs[armSide].joint[2], -0.15);
    close(pose.legs[legSide].end[1], 0.56);
  }
  assert.deepEqual(getExercisePose('bird-dog', 0.25).pelvis, getExercisePose('bird-dog', 0.75).pelvis);
});

test('mountain climbers plant both hands and the opposite toes while each knee clears the floor', () => {
  const start = getExercisePose('mountain-climber', 0);
  for (let frame = 0; frame <= 200; frame++) {
    const phase = frame / 200;
    const pose = getExercisePose('mountain-climber', phase);
    const support = phase < 0.5 || phase === 1 ? 'right' : 'left';
    close(distance(pose.legs[support].end, start.legs[support].end), 0);
    for (const side of ['left', 'right'] as const) {
      close(distance(pose.arms[side].end, start.arms[side].end), 0);
      assert.ok(pose.legs[side].joint[1] > 0.055);
    }
  }
  assert.ok(getExercisePose('mountain-climber', 0.25).legs.left.joint[2] > 0.18);
  assert.ok(getExercisePose('mountain-climber', 0.75).legs.right.joint[2] > 0.18);
});

test('crunch raises the shoulders without moving the pelvis or feet', () => {
  const low = getExercisePose('crunch', 0);
  const high = getExercisePose('crunch', 0.5);
  assert.deepEqual(high.pelvis, low.pelvis);
  assert.ok(high.arms.left.start[1] > low.arms.left.start[1] + 0.20);
  for (const side of ['left', 'right'] as const) {
    close(distance(high.legs[side].end, low.legs[side].end), 0);
    assert.ok(high.arms[side].start[0] * high.arms[side].end[0] < 0, 'each hand crosses the chest midline');
  }
});

test('alternating movements remain continuous at both side switches', () => {
  for (const exercise of ['reverse-lunge', 'lateral-lunge', 'bird-dog', 'mountain-climber', 'dead-bug-arm-only', 'forward-lunge', 'quadruped-arm-raise', 'supine-march', 'supine-heel-slide', 'plank-shoulder-tap']) {
    for (const phase of [0, 0.5, 1]) {
      const before = getExercisePose(exercise, phase - 1e-6);
      const after = getExercisePose(exercise, phase + 1e-6);
      close(distance(before.pelvis, after.pelvis), 0, 1e-5);
      for (const side of ['left', 'right'] as const) {
        for (const part of ['start', 'joint', 'end'] as const) {
          close(distance(before.arms[side][part], after.arms[side][part]), 0, 1e-5);
          close(distance(before.legs[side][part], after.legs[side][part]), 0, 1e-5);
        }
      }
    }
  }
});

test('IK handles unreachable targets and collinear bend hints without stretching', () => {
  for (const target of [[0, 4, 0], [0, 0, 0], [0, 0.001, 0]] as [number, number, number][]) {
    const limb = solveLimb([0, 0, 0], target, 0.3, 0.29, [0, 1, 0]);
    close(distance(limb.start, limb.joint), 0.3);
    close(distance(limb.joint, limb.end), 0.29);
    assert.ok(limb.joint.every(Number.isFinite));
  }
});

test('short squats reduce depth and paused squats keep an actual still bottom interval', () => {
  const stand = getExercisePose('squat', 0).pelvis[1];
  const short = getExercisePose('quarter-squat', 0.5).pelvis[1];
  assert.ok(stand - short > 0.1 && stand - short < 0.18);
  assert.deepEqual(getExercisePose('paused-squat', 0.35), getExercisePose('paused-squat', 0.75));
  assert.ok(getExercisePose('paused-squat', 0.92).pelvis[1] > getExercisePose('paused-squat', 0.5).pelvis[1]);
});

test('narrow push-up variants keep palms inside shoulder width and retain their support type', () => {
  for (const exercise of ['knee-narrow-pushup', 'narrow-pushup']) {
    for (let frame = 0; frame <= 100; frame++) {
      const pose = getExercisePose(exercise, frame / 100);
      for (const side of ['left', 'right'] as const) {
        assert.ok(Math.abs(pose.arms[side].end[0]) < Math.abs(pose.arms[side].start[0]));
        close(pose.arms[side].end[1], 0.065);
        if (exercise === 'knee-narrow-pushup') close(pose.legs[side].joint[1], 0.11);
        else close(pose.legs[side].end[1], 0.16);
      }
    }
  }
});

test('heel taps and leg-only quadruped extensions alternate legs without moving either hand', () => {
  for (const exercise of ['dead-bug-heel-tap', 'quadruped-leg-extension']) {
    const rest = getExercisePose(exercise, 0);
    for (let frame = 0; frame <= 100; frame++) {
      const pose = getExercisePose(exercise, frame / 100);
      for (const side of ['left', 'right'] as const) close(distance(pose.arms[side].end, rest.arms[side].end), 0);
    }
    const first = getExercisePose(exercise, 0.25), second = getExercisePose(exercise, 0.75);
    assert.ok(distance(first.legs.left.end, rest.legs.left.end) > 0.4);
    assert.ok(distance(second.legs.right.end, rest.legs.right.end) > 0.4);
    close(distance(first.legs.right.end, rest.legs.right.end), 0);
    close(distance(second.legs.left.end, rest.legs.left.end), 0);
    if (exercise === 'dead-bug-heel-tap') close(first.legs.left.end[1], 0.085);
  }
});

test('T and Y raises extend the arms in distinct directions with the trunk still', () => {
  for (const exercise of ['prone-t-raise', 'prone-y-raise']) {
    const rest = getExercisePose(exercise, 0), high = getExercisePose(exercise, 0.5);
    assert.deepEqual(rest.pelvis, high.pelvis);
    assert.ok(high.arms.left.end[1] > rest.arms.left.end[1] + 0.09);
    assert.ok(distance(high.arms.left.start, high.arms.left.end) > 0.56);
  }
  const t = getExercisePose('prone-t-raise', 0.5), y = getExercisePose('prone-y-raise', 0.5);
  assert.ok(Math.abs(t.arms.left.end[0]) > Math.abs(y.arms.left.end[0]) + 0.2);
  assert.ok(y.arms.left.end[2] > t.arms.left.end[2] + 0.4);
});

test('unilateral exercises retain the same supporting leg throughout a set', () => {
  for (const exercise of ['split-squat', 'single-leg-calf-raise', 'single-leg-glute-bridge']) {
    const rest = getExercisePose(exercise, 0);
    for (let frame = 0; frame <= 100; frame++) {
      const pose = getExercisePose(exercise, frame / 100);
      if (exercise === 'split-squat') {
        for (const side of ['left', 'right'] as const) close(distance(pose.legs[side].end, rest.legs[side].end), 0);
      } else {
        assert.ok(pose.legs.right.end[1] > pose.legs.left.end[1] + 0.2);
        if (exercise === 'single-leg-glute-bridge') close(distance(pose.legs.left.end, rest.legs.left.end), 0);
      }
    }
  }
});

test('bridge march keeps the hips elevated and alternates a free foot with a planted foot', () => {
  const rest = getExercisePose('bridge-march', 0);
  assert.ok(rest.pelvis[1] > 0.4);
  for (const [phase, moving, supported] of [[0.25, 'left', 'right'], [0.75, 'right', 'left']] as const) {
    const pose = getExercisePose('bridge-march', phase);
    assert.deepEqual(pose.pelvis, rest.pelvis);
    close(distance(pose.legs[supported].end, rest.legs[supported].end), 0);
    assert.ok(pose.legs[moving].end[1] > rest.legs[moving].end[1] + 0.35);
    assert.deepEqual(getHeadPose('bridge-march', pose), getHeadPose('bridge-march', rest));
  }
});

test('expanded movements have coaching phases and visibly distinct paths', () => {
  for (const exercise of expandedExercises) {
    assert.equal(EXERCISE_PHASES[exercise]?.length, 2, `${exercise}: phase cues`);
    assert.notDeepEqual(getExercisePose(exercise, 0), getExercisePose(exercise, 0.25), `${exercise}: animated movement`);
  }
});

test('bent-knee rows keep both hands on the bar and flat feet planted with flexed knees', () => {
  const low = getExercisePose('bent-knee-row', 0), high = getExercisePose('bent-knee-row', 0.5);
  assert.ok(high.arms.left.start[1] > low.arms.left.start[1] + 0.15);
  assert.ok(distance(low.arms.left.start, low.arms.left.end) > 0.58, 'start with nearly extended arms');
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('bent-knee-row', frame / 100);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      close(distance(pose.arms[side].end, [sign * 0.29, 1.04, -0.66]), 0);
      close(distance(pose.legs[side].end, [sign * 0.17, 0.085, 0.18]), 0);
      assert.ok(distance(pose.legs[side].start, pose.legs[side].end) < 0.75);
      const knee = pose.legs[side].joint, shoulder = pose.arms[side].start;
      close((shoulder[1] - pose.pelvis[1]) / BODY.torso, (pose.pelvis[1] - knee[1]) / BODY.thigh);
      close((shoulder[2] - pose.pelvis[2]) / BODY.torso, (pose.pelvis[2] - knee[2]) / BODY.thigh);
    }
  }
});

test('sumo squats keep wide feet planted and the knees tracking outward', () => {
  const rest = getExercisePose('sumo-squat', 0), low = getExercisePose('sumo-squat', 0.5);
  assert.ok(low.pelvis[1] < rest.pelvis[1] - 0.3);
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('sumo-squat', frame / 100);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      close(distance(pose.legs[side].end, [sign * 0.39, 0.085, 0.08]), 0);
      assert.ok(Math.abs(pose.legs[side].joint[0]) > Math.abs(pose.legs[side].start[0]));
    }
  }
});

test('single-leg deadlifts keep the left foot planted while the right leg counterbalances the hinge', () => {
  const rest = getExercisePose('single-leg-deadlift', 0), hinged = getExercisePose('single-leg-deadlift', 0.5);
  assert.ok(hinged.torsoAngle > rest.torsoAngle + 1.2);
  assert.ok(hinged.legs.right.end[2] < rest.legs.right.end[2] - 0.55);
  assert.ok(hinged.legs.right.end[1] > rest.legs.right.end[1] + 0.4);
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('single-leg-deadlift', frame / 100);
    close(distance(pose.legs.left.end, rest.legs.left.end), 0);
    close(distance(pose.legs.left.start, pose.legs.left.end), 0.835);
    assert.ok(pose.legs.right.end[1] > 0.12);
  }
});

test('forward lunges plant the advancing foot before lowering and lift it again to return', () => {
  for (const [offset, frontSide, rearSide] of [[0, 'left', 'right'], [0.5, 'right', 'left']] as const) {
    const stepped = getExercisePose('forward-lunge', offset + 0.125);
    const low = getExercisePose('forward-lunge', offset + 0.25);
    const raised = getExercisePose('forward-lunge', offset + 0.375);
    assert.ok(low.pelvis[1] < stepped.pelvis[1] - 0.2);
    for (const pose of [stepped, low, raised]) {
      close(pose.legs[frontSide].end[2], 0.76);
      close(pose.legs[frontSide].end[1], 0.085);
      close(pose.legs[rearSide].end[2], 0.11);
      close(pose.legs[rearSide].end[1], 0.16);
    }
    for (const phase of [offset + 0.0625, offset + 0.4375]) {
      assert.ok(getExercisePose('forward-lunge', phase).legs[frontSide].end[1] > 0.18);
    }
  }
});

test('arm-only supine and quadruped reaches alternate arms with legs and torso still', () => {
  for (const exercise of ['dead-bug-arm-only', 'quadruped-arm-raise']) {
    const rest = getExercisePose(exercise, 0);
    for (let frame = 0; frame <= 100; frame++) {
      const pose = getExercisePose(exercise, frame / 100);
      assert.deepEqual(pose.legs, rest.legs);
      assert.deepEqual(pose.pelvis, rest.pelvis);
    }
    for (const [phase, moving, support] of [[0.25, 'left', 'right'], [0.75, 'right', 'left']] as const) {
      const pose = getExercisePose(exercise, phase);
      close(distance(pose.arms[support].end, rest.arms[support].end), 0);
      assert.ok(distance(pose.arms[moving].end, rest.arms[moving].end) > 0.7);
      if (exercise === 'quadruped-arm-raise') {
        close(pose.arms[support].end[1], 0.065);
        assert.ok(pose.arms[moving].end[2] > pose.arms[moving].start[2] + 0.57);
      } else {
        assert.ok(pose.arms[moving].end[2] < pose.arms[moving].start[2] - 0.57);
      }
    }
  }
});

test('prone hip extensions lift only the right leg a small amount with the pelvis and arms still', () => {
  const rest = getExercisePose('prone-hip-extension', 0), lifted = getExercisePose('prone-hip-extension', 0.5);
  close(lifted.legs.right.end[1] - rest.legs.right.end[1], 0.18);
  assert.deepEqual(getExercisePose('prone-hip-extension', 0.25), lifted, 'brief still interval at the top');
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('prone-hip-extension', frame / 100);
    assert.deepEqual(pose.pelvis, rest.pelvis);
    assert.deepEqual(pose.arms, rest.arms);
    assert.deepEqual(pose.legs.left, rest.legs.left);
    close(distance(pose.legs.right.start, pose.legs.right.end), 0.855);
  }
});

test('supine marches lift one foot while heel slides keep both heels on the mat', () => {
  for (const exercise of ['supine-march', 'supine-heel-slide']) {
    const rest = getExercisePose(exercise, 0);
    for (let frame = 0; frame <= 100; frame++) {
      const pose = getExercisePose(exercise, frame / 100);
      assert.deepEqual(pose.pelvis, rest.pelvis);
      assert.deepEqual(pose.arms, rest.arms);
      if (exercise === 'supine-heel-slide') for (const side of ['left', 'right'] as const) close(pose.legs[side].end[1], 0.085);
    }
    for (const [phase, moving, support] of [[0.25, 'left', 'right'], [0.75, 'right', 'left']] as const) {
      const pose = getExercisePose(exercise, phase);
      close(distance(pose.legs[support].end, rest.legs[support].end), 0);
      if (exercise === 'supine-march') assert.ok(pose.legs[moving].end[1] > 0.47);
      else {
        assert.ok(pose.legs[moving].end[2] > rest.legs[moving].end[2] + 0.3);
        close(distance(pose.legs[moving].start, pose.legs[moving].end), 0.855);
      }
    }
  }
});

test('shoulder taps keep wide toes and the other hand planted while reaching the opposite shoulder', () => {
  const rest = getExercisePose('plank-shoulder-tap', 0);
  assert.ok(Math.abs(rest.legs.left.end[0]) > 0.25);
  for (let frame = 0; frame <= 100; frame++) {
    const pose = getExercisePose('plank-shoulder-tap', frame / 100);
    assert.deepEqual(pose.pelvis, rest.pelvis);
    assert.deepEqual(pose.legs, rest.legs);
  }
  for (const [phase, moving, support] of [[0.25, 'left', 'right'], [0.75, 'right', 'left']] as const) {
    const pose = getExercisePose('plank-shoulder-tap', phase);
    close(distance(pose.arms[support].end, rest.arms[support].end), 0);
    close(distance(pose.arms[moving].end, pose.arms[support].start), 0.015);
    assert.ok(pose.arms[moving].end[0] * pose.arms[moving].start[0] < 0);
  }
});
