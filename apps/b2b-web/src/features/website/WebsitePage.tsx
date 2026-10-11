import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { useEffect } from 'react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { WebsiteEditor } from './Website'

export function WebsitePage({
  membership,
  dataRefresh,
  userId,
  onPublication,
  floorPlanEnabled,
  publicPath,
}: Context & {
  userId: string
  onPublication: (published: boolean) => void
  floorPlanEnabled?: boolean
  publicPath?: string
}) {
  const client = useAccountClient(),
    org = membership.organization
  const website = useLoad((signal) => client.withSignal(signal).website.get(org.id), org.id, {
    refreshKey: dataRefresh,
  })
  const published = website.data ? website.data.website.publishedRevision !== null : undefined
  useEffect(() => {
    if (published !== undefined) onPublication(published)
  }, [published, onPublication])
  return (
    <SectionResources resources={[website]}>
      {website.data && (
        <WebsiteEditor
          floorPlanEnabled={floorPlanEnabled}
          publicPath={publicPath}
          userId={userId}
          organization={org}
          website={website.data.website}
          active={org.serviceActive}
          reload={website.reload}
        />
      )}
    </SectionResources>
  )
}
