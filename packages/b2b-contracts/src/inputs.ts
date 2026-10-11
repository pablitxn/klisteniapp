import type { PublishInput } from './common.ts'
import type { MediaUploadInput } from './media.ts'
import type {
  AcceptInvitationInput,
  BrandInput,
  CoachAssignmentInput,
  InvitationInput,
  MembershipUpdateInput,
} from './organization.ts'
import type {
  ExerciseInput,
  ExerciseUpdateInput,
  MachineInput,
  MachineUpdateInput,
  UnitBatchInput,
  UnitInput,
  UnitUpdateInput,
} from './catalog.ts'
import type {
  ExecutionCreateInput,
  ProgramAssignmentInput,
  ProgramInput,
  ProgramUpdateInput,
} from './training.ts'
import type { WebsiteUpdateInput } from './website.ts'
import type { BranchInput, BranchUpdateInput, BranchGrantInput, ThemeInput } from './white-label.ts'

/** Payload types before parsing: defaults are optional at the API boundary. */
export type B2BInputs = {
  branch: BranchInput
  branchUpdate: BranchUpdateInput
  branchGrant: BranchGrantInput
  theme: ThemeInput & { expectedRevision: number }
  signIn: { email: string; password: string }
  invitation: InvitationInput
  acceptInvitation: AcceptInvitationInput
  membership: MembershipUpdateInput
  coachAssignment: CoachAssignmentInput
  brand: BrandInput
  machine: MachineInput
  machineUpdate: MachineUpdateInput
  unit: UnitInput
  unitUpdate: UnitUpdateInput
  unitBatch: UnitBatchInput
  exercise: ExerciseInput
  exerciseUpdate: ExerciseUpdateInput
  program: ProgramInput
  programUpdate: ProgramUpdateInput
  revision: PublishInput
  assignment: ProgramAssignmentInput
  execution: ExecutionCreateInput
  website: WebsiteUpdateInput
  media: MediaUploadInput
}
