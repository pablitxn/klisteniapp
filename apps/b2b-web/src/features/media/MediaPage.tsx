import { Heading } from '../../shared/Heading'
import { MediaLibrary } from './MediaLibrary'

export function MediaPage({
  orgId,
  active,
  dataRefresh,
}: {
  orgId: string
  active: boolean
  dataRefresh: number
}) {
  return (
    <>
      <Heading
        title="Los recursos de tu gimnasio."
        description="Subí contenido real del espacio y reutilizalo en modelos, unidades, ejercicios y en la web."
      />
      <MediaLibrary orgId={orgId} disabled={!active} dataRefresh={dataRefresh} />
    </>
  )
}
