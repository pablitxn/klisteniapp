import { useAccountClient, useLoad } from '@klisteniapp/b2b-react'
import {
  SectionResources,
  type WorkspaceViewContext as Context,
} from '../../shared/SectionResources'
import { Programs } from './Programs'

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
