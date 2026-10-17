import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { Reports } from './Reports'

export function ReportsPage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    orgId = membership.organization.id
  const report = useLoad((signal) => client.withSignal(signal).reports.get(orgId), orgId, {
    refreshKey: dataRefresh,
  })
  return (
    <SectionResources resources={[report]}>
      {report.data && <Reports report={report.data} />}
    </SectionResources>
  )
}

export { ProductReportsPage } from './ProductReportsPage'
