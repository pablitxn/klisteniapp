import { createHash } from 'node:crypto';
import {
  ProductEndpoints,
  SessionReceiptSchema,
  SessionRevisionSchema,
  RoutineVersionV2Schema,
  decodeRoutine,
  projectLegacyRoutine,
  type SessionContent,
} from '@klisteniapp/b2b-contracts/product-v2';
import {
  canonicalJson,
  sessionIssues,
  type SessionPrescription,
} from '@klisteniapp/b2b-domain/sessions';
import type { AuthorizedProductContext, RecordsServices } from '../product-context.ts';
import { conflict, denied, HttpError, missing } from '../errors.ts';
import { enrollment, occurrence } from '../schedule/repository.ts';
import {
  authorizeRecords,
  lockKey,
  recordOperation,
  replayOperation,
  requestHash,
} from './operations.ts';
import {
  latestSessions,
  legacyRecords,
  revisions,
  routineSnapshot,
  sessionHead,
} from './repository.ts';

export function createSessionServices(
  clock: () => Date = () => new Date(),
): Pick<RecordsServices, 'sessions' | 'sessionRevisions' | 'saveSession'> {
  return {
    async sessions(context, input) {
      const { memberId } = ProductEndpoints.sessions.input.parse(input);
      await authorizeRecords(context, memberId);
      const current = await latestSessions(context, memberId);
      const corrected = new Set(
        current.flatMap((s) =>
          s.origin.kind === 'legacy' && s.origin.executionId ? [s.origin.executionId] : [],
        ),
      );
      return [
        ...current,
        ...(await legacyRecords(context, memberId)).filter((s) => !corrected.has(s.original.id)),
      ];
    },
    async sessionRevisions(context, input) {
      const { id } = ProductEndpoints.sessionRevisions.input.parse(input);
      const head = await sessionHead(context, id);
      if (head) {
        await authorizeRecords(context, head.member_id);
        return revisions(context, id);
      }
      // Legacy IDs are globally stable within the tenant. Resolve identity in the
      // selected branch before authorizing; no caller-selected member authority.
      const legacy = await context.db.query(
        'SELECT member_id FROM b2b_execution WHERE organization_id=$1 AND branch_id=$2 AND id=$3',
        [context.organizationId, context.branchId, id],
      );
      if (!legacy.rows[0]) throw missing();
      await authorizeRecords(context, legacy.rows[0].member_id);
      return legacyRecords(context, legacy.rows[0].member_id, id);
    },
    async saveSession(context, raw) {
      const input = ProductEndpoints.saveSession.input.parse(raw);
      await authorizeRecords(context, context.actorId, true);
      const hash = requestHash(context, 'session.save', input);
      let enrollmentValue;
      if (input.origin.kind === 'occurrence') {
        const issued = await occurrence(context, input.origin.occurrenceId);
        if (issued.scope.memberId !== context.actorId) throw denied();
        // Planning and records lock the same enrollment before child heads.
        enrollmentValue = await enrollment(context, issued.enrollmentId, true);
      }
      const replay = await replayOperation(context, input.operationId, hash);
      if (replay !== undefined) return SessionReceiptSchema.parse(replay);
      await lockKey(context, `session:${input.id}`);
      const head = await sessionHead(context, input.id);
      if (head && head.member_id !== context.actorId) throw denied();
      if ((head?.revision ?? 0) !== input.expectedRevision) throw conflict();
      const previousRecords = head ? await revisions(context, input.id) : [];
      const previous = previousRecords.at(-1);
      if (head && (!previous || previous.revision !== head.revision))
        throw new Error('Missing accepted session snapshot');
      if (
        previous?.schemaVersion === 2 &&
        canonicalJson(previous.origin) !== canonicalJson(input.origin)
      )
        throw new HttpError(409, 'REVISION_CONFLICT', 'Original session linkage cannot change.');
      if (
        head &&
        ((head.occurrence_id ?? null) !==
          (input.origin.kind === 'occurrence' ? input.origin.occurrenceId : null) ||
          head.program_id !== input.origin.routine.programId ||
          head.program_version !== input.origin.routine.version ||
          (head.legacy_assignment_id ?? null) !==
            (input.origin.kind === 'legacy' ? input.origin.assignmentId : null) ||
          (head.legacy_execution_id ?? null) !==
            (input.origin.kind === 'legacy' ? input.origin.executionId : null))
      )
        throw conflict();
      let originalLegacy;
      if (input.origin.kind === 'occurrence') {
        const issued = await occurrence(context, input.origin.occurrenceId);
        if (
          issued.scope.memberId !== context.actorId ||
          canonicalJson(issued.routine) !== canonicalJson(input.origin.routine)
        )
          throw denied();
        if (!head && (issued.eligibility !== 'required' || enrollmentValue?.status !== 'active'))
          throw denied();
      } else {
        const assignment = await context.db.query(
          `SELECT a.member_id,a.program_id,a.version,p.archived_at FROM b2b_program_assignment a JOIN b2b_program p
           ON (p.organization_id,p.branch_id,p.id)=(a.organization_id,a.branch_id,a.program_id)
           WHERE a.organization_id=$1 AND a.branch_id=$2 AND a.id=$3`,
          [context.organizationId, context.branchId, input.origin.assignmentId],
        );
        const row = assignment.rows[0];
        if (
          !row ||
          row.member_id !== context.actorId ||
          row.program_id !== input.origin.routine.programId ||
          row.version !== input.origin.routine.version
        )
          throw denied();
        if (input.origin.executionId) {
          if (input.id !== input.origin.executionId)
            throw new HttpError(409, 'REVISION_CONFLICT', 'Keep the original legacy execution ID.');
          originalLegacy = (
            await legacyRecords(context, context.actorId, input.origin.executionId)
          )[0];
          if (!originalLegacy || originalLegacy.original.assignmentId !== input.origin.assignmentId)
            throw missing();
        } else if (!head && row.archived_at) throw denied();
      }
      const stored = await routineSnapshot(
        context,
        input.origin.routine.programId,
        input.origin.routine.version,
      );
      if (stored.schema_version !== input.origin.routine.schemaVersion) throw conflict();
      const decoded = decodeRoutine(stored.schema_version, stored.snapshot);
      let prescription: SessionPrescription;
      if (decoded.schemaVersion === 2)
        prescription = RoutineVersionV2Schema.parse(decoded.snapshot);
      else {
        const supplement = await context.db.query(
          'SELECT source_snapshot_hash,snapshot FROM b2b_routine_supplement WHERE organization_id=$1 AND branch_id=$2 AND program_id=$3 AND program_version=$4',
          [
            context.organizationId,
            context.branchId,
            input.origin.routine.programId,
            input.origin.routine.version,
          ],
        );
        if (supplement.rows[0]) {
          const sourceHash = createHash('sha256')
            .update(canonicalJson(stored.snapshot))
            .digest('hex');
          if (supplement.rows[0].source_snapshot_hash !== sourceHash)
            throw new Error('Legacy supplement does not match the issued snapshot');
          prescription = RoutineVersionV2Schema.parse(supplement.rows[0].snapshot);
        } else {
          // Compatibility dose only; this is never published or persisted over
          // the issued JSON. Reviewed targets require WP04's immutable supplement.
          const projected = projectLegacyRoutine(decoded.snapshot);
          prescription = {
            relations: [],
            steps: projected.steps.map((step) => ({
              ...step,
              exerciseId: step.exerciseId!,
              dose: {
                ...step.dose,
                mode: step.dose.mode!,
                sets: step.dose.sets!,
                load: step.dose.load!,
                restSeconds: step.dose.restSeconds!,
                laterality: 'bilateral' as const,
              },
            })),
          };
        }
      }
      const now = clock().toISOString();
      if (Date.parse(input.content.performedAt) > Date.parse(now))
        throw new HttpError(400, 'INVALID_INPUT', 'Performed time cannot be in the future.');
      const priorContent: SessionContent | undefined =
        previous?.schemaVersion === 2 ? previous.content : undefined;
      const issues = sessionIssues(input.content, prescription, priorContent);
      if (originalLegacy && !head && !input.content.correctionReason.trim())
        issues.push({
          code: 'required',
          path: ['content', 'correctionReason'],
          stepId: null,
          message: 'Explain the first legacy correction.',
        });
      if (issues.length)
        throw new HttpError(
          400,
          input.content.status === 'completed' ? 'INCOMPLETE_EXECUTION' : 'INVALID_INPUT',
          'Invalid session content.',
          issues,
        );
      const session = SessionRevisionSchema.parse({
        schemaVersion: 2,
        id: input.id,
        scope: {
          organizationId: context.organizationId,
          branchId: context.branchId,
          memberId: context.actorId,
        },
        origin: input.origin,
        revision: input.expectedRevision + 1,
        operationId: input.operationId,
        content: input.content,
        actorId: context.actorId,
        acceptedAt: now,
      });
      if (!head) {
        await context.db.query(
          `INSERT INTO b2b_training_session(organization_id,branch_id,member_id,id,occurrence_id,legacy_assignment_id,legacy_execution_id,program_id,program_version,revision)
           VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
          [
            context.organizationId,
            context.branchId,
            context.actorId,
            input.id,
            input.origin.kind === 'occurrence' ? input.origin.occurrenceId : null,
            input.origin.kind === 'legacy' ? input.origin.assignmentId : null,
            input.origin.kind === 'legacy' ? input.origin.executionId : null,
            input.origin.routine.programId,
            input.origin.routine.version,
            session.revision,
          ],
        );
        if (originalLegacy)
          await context.db.query(
            `INSERT INTO b2b_session_revision(organization_id,branch_id,member_id,session_id,revision,schema_version,snapshot,actor_id)
           VALUES($1,$2,$3,$4,0,1,$5,$3)`,
            [context.organizationId, context.branchId, context.actorId, input.id, originalLegacy],
          );
      } else
        await context.db.query(
          'UPDATE b2b_training_session SET revision=$4 WHERE organization_id=$1 AND branch_id=$2 AND id=$3',
          [context.organizationId, context.branchId, input.id, session.revision],
        );
      await context.db.query(
        `INSERT INTO b2b_session_revision(organization_id,branch_id,member_id,session_id,revision,schema_version,operation_id,snapshot,actor_id,accepted_at)
         VALUES($1,$2,$3,$4,$5,2,$6,$7,$3,$8)`,
        [
          context.organizationId,
          context.branchId,
          context.actorId,
          input.id,
          session.revision,
          input.operationId,
          session,
          now,
        ],
      );
      const response = SessionReceiptSchema.parse({
        session,
        receipt: {
          schemaVersion: 2,
          operationId: input.operationId,
          resourceId: input.id,
          revision: session.revision,
          requestHash: hash,
          acceptedAt: now,
        },
      });
      await recordOperation(
        context,
        input,
        input.id,
        input.expectedRevision,
        session.revision,
        hash,
        response,
        'session.revision',
        ['content', 'affectedWeeks'],
        now,
      );
      return response;
    },
  };
}

export type { AuthorizedProductContext };
