import { Quaternion, Vector3 } from 'three';
import { solveLimb, type Limb, type Side, type Vec3 } from '@klisteniapp/geometry';
import type { YogaAsanaId } from '@klisteniapp/scene-schema';
import { retargetExercisePose, segmentFrame, type AnatomyLandmarks, type AnatomyRig } from './anatomy-rig.ts';
import { applyYogaPoseFrame, getYogaPose, type YogaPose, type YogaSide, type YogaTerminal } from './yoga-rig.ts';

export const YOGA_MOTION_DURATION_SECONDS = 12;
export const YOGA_HOLD_PHASE = 0.5;
export const yogaMotionTimeline = [
  { id: 'preparation', label: 'Preparación', start: 0, end: 0.08 },
  { id: 'enter', label: 'Entrada', start: 0.08, end: 0.36 },
  { id: 'hold', label: 'Permanencia', start: 0.36, end: 0.66 },
  { id: 'exit', label: 'Salida', start: 0.66, end: 0.94 },
  { id: 'preparation', label: 'Preparación', start: 0.94, end: 1 },
] as const;
export interface YogaMotion {
  asanaId: YogaAsanaId;
  side: YogaSide;
  durationSeconds: number;
  timeline: typeof yogaMotionTimeline;
  preparation: string;
  sample: (phase: number) => YogaPose;
  phaseLabel: (phase: number) => string;
}
const SIDES: Side[] = ['left', 'right'];
const v = (value: Vec3) => new Vector3(...value);
const p = (value: Vector3): Vec3 => [value.x, value.y, value.z];
const sign = (side: Side) => side === 'left' ? 1 : -1;
const opposite = (side: Side): Side => side === 'left' ? 'right' : 'left';
const distance = (a: Vec3, b: Vec3) => v(a).distanceTo(v(b));
const mix = (a: Vec3, b: Vec3, amount: number): Vec3 => p(v(a).lerp(v(b), amount));
const q = (pitch = 0) => new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), pitch);
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * t * (t * (t * 6 - 15) + 10); };
const phaseOf = (value: number) => Number.isFinite(value) ? ((value % 1) + 1) % 1 : 0;
export function yogaMotionPhaseLabel(value: number) {
  const phase = phaseOf(value);
  return yogaMotionTimeline.find(interval => phase >= interval.start && phase < interval.end)!.label;
}
const amountAt = (phase: number) => phase < 0.36 ? smooth((phase - 0.08) / 0.28)
  : phase < 0.66 ? 1 : 1 - smooth((phase - 0.66) / 0.28);
const transformed = (point: Vec3, source: Vec3, target: Vec3, rotation: Quaternion): Vec3 =>
  p(v(point).sub(v(source)).applyQuaternion(rotation).add(v(target)));
function clone(pose: YogaPose): YogaPose {
  return { ...pose, pelvis: [...pose.pelvis], neck: [...pose.neck], headTop: [...pose.headTop],
    pelvisRotation: pose.pelvisRotation.clone(), torsoRotation: pose.torsoRotation.clone(), headRotation: pose.headRotation.clone(),
    arms: { ...pose.arms }, legs: { ...pose.legs }, hands: { ...pose.hands }, feet: { ...pose.feet } };
}
function reach(landmarks: AnatomyLandmarks, pose: YogaPose, limb: 'arms' | 'legs', side: Side, target: Vec3, hint?: Vec3): Limb {
  const source = landmarks[side], arm = limb === 'arms';
  const start = transformed(arm ? source.shoulder : source.hip, landmarks.pelvis, pose.pelvis, arm ? pose.torsoRotation : pose.pelvisRotation);
  const previous = pose[limb][side];
  return solveLimb(start, target,
    distance(arm ? source.shoulder : source.hip, arm ? source.elbow : source.knee),
    distance(arm ? source.elbow : source.knee, arm ? source.wrist : source.ankle),
    hint ?? p(v(previous.joint).sub(v(previous.start))));
}
function updateAxial(landmarks: AnatomyLandmarks, pose: YogaPose, supportedNeck?: Vec3) {
  pose.neck = supportedNeck ?? transformed(landmarks.neck, landmarks.pelvis, pose.pelvis, pose.torsoRotation);
  pose.headTop = transformed(landmarks.headTop, landmarks.neck, pose.neck, pose.headRotation);
}
function relaxedArms(landmarks: AnatomyLandmarks, pose: YogaPose) {
  for (const side of SIDES) {
    const source = landmarks[side];
    const shoulder = transformed(source.shoulder, landmarks.pelvis, pose.pelvis, pose.torsoRotation);
    const length = distance(source.shoulder, source.elbow) + distance(source.elbow, source.wrist);
    pose.arms[side] = reach(landmarks, pose, 'arms', side,
      [shoulder[0] + sign(side) * 0.07, shoulder[1] - length + 0.025, shoulder[2] + 0.04], [sign(side), 0, -1]);
    pose.hands[side] = null;
  }
}
function terminal(landmarks: AnatomyLandmarks, pose: YogaPose, side: Side, hand: boolean): YogaTerminal {
  const explicit = hand ? pose.hands[side] : pose.feet[side];
  if (explicit) return explicit;
  const source = landmarks[side], limb = hand ? pose.arms[side] : pose.legs[side];
  const sourceStart = hand ? source.elbow : source.knee, sourceEnd = hand ? source.wrist : source.ankle;
  const rotation = (hand ? pose.torsoRotation : pose.pelvisRotation).clone();
  const from = v(sourceEnd).sub(v(sourceStart)).normalize().applyQuaternion(rotation);
  const to = v(limb.end).sub(v(limb.joint)).normalize();
  const delta = new Quaternion().setFromUnitVectors(from, to).multiply(rotation);
  const endpoint = hand ? source.handEnd ?? [source.wrist[0], source.wrist[1] - 0.17, source.wrist[2]] as Vec3
    : source.toe ?? [source.ankle[0], 0.02, source.ankle[2] + 0.18] as Vec3;
  return { direction: p(v(endpoint).sub(v(sourceEnd)).applyQuaternion(delta)),
    normal: p(new Vector3(...(hand ? [0, 0, 1] : [0, 1, 0]) as Vec3).applyQuaternion(delta)) };
}
function blendTerminal(a: YogaTerminal, b: YogaTerminal, amount: number): YogaTerminal {
  // Slerp the complete palm/sole frame. Interpolating its two vectors separately
  // can make them parallel and abruptly flip the wrist during a forward fold.
  const frame = (value: YogaTerminal) => new Quaternion().setFromRotationMatrix(segmentFrame(new Vector3(), v(value.direction), v(value.normal)));
  const rotation = frame(a).slerp(frame(b), amount);
  return { direction: p(new Vector3(0, 1, 0).applyQuaternion(rotation)), normal: p(new Vector3(0, 0, 1).applyQuaternion(rotation)) };
}
/** Swing a free limb around its own joint; a Cartesian hand tween would pass
 * through the ribcage when arms rise from beside the body to overhead. */
function swingingTarget(start: Vec3, from: Limb, to: Limb, amount: number): Vec3 {
  const a = v(from.end).sub(v(from.start)), b = v(to.end).sub(v(to.start));
  const length = a.length() + (b.length() - a.length()) * amount;
  const rotation = new Quaternion().identity().slerp(new Quaternion().setFromUnitVectors(a.normalize(), b.normalize()), amount);
  return p(a.applyQuaternion(rotation).multiplyScalar(length).add(v(start)));
}

/** Cache contextual preparation and support constraints once, then sample only
 * joint transforms. No mesh scaling, moving camera, or standing-to-floor tween. */
export function createYogaMotion(landmarks: AnatomyLandmarks, asanaId: YogaAsanaId, side: YogaSide = 'both'): YogaMotion {
  const goal = getYogaPose(landmarks, asanaId, side), prep = clone(goal);
  const active = goal.side, passive = opposite(active);
  const fixedHands = new Set<Side>(), fixedFeet = new Set<Side>(SIDES);
  let preparation = 'Acomodá la base antes de entrar.';
  let anchoredKnee: Side | undefined, supportedNeck = false, bridge = false;
  const upright = () => { prep.torsoRotation = q(); prep.pelvisRotation = q(); prep.headRotation = q(); prep.torsoAngle = 0; };
  switch (asanaId) {
    case 'tadasana':
      preparation = 'De pie, acomodá los brazos y alargá suavemente la nuca.';
      prep.headRotation = q(0.12);
      for (const s of SIDES) {
        const hand = goal.arms[s].end;
        prep.arms[s] = reach(landmarks, prep, 'arms', s, [hand[0] + sign(s) * 0.10, hand[1] + 0.13, hand[2] + 0.10], [sign(s), 0, -1]);
      }
      break;
    case 'uttanasana': case 'ardha-uttanasana': case 'utkatasana':
    case 'virabhadrasana-i': case 'virabhadrasana-ii': case 'anjaneyasana':
      preparation = 'Prepará los apoyos y después acompañá la entrada con los brazos y el torso.';
      upright();
      if (['utkatasana', 'virabhadrasana-i', 'virabhadrasana-ii'].includes(asanaId)) {
        prep.pelvis[0] = (goal.legs.left.end[0] + goal.legs.right.end[0]) / 2;
        prep.pelvis[2] = (goal.legs.left.end[2] + goal.legs.right.end[2]) / 2;
        prep.pelvis[1] = Math.min(...SIDES.map(s => {
          const foot = goal.legs[s].end, hip = landmarks[s].hip;
          const span = distance(hip, landmarks[s].knee) + distance(landmarks[s].knee, landmarks[s].ankle) - 0.00002;
          return foot[1] + Math.sqrt(span ** 2 - (foot[0] - prep.pelvis[0] - hip[0]) ** 2 - (foot[2] - prep.pelvis[2]) ** 2);
        }));
      }
      if (asanaId === 'anjaneyasana') {
        anchoredKnee = passive;
        const knee = goal.legs[passive].joint, thigh = distance(landmarks[passive].hip, landmarks[passive].knee);
        prep.pelvis = [0, knee[1] + Math.sqrt(thigh ** 2 - 0.08 ** 2), knee[2] + 0.08];
      }
      relaxedArms(landmarks, prep);
      break;
    case 'trikonasana':
      preparation = 'Con los pies separados, abrí los brazos antes de inclinarte.';
      upright();
      for (const s of SIDES) {
        const length = distance(landmarks[s].shoulder, landmarks[s].elbow) + distance(landmarks[s].elbow, landmarks[s].wrist);
        prep.arms[s] = reach(landmarks, prep, 'arms', s, [sign(s) * (Math.abs(landmarks[s].shoulder[0]) + length - 0.00001), prep.pelvis[1] + landmarks[s].shoulder[1] - landmarks.pelvis[1], 0], [0, 0, -1]);
        prep.hands[s] = null;
      }
      break;
    case 'vrksasana':
      preparation = 'Apoyá ambos pies; reuní las manos mientras elevás el pie libre hasta la pantorrilla.';
      relaxedArms(landmarks, prep);
      prep.legs[passive] = reach(landmarks, prep, 'legs', passive,
        [prep.legs[passive].start[0], landmarks[passive].ankle[1], landmarks[passive].ankle[2]], [sign(passive), 0, 0.2]);
      prep.feet[passive] = getYogaPose(landmarks, 'tadasana').feet[passive];
      fixedFeet.delete(passive);
      break;
    case 'sukhasana': case 'baddha-konasana': case 'dandasana':
      preparation = 'Desde el asiento, acomodá las manos y dejá crecer el torso.';
      prep.headRotation = q(0.16);
      for (const s of SIDES) {
        const hand = goal.arms[s].end;
        prep.arms[s] = reach(landmarks, prep, 'arms', s, [hand[0] + sign(s) * 0.035, hand[1] + 0.15, hand[2] + 0.07], [sign(s), 0, -0.2]);
        prep.hands[s] = null;
      }
      break;
    case 'paschimottanasana': case 'janu-sirsasana': case 'ardha-matsyendrasana':
      preparation = 'Organizá las piernas sentado y crecé antes de plegarte o girar.';
      upright();
      for (const s of SIDES) {
        prep.arms[s] = reach(landmarks, prep, 'arms', s, [sign(s) * 0.19, 0.28, 0.34], [sign(s), -0.4, 0]);
        prep.hands[s] = null;
      }
      break;
    case 'marjaryasana': case 'bitilasana':
      preparation = 'Desde cuatro apoyos, articulá suavemente pelvis y cabeza con manos y rodillas apoyadas.';
      prep.pelvisRotation = q(Math.PI / 2); prep.headRotation = q(Math.PI / 2);
      prep.torsoRotation = q(prep.torsoAngle + (asanaId === 'marjaryasana' ? 0.025 : 0.005));
      SIDES.forEach(s => fixedHands.add(s));
      break;
    case 'balasana': {
      preparation = 'Desde cuatro apoyos, llevá la pelvis hacia los talones sin arrastrar las manos.';
      const knee = goal.legs.left.joint, thigh = distance(landmarks.left.hip, landmarks.left.knee);
      prep.pelvis = [0, knee[1] + thigh - 0.004, knee[2] - Math.sqrt(thigh ** 2 - (thigh - 0.004) ** 2)];
      prep.torsoAngle = 1.52; prep.torsoRotation = q(1.52); prep.pelvisRotation = q(Math.PI / 2); prep.headRotation = q(1.52);
      anchoredKnee = 'left'; SIDES.forEach(s => fixedHands.add(s));
      break;
    }
    case 'adho-mukha-svanasana': {
      preparation = 'Desde cuatro apoyos y los dedos recogidos, elevá las rodillas y llevá la pelvis hacia arriba.';
      const ankle = goal.legs.left.end, shin = distance(landmarks.left.knee, landmarks.left.ankle);
      const thigh = distance(landmarks.left.hip, landmarks.left.knee);
      const kneeZ = ankle[2] + Math.sqrt(shin ** 2 - (ankle[1] - 0.105) ** 2);
      prep.pelvis = [0, 0.105 + Math.sqrt(thigh ** 2 - 0.10 ** 2), kneeZ + 0.10];
      prep.torsoAngle = Math.PI / 2; prep.torsoRotation = q(Math.PI / 2); prep.pelvisRotation = q(Math.PI / 2); prep.headRotation = q(Math.PI / 2);
      for (const s of SIDES) {
        fixedHands.add(s);
        prep.legs[s] = { start: [landmarks[s].hip[0], prep.pelvis[1], prep.pelvis[2]], joint: [landmarks[s].hip[0], 0.105, kneeZ], end: goal.legs[s].end };
      }
      break;
    }
    case 'bhujangasana': case 'salabhasana': {
      preparation = 'Desde boca abajo, elevá el pecho con amplitud pequeña y regresá con control.';
      prep.torsoAngle = 1.53; prep.torsoRotation = q(1.53); prep.headRotation = q(1.40);
      for (let attempt = 0; attempt < 30; attempt++) {
        const bottom = Math.min(...(landmarks.support?.torsoProfile ?? []).map(point => transformed(point, landmarks.pelvis, prep.pelvis, prep.torsoRotation)[1]));
        if (bottom >= 0.005) break;
        prep.torsoAngle -= 0.01; prep.torsoRotation = q(prep.torsoAngle);
      }
      if (asanaId === 'bhujangasana') SIDES.forEach(s => fixedHands.add(s));
      else {
        const lower = getYogaPose(landmarks, 'bhujangasana');
        for (const s of SIDES) {
          prep.legs[s] = lower.legs[s]; fixedFeet.delete(s);
          prep.arms[s] = reach(landmarks, prep, 'arms', s, [goal.arms[s].end[0], 0.10, goal.arms[s].end[2]], [sign(s), 0.2, 0]);
        }
      }
      break;
    }
    case 'setu-bandha-sarvangasana': {
      preparation = 'Boca arriba, apoyá pies, hombros y cabeza antes de elevar la pelvis.';
      const lower = retargetExercisePose(landmarks, 'glute-bridge', 0);
      prep.pelvis = lower.pelvis; prep.torsoAngle = lower.torsoAngle;
      prep.torsoRotation = q(lower.torsoAngle); prep.pelvisRotation = q(lower.torsoAngle);
      prep.neck = lower.neck; prep.legs = lower.legs; prep.arms = lower.arms;
      supportedNeck = true; bridge = true; SIDES.forEach(s => fixedHands.add(s));
      break;
    }
    case 'supta-padangusthasana': {
      preparation = 'Boca arriba, conservá cabeza y espalda apoyadas mientras acercás una pierna.';
      prep.legs[active] = reach(landmarks, prep, 'legs', active,
        [landmarks[active].hip[0], landmarks[active].ankle[1], prep.pelvis[2] + 0.58], [0, 1, 0]);
      prep.feet[active] = getYogaPose(landmarks, 'tadasana').feet[active];
      const resting = getYogaPose(landmarks, 'savasana');
      prep.arms = resting.arms; prep.hands = resting.hands;
      fixedFeet.delete(active); supportedNeck = true;
      break;
    }
    case 'savasana':
      preparation = 'Boca arriba, acomodá los brazos y dejá descansar las manos.';
      supportedNeck = true;
      for (const s of SIDES) {
        const hand = goal.arms[s].end;
        prep.arms[s] = reach(landmarks, prep, 'arms', s, [hand[0] - sign(s) * 0.06, hand[1] + 0.12, hand[2] - 0.06], [sign(s), 1, 0]);
        prep.hands[s] = null;
      }
      break;
  }
  // Re-anchor modified preparations before caching their joint trajectories.
  for (const s of SIDES) {
    prep.arms[s] = reach(landmarks, prep, 'arms', s, fixedHands.has(s) ? goal.arms[s].end : prep.arms[s].end);
    prep.legs[s] = reach(landmarks, prep, 'legs', s, fixedFeet.has(s) ? goal.legs[s].end : prep.legs[s].end);
  }
  updateAxial(landmarks, prep, supportedNeck ? goal.neck : undefined);
  const terminals = { hands: { from: SIDES.map(s => terminal(landmarks, prep, s, true)), to: SIDES.map(s => terminal(landmarks, goal, s, true)) },
    feet: { from: SIDES.map(s => terminal(landmarks, prep, s, false)), to: SIDES.map(s => terminal(landmarks, goal, s, false)) } };

  const sample = (rawPhase: number): YogaPose => {
    const phase = phaseOf(rawPhase), amount = amountAt(phase), pose = clone(goal);
    pose.pelvis = mix(prep.pelvis, goal.pelvis, amount);
    pose.pelvisRotation = prep.pelvisRotation.clone().slerp(goal.pelvisRotation, amount);
    pose.torsoRotation = prep.torsoRotation.clone().slerp(goal.torsoRotation, amount);
    pose.headRotation = prep.headRotation.clone().slerp(goal.headRotation, amount);
    pose.torsoAngle = prep.torsoAngle + (goal.torsoAngle - prep.torsoAngle) * amount;
    if (phase > 0.36 && phase < 0.66 && ['tadasana', 'sukhasana', 'savasana'].includes(asanaId)) {
      const hold = (phase - 0.36) / 0.30;
      // A tiny thorax articulation suggests quiet breathing without stretching
      // the atlas. Keep the exact teaching pose at the canonical poster phase.
      const breathing = 0.004 * Math.sin(Math.PI * hold) ** 2 * Math.sin(Math.PI * (phase - YOGA_HOLD_PHASE) / 0.15) ** 2;
      pose.torsoAngle += breathing;
      pose.torsoRotation.multiply(q(breathing));
    }
    if (anchoredKnee) {
      const knee = goal.legs[anchoredKnee].joint;
      const from = v(prep.pelvis).sub(new Vector3(0, knee[1], knee[2]));
      const to = v(goal.pelvis).sub(new Vector3(0, knee[1], knee[2]));
      const rotation = new Quaternion().identity().slerp(new Quaternion().setFromUnitVectors(from.clone().normalize(), to.clone().normalize()), amount);
      pose.pelvis = p(from.applyQuaternion(rotation).add(new Vector3(0, knee[1], knee[2])));
    }
    if (bridge) {
      const shoulder = v(landmarks.left.shoulder).add(v(landmarks.right.shoulder)).multiplyScalar(0.5);
      const supported = v(goal.arms.left.start).add(v(goal.arms.right.start)).multiplyScalar(0.5);
      pose.pelvis = p(supported.sub(shoulder.sub(v(landmarks.pelvis)).applyQuaternion(pose.torsoRotation)));
    }
    for (const [index, s] of SIDES.entries()) {
      for (const limb of ['arms', 'legs'] as const) {
        const fixed = limb === 'arms' ? fixedHands.has(s) : fixedFeet.has(s);
        const sourceStart = limb === 'arms' ? landmarks[s].shoulder : landmarks[s].hip;
        const start = transformed(sourceStart, landmarks.pelvis, pose.pelvis, limb === 'arms' ? pose.torsoRotation : pose.pelvisRotation);
        const target = fixed ? goal[limb][s].end : swingingTarget(start, prep[limb][s], goal[limb][s], amount);
        const hint = mix(p(v(prep[limb][s].joint).sub(v(prep[limb][s].start))), p(v(goal[limb][s].joint).sub(v(goal[limb][s].start))), amount);
        pose[limb][s] = reach(landmarks, pose, limb, s, target, hint);
      }
      pose.hands[s] = blendTerminal(terminals.hands.from[index]!, terminals.hands.to[index]!, amount);
      pose.feet[s] = blendTerminal(terminals.feet.from[index]!, terminals.feet.to[index]!, amount);
    }
    updateAxial(landmarks, pose, supportedNeck ? goal.neck : undefined);
    return pose;
  };
  return { asanaId, side, durationSeconds: YOGA_MOTION_DURATION_SECONDS, timeline: yogaMotionTimeline, preparation, sample, phaseLabel: yogaMotionPhaseLabel };
}

export function applyYogaMotion(rig: AnatomyRig, motion: YogaMotion, phase: number): YogaPose {
  return applyYogaPoseFrame(rig, motion.sample(phase));
}
