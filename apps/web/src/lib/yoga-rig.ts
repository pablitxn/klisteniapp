import { Matrix4, Quaternion, Vector3 } from 'three';
import { solveLimb, type Limb, type Side, type Vec3 } from '@klisteniapp/geometry';
import type { YogaAsanaId } from '@klisteniapp/scene-schema';
import { retargetExercisePose, segmentFrame, type AnatomyLandmarks, type AnatomyRig, type RigSegment } from './anatomy-rig.ts';

export type YogaSide = 'both' | Side;
export type YogaTerminal = { direction: Vec3; normal: Vec3 };
export type YogaProp = { type: 'block'; position: Vec3; size: Vec3 };
export interface YogaPose {
  asanaId: YogaAsanaId;
  side: Side;
  pelvis: Vec3;
  neck: Vec3;
  headTop: Vec3;
  torsoAngle: number;
  pelvisRotation: Quaternion;
  torsoRotation: Quaternion;
  headRotation: Quaternion;
  arms: Record<Side, Limb>;
  legs: Record<Side, Limb>;
  hands: Record<Side, YogaTerminal | null>;
  feet: Record<Side, YogaTerminal | null>;
  floorExercise: boolean;
  props: YogaProp[];
}

const SIDES: Side[] = ['left', 'right'];
const v = (p: Vec3) => new Vector3(...p);
const p = (a: Vector3): Vec3 => [a.x, a.y, a.z];
const length = (a: Vec3, b: Vec3) => v(a).distanceTo(v(b));
const sign = (side: Side) => side === 'left' ? 1 : -1;
const other = (side: Side): Side => side === 'left' ? 'right' : 'left';
const unit = (direction: Vec3) => v(direction).normalize();
const q = (pitch = 0, yaw = 0, roll = 0) => new Quaternion()
  .setFromAxisAngle(new Vector3(0, 1, 0), yaw)
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), roll))
  .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch));
const transform = (value: Vec3, source: Vec3, target: Vec3, rotation: Quaternion): Vec3 =>
  p(v(value).sub(v(source)).applyQuaternion(rotation).add(v(target)));
const palmDown: YogaTerminal = { direction: [0, 0, 1], normal: [0, -1, 0] };
const proneFoot: YogaTerminal = { direction: [0, -0.035, -0.18], normal: [0, -1, 0] };

/** Pure source-length kinematics; anatomical left is +X in the source atlas.
 * This 17-segment educational rig approximates the spine with separate rigid
 * pelvis, torso and head rotations. It is not a vertebra-by-vertebra simulation.
 */
export function getYogaPose(landmarks: AnatomyLandmarks, asanaId: YogaAsanaId, selectedSide: YogaSide = 'both'): YogaPose {
  const side: Side = selectedSide === 'both' ? 'right' : selectedSide;
  const active = sign(side), passive = other(side);
  const armLength = (s: Side) => length(landmarks[s].shoulder, landmarks[s].elbow) + length(landmarks[s].elbow, landmarks[s].wrist);
  const thigh = (s: Side) => length(landmarks[s].hip, landmarks[s].knee);
  const shin = (s: Side) => length(landmarks[s].knee, landmarks[s].ankle);
  const legLength = (s: Side) => thigh(s) + shin(s);
  const handHeight = (s: Side) => landmarks.support?.handHeight?.[s] ?? 0.065;
  let pelvis: Vec3 = [...landmarks.pelvis];
  let torsoAngle = 0, torsoRotation = q(), pelvisRotation = q(), headRotation: Quaternion | undefined;
  let neckOverride: Vec3 | undefined;
  let floorExercise = false;
  let baseArms: Record<Side, Limb> | undefined, baseLegs: Record<Side, Limb> | undefined;
  const armTargets: Partial<Record<Side, Vec3>> = {}, legTargets: Partial<Record<Side, Vec3>> = {};
  const armDirections: Partial<Record<Side, Vec3>> = {}, legDirections: Partial<Record<Side, Vec3>> = {};
  const armHints: Partial<Record<Side, Vec3>> = {}, legHints: Partial<Record<Side, Vec3>> = {};
  const knees: Partial<Record<Side, { height: number; z?: number }>> = {};
  const hands: Record<Side, YogaTerminal | null> = { left: null, right: null };
  const feet: Record<Side, YogaTerminal | null> = { left: null, right: null };
  const props: YogaProp[] = [];

  const trunk = (pitch: number, yaw = 0, roll = 0) => {
    torsoAngle = pitch; torsoRotation = q(pitch, yaw, roll);
  };
  const inherit = (exercise: string, phase: number) => {
    const base = retargetExercisePose(landmarks, exercise, phase);
    pelvis = base.pelvis;
    trunk(base.torsoAngle);
    pelvisRotation = q(base.torsoAngle);
    headRotation = q(base.headAngle);
    neckOverride = base.neck;
    baseArms = base.arms; baseLegs = base.legs;
  };
  const footRotation = (s: Side, rotation: Quaternion) => {
    const source = landmarks[s];
    feet[s] = {
      direction: p(v(source.toe ?? [source.ankle[0], source.ankle[1] - 0.045, source.ankle[2] + 0.18]).sub(v(source.ankle)).applyQuaternion(rotation)),
      normal: p(new Vector3(0, 1, 0).applyQuaternion(rotation)),
    };
  };
  const flatFeet = () => SIDES.forEach(s => footRotation(s, q()));
  const seat = () => { floorExercise = true; pelvis = [0, 0.157, 0]; };
  const longLeg = (s: Side, direction: Vec3 = [0, -0.045, 1]) => {
    legDirections[s] = direction;
    footRotation(s, q(-Math.PI / 2));
  };
  const handsOnThighs = () => SIDES.forEach(s => {
    armTargets[s] = [sign(s) * 0.27, 0.25, 0.28];
    armHints[s] = [sign(s), -0.6, -0.3];
  });
  const raisedArms = () => SIDES.forEach(s => { armDirections[s] = [sign(s) * 0.24, 0.97, 0.04]; });
  const blockHand = (s: Side, wrist: Vec3, width = 0.18) => {
    armTargets[s] = wrist; hands[s] = palmDown;
    const height = Math.max(0.025, wrist[1] - handHeight(s));
    props.push({ type: 'block', position: [wrist[0], height / 2, wrist[2] + 0.055], size: [width, height, 0.24] });
  };

  switch (asanaId) {
    case 'tadasana':
      baseArms = Object.fromEntries(SIDES.map(s => [s, { start: landmarks[s].shoulder, joint: landmarks[s].elbow, end: landmarks[s].wrist }])) as Record<Side, Limb>;
      baseLegs = Object.fromEntries(SIDES.map(s => [s, { start: landmarks[s].hip, joint: landmarks[s].knee, end: landmarks[s].ankle }])) as Record<Side, Limb>;
      flatFeet();
      break;
    case 'sukhasana':
      seat(); handsOnThighs();
      for (const s of SIDES) {
        legTargets[s] = [-sign(s) * 0.13, s === 'left' ? 0.099 : 0.115, s === 'left' ? 0.34 : 0.43];
        legHints[s] = [sign(s), 0.08, 0.15];
        feet[s] = { direction: [-sign(s), 0, 0.2], normal: [0, 1, 0] };
      }
      break;
    case 'baddha-konasana':
      seat();
      for (const s of SIDES) {
        legTargets[s] = [sign(s) * 0.045, 0.075, 0.38];
        legHints[s] = [sign(s), 0, 0.1];
        armTargets[s] = [sign(s) * 0.10, 0.19, 0.34];
        armHints[s] = [sign(s), -0.5, 0];
        footRotation(s, q(0, 0, sign(s) * Math.PI / 2));
      }
      break;
    case 'dandasana':
      seat();
      for (const s of SIDES) {
        longLeg(s);
        const wristHeight = pelvis[1] + landmarks[s].shoulder[1] - landmarks.pelvis[1] - armLength(s) + 0.03;
        blockHand(s, [sign(s) * 0.25, wristHeight, 0]);
        armHints[s] = [sign(s), 0, -1];
      }
      break;
    case 'paschimottanasana':
      seat(); trunk(1.12); pelvisRotation = q(0.18);
      for (const s of SIDES) {
        longLeg(s); armTargets[s] = [sign(s) * 0.13, 0.17, 0.75];
        armHints[s] = [sign(s), 0.15, 0];
      }
      break;
    case 'janu-sirsasana':
      seat(); trunk(0.88, active * 0.13); pelvisRotation = q(0.12);
      longLeg(side);
      legTargets[passive] = [-active * 0.12, 0.095, 0.24];
      legHints[passive] = [-active, 0.05, 0.1];
      feet[passive] = { direction: [active, -0.12, 0.3], normal: [0, 1, 0] };
      for (const s of SIDES) {
        armTargets[s] = [active * 0.11 + sign(s) * 0.055, 0.21, 0.63];
        armHints[s] = [sign(s), -0.3, 0];
      }
      break;
    case 'ardha-matsyendrasana':
      seat(); trunk(0, active * 0.62); headRotation = q(0, active * 0.9);
      longLeg(passive);
      legTargets[side] = [-active * 0.17, 0.09, 0.32];
      legHints[side] = [active * 0.12, 1, 0];
      footRotation(side, q());
      blockHand(side, [active * 0.28, 0.16, -0.16]);
      armTargets[passive] = [-active * 0.13, 0.44, 0.22];
      armHints[passive] = [-active, -0.5, 0.2];
      break;
    case 'balasana':
      floorExercise = true; pelvis = [0, 0.225, -0.26];
      trunk(Math.acos((0.16 - pelvis[1]) / length(landmarks.pelvis, landmarks.neck)));
      // Keep the actual external chest profile above the mat in both visual
      // morphologies; the adjustment opens the fold instead of shrinking it.
      for (let attempt = 0; attempt < 12; attempt++) {
        const bottom = Math.min(...(landmarks.support?.torsoProfile ?? []).map(point =>
          transform(point, landmarks.pelvis, pelvis, torsoRotation)[1]));
        if (bottom >= 0.003) break;
        trunk(torsoAngle - 0.01);
      }
      pelvisRotation = q(0.45); headRotation = q(Math.PI / 2);
      for (const s of SIDES) {
        knees[s] = { height: 0.105 };
        armTargets[s] = [sign(s) * 0.23, handHeight(s), 0.84];
        armHints[s] = [sign(s) * 0.1, 1, 0];
        hands[s] = palmDown; feet[s] = proneFoot;
      }
      break;
    case 'marjaryasana':
    case 'bitilasana': {
      const cat = asanaId === 'marjaryasana';
      floorExercise = true; pelvis = [0, cat ? 0.53 : 0.55, -0.22];
      // Match shoulder height to the measured arm span. Shortening the torso
      // to draw a pronounced cartoon arch would otherwise turn Cat into a push-up.
      const shoulder = landmarks.left.shoulder;
      const shoulderY = handHeight('left') + armLength('left') - 0.012;
      const dy = shoulder[1] - landmarks.pelvis[1], dz = shoulder[2] - landmarks.pelvis[2];
      trunk(Math.acos((shoulderY - pelvis[1]) / Math.hypot(dy, dz)) - Math.atan2(dz, dy));
      pelvisRotation = q(cat ? 1.18 : 1.85);
      headRotation = q(cat ? 2.15 : 0.85);
      for (const s of SIDES) {
        knees[s] = { height: 0.105 };
        const shoulderZ = transform(landmarks[s].shoulder, landmarks.pelvis, pelvis, torsoRotation)[2];
        armTargets[s] = [landmarks[s].shoulder[0], handHeight(s), shoulderZ];
        armHints[s] = [sign(s) * 0.15, 0, -1];
        hands[s] = palmDown; feet[s] = proneFoot;
      }
      break;
    }
    case 'adho-mukha-svanasana':
      inherit('pike-pushup', 0); floorExercise = true;
      for (const s of SIDES) {
        hands[s] = palmDown;
        const source = landmarks[s], offset = v(source.toe ?? [source.ankle[0], 0.02, source.ankle[2] + 0.18]).sub(v(source.ankle));
        const footPitch = Math.atan2(offset.y, offset.z) - Math.asin(Math.max(-1, Math.min(1,
          ((source.toe?.[1] ?? 0.02) - baseLegs![s].end[1]) / Math.hypot(offset.y, offset.z))));
        footRotation(s, q(footPitch));
      }
      break;
    case 'uttanasana':
    case 'ardha-uttanasana': {
      const half = asanaId === 'ardha-uttanasana';
      pelvis = [0, 0.84, -0.12]; trunk(half ? 1.10 : 2.22); pelvisRotation = q(half ? 0.30 : 0.55);
      for (const s of SIDES) {
        legTargets[s] = [landmarks[s].ankle[0] + sign(s) * 0.035, landmarks[s].ankle[1], 0];
        armTargets[s] = half ? [sign(s) * 0.15, 0.56, 0.20] : [sign(s) * 0.15, handHeight(s) + 0.12, 0.28];
        armHints[s] = [sign(s) * 0.3, 0.1, 1];
        if (!half) blockHand(s, armTargets[s]!);
      }
      flatFeet();
      break;
    }
    case 'utkatasana':
      inherit('squat', 0.25); raisedArms(); flatFeet();
      break;
    case 'virabhadrasana-i': {
      pelvis = [0, 0.70, 0.02]; trunk(0.03); raisedArms();
      legTargets[side] = [active * 0.13, landmarks[side].ankle[1], 0.37];
      const rearX = -active * 0.13, drop = pelvis[1] - landmarks[passive].ankle[1];
      const reach = Math.sqrt((legLength(passive) - 0.00001) ** 2 - drop ** 2 - (rearX - landmarks[passive].hip[0]) ** 2);
      legTargets[passive] = [rearX, landmarks[passive].ankle[1], pelvis[2] - reach];
      footRotation(side, q()); footRotation(passive, q(0, -active * 0.55));
      break;
    }
    case 'virabhadrasana-ii': {
      pelvis = [active * 0.20, 0.665, 0];
      headRotation = q(0, active * Math.PI / 2);
      legTargets[side] = [active * 0.61, landmarks[side].ankle[1], 0];
      const drop = pelvis[1] - landmarks[passive].ankle[1];
      const reach = Math.sqrt((legLength(passive) - 0.00001) ** 2 - drop ** 2);
      legTargets[passive] = [pelvis[0] + landmarks[passive].hip[0] - active * reach, landmarks[passive].ankle[1], 0];
      legHints[side] = [active, 0, 0]; legHints[passive] = [-active, 0, 0];
      for (const s of SIDES) armDirections[s] = [sign(s), 0, 0];
      footRotation(side, q(0, active * Math.PI / 2)); footRotation(passive, q(0, active * 0.15));
      break;
    }
    case 'trikonasana':
      pelvis = [0, 0.75, 0]; trunk(0, 0, -active * 1.02);
      for (const s of SIDES) {
        legTargets[s] = [sign(s) * 0.55, landmarks[s].ankle[1], 0];
        legHints[s] = [sign(s), 0, 0.4];
      }
      blockHand(side, [active * 0.63, 0.39, 0.02]);
      armHints[side] = [active, 0, -0.2];
      armDirections[passive] = [0, 1, 0];
      footRotation(side, q(0, active * Math.PI / 2)); footRotation(passive, q(0, active * 0.12));
      break;
    case 'vrksasana':
      pelvis = [-landmarks[side].hip[0], landmarks.pelvis[1] - 0.005, 0];
      legTargets[side] = [0, landmarks[side].ankle[1], landmarks[side].ankle[2]];
      legTargets[passive] = [-active * 0.055, 0.34, 0.035];
      legHints[passive] = [-active, 0.10, 0.1];
      footRotation(side, q());
      feet[passive] = { direction: [0, -1, 0.05], normal: [active, 0, 0] };
      for (const s of SIDES) {
        armTargets[s] = [pelvis[0] + sign(s) * 0.045, 1.23, 0.19];
        armHints[s] = [sign(s), -0.4, 0];
        hands[s] = { direction: [0, 1, 0], normal: [-sign(s), 0, 0] };
      }
      break;
    case 'anjaneyasana': {
      const kneeZ = -0.20;
      pelvis = [0, 0.105 + Math.sqrt(thigh(passive) ** 2 - kneeZ ** 2), 0];
      trunk(0.03); raisedArms(); floorExercise = true;
      knees[passive] = { height: 0.105, z: kneeZ };
      legTargets[side] = [active * 0.13, landmarks[side].ankle[1], 0.48];
      legHints[side] = [0, 0, 1];
      footRotation(side, q()); feet[passive] = proneFoot;
      break;
    }
    case 'bhujangasana':
    case 'salabhasana': {
      const cobra = asanaId === 'bhujangasana';
      floorExercise = true;
      pelvis = [0, Math.max(landmarks.support?.pronePelvisHeight ?? 0.18, 0.18), -0.08];
      trunk(cobra ? 1.10 : 1.39); pelvisRotation = q(Math.PI / 2); headRotation = q(cobra ? 0.50 : 1.5);
      for (const s of SIDES) {
        legDirections[s] = cobra ? [0, -0.12, -1] : [0, 0.12, -1];
        feet[s] = proneFoot;
        if (cobra) {
          armTargets[s] = [sign(s) * 0.23, handHeight(s), 0.27];
          armHints[s] = [sign(s) * 0.15, 0, -1]; hands[s] = palmDown;
        } else armDirections[s] = [sign(s) * 0.18, -0.14, -1];
      }
      break;
    }
    case 'setu-bandha-sarvangasana':
      inherit('glute-bridge', 0.5); floorExercise = true; flatFeet();
      SIDES.forEach(s => { hands[s] = palmDown; });
      break;
    case 'savasana':
    case 'supta-padangusthasana': {
      inherit('glute-bridge', 0); floorExercise = true;
      for (const s of SIDES) {
        legDirections[s] = [sign(s) * 0.13, -0.07, 1];
        footRotation(s, q(-Math.PI / 2, 0, -sign(s) * 0.25));
        hands[s] = { direction: [sign(s) * 0.15, 0, 1], normal: [0, 1, 0] };
      }
      if (asanaId === 'supta-padangusthasana') {
        legDirections[side] = [0, 0.92, -0.39];
        delete legDirections[passive];
        legTargets[passive] = [landmarks[passive].hip[0], landmarks[passive].ankle[1], pelvis[2] + 0.58];
        legHints[passive] = [0, 1, 0]; footRotation(passive, q());
        footRotation(side, q(-0.38));
        for (const s of SIDES) {
          armTargets[s] = [landmarks[side].hip[0] + sign(s) * 0.065, pelvis[1] + 0.28, pelvis[2] - 0.15];
          armHints[s] = [sign(s), 1, 0]; hands[s] = null;
        }
      }
      break;
    }
    default: {
      const exhaustive: never = asanaId;
      throw new Error(`Asana sin pose: ${exhaustive}`);
    }
  }

  const arms = {} as Record<Side, Limb>, legs = {} as Record<Side, Limb>;
  for (const s of SIDES) {
    const source = landmarks[s];
    const shoulder = transform(source.shoulder, landmarks.pelvis, pelvis, torsoRotation);
    const hip = transform(source.hip, landmarks.pelvis, pelvis, pelvisRotation);
    const armTarget = armDirections[s]
      ? p(v(shoulder).addScaledVector(unit(armDirections[s]!), armLength(s) - 0.00001))
      : armTargets[s];
    arms[s] = armTarget ? solveLimb(shoulder, armTarget,
      length(source.shoulder, source.elbow), length(source.elbow, source.wrist), armHints[s] ?? [sign(s) * 0.2, 0, -1])
      : baseArms?.[s] ?? solveLimb(shoulder, p(v(shoulder).add(new Vector3(sign(s) * 0.08, -armLength(s) + 0.01, 0))),
        length(source.shoulder, source.elbow), length(source.elbow, source.wrist), [0, 0, -1]);
    if (knees[s]) {
      const anchor = knees[s]!;
      const vertical = hip[1] - anchor.height;
      const forward = Math.sqrt(Math.max(0, thigh(s) ** 2 - vertical ** 2));
      const knee: Vec3 = [hip[0], anchor.height, anchor.z ?? hip[2] + forward];
      const ankleDrop = 0.04;
      const ankle: Vec3 = [knee[0], knee[1] - ankleDrop, knee[2] - Math.sqrt(shin(s) ** 2 - ankleDrop ** 2)];
      legs[s] = { start: hip, joint: knee, end: ankle };
    } else {
      const legTarget = legDirections[s]
        ? p(v(hip).addScaledVector(unit(legDirections[s]!), legLength(s) - 0.00001))
        : legTargets[s];
      legs[s] = legTarget ? solveLimb(hip, legTarget, thigh(s), shin(s), legHints[s] ?? [0, 0, 1])
        : baseLegs?.[s] ?? solveLimb(hip, source.ankle, thigh(s), shin(s), [0, 0, 1]);
    }
  }
  const neck = neckOverride ?? transform(landmarks.neck, landmarks.pelvis, pelvis, torsoRotation);
  const head = headRotation ?? torsoRotation.clone();
  const headTop = transform(landmarks.headTop, landmarks.neck, neck, head);
  return { asanaId, side, pelvis, neck, headTop, torsoAngle, pelvisRotation, torsoRotation, headRotation: head,
    arms, legs, hands, feet, floorExercise, props };
}

function rigid(segment: RigSegment, source: Vec3, target: Vec3, rotation: Quaternion) {
  const delta = new Matrix4().makeTranslation(...target)
    .multiply(new Matrix4().makeRotationFromQuaternion(rotation))
    .multiply(new Matrix4().makeTranslation(-source[0], -source[1], -source[2]));
  segment.bone.matrix.copy(delta.multiply(segment.bindMatrix));
}

function limbFrame(segment: RigSegment, start: Vec3, end: Vec3, rotation: Quaternion) {
  const from = segment.direction.clone().applyQuaternion(rotation);
  const to = v(end).sub(v(start)).normalize();
  const orientation = new Quaternion().setFromUnitVectors(from, to).multiply(rotation).multiply(segment.bindRotation);
  segment.bone.matrix.compose(v(start), orientation, new Vector3(1, 1, 1));
}

/** Update only the existing 17 GPU bones. The GLB and bind geometry are untouched. */
export function applyYogaPose(rig: AnatomyRig, asanaId: YogaAsanaId, side: YogaSide = 'both'): YogaPose {
  const pose = getYogaPose(rig.landmarks, asanaId, side);
  return applyYogaPoseFrame(rig, pose);
}

/** Apply a sampled pose through the same GPU deformation as the static atlas. */
export function applyYogaPoseFrame(rig: AnatomyRig, pose: YogaPose): YogaPose {
  for (const segment of rig.segments) {
    const s = segment.side!;
    switch (segment.segment) {
      case 'pelvis': rigid(segment, rig.landmarks.pelvis, pose.pelvis, pose.pelvisRotation); break;
      case 'torso':
      case 'scapula': rigid(segment, rig.landmarks.pelvis, pose.pelvis, pose.torsoRotation); break;
      case 'head': rigid(segment, rig.landmarks.neck, pose.neck, pose.headRotation); break;
      case 'upperArm': limbFrame(segment, pose.arms[s].start, pose.arms[s].joint, pose.torsoRotation); break;
      case 'forearm': limbFrame(segment, pose.arms[s].joint, pose.arms[s].end, pose.torsoRotation); break;
      case 'thigh': limbFrame(segment, pose.legs[s].start, pose.legs[s].joint, pose.pelvisRotation); break;
      case 'shin': limbFrame(segment, pose.legs[s].joint, pose.legs[s].end, pose.pelvisRotation); break;
      case 'hand':
      case 'foot': {
        const hand = segment.segment === 'hand';
        const terminal = hand ? pose.hands[s] : pose.feet[s];
        const anchor = hand ? pose.arms[s].end : pose.legs[s].end;
        if (terminal) {
          segment.bone.matrix.copy(segmentFrame(v(anchor), v(anchor).addScaledVector(unit(terminal.direction), segment.length), v(terminal.normal)));
        } else {
          const parent = rig.byKey.get(`${hand ? 'forearm' : 'shin'}.${s}`)!;
          segment.bone.matrix.copy(parent.bone.matrix.clone().multiply(parent.bindMatrix.clone().invert()).multiply(segment.bindMatrix));
        }
        break;
      }
    }
    segment.bone.matrixWorld.copy(segment.bone.matrix);
  }
  rig.skeleton.update();
  return pose;
}
