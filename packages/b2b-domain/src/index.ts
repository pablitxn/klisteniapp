export {
  exerciseMachineIds,
  supportsMachine,
  exerciseAvailability,
  programAvailability,
} from './catalog.ts'
export {
  programExerciseIds,
  checkProgramAlternatives,
  isAuthorizedSet,
  checkExecution,
  type ExecutionIssue,
  type RuleResult,
} from './training.ts'
export { MODULE_POLICY, effectiveModules, contrastRatio, accessibleTheme } from './white-label.ts'
export {
  DEFAULT_REST_SECONDS,
  checkPrescription,
  checkGoalActivation,
  targetBounds,
  targetContains,
  type NumericTarget,
} from './prescription.ts'
export {
  reviewedAlternatives,
  targetEquipmentAvailable,
  createOriginalSegment,
  createReviewedSegment,
  selectEffectiveSegment,
  restoreEffectiveSegment,
  emptyPerformedSet,
  segmentCoverage,
  checkEffectiveSegments,
  checkNewSegmentSelections,
  type AlternativeEnvironment,
  type AlternativeState,
  type EffectiveSegment,
  type PerformedSet,
} from './alternatives.ts'
export { canonicalJson, sessionIssues, type SessionPrescription } from './sessions.ts'
export {
  addDays,
  weekStart,
  localDate,
  startOfLocalDate,
  weekBounds,
  isCompletionEligible,
  moveWithinWeek,
  reconcileOccurrences,
  deriveWeek,
} from './schedule.ts'
