import { ExerciseStage as SharedExerciseStage } from '@klisteniapp/anatomy-viewer'
import type { AnatomicalModelProps as SharedProps } from '@klisteniapp/anatomy-viewer'
import { localAssets } from '@klisteniapp/model-assets'

export type AnatomicalModelProps = Omit<SharedProps, 'assetResolver'>

export default function ExerciseStage(props: AnatomicalModelProps) {
  return <SharedExerciseStage {...props} assetResolver={localAssets} />
}
