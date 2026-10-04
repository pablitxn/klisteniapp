import { getExercisePose } from '@klisteniapp/geometry'
import AnatomicalModel, { type AnatomicalModelProps } from './AnatomicalModel'
import AnatomyStudio from './AnatomyStudio'

/** Shared by the interactive viewer and the offline preview capture. */
export default function ExerciseStage(props: AnatomicalModelProps) {
  return (
    <>
      <AnatomyStudio floorExercise={getExercisePose(props.exerciseId, 0).floorExercise} />
      <AnatomicalModel {...props} />
      {(props.exerciseId === 'row' || props.exerciseId === 'bent-knee-row') && (
        <group name="stable-low-row-bar">
          <mesh position={[0, 1.045, -0.66]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.024, 0.024, 1.1, 20]} />
            <meshStandardMaterial color="#a8bfbd" metalness={0.3} roughness={0.4} />
          </mesh>
          {[-0.52, 0.52].map((x) => (
            <group key={x}>
              <mesh position={[x, 0.516, -0.66]} castShadow>
                <cylinderGeometry args={[0.023, 0.023, 1.045, 16]} />
                <meshStandardMaterial color="#728383" metalness={0.3} roughness={0.5} />
              </mesh>
              <mesh position={[x, 0.015, -0.66]} castShadow receiveShadow>
                <boxGeometry args={[0.085, 0.03, 0.46]} />
                <meshStandardMaterial color="#728383" metalness={0.3} roughness={0.5} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </>
  )
}
