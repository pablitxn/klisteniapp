import { randomUUID } from 'node:crypto';
import {
  HealthImportPreviewSchema,
  OwnHealthSchema,
  ProductEndpoints,
  type NormalizedHealth,
  type ProductEndpoint,
  type ProductInput,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductIdentityContext, HealthServices } from '../product-context.ts';
import { conflict, HttpError } from '../errors.ts';
import {
  parseProductHealth,
  previewProductHealthImport,
  productHealthImportFormat,
} from '../product-health-adapter.ts';
import { currentHealthContext, currentIdentity, lockHealthOwner } from './access.ts';
import {
  consentedHealth,
  grantHealthConsent,
  listHealthConsents,
  revokeHealthConsent,
} from './consent.ts';
import {
  healthHash,
  healthReceipt,
  readOwnerHealth,
  saveHealthReceipt,
  writeOwnerHealth,
} from './storage.ts';

export {
  HEALTH_RESPONSE_HEADERS,
  healthDisclosureGeneration,
  revalidateHealthDisclosure,
  revokeHealthForInactiveMembership,
} from './consent.ts';

const invalid = () =>
  new HttpError(400, 'INVALID_INPUT', 'Revisá los datos de salud. No se guardó ningún cambio.');
const categories = productHealthImportFormat.categories;
const zeroAdditions = () => Object.fromEntries(categories.map((category) => [category, 0]));
const PREVIEW_TTL_MS = 5 * 60 * 1000;
const MAX_PENDING_PREVIEWS = 1000;

function input<K extends ProductEndpoint>(name: K, value: ProductInput<K>): ProductInput<K> {
  const parsed = ProductEndpoints[name].input.safeParse(value);
  if (!parsed.success) throw invalid();
  return parsed.data as ProductInput<K>;
}

/** Semantic parsing is exclusively delegated to the API adapter. Date checks
 * additionally use the server clock and the persisted observation timezone.
 * A missing observation timezone uses the explicit UTC storage fallback. */
function validatedHealth(data: unknown, now: Date) {
  let parsed: NormalizedHealth;
  try {
    parsed = parseProductHealth(data);
  } catch {
    throw invalid();
  }
  if (!Number.isFinite(now.getTime())) throw invalid();
  const utcToday = now.toISOString().slice(0, 10);
  if (typeof parsed.profile.birthDate === 'string' && parsed.profile.birthDate > utcToday)
    throw invalid();
  for (const category of categories) {
    for (const record of parsed[category]) {
      const today =
        typeof record.timeZone === 'string'
          ? new Intl.DateTimeFormat('sv-SE', {
              timeZone: record.timeZone,
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
            }).format(now)
          : utcToday;
      if (
        record.date > today ||
        ['recordedAt', 'modifiedAt', 'startAt', 'endAt'].some(
          (key) => typeof record[key] === 'string' && Date.parse(record[key]) > now.getTime(),
        )
      )
        throw invalid();
    }
  }
  return parsed;
}

/** Purpose-limited WP06 projection; identity/host authorization belongs to
 * ACCESS. Caller supplies the owner only through its authenticated context. */
export async function ownerHealthExport(context: AuthorizedProductIdentityContext) {
  await currentIdentity(context);
  if (!context.capabilities.has('export-own-records'))
    throw new HttpError(403, 'CONTEXT_REVOKED', 'La exportación no está disponible.');
  await lockHealthOwner(context, context.actorId);
  return readOwnerHealth(context, context.actorId);
}

/** One instance per API process. Preview state contains hashes only, never raw
 * health payloads. Restart/eviction fails closed and requires another preview.
 * No feature function starts or commits a transaction. */
export function createHealthServices(options: { now?: () => Date } = {}): HealthServices {
  const clock = options.now ?? (() => new Date());
  const previews = new Map<
    string,
    { ownerId: string; revision: number; payloadHash: string; expires: number }
  >();
  function prune(now: Date) {
    for (const [key, preview] of previews)
      if (preview.expires <= now.getTime()) previews.delete(key);
    while (previews.size >= MAX_PENDING_PREVIEWS) previews.delete(previews.keys().next().value!);
  }
  return {
    async ownHealth(context, value) {
      input('ownHealth', value);
      await currentHealthContext(context, 'manage-own-health');
      await lockHealthOwner(context, context.actorId);
      return readOwnerHealth(context, context.actorId);
    },
    async saveOwnHealth(context, value) {
      const request = input('saveOwnHealth', value);
      await currentHealthContext(context, 'manage-own-health');
      await lockHealthOwner(context, context.actorId);
      const data = validatedHealth(request.data, clock());
      const hash = healthHash({ kind: 'health.save', input: { ...request, data } });
      const receipt = await healthReceipt(context, request.operationId, hash);
      if (receipt) return OwnHealthSchema.parse(receipt);
      const current = await readOwnerHealth(context, context.actorId);
      if (current.revision !== request.expectedRevision) throw conflict();
      const response = await writeOwnerHealth(context, data, current.revision + 1);
      await saveHealthReceipt(context, request.operationId, hash, response.revision, response);
      return response;
    },
    async previewHealthImport(context, value) {
      const request = input('previewHealthImport', value);
      await currentHealthContext(context, 'manage-own-health');
      await lockHealthOwner(context, context.actorId);
      const current = await readOwnerHealth(context, context.actorId);
      if (current.revision !== request.expectedRevision) throw conflict();
      const now = clock();
      const result = previewProductHealthImport(request.raw, current.data, now);
      const expires = now.getTime() + PREVIEW_TTL_MS;
      const hash = healthHash({
        ownerId: context.actorId,
        revision: current.revision,
        normalized: result.ok ? result.health : null,
        expires,
        nonce: randomUUID(),
      });
      prune(now);
      if (result.ok)
        previews.set(hash, {
          ownerId: context.actorId,
          revision: current.revision,
          payloadHash: healthHash({ health: result.health, file: JSON.parse(request.raw) }),
          expires,
        });
      return HealthImportPreviewSchema.parse({
        schemaVersion: 2,
        expectedRevision: current.revision,
        format: request.format,
        version: request.version,
        previewHash: hash,
        expiresAt: new Date(expires).toISOString(),
        additions: result.ok
          ? Object.fromEntries(
              categories.map((category) => [category, result.byCategory[category].added]),
            )
          : zeroAdditions(),
        duplicates: result.ok ? result.counts.duplicates : 0,
        conflicts: [],
        issues: result.ok ? [] : [{ path: 'raw', message: result.error }],
      });
    },
    async applyHealthImport(context, value) {
      const request = input('applyHealthImport', value);
      await currentHealthContext(context, 'manage-own-health');
      await lockHealthOwner(context, context.actorId);
      const { previewHash, ...importRequest } = request;
      // Preview tickets are ephemeral; accepted operation receipts are durable.
      // A response-loss retry remains exact after expiry or another owner edit.
      const hash = healthHash({ kind: 'health.import', input: importRequest });
      const receipt = await healthReceipt(context, request.operationId, hash);
      if (receipt) return OwnHealthSchema.parse(receipt);
      const current = await readOwnerHealth(context, context.actorId);
      if (current.revision !== request.expectedRevision) throw conflict();
      const now = clock();
      const ticket = previews.get(previewHash);
      if (
        !ticket ||
        ticket.ownerId !== context.actorId ||
        ticket.revision !== current.revision ||
        ticket.expires <= now.getTime()
      )
        throw invalid();
      const result = previewProductHealthImport(request.raw, current.data, now);
      if (
        !result.ok ||
        healthHash({ health: result.health, file: JSON.parse(request.raw) }) !== ticket.payloadHash
      )
        throw invalid();
      const response = await writeOwnerHealth(
        context,
        validatedHealth(result.health, now),
        current.revision + 1,
      );
      await saveHealthReceipt(context, request.operationId, hash, response.revision, response);
      // Do not consume a ticket before ACCESS commits; rollback remains retryable.
      return response;
    },
    async healthConsents(context, value) {
      input('healthConsents', value);
      return listHealthConsents(context);
    },
    async grantHealthConsent(context, value) {
      return grantHealthConsent(context, input('grantHealthConsent', value));
    },
    async revokeHealthConsent(context, value) {
      return revokeHealthConsent(context, input('revokeHealthConsent', value));
    },
    async consentedHealth(context, value) {
      const request = input('consentedHealth', value);
      return consentedHealth(context, request.memberId, clock());
    },
  };
}
