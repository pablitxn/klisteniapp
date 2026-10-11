import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { useEffect } from 'react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { Equipment } from './Equipment'
import { Preparation, type PreparationPage } from './Preparation'
import { QRCodes } from './QRCodes'
import { unitPublicationBlockers } from './equipmentReadiness'

// Only these inventory screens need publication readiness and QR eligibility.
function useInventory(
  { membership, dataRefresh }: Context,
  onPublication: (published: boolean) => void,
) {
  const client = useAccountClient(),
    orgId = membership.organization.id,
    key = orgId
  const machines = useLoad(
    (signal) => client.withSignal(signal).equipment.listMachines(orgId),
    key,
    { refreshKey: dataRefresh },
  )
  const units = useLoad((signal) => client.withSignal(signal).equipment.listUnits(orgId), key, {
    refreshKey: dataRefresh,
  })
  const setup = useLoad((signal) => client.withSignal(signal).setup.progress(orgId), key, {
    refreshKey: dataRefresh,
  })
  const published = setup.data?.websitePublished
  useEffect(() => {
    if (published !== undefined) onPublication(published)
  }, [published, onPublication])
  const qrUnits = published
    ? (units.data?.units.filter(
        (unit) =>
          unitPublicationBlockers(
            unit,
            machines.data?.machines.find((machine) => machine.id === unit.machineId),
            published,
          ).length === 0,
      ) ?? [])
    : []
  return { machines, units, setup, qrUnits }
}

export function InventoryPage(
  props: Context & {
    page: 'equipment' | 'preparation' | 'qr'
    userId: string
    onPublication: (published: boolean) => void
    onGo: (page: PreparationPage) => void
  },
) {
  const { machines, units, setup, qrUnits } = useInventory(props, props.onPublication)
  const org = props.membership.organization
  return (
    <SectionResources resources={[machines, units, setup]}>
      {setup.data && machines.data && units.data && props.page === 'preparation' && (
        <Preparation progress={setup.data} readyQrCount={qrUnits.length} onGo={props.onGo} />
      )}
      {setup.data && machines.data && units.data && props.page === 'qr' && (
        <QRCodes
          units={units.data.units}
          machines={machines.data.machines}
          websitePublished={setup.data.websitePublished}
          gymName={org.brand.name}
          onGo={props.onGo}
        />
      )}
      {machines.data && units.data && props.page === 'equipment' && (
        <Equipment
          userId={props.userId}
          orgId={org.id}
          machines={machines.data.machines}
          units={units.data.units}
          active={org.serviceActive}
          admin={props.membership.role === 'admin'}
          websitePublished={setup.data?.websitePublished ?? false}
          reload={(resource) => (resource === 'machines' ? machines.reload() : units.reload())}
        />
      )}
    </SectionResources>
  )
}
