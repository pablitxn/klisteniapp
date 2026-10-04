/** Educational kinematic mannequin. Metres; +Y up, +Z anterior when standing. */
export type Vec3 = [number, number, number];
export type Side = 'left' | 'right';
export type Limb = { start: Vec3; joint: Vec3; end: Vec3 };
export interface BodyPose {
  pelvis: Vec3;
  torsoAngle: number;
  arms: Record<Side, Limb>;
  legs: Record<Side, Limb>;
  floorExercise: boolean;
}

export const BODY = { torso: 0.51, upperArm: 0.3, forearm: 0.29, thigh: 0.43, shin: 0.43 } as const;
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a: Vec3, n: number): Vec3 => [a[0] * n, a[1] * n, a[2] * n];
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const distance = (a: Vec3, b: Vec3): number => Math.hypot(...sub(a, b));
const unit = (v: Vec3): Vec3 => mul(v, 1 / (Math.hypot(...v) || 1));

/** Two-bone IK retains segment lengths, including unreachable and singular targets. */
export function solveLimb(start: Vec3, target: Vec3, a: number, b: number, bendHint: Vec3): Limb {
  const delta = sub(target, start);
  const requestedDistance = Math.hypot(...delta);
  const direction: Vec3 = requestedDistance > 1e-8 ? unit(delta) : [0, -1, 0];
  const d = Math.max(Math.abs(a - b) + 1e-6, Math.min(a + b - 1e-6, requestedDistance));
  const along = (a * a - b * b + d * d) / (2 * d);
  let perpendicular = sub(bendHint, mul(direction, dot(bendHint, direction)));
  if (Math.hypot(...perpendicular) < 1e-7) {
    const fallback: Vec3 = Math.abs(direction[0]) < 0.8 ? [1, 0, 0] : [0, 0, 1];
    perpendicular = sub(fallback, mul(direction, dot(fallback, direction)));
  }
  const height = Math.sqrt(Math.max(0, a * a - along * along));
  return {
    start,
    joint: add(add(start, mul(direction, along)), mul(unit(perpendicular), height)),
    end: add(start, mul(direction, d)),
  };
}

export function torsoPoint(pose: Pick<BodyPose, 'pelvis' | 'torsoAngle'>, x: number, y: number, z = 0): Vec3 {
  const c = Math.cos(pose.torsoAngle);
  const s = Math.sin(pose.torsoAngle);
  return add(pose.pelvis, [x, y * c - z * s, y * s + z * c]);
}

/** In bridges the shoulders pivot while the neck and head stay supported. */
export function getHeadPose(exerciseId: string, pose: BodyPose): { neck: Vec3; angle: number } {
  return ['glute-bridge', 'bridge-march', 'single-leg-glute-bridge'].includes(exerciseId)
    ? { neck: [0, 0.145, -0.555], angle: -Math.PI / 2 }
    : { neck: torsoPoint(pose, 0, 0.595), angle: pose.torsoAngle };
}

/** A full cycle, starts in the easier/extended position. Smooth at both turnarounds. */
export function repetitionAmount(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

const smoothStep = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * (3 - 2 * t);
};

export function getExercisePose(exerciseId: string, phase: number): BodyPose {
  const additional = getAdditionalExercisePose(exerciseId, phase);
  if (additional) return additional;
  const s = repetitionAmount(phase);
  const cycle = ((phase % 1) + 1) % 1;
  const halfCycle = (cycle * 2) % 1;
  const activeSide: Side = cycle < 0.5 ? 'left' : 'right';
  const alternatingReach = repetitionAmount(halfCycle);
  // A reverse lunge has separate flight and planted phases: step, lower/rise, return.
  const lungeStep = halfCycle < 0.25
    ? smoothStep(halfCycle / 0.25)
    : halfCycle > 0.75 ? smoothStep((1 - halfCycle) / 0.25) : 1;
  const lungeLower = halfCycle >= 0.25 && halfCycle <= 0.75
    ? repetitionAmount((halfCycle - 0.25) / 0.5) : 0;
  const lungeFlight = halfCycle < 0.25
    ? Math.sin(Math.PI * halfCycle / 0.25) ** 2
    : halfCycle > 0.75 ? Math.sin(Math.PI * (1 - halfCycle) / 0.25) ** 2 : 0;
  let pelvis: Vec3 = [0, 0.94, 0];
  let torsoAngle = 0;
  const floorExercise = ['pushup', 'full-pushup', 'pike-pushup', 'glute-bridge', 'dead-bug', 'prone-w', 'row', 'bird-dog', 'mountain-climber', 'crunch'].includes(exerciseId);
  if (exerciseId === 'squat') {
    pelvis = [0, 0.94 - 0.36 * s, -0.02 - 0.23 * s];
    torsoAngle = 0.06 + 0.31 * s;
  } else if (exerciseId === 'pushup') {
    const incline = 0.60 - 0.48 * s;
    pelvis = [0, 0.11 + BODY.thigh * Math.sin(incline), -0.64 + BODY.thigh * Math.cos(incline)];
    torsoAngle = Math.PI / 2 - incline;
  } else if (exerciseId === 'glute-bridge') {
    const height = 0.21 + 0.23 * s;
    pelvis = [0, height, -0.47 + Math.sqrt(BODY.torso ** 2 - (height - 0.19) ** 2)];
    torsoAngle = -Math.acos((0.19 - height) / BODY.torso);
  } else if (exerciseId === 'dead-bug') {
    pelvis = [0, 0.18, 0.1];
    torsoAngle = -Math.PI / 2;
  } else if (exerciseId === 'prone-w') {
    pelvis = [0, 0.19, -0.12];
    torsoAngle = Math.PI / 2 - 0.025;
  } else if (exerciseId === 'calf-raise') {
    pelvis = [0, 0.94 + 0.085 * s, 0.015 * s];
  } else if (exerciseId === 'row') {
    pelvis = [0, 0.4 + 0.15 * s, -0.14];
    torsoAngle = -1.05;
  } else if (exerciseId === 'full-pushup') {
    const incline = 0.31 - 0.24 * s;
    const legLength = BODY.thigh + BODY.shin;
    pelvis = [0, 0.16 + legLength * Math.sin(incline), -0.985 + legLength * Math.cos(incline)];
    torsoAngle = Math.PI / 2 - incline;
  } else if (exerciseId === 'pike-pushup') {
    // Hips travel on an arc around the planted toes; the knees stay extended.
    const forward = 0.50 + 0.14 * s;
    pelvis = [0, 0.16 + Math.sqrt((BODY.thigh + BODY.shin) ** 2 - forward ** 2), -0.76 + forward];
    torsoAngle = 2.18 + 0.20 * s;
  } else if (exerciseId === 'reverse-lunge') {
    pelvis = [0, 0.935 - 0.15 * lungeStep - 0.23 * lungeLower, -0.07 * lungeStep];
    torsoAngle = 0.04 + 0.13 * lungeLower;
  } else if (exerciseId === 'lateral-lunge') {
    const shift = 0.26 * alternatingReach;
    const z = -0.12 * alternatingReach;
    // The far leg sets hip height, so a fixed wide stance never stretches the shin.
    const farReach = 0.55 - 0.135 + shift;
    pelvis = [activeSide === 'left' ? -shift : shift,
      0.085 + Math.sqrt(0.859 ** 2 - farReach ** 2 - (z - 0.08) ** 2), z];
    torsoAngle = 0.06 + 0.25 * alternatingReach;
  } else if (exerciseId === 'good-morning') {
    const z = -0.025 - 0.30 * s;
    pelvis = [0, 0.085 + Math.sqrt(0.835 ** 2 - (z - 0.035) ** 2 - 0.035 ** 2), z];
    torsoAngle = 0.05 + 0.95 * s;
  } else if (exerciseId === 'bird-dog') {
    pelvis = [0, 0.54, -0.15];
    torsoAngle = Math.PI / 2 - 0.15;
  } else if (exerciseId === 'mountain-climber') {
    // A little hip clearance lets the knee pass under the body without crossing the mat.
    pelvis = [0, 0.525, -0.15];
    torsoAngle = Math.PI / 2 - 0.20;
  } else if (exerciseId === 'crunch') {
    pelvis = [0, 0.18, 0.08];
    torsoAngle = -Math.PI / 2 + 0.43 * s;
  }
  const base = { pelvis, torsoAngle };
  const arms = {} as Record<Side, Limb>;
  const legs = {} as Record<Side, Limb>;
  for (const side of ['left', 'right'] as const) {
    const sign = side === 'left' ? -1 : 1;
    const shoulder = torsoPoint(base, sign * 0.235, BODY.torso);
    const hip = torsoPoint(base, sign * 0.135, 0);
    let wrist: Vec3 = [sign * 0.29, pelvis[1] + 0.015, 0.05];
    let ankle: Vec3 = [sign * 0.17, 0.085, 0.035];
    let armBend: Vec3 = [sign * 0.8, 0, -1];
    let kneeBend: Vec3 = [0, 0, 1];
    if (exerciseId === 'squat') {
      wrist = [sign * 0.29, pelvis[1] + 0.22 + 0.14 * s, 0.16 + 0.34 * s];
      ankle = [sign * 0.21, 0.085, 0.11];
      armBend = [sign * 0.3, -1, 0];
    } else if (exerciseId === 'pushup') {
      wrist = [sign * 0.295, 0.065, 0.23];
      armBend = [sign * 0.6, 0, -1];
      const knee: Vec3 = [sign * 0.135, 0.11, -0.64];
      legs[side] = { start: hip, joint: knee, end: [sign * 0.135, 0.11, -1.07] };
    } else if (exerciseId === 'glute-bridge') {
      wrist = [sign * 0.34, 0.07, 0.02];
      ankle = [sign * 0.17, 0.085, 0.63];
      kneeBend = [0, 1, 0];
      armBend = [sign * 0.5, 0, -0.5];
    } else if (exerciseId === 'dead-bug') {
      // One full demo alternates opposite arm + leg on each half-cycle.
      const moving = ((phase % 1 + 1) % 1 < 0.5) === (side === 'left');
      const reach = Math.sin(2 * Math.PI * phase) ** 2;
      const legReach = moving ? reach : 0;
      const armReach = moving ? 0 : reach;
      ankle = [sign * 0.15, 0.59 - 0.44 * legReach, 0.5 + 0.41 * legReach];
      wrist = [sign * 0.24, 0.72 - 0.50 * armReach, -0.46 - 0.57 * armReach];
      kneeBend = [0, 1, 0];
      armBend = [sign * 0.1, 1, 0];
    } else if (exerciseId === 'prone-w') {
      wrist = [sign * 0.43, 0.14 + 0.105 * s, 0.59];
      ankle = [sign * 0.15, 0.10, -0.97];
      armBend = [sign * 1, 0, -0.8];
      kneeBend = [0, 1, 0];
    } else if (exerciseId === 'calf-raise') {
      ankle = [sign * 0.17, 0.085 + 0.085 * s, 0.035 + 0.015 * s];
      wrist = [sign * 0.37, pelvis[1] + 0.03, 0.09];
    } else if (exerciseId === 'row') {
      wrist = [sign * 0.29, 1.04, -0.66];
      ankle = [sign * 0.16, 0.09, 0.64];
      kneeBend = [0, 1, 0];
    } else if (exerciseId === 'full-pushup' || exerciseId === 'pike-pushup') {
      wrist = [sign * 0.295, 0.065, exerciseId === 'full-pushup' ? 0.36 : 0.44];
      ankle = [sign * 0.135, 0.16, exerciseId === 'full-pushup' ? -0.985 : -0.76];
      armBend = [sign * 0.45, 0, -1];
      // Exact straight legs avoid the IK reach clamp moving a planted ankle.
      legs[side] = { start: hip, joint: add(hip, mul(sub(ankle, hip), BODY.thigh / (BODY.thigh + BODY.shin))), end: ankle };
    } else if (exerciseId === 'reverse-lunge') {
      const moving = side === activeSide;
      ankle = [sign * 0.17, 0.085 + (moving ? 0.075 * lungeStep + 0.10 * lungeFlight : 0), 0.11 - (moving ? 0.65 * lungeStep : 0)];
      wrist = torsoPoint(base, sign * 0.13, 0.32, 0.23);
      armBend = [sign * 0.6, -1, 0];
    } else if (exerciseId === 'lateral-lunge') {
      ankle = [sign * 0.55, 0.085, 0.08];
      wrist = torsoPoint(base, sign * 0.13, 0.32, 0.23);
      kneeBend = [side === activeSide ? sign * 0.4 * alternatingReach : 0, 0, 1];
      armBend = [sign * 0.6, -1, 0];
    } else if (exerciseId === 'good-morning' || exerciseId === 'crunch') {
      wrist = torsoPoint(base, sign * (exerciseId === 'crunch' ? -0.10 : 0.10), 0.34, 0.19);
      armBend = [sign * 1, -0.2, 0];
      if (exerciseId === 'crunch') {
        ankle = [sign * 0.17, 0.085, 0.64];
        kneeBend = [0, 1, 0];
      }
    } else if (exerciseId === 'bird-dog') {
      const legReach = side === activeSide ? alternatingReach : 0;
      const armReach = side === activeSide ? 0 : alternatingReach;
      wrist = [sign * 0.235, 0.065 + (shoulder[1] + 0.02 - 0.065) * armReach, 0.48 + (shoulder[2] + 0.58 - 0.48) * armReach];
      ankle = [sign * 0.135, 0.11 + 0.45 * legReach, -0.58 - 0.429 * legReach];
      kneeBend = [0, -1, 0];
      armBend = [sign * 0.15, 0, -1];
      if (legReach === 0) {
        legs[side] = { start: hip, joint: [sign * 0.135, 0.11, -0.15], end: ankle };
      }
    } else if (exerciseId === 'mountain-climber') {
      const reach = side === activeSide ? alternatingReach : 0;
      // A tiny knee bend avoids switching from an exact straight leg to clamped IK.
      const rear = -0.15 - Math.sqrt(0.8599 ** 2 - (pelvis[1] - 0.16) ** 2);
      wrist = [sign * 0.295, 0.065, 0.36];
      ankle = [sign * 0.135, 0.16 + 0.04 * reach, rear + (-0.20 - rear) * reach];
      armBend = [sign * 0.45, 0, -1];
    }
    arms[side] = solveLimb(shoulder, wrist, BODY.upperArm, BODY.forearm, armBend);
    legs[side] ??= solveLimb(hip, ankle, BODY.thigh, BODY.shin, kneeBend);
  }
  return { pelvis, torsoAngle, arms, legs, floorExercise };
}

/** Variants use the established movement templates without changing their existing paths. */
function getAdditionalExercisePose(exerciseId: string, phase: number): BodyPose | null {
  const cycle = ((phase % 1) + 1) % 1;
  const s = repetitionAmount(cycle);
  const activeSide: Side = cycle < 0.5 ? 'left' : 'right';
  const reach = repetitionAmount((cycle * 2) % 1);
  const phaseForAmount = (amount: number) => Math.acos(1 - 2 * amount) / (2 * Math.PI);
  const groundedSquat = (amount: number): BodyPose => {
    const pose = getExercisePose('squat', phaseForAmount(amount));
    const maximumHeight = 0.085 + Math.sqrt(0.8599 ** 2 - 0.075 ** 2 - (pose.pelvis[2] - 0.11) ** 2);
    const offset: Vec3 = [0, Math.min(0, maximumHeight - pose.pelvis[1]), 0];
    pose.pelvis = add(pose.pelvis, offset);
    for (const side of ['left', 'right'] as const) {
      const arm = pose.arms[side];
      pose.arms[side] = { start: add(arm.start, offset), joint: add(arm.joint, offset), end: add(arm.end, offset) };
      pose.legs[side] = solveLimb(add(pose.legs[side].start, offset), [side === 'left' ? -0.21 : 0.21, 0.085, 0.11], BODY.thigh, BODY.shin, [0, 0, 1]);
    }
    return pose;
  };
  if (exerciseId === 'quarter-squat') return groundedSquat(0.42 * s);
  if (exerciseId === 'paused-squat') {
    const amount = cycle < 1 / 3 ? smoothStep(cycle * 3) : cycle < 5 / 6 ? 1 : 1 - smoothStep((cycle - 5 / 6) * 6);
    return groundedSquat(amount);
  }
  if (exerciseId === 'knee-narrow-pushup' || exerciseId === 'narrow-pushup') {
    const pose = getExercisePose(exerciseId === 'knee-narrow-pushup' ? 'pushup' : 'full-pushup',
      exerciseId === 'knee-narrow-pushup' ? phaseForAmount(0.03 + 0.97 * s) : phase);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const arm = pose.arms[side];
      pose.arms[side] = solveLimb(arm.start, [sign * 0.135, 0.065, arm.end[2]], BODY.upperArm, BODY.forearm, [sign * 0.12, 0, -1]);
    }
    return pose;
  }
  if (exerciseId === 'quadruped-leg-extension') {
    const pose = getExercisePose('bird-dog', phase);
    pose.arms = getExercisePose('bird-dog', 0).arms;
    return pose;
  }
  if (exerciseId === 'prone-t-raise' || exerciseId === 'prone-y-raise') {
    const pose = getExercisePose('prone-w', phase);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const shoulder = pose.arms[side].start;
      const lateral = exerciseId === 'prone-t-raise' ? 0.57 : 0.36;
      const forward = exerciseId === 'prone-t-raise' ? 0 : 0.44;
      pose.arms[side] = solveLimb(shoulder, [shoulder[0] + sign * lateral, 0.14 + 0.105 * s, shoulder[2] + forward], BODY.upperArm, BODY.forearm, [0, 1, 0]);
    }
    return pose;
  }
  if (exerciseId === 'split-squat') {
    // Both feet stay fixed for the whole set; change the leading leg between sets.
    return getExercisePose('reverse-lunge', 0.125 + 0.125 * s);
  }
  if (exerciseId === 'bridge-march' || exerciseId === 'single-leg-glute-bridge') {
    const pose = getExercisePose('glute-bridge', exerciseId === 'bridge-march' ? 0.5 : phase);
    for (const side of ['left', 'right'] as const) {
      const leg = pose.legs[side];
      if (exerciseId === 'bridge-march' && side === activeSide) {
        pose.legs[side] = solveLimb(leg.start, [leg.end[0], 0.085 + 0.40 * reach, 0.63 - 0.35 * reach], BODY.thigh, BODY.shin, [0, 1, 0]);
      } else if (exerciseId === 'single-leg-glute-bridge' && side === 'right') {
        pose.legs[side] = solveLimb(leg.start, add(leg.start, [0, 0.65, 0.56]), BODY.thigh, BODY.shin, [0, 1, 0]);
      }
    }
    return pose;
  }
  if (exerciseId === 'dead-bug-heel-tap') {
    const pose = getExercisePose('dead-bug', 0);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const legReach = side === activeSide ? reach : 0;
      pose.arms[side] = solveLimb(pose.arms[side].start, [sign * 0.34, 0.07, 0.02], BODY.upperArm, BODY.forearm, [sign * 0.5, 0, -0.5]);
      pose.legs[side] = solveLimb(pose.legs[side].start, [sign * 0.17, 0.59 - 0.505 * legReach, 0.50 + 0.13 * legReach], BODY.thigh, BODY.shin, [0, 1, 0]);
    }
    return pose;
  }
  if (exerciseId === 'single-leg-calf-raise') {
    const pelvis: Vec3 = [-0.12, 0.935 + 0.075 * s, 0.015 * s];
    const pose: BodyPose = { pelvis, torsoAngle: 0, floorExercise: false, arms: {} as Record<Side, Limb>, legs: {} as Record<Side, Limb> };
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const shoulder = torsoPoint(pose, sign * 0.235, BODY.torso);
      const hip = torsoPoint(pose, sign * 0.135, 0);
      const ankle: Vec3 = side === 'left' ? [-0.17, 0.085 + 0.075 * s, 0.035 + 0.015 * s] : [0.15, 0.36 + 0.075 * s, -0.23];
      pose.arms[side] = solveLimb(shoulder, [pelvis[0] + sign * 0.48, pelvis[1] + 0.13, 0.05], BODY.upperArm, BODY.forearm, [sign, -0.5, 0]);
      pose.legs[side] = solveLimb(hip, ankle, BODY.thigh, BODY.shin, [0, 0, 1]);
    }
    return pose;
  }
  if (exerciseId === 'dead-bug-arm-only' || exerciseId === 'quadruped-arm-raise') {
    const supine = exerciseId === 'dead-bug-arm-only';
    const pose = getExercisePose(supine ? 'dead-bug' : 'bird-dog', 0);
    const arm = pose.arms[activeSide];
    const sign = activeSide === 'left' ? -1 : 1;
    const wrist: Vec3 = supine
      ? [sign * 0.24, 0.72 - 0.50 * reach, -0.46 - 0.57 * reach]
      : [sign * 0.235, 0.065 + (arm.start[1] + 0.02 - 0.065) * reach, 0.48 + (arm.start[2] + 0.58 - 0.48) * reach];
    pose.arms[activeSide] = solveLimb(arm.start, wrist, BODY.upperArm, BODY.forearm,
      supine ? [sign * 0.1, 1, 0] : [sign * 0.15, 0, -1]);
    return pose;
  }
  if (exerciseId === 'supine-march' || exerciseId === 'supine-heel-slide') {
    const pose = getExercisePose('dead-bug', 0);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const amount = side === activeSide ? reach : 0;
      const heelSlide = exerciseId === 'supine-heel-slide';
      // The extended heel remains reachable on the mat without stretching the knee.
      const extendedZ = pose.pelvis[2] + Math.sqrt(0.855 ** 2 - 0.095 ** 2 - 0.035 ** 2);
      const ankle: Vec3 = [sign * 0.17, 0.085 + (heelSlide ? 0 : 0.39 * amount),
        0.64 + (heelSlide ? extendedZ - 0.64 : -0.35) * amount];
      pose.arms[side] = solveLimb(pose.arms[side].start, [sign * 0.34, 0.07, 0.02], BODY.upperArm, BODY.forearm, [sign * 0.5, 0, -0.5]);
      pose.legs[side] = solveLimb(pose.legs[side].start, ankle, BODY.thigh, BODY.shin, [0, 1, 0]);
    }
    return pose;
  }
  if (exerciseId === 'prone-hip-extension') {
    const pose = getExercisePose('prone-w', 0);
    const lift = cycle < 0.25 ? smoothStep(cycle * 4) : cycle <= 0.5 ? 1 : 1 - smoothStep((cycle - 0.5) * 2);
    for (const side of ['left', 'right'] as const) {
      const hip = pose.legs[side].start;
      const height = 0.10 + (side === 'right' ? 0.18 * lift : 0);
      const ankle: Vec3 = [hip[0], height, hip[2] - Math.sqrt(0.855 ** 2 - (height - hip[1]) ** 2)];
      pose.legs[side] = solveLimb(hip, ankle, BODY.thigh, BODY.shin, [0, 1, 0]);
    }
    return pose;
  }
  if (exerciseId === 'plank-shoulder-tap') {
    const pose = getExercisePose('full-pushup', 0);
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const hip = pose.legs[side].start;
      const ankle: Vec3 = [sign * 0.26, 0.16,
        hip[2] - Math.sqrt((BODY.thigh + BODY.shin) ** 2 - (hip[1] - 0.16) ** 2 - 0.125 ** 2)];
      pose.legs[side] = { start: hip, joint: add(hip, mul(sub(ankle, hip), 0.5)), end: ankle };
    }
    const arm = pose.arms[activeSide];
    const opposite: Side = activeSide === 'left' ? 'right' : 'left';
    const target = add(pose.arms[opposite].start, [0, 0.015, 0]);
    const wrist = add(arm.end, mul(sub(target, arm.end), reach));
    pose.arms[activeSide] = solveLimb(arm.start, wrist, BODY.upperArm, BODY.forearm, [activeSide === 'left' ? -0.45 : 0.45, 0, -1]);
    return pose;
  }
  if (['bent-knee-row', 'sumo-squat', 'single-leg-deadlift', 'forward-lunge'].includes(exerciseId)) {
    const halfCycle = (cycle * 2) % 1;
    const step = halfCycle < 0.25 ? smoothStep(halfCycle / 0.25)
      : halfCycle > 0.75 ? smoothStep((1 - halfCycle) / 0.25) : 1;
    const lower = halfCycle >= 0.25 && halfCycle <= 0.75 ? repetitionAmount((halfCycle - 0.25) / 0.5) : 0;
    const flight = halfCycle < 0.25 ? Math.sin(Math.PI * halfCycle / 0.25) ** 2
      : halfCycle > 0.75 ? Math.sin(Math.PI * (1 - halfCycle) / 0.25) ** 2 : 0;
    let pelvis: Vec3;
    let torsoAngle: number;
    if (exerciseId === 'bent-knee-row') {
      // Fixed shins support a rigid shoulder/hip/knee line that pivots at the knees.
      torsoAngle = -1.625 + 0.345 * s;
      const kneeHeight = 0.085 + Math.sqrt(BODY.shin ** 2 - 0.07 ** 2 - 0.035 ** 2);
      pelvis = [0, kneeHeight + BODY.thigh * Math.cos(torsoAngle), 0.25 + BODY.thigh * Math.sin(torsoAngle)];
    } else if (exerciseId === 'sumo-squat') {
      pelvis = [0, 0.875 - 0.32 * s, -0.015 - 0.21 * s];
      torsoAngle = 0.06 + 0.25 * s;
    } else if (exerciseId === 'single-leg-deadlift') {
      const z = -0.025 - 0.25 * s;
      pelvis = [-0.11, 0.085 + Math.sqrt(0.835 ** 2 - (z - 0.035) ** 2 - 0.075 ** 2), z];
      torsoAngle = 0.05 + 1.25 * s;
    } else {
      pelvis = [0, 0.935 - 0.15 * step - 0.23 * lower, 0.27 * step];
      torsoAngle = 0.04 + 0.13 * lower;
    }
    const pose: BodyPose = { pelvis, torsoAngle, floorExercise: exerciseId === 'bent-knee-row', arms: {} as Record<Side, Limb>, legs: {} as Record<Side, Limb> };
    for (const side of ['left', 'right'] as const) {
      const sign = side === 'left' ? -1 : 1;
      const shoulder = torsoPoint(pose, sign * 0.235, BODY.torso);
      const hip = torsoPoint(pose, sign * 0.135, 0);
      let wrist = torsoPoint(pose, sign * 0.13, 0.32, 0.23);
      let ankle: Vec3;
      let armBend: Vec3 = [sign * 0.6, -1, 0];
      let kneeBend: Vec3 = [0, 0, 1];
      if (exerciseId === 'bent-knee-row') {
        wrist = [sign * 0.29, 1.04, -0.66];
        ankle = [sign * 0.17, 0.085, 0.18];
        armBend = [sign * 0.8, 0, -1];
        pose.legs[side] = { start: hip, joint: [hip[0], 0.085 + Math.sqrt(BODY.shin ** 2 - 0.07 ** 2 - 0.035 ** 2), 0.25], end: ankle };
      } else if (exerciseId === 'sumo-squat') {
        ankle = [sign * 0.39, 0.085, 0.08];
        kneeBend = [sign * 0.6, 0, 1];
      } else if (exerciseId === 'single-leg-deadlift') {
        // Keep the free toes clear of the mat after anatomical ankle/foot retargeting.
        const freeAngle = 0.60 + 0.70 * s;
        ankle = side === 'left' ? [-0.17, 0.085, 0.035]
          : add(hip, [0, -0.855 * Math.cos(freeAngle), -0.855 * Math.sin(freeAngle)]);
        wrist = torsoPoint(pose, sign * 0.27, 0.02, 0.15);
        armBend = [sign * 0.3, -1, 0];
      } else {
        const moving = side === activeSide;
        ankle = [sign * 0.17, 0.085 + (moving ? 0.10 * flight : 0.075 * step), 0.11 + (moving ? 0.65 * step : 0)];
      }
      pose.arms[side] = solveLimb(shoulder, wrist, BODY.upperArm, BODY.forearm, armBend);
      pose.legs[side] ??= solveLimb(hip, ankle, BODY.thigh, BODY.shin, kneeBend);
    }
    return pose;
  }
  return null;
}

export const EXERCISE_PHASES: Record<string, readonly [string, string]> = {
  pushup: ['Bajá con control', 'Empujá el suelo'],
  squat: ['Llevá la cadera atrás', 'Volvé a subir'],
  'glute-bridge': ['Elevá la cadera', 'Bajá con control'],
  'dead-bug': ['Extendé lados opuestos', 'Volvé y alterná'],
  'prone-w': ['Elevá suavemente los brazos', 'Apoyá con control'],
  'calf-raise': ['Subí los talones', 'Bajá con control'],
  row: ['Acercá el pecho a la barra', 'Extendé con control'],
  'full-pushup': ['Bajá en bloque', 'Empujá el suelo'],
  'pike-pushup': ['Acercá la cabeza al suelo', 'Empujá y mantené la cadera alta'],
  'reverse-lunge': ['Paso atrás y bajá', 'Volvé y alterná'],
  'lateral-lunge': ['Llevá la cadera a un lado', 'Volvé y cambiá de lado'],
  'good-morning': ['Llevá la cadera atrás', 'Extendé la cadera'],
  'bird-dog': ['Alargá brazo y pierna opuestos', 'Volvé y alterná'],
  'mountain-climber': ['Acercá una rodilla al pecho', 'Extendé y alterná'],
  crunch: ['Acercá las costillas a la pelvis', 'Apoyá con control'],
  'quarter-squat': ['Bajá un poco la cadera', 'Volvé a subir'],
  'paused-squat': ['Bajá y sostené un momento', 'Volvé a subir'],
  'knee-narrow-pushup': ['Bajá con los codos cerca', 'Empujá el suelo'],
  'narrow-pushup': ['Bajá con los codos cerca', 'Empujá en bloque'],
  'dead-bug-heel-tap': ['Bajá un talón al suelo', 'Volvé y alterná'],
  'quadruped-leg-extension': ['Extendé una pierna atrás', 'Volvé y alterná'],
  'prone-t-raise': ['Elevá los brazos en T', 'Bajá con control'],
  'prone-y-raise': ['Elevá los brazos en Y', 'Bajá con control'],
  'split-squat': ['Bajá sin mover los pies', 'Empujá para subir'],
  'single-leg-calf-raise': ['Subí el talón de apoyo', 'Bajá con control'],
  'bridge-march': ['Elevá un pie con la cadera alta', 'Apoyá y alterná'],
  'single-leg-glute-bridge': ['Empujá con el pie apoyado', 'Bajá la cadera con control'],
  'bent-knee-row': ['Acercá el pecho con las rodillas dobladas', 'Extendé los brazos con control'],
  'dead-bug-arm-only': ['Llevá un brazo detrás de la cabeza', 'Volvé y alterná'],
  'sumo-squat': ['Bajá entre los pies separados', 'Empujá el suelo para subir'],
  'single-leg-deadlift': ['Llevá la cadera atrás y alargá la pierna libre', 'Volvé sobre el mismo pie'],
  'forward-lunge': ['Paso adelante y bajá', 'Empujá para volver y alterná'],
  'quadruped-arm-raise': ['Alargá un brazo al frente', 'Apoyá y alterná'],
  'prone-hip-extension': ['Elevá suavemente una pierna', 'Bajá sin mover la pelvis'],
  'supine-march': ['Elevá un pie con la rodilla doblada', 'Apoyá y alterná'],
  'supine-heel-slide': ['Deslizá un talón para alargar la pierna', 'Volvé y alterná'],
  'plank-shoulder-tap': ['Tocá el hombro opuesto', 'Apoyá la mano y alterná'],
};
