import {
  B2CInvitationSchema,
  PersonalExportSchema,
  ProductEndpoints,
  type ProductService,
} from '@klisteniapp/b2b-contracts/product-v2';
import type { AuthorizedProductIdentityContext } from '../product-context.ts';
import { currentIdentity, lockHealthOwner } from '../health/access.ts';
import { readOwnerHealth } from '../health/storage.ts';
import { HttpError } from '../errors.ts';
import { trainingExport } from './training.ts';

/** A manifest explanation for the download screen/HTTP binding. The frozen
 * strict PersonalExportSchema has no free-form manifest/omissions field. */
export const PERSONAL_EXPORT_COVERAGE = Object.freeze({
  format: 'klisteni-personal-export',
  version: 2,
  serverAcceptedOnly: true,
  included: [
    'Own issued immutable routine versions and supplements in the selected organization',
    'All accepted enrollment, occurrence and actual-session revisions, including legacy originals',
    'Own current B2B health, independent of organization sharing consent',
  ],
  omitted: [
    'Unsynchronized device work; export it separately as owner-local data',
    'Unissued staff drafts, staff-private audit/contact data and other members records',
    'Media bytes and temporary media authorization; historical references remain unchanged',
    'Other organizations training and separate B2C accounts, billing and health',
    'Health operation receipts and historical health edits; current owner health is included',
  ],
});

export const PERSONAL_EXPORT_HEADERS = Object.freeze({
  'Cache-Control': 'no-store, private, max-age=0',
  Pragma: 'no-cache',
  'Surrogate-Control': 'no-store',
  'Content-Disposition': 'attachment; filename="klisteni-personal-export-v2.json"',
  'X-Klisteni-Export-Version': '2',
  'X-Klisteni-Export-Scope': 'selected-organization; server-accepted-only; owner-health',
});

type SelfServices = Pick<
  ProductService<AuthorizedProductIdentityContext>,
  'personalExport' | 'b2cInvitation'
>;

export function createPersonalExportServices(
  options: { now?: () => Date; b2cInvitationUrl?: string | null } = {},
): SelfServices {
  // Validate trusted configuration once, before serving any identity.
  const invitation = B2CInvitationSchema.parse({
    separateProduct: true,
    paid: true,
    automaticConversion: false,
    url: options.b2cInvitationUrl ?? null,
  });
  if (invitation.url) {
    const url = new URL(invitation.url);
    if (url.username || url.password || url.hash || url.search)
      throw new Error('The separate B2C invitation must not contain credentials or transfer parameters');
  }
  async function authorize(context: AuthorizedProductIdentityContext) {
    await currentIdentity(context);
    if (!context.capabilities.has('export-own-records'))
      throw new HttpError(403, 'CONTEXT_REVOKED', 'El acceso cambió.');
  }
  return {
    async personalExport(context, input) {
      ProductEndpoints.personalExport.input.parse(input);
      await authorize(context);
      // Same ordering as WP05: organization/membership, then identity health lock.
      await lockHealthOwner(context, context.actorId);
      const exportedAt = (options.now?.() ?? new Date()).toISOString();
      const training = await trainingExport(context, exportedAt);
      const health = await readOwnerHealth(context, context.actorId);
      return PersonalExportSchema.parse({
        format: 'klisteni-personal-export',
        version: 2,
        exportedAt,
        ownerId: context.actorId,
        training,
        health,
        serverAcceptedOnly: true,
      });
    },
    async b2cInvitation(context, input) {
      ProductEndpoints.b2cInvitation.input.parse(input);
      await authorize(context);
      return B2CInvitationSchema.parse(invitation);
    },
  };
}
