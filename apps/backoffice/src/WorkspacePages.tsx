import { useEffect, type ReactNode } from 'react'
import type { Membership } from '@klisteniapp/b2b-contracts'
import { Notice } from '@klisteniapp/b2b-ui'
import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import { Catalog } from './Catalog'
import { Equipment } from './Equipment'
import { Programs } from './Programs'
import { People, Reports } from './People'
import { Preparation, type PreparationPage } from './Preparation'
import { WebsiteEditor } from './Website'
import { QRCodes } from './QRCodes'
import { unitPublicationBlockers } from './equipmentReadiness'

type Context = { membership: Membership; dataRefresh: number }
type Resource = { data: unknown; error: string; loading: boolean; reload: () => void }

// A section owns its requests. Background refresh keeps its editor mounted;
// useLoad clears protected data when a request loses authorization (401/403).
function SectionResources({ resources, children }: { resources: Resource[]; children: ReactNode }) {
  const failed = resources.filter((resource) => resource.error)
  return (
    <>
      {[...new Set(failed.map((resource) => resource.error))].map((error) => (
        <Notice key={error} error>
          {error}
        </Notice>
      ))}
      {failed.length > 0 && (
        <button className="button" onClick={() => failed.forEach((resource) => resource.reload())}>
          Reintentar carga
        </button>
      )}
      {resources.some((resource) => resource.loading && !resource.data) && (
        <p className="loading" role="status">
          Cargando esta sección…
        </p>
      )}
      {children}
    </>
  )
}

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

export function PeoplePage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    org = membership.organization
  const members = useLoad((signal) => client.withSignal(signal).members.list(org.id), org.id, {
    refreshKey: dataRefresh,
  })
  return (
    <SectionResources resources={[members]}>
      {members.data && (
        <People
          orgId={org.id}
          members={members.data.members}
          admin={membership.role === 'admin'}
          active={org.serviceActive}
          reload={members.reload}
        />
      )}
    </SectionResources>
  )
}

export function CatalogPage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    org = membership.organization,
    key = org.id
  const exercises = useLoad(
    (signal) => client.withSignal(signal).catalog.listExercises(org.id),
    key,
    { refreshKey: dataRefresh },
  )
  const machines = useLoad(
    (signal) => client.withSignal(signal).equipment.listMachines(org.id),
    key,
    { refreshKey: dataRefresh },
  )
  return (
    <SectionResources resources={[exercises, machines]}>
      {exercises.data && machines.data && (
        <Catalog
          orgId={org.id}
          exercises={exercises.data.exercises}
          machines={machines.data.machines}
          active={org.serviceActive}
          reload={exercises.reload}
        />
      )}
    </SectionResources>
  )
}

export function ProgramsPage({ membership, dataRefresh }: Context) {
  const client = useAccountClient(),
    org = membership.organization,
    key = org.id
  const exercises = useLoad(
    (signal) => client.withSignal(signal).catalog.listExercises(org.id),
    key,
    { refreshKey: dataRefresh },
  )
  const members = useLoad((signal) => client.withSignal(signal).members.list(org.id), key, {
    refreshKey: dataRefresh,
  })
  const programs = useLoad((signal) => client.withSignal(signal).programs.list(org.id), key, {
    refreshKey: dataRefresh,
  })
  const assignments = useLoad((signal) => client.withSignal(signal).assignments.list(org.id), key, {
    refreshKey: dataRefresh,
  })
  function reload(resource?: 'programs' | 'assignments') {
    if (!resource || resource === 'programs') programs.reload()
    if (!resource || resource === 'assignments') assignments.reload()
  }
  return (
    <SectionResources resources={[exercises, members, programs, assignments]}>
      {exercises.data && members.data && programs.data && assignments.data && (
        <Programs
          orgId={org.id}
          exercises={exercises.data.exercises}
          members={members.data.members}
          programs={programs.data.programs}
          assignments={assignments.data.assignments}
          active={org.serviceActive}
          reload={reload}
        />
      )}
    </SectionResources>
  )
}

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
