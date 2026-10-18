import { ProductEndpoints, SessionBindingSchema } from '@klisteniapp/b2b-contracts/product-v2';
import type { ProductServices } from '../product-context.ts';
import { denied, missing } from '../errors.ts';
import { authorizeRecords } from './operations.ts';
import { legacyRecords, revisions, routineSnapshot, sessionHead } from './repository.ts';
import { resolveSessionPrescription } from './prescription.ts';

/** Own correction binding. Revision zero remains original evidence; a missing
 * accepted v2 receipt is explicitly null, never a fabricated accepted draft. */
export const sessionBinding: ProductServices['sessionBinding'] = async (context, raw) => {
  const { id } = ProductEndpoints.sessionBinding.input.parse(raw);
  await authorizeRecords(context, context.actorId, true);
  const head = await sessionHead(context, id);
  if (head && head.member_id !== context.actorId) throw denied();
  const original = (await legacyRecords(context, context.actorId, id))[0] ?? null;
  const latest = head ? (await revisions(context, id)).at(-1) : null;
  const accepted = latest?.schemaVersion === 2 ? latest : null;
  if (!original && !accepted) throw missing();
  if (head && !accepted) throw new Error('Missing accepted session snapshot');
  const reference = accepted?.origin.routine ?? original!.routine;
  const stored = await routineSnapshot(context, reference.programId, reference.version);
  const { binding } = await resolveSessionPrescription(context, stored, accepted?.content);
  return SessionBindingSchema.parse({ original, accepted, prescription: binding });
};
