import type {
  Assignment,
  Exercise,
  Member,
  Program,
  ProgramVersion,
} from '@klisteniapp/b2b-contracts'
import { useAccountClient } from '@klisteniapp/b2b-react'
import { Empty } from '@klisteniapp/b2b-ui'
import { useState } from 'react'
import { latestEditorEntity } from '../../shared/editor/editorEntity'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'
import { ProgramAssignmentForm } from './ProgramAssignmentForm'
import { ProgramCard } from './ProgramCard'
import { ProgramEditor } from './ProgramEditor'
import { RecentAssignments } from './RecentAssignments'

export function Programs({
  orgId,
  exercises,
  programs,
  members,
  assignments,
  active,
  reload,
}: {
  orgId: string
  exercises: Exercise[]
  programs: Program[]
  members: Member[]
  assignments: Assignment[]
  active: boolean
  reload: (resource?: 'programs' | 'assignments') => void
}) {
  const client = useAccountClient()
  const [editing, setEditing] = useState<Program | 'new' | null>(null)
  const [assigning, setAssigning] = useState<{ program: Program; version: ProgramVersion } | null>(
    null,
  )
  const action = useAction()
  async function publish(program: Program) {
    await action.run(async () => {
      await client.programs.publish(orgId, program.id, { expectedRevision: program.revision })
      reload('programs')
    }, 'Nueva versión publicada. Las asignaciones anteriores conservan su versión.')
  }
  async function openAssign(program: Program) {
    const version = program.publishedVersion
    if (version === null) return
    await action.run(async () => {
      const result = await client.programs.version(orgId, program.id, version)
      setAssigning({ program, version: result.version })
    }, '')
  }
  async function assign(memberId: string) {
    if (!assigning) return
    const ok = await action.run(async () => {
      await client.assignments.create(orgId, {
        memberId,
        programId: assigning.program.id,
        version: assigning.version.version,
      })
      reload('assignments')
    }, 'Rutina asignada. El socio ya la puede ver en su espacio.')
    if (ok) setAssigning(null)
  }
  if (editing)
    return (
      <ProgramEditor
        orgId={orgId}
        program={editing === 'new' ? undefined : latestEditorEntity(editing, programs)}
        exercises={exercises}
        active={active}
        onClose={() => setEditing(null)}
        onSaved={(program) => {
          setEditing(program)
          reload('programs')
        }}
      />
    )
  return (
    <>
      <Heading
        title="Planes con intención."
        description="Prepará rutinas reutilizables, publicá una versión y asignala a cada persona."
      >
        <button className="button primary" disabled={!active} onClick={() => setEditing('new')}>
          + Crear rutina
        </button>
      </Heading>
      {action.notices}
      {assigning && (
        <ProgramAssignmentForm
          version={assigning.version}
          members={members}
          active={active}
          busy={action.busy}
          onAssign={(memberId) => void assign(memberId)}
          onClose={() => setAssigning(null)}
        />
      )}
      {programs.length ? (
        <div className="grid two">
          {programs.map((program) => (
            <ProgramCard
              key={program.id}
              program={program}
              exercises={exercises}
              active={active}
              busy={action.busy}
              onEdit={() => setEditing(program)}
              onPublish={() => void publish(program)}
              onAssign={() => void openAssign(program)}
            />
          ))}
        </div>
      ) : (
        <Empty title="El primer plan empieza acá">
          Creá una rutina con el catálogo base y los ejercicios publicados del gimnasio.
        </Empty>
      )}
      <RecentAssignments assignments={assignments} />
    </>
  )
}
