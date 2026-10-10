import { Environment, Lightformer } from '@react-three/drei'
import { useThree } from '@react-three/fiber'

/** Local, reproducible studio lighting. No environment-map downloads or CDN. */
export default function AnatomyStudio({
  floorExercise,
}: {
  floorExercise: boolean
}) {
  const { size } = useThree()
  const shadowResolution = size.width < 640 ? 1024 : 2048
  return (
    <>
      <color attach="background" args={['#172526']} />
      <ambientLight intensity={0.32} />
      <hemisphereLight args={['#f3f5f2', '#334343', 0.8]} />
      <directionalLight
        position={[2.8, 4.5, 4]}
        intensity={2.8}
        color="#fff1df"
        castShadow
        shadow-mapSize={[shadowResolution, shadowResolution]}
        shadow-normalBias={0.006}
        shadow-bias={-0.0001}
        shadow-camera-left={-1.8}
        shadow-camera-right={1.8}
        shadow-camera-top={2.3}
        shadow-camera-bottom={-1.8}
      />
      <directionalLight
        position={[-3, 2.5, 1.5]}
        intensity={1.2}
        color="#d9e5f3"
      />
      <directionalLight position={[1, 3, -3]} intensity={3.2} color="#e9e4d4" />
      <Environment resolution={128} frames={1} environmentIntensity={0.55}>
        <Lightformer
          form="rect"
          intensity={3}
          color="#fff3e6"
          position={[3, 3, 4]}
          scale={[3, 5, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={1.5}
          color="#d6e4ed"
          position={[-4, 2, 1]}
          scale={[2, 4, 1]}
          target={[0, 1, 0]}
        />
        <Lightformer
          form="rect"
          intensity={4}
          color="#f6f0e4"
          position={[0, 4, -3]}
          scale={[3, 3, 1]}
          target={[0, 1, 0]}
        />
      </Environment>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.012, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <shadowMaterial transparent opacity={0.24} />
      </mesh>
      {floorExercise ? (
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.008, -0.12]}
          receiveShadow
        >
          <boxGeometry args={[1.12, 2.5, 0.012]} />
          <meshStandardMaterial color="#29403e" roughness={0.95} />
        </mesh>
      ) : (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
            <ringGeometry args={[0.47, 0.472, 96]} />
            <meshBasicMaterial
              color="#516665"
              transparent
              opacity={0.4}
              depthWrite={false}
            />
          </mesh>
          <mesh
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, -0.011, 0]}
            scale={[0.36, 0.22, 1]}
          >
            <circleGeometry args={[1, 64]} />
            <meshBasicMaterial
              color="#071010"
              transparent
              opacity={0.22}
              depthWrite={false}
            />
          </mesh>
        </group>
      )}
    </>
  )
}
