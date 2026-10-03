import { getExercisePose } from '@klisteniapp/geometry'
import AnatomicalModel, { type AnatomicalModelProps } from './AnatomicalModel'
import AnatomyStudio from './AnatomyStudio'

/** Shared by the interactive viewer and the offline preview capture. */
export default function ExerciseStage(props: AnatomicalModelProps) {
  return (
    <>
      <AnatomyStudio floorExercise={getExercisePose(props.exerciseId, 0).floorExercise} />
      <AnatomicalModel {...props} />
      {props.exerciseId === 'row' && (
        <mesh position={[0, 1.045, -0.66]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.019, 0.019, 1.1, 20]} />
          <meshStandardMaterial color="#728383" metalness={0.5} roughness={0.4} />
        </mesh>
      )}
    </>
  )
}
