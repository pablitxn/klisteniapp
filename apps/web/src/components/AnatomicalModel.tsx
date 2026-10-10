import { AnatomicalModel as SharedAnatomicalModel } from '@klisteniapp/anatomy-viewer'
import type { AnatomicalModelProps as SharedProps } from '@klisteniapp/anatomy-viewer'
import { localAssets } from '@klisteniapp/model-assets'

export type AnatomicalModelProps = Omit<SharedProps, 'assetResolver'>

export default function AnatomicalModel(props: AnatomicalModelProps) {
  return <SharedAnatomicalModel {...props} assetResolver={localAssets} />
}
