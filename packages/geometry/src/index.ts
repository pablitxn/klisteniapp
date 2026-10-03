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
  return exerciseId === 'glute-bridge'
    ? { neck: [0, 0.145, -0.555], angle: -Math.PI / 2 }
    : { neck: torsoPoint(pose, 0, 0.595), angle: pose.torsoAngle };
}

/** A full cycle, starts in the easier/extended position. Smooth at both turnarounds. */
export function repetitionAmount(phase: number): number {
  return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

export function getExercisePose(exerciseId: string, phase: number): BodyPose {
  const s = repetitionAmount(phase);
  let pelvis: Vec3 = [0, 0.94, 0];
  let torsoAngle = 0;
  const floorExercise = ['pushup', 'glute-bridge', 'dead-bug', 'prone-w', 'row'].includes(exerciseId);
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
    }
    arms[side] = solveLimb(shoulder, wrist, BODY.upperArm, BODY.forearm, armBend);
    legs[side] ??= solveLimb(hip, ankle, BODY.thigh, BODY.shin, kneeBend);
  }
  return { pelvis, torsoAngle, arms, legs, floorExercise };
}

export const EXERCISE_PHASES: Record<string, readonly [string, string]> = {
  pushup: ['Bajá con control', 'Empujá el suelo'],
  squat: ['Llevá la cadera atrás', 'Volvé a subir'],
  'glute-bridge': ['Elevá la cadera', 'Bajá con control'],
  'dead-bug': ['Extendé lados opuestos', 'Volvé y alterná'],
  'prone-w': ['Elevá suavemente los brazos', 'Apoyá con control'],
  'calf-raise': ['Subí los talones', 'Bajá con control'],
  row: ['Acercá el pecho a la barra', 'Extendé con control'],
};
