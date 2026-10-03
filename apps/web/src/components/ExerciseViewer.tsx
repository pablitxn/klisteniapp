import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Group, Matrix4, PCFShadowMap, Vector3 } from 'three';
import { EXERCISE_PHASES, getExercisePose, getHeadPose, type BodyPose, type Side, type Vec3 } from '@klisteniapp/geometry';
import './viewer.css';

export interface ExerciseViewerProps {
  exerciseId: string;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  selectedMuscle?: string | null;
  onSelectMuscle?: (id: string) => void;
  reducedMotion?: boolean;
}

const MUSCLE_NAMES: Record<string, string> = {
  pectorals: 'Pectorales', deltoids: 'Deltoides', triceps: 'Tríceps', lats: 'Dorsales', biceps: 'Bíceps',
  'upper-back': 'Espalda alta', abdominals: 'Abdominales', obliques: 'Oblicuos', glutes: 'Glúteos',
  quadriceps: 'Cuádriceps', hamstrings: 'Isquiotibiales', calves: 'Gemelos y sóleo',
};
const SKIN = '#c7cdc3';
const INACTIVE = '#b4bcb0';
const PRIMARY = '#e58469';
const SECONDARY = '#d9b66c';
const SIDES: readonly Side[] = ['left', 'right'];
type PoseRef = { current: BodyPose };
type CameraView = 'perspective' | 'front' | 'side';
type MuscleProps = Pick<ExerciseViewerProps, 'primaryMuscles' | 'secondaryMuscles' | 'selectedMuscle' | 'onSelectMuscle'>;

function Muscle({ id, position, scale, rotation, ...props }: MuscleProps & {
  id: string; position: Vec3; scale: Vec3; rotation?: Vec3;
}) {
  const active = props.primaryMuscles.includes(id);
  const secondary = props.secondaryMuscles.includes(id);
  const selected = props.selectedMuscle === id;
  const color = active ? PRIMARY : secondary ? SECONDARY : INACTIVE;
  const select = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return;
    event.stopPropagation();
    props.onSelectMuscle?.(id);
  };
  return (
    <mesh position={position} scale={scale} rotation={rotation} onClick={select} castShadow>
      <sphereGeometry args={[1, 24, 16]} />
      <meshStandardMaterial color={color} roughness={0.65} emissive={selected ? color : '#000000'} emissiveIntensity={selected ? 0.22 : 0} />
    </mesh>
  );
}

function Ellipsoid({ position = [0, 0, 0], scale, color = SKIN }: { position?: Vec3; scale: Vec3; color?: string }) {
  return <mesh position={position} scale={scale} castShadow><sphereGeometry args={[1, 28, 20]} /><meshStandardMaterial color={color} roughness={0.75} /></mesh>;
}

function Torso({ pose, ...props }: MuscleProps & { pose: PoseRef }) {
  const group = useRef<Group>(null);
  useFrame(() => {
    if (!group.current) return;
    group.current.position.set(...pose.current.pelvis);
    group.current.rotation.set(pose.current.torsoAngle, 0, 0);
  }, -1);
  return <group ref={group}>
    <Ellipsoid position={[0, 0.025, 0]} scale={[0.195, 0.145, 0.135]} />
    <Ellipsoid position={[0, 0.2, 0]} scale={[0.175, 0.235, 0.115]} />
    <Ellipsoid position={[0, 0.385, -0.005]} scale={[0.242, 0.21, 0.138]} />
    {SIDES.map((side) => {
      const sign = side === 'left' ? -1 : 1;
      return <group key={side}>
        <Muscle {...props} id="pectorals" position={[sign * 0.109, 0.417, 0.121]} scale={[0.116, 0.072, 0.029]} rotation={[0, 0, sign * 0.14]} />
        <Muscle {...props} id="deltoids" position={[sign * 0.232, 0.482, 0.008]} scale={[0.091, 0.095, 0.105]} />
        <Muscle {...props} id="lats" position={[sign * 0.138, 0.275, -0.092]} scale={[0.086, 0.185, 0.043]} rotation={[0, 0, -sign * 0.22]} />
        <Muscle {...props} id="upper-back" position={[sign * 0.104, 0.431, -0.118]} scale={[0.106, 0.123, 0.033]} rotation={[0, 0, sign * 0.22]} />
        <Muscle {...props} id="obliques" position={[sign * 0.135, 0.194, 0.071]} scale={[0.047, 0.125, 0.044]} rotation={[0, 0, sign * 0.14]} />
        <Muscle {...props} id="glutes" position={[sign * 0.093, -0.002, -0.107]} scale={[0.104, 0.113, 0.066]} />
        {[0.137, 0.202, 0.27, 0.326].map((y, i) => <Muscle key={y} {...props} id="abdominals" position={[sign * 0.043, y, 0.112]} scale={[0.038 + i * 0.002, 0.037, 0.024]} />)}
      </group>;
    })}
  </group>;
}

function Head({ pose, exerciseId }: { pose: PoseRef; exerciseId: string }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const head = getHeadPose(exerciseId, pose.current);
    ref.current.position.set(...head.neck);
    ref.current.rotation.set(head.angle, 0, 0);
  }, -1);
  return <group ref={ref}>
    <Ellipsoid scale={[0.072, 0.108, 0.075]} />
    <Ellipsoid position={[0, 0.157, 0.005]} scale={[0.108, 0.142, 0.107]} />
    <Ellipsoid position={[0, 0.127, 0.099]} scale={[0.022, 0.032, 0.024]} />
    <Ellipsoid position={[0, 0.078, 0.031]} scale={[0.072, 0.049, 0.079]} />
    <Ellipsoid position={[-0.105, 0.15, 0]} scale={[0.016, 0.033, 0.024]} />
    <Ellipsoid position={[0.105, 0.15, 0]} scale={[0.016, 0.033, 0.024]} />
  </group>;
}

function Segment({ pose, side, limb, part, ...props }: MuscleProps & {
  pose: PoseRef; side: Side; limb: 'arms' | 'legs'; part: 'upper' | 'lower';
}) {
  const group = useRef<Group>(null);
  const math = useMemo(() => ({ start: new Vector3(), end: new Vector3(), y: new Vector3(), z: new Vector3(), x: new Vector3(), matrix: new Matrix4() }), []);
  const isLeg = limb === 'legs';
  const upper = part === 'upper';
  const radius = isLeg ? (upper ? 0.096 : 0.065) : upper ? 0.066 : 0.049;
  useFrame(() => {
    if (!group.current) return;
    const points = pose.current[limb][side];
    math.start.set(...(upper ? points.start : points.joint));
    math.end.set(...(upper ? points.joint : points.end));
    const length = math.start.distanceTo(math.end);
    math.y.subVectors(math.end, math.start).normalize();
    math.z.set(0, -Math.sin(pose.current.torsoAngle), Math.cos(pose.current.torsoAngle));
    math.z.addScaledVector(math.y, -math.z.dot(math.y)).normalize();
    if (math.z.lengthSq() < 0.001) math.z.set(0, 0, 1);
    math.x.crossVectors(math.y, math.z).normalize();
    math.z.crossVectors(math.x, math.y).normalize();
    math.matrix.makeBasis(math.x, math.y, math.z);
    group.current.quaternion.setFromRotationMatrix(math.matrix);
    group.current.position.copy(math.start).lerp(math.end, 0.5);
    group.current.scale.set(1, length, 1);
  }, -1);
  return <group ref={group}>
    <Ellipsoid scale={[radius, 0.59, radius * 0.88]} />
    {isLeg && upper && <>
      <Muscle {...props} id="quadriceps" position={[0, -0.025, 0.064]} scale={[0.075, 0.44, 0.051]} />
      <Muscle {...props} id="hamstrings" position={[0, -0.02, -0.06]} scale={[0.064, 0.42, 0.036]} />
    </>}
    {isLeg && !upper && <Muscle {...props} id="calves" position={[0, -0.1, -0.044]} scale={[0.064, 0.31, 0.041]} />}
    {!isLeg && upper && <>
      <Muscle {...props} id="biceps" position={[0, 0, 0.047]} scale={[0.048, 0.36, 0.029]} />
      <Muscle {...props} id="triceps" position={[0, -0.04, -0.042]} scale={[0.052, 0.40, 0.032]} />
    </>}
  </group>;
}

function Extremity({ pose, side, hand, exerciseId }: { pose: PoseRef; side: Side; hand?: boolean; exerciseId: string }) {
  const ref = useRef<Group>(null);
  useFrame(() => {
    if (!ref.current) return;
    const p = pose.current;
    const end = p[hand ? 'arms' : 'legs'][side].end;
    ref.current.position.set(...end);
    if (hand) ref.current.rotation.set(p.floorExercise ? 0 : -0.5, 0, 0);
    else ref.current.rotation.set(exerciseId === 'calf-raise' ? (end[1] - 0.085) * 6 : 0, 0, 0);
  }, -1);
  return <group ref={ref}><Ellipsoid position={hand ? [0, -0.018, 0.025] : [0, -0.033, 0.065]} scale={hand ? [0.05, 0.035, 0.079] : [0.06, 0.051, 0.129]} /></group>;
}

function CameraRig({ view, floor }: { view: CameraView; floor: boolean }) {
  const { camera } = useThree();
  const target = useMemo(() => new Vector3(0, floor ? 0.35 : 0.87, floor ? -0.12 : 0), [floor]);
  const cameraPosition = useMemo(() => {
    if (view === 'front') return new Vector3(0, floor ? 2.5 : 1.3, floor ? 2.8 : 3.5);
    if (view === 'side') return new Vector3(3.5, floor ? 0.95 : 1.2, 0.12);
    return floor ? new Vector3(2.45, 1.62, 1.8) : new Vector3(2.8, 1.65, 3.2);
  }, [view, floor]);
  useEffect(() => { camera.position.copy(cameraPosition); camera.lookAt(target); camera.updateProjectionMatrix(); }, [camera, cameraPosition, target]);
  return <OrbitControls target={target} makeDefault enablePan={false} minDistance={2.1} maxDistance={5.5} minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.02} />;
}

function Scene({ exerciseId, phaseRef, playing, speed, onProgress, view, ...props }: MuscleProps & {
  exerciseId: string; phaseRef: { current: number }; playing: boolean; speed: number;
  onProgress: (phase: number) => void; view: CameraView;
}) {
  const pose = useRef(getExercisePose(exerciseId, phaseRef.current));
  const lastProgress = useRef(0);
  const floor = getExercisePose(exerciseId, 0).floorExercise;
  useFrame((state, delta) => {
    if (playing) phaseRef.current = (phaseRef.current + Math.min(delta, 0.1) * speed / (exerciseId === 'dead-bug' ? 9 : 5)) % 1;
    pose.current = getExercisePose(exerciseId, phaseRef.current);
    if (state.clock.elapsedTime - lastProgress.current > 0.08) { onProgress(phaseRef.current); lastProgress.current = state.clock.elapsedTime; }
  }, -2);
  return <>
    <color attach="background" args={['#f1f1e9']} />
    <ambientLight intensity={0.65} />
    <hemisphereLight args={['#ffffff', '#b6baab', 0.7]} />
    <directionalLight position={[3, 5, 4]} intensity={1.7} castShadow shadow-mapSize={[1024, 1024]} shadow-normalBias={0.025} shadow-camera-left={-2} shadow-camera-right={2} shadow-camera-top={2} shadow-camera-bottom={-2} />
    <directionalLight position={[-3, 3, -2]} intensity={0.6} color="#e8e1ff" />
    <CameraRig view={view} floor={floor} />
    <Torso pose={pose} {...props} />
    <Head pose={pose} exerciseId={exerciseId} />
    {SIDES.map((side) => <group key={side}>
      {(['arms', 'legs'] as const).flatMap((limb) => (['upper', 'lower'] as const).map((part) => <Segment key={`${limb}-${part}`} pose={pose} side={side} limb={limb} part={part} {...props} />))}
      <Extremity pose={pose} side={side} hand exerciseId={exerciseId} />
      <Extremity pose={pose} side={side} exerciseId={exerciseId} />
    </group>)}
    {floor && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.014, -0.12]} receiveShadow><boxGeometry args={[1.08, 2.45, 0.018]} /><meshStandardMaterial color="#dedfd3" roughness={0.96} /></mesh>}
    {!floor && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0.015]} scale={[0.44, 0.25, 1]}><circleGeometry args={[1, 48]} /><meshBasicMaterial color="#697660" transparent opacity={0.10} toneMapped={false} depthWrite={false} /></mesh>}
    {exerciseId === 'row' && <mesh position={[0, 1.045, -0.66]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.025, 0.025, 1.1]} /><meshStandardMaterial color="#727b70" /></mesh>}
  </>;
}

class ViewerBoundary extends Component<{ children: ReactNode; onError: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function ControlIcon({ name }: { name: 'play' | 'pause' | 'rotate' | 'reset' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" aria-hidden="true">
    {name === 'play' ? <path d="m9 5 10 7-10 7V5Z" fill="currentColor" stroke="none" /> : name === 'pause' ? <><path d="M9 6v12M15 6v12" strokeWidth="3" /></> : name === 'reset' ? <><path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" /></> : <><ellipse cx="12" cy="12" rx="9" ry="4" /><path d="m16 5 4 5-6 1" /></>}
  </svg>;
}

export default function ExerciseViewer(props: ExerciseViewerProps) {
  const [playing, setPlaying] = useState(!props.reducedMotion);
  const [phase, setPhase] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [view, setView] = useState<CameraView>('perspective');
  const [anatomy, setAnatomy] = useState(false);
  const [failed, setFailed] = useState(false);
  const phaseRef = useRef(0);
  const exerciseRef = useRef(props.exerciseId);
  useEffect(() => {
    if (exerciseRef.current !== props.exerciseId) { phaseRef.current = 0; exerciseRef.current = props.exerciseId; }
  }, [props.exerciseId]);
  useEffect(() => { if (props.reducedMotion) setPlaying(false); }, [props.reducedMotion]);
  const scrub = (value: number) => { phaseRef.current = value; setPhase(value); setPlaying(false); };
  const phases = EXERCISE_PHASES[props.exerciseId] ?? ['Movete con control', 'Volvé al inicio'];
  const activeName = props.selectedMuscle ? MUSCLE_NAMES[props.selectedMuscle] : undefined;
  return <section className="viewer" aria-label="Demostración 3D del ejercicio">
    <div className="viewer-topline"><span className="viewer-live-dot" /><span>ESTUDIO DE MOVIMIENTO</span><span className="viewer-schematic">Modelo educativo</span></div>
    <div className="viewer-stage">
      {failed ? <div className="viewer-fallback"><span>Vista 3D no disponible</span><p>Este dispositivo no pudo iniciar el visor. Podés seguir la guía paso a paso y consultar los músculos debajo.</p></div> : <ViewerBoundary onError={() => setFailed(true)}><Suspense fallback={<div className="viewer-fallback">Preparando el movimiento…</div>}><Canvas camera={{ position: [2.8, 1.65, 3.2], fov: 34 }} dpr={[1, 1.7]} shadows={{ type: PCFShadowMap }} gl={{ antialias: true, alpha: false, powerPreference: 'low-power' }} fallback={<div className="viewer-fallback">Representación educativa 3D del ejercicio. Consultá los pasos y músculos debajo.</div>}>
        <Scene {...props} exerciseId={anatomy ? 'anatomy' : props.exerciseId} phaseRef={phaseRef} playing={playing && !anatomy} speed={speed} onProgress={setPhase} view={view} />
      </Canvas></Suspense></ViewerBoundary>}
      <div className="viewer-phase"><span>{anatomy ? '◎' : phase < 0.5 ? '01' : '02'}</span>{anatomy ? 'Explorá las regiones del cuerpo' : phases[phase < 0.5 ? 0 : 1]}</div>
      <div className="viewer-mode" aria-label="Contenido del visor"><button type="button" aria-pressed={!anatomy} onClick={() => setAnatomy(false)}>Movimiento</button><button type="button" aria-pressed={anatomy} onClick={() => setAnatomy(true)}>Anatomía</button></div>
      {activeName && <div className="viewer-muscle-name"><span />{activeName}</div>}
      <div className="viewer-orbit-hint"><ControlIcon name="rotate" />Arrastrá para explorar</div>
      <div className="viewer-camera" aria-label="Ángulo de cámara">
        {([['perspective', '3D'], ['front', 'Frente'], ['side', 'Perfil']] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={view === id} onClick={() => setView(id)}>{label}</button>)}
      </div>
    </div>
    <div className="viewer-controls">
      <button type="button" className="viewer-play" aria-label={playing && !anatomy ? 'Pausar demostración' : 'Reproducir demostración'} onClick={() => { setAnatomy(false); setPlaying(anatomy ? true : !playing); }} disabled={failed}><ControlIcon name={playing && !anatomy ? 'pause' : 'play'} /></button>
      <div className="viewer-timeline"><div><span>{anatomy ? 'Conocé los músculos que trabajan' : 'Un movimiento, paso a paso'}</span><span>{Math.round(phase * 100)}%</span></div><input aria-label="Posición de la demostración" type="range" min="0" max="1" step="0.001" value={phase} onChange={(event) => { setAnatomy(false); scrub(Number(event.target.value)); }} disabled={failed} /></div>
      <button type="button" className="viewer-speed" aria-label={`Velocidad ${speed}. Cambiar velocidad`} onClick={() => setSpeed(speed === 1 ? 0.5 : 1)}>{speed === 1 ? '1×' : '½×'}</button>
      <button type="button" className="viewer-reset" aria-label="Reiniciar demostración" onClick={() => scrub(0)}><ControlIcon name="reset" /></button>
    </div>
    <div className="viewer-legend"><span><i className="viewer-primary" />Músculo principal</span><span><i className="viewer-secondary" />Músculo de apoyo</span><span className="viewer-tap-hint">Tocá un músculo para conocerlo</span></div>
  </section>;
}
