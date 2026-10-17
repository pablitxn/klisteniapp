import type { PoolClient } from 'pg';
import type {
  OrganizationRoleV2,
  ProductAccess,
  ProductService,
} from '@klisteniapp/b2b-contracts/product-v2';
import { HttpError } from './errors.ts';

/** ACCESS constructs this only inside its locked, authorized transaction. A
 * capability response or a caller-supplied role is never proof of access. */
export type AuthorizedProductContext = {
  readonly db: PoolClient;
  readonly actorId: string;
  readonly organizationId: string;
  readonly branchId: string;
  readonly role: OrganizationRoleV2;
  readonly accessMode: ProductAccess['accessMode'];
  readonly accessRevision: number;
  readonly capabilities: ReadonlySet<ProductAccess['capabilities'][number]>;
  /** Current-grant check; historical targets may be inactive, planning targets
   * must be active. Does not authorize viewing another identity's health. */
  authorizeMember(memberId: string, purpose: 'planning' | 'history'): Promise<void>;
};
export type ProductServices = ProductService<AuthorizedProductContext>;
export type PlanningServices = Pick<
  ProductServices,
  | 'routines'
  | 'routine'
  | 'saveRoutine'
  | 'publishRoutine'
  | 'goals'
  | 'saveGoal'
  | 'enroll'
  | 'continuity'
  | 'periodPreview'
  | 'applyPeriod'
>;
export type RecordsServices = Pick<
  ProductServices,
  'occurrences' | 'moveOccurrence' | 'week' | 'sessions' | 'sessionRevisions' | 'saveSession'
>;
export type HealthServices = Pick<
  ProductServices,
  | 'ownHealth'
  | 'saveOwnHealth'
  | 'previewHealthImport'
  | 'applyHealthImport'
  | 'healthConsents'
  | 'grantHealthConsent'
  | 'revokeHealthConsent'
  | 'consentedHealth'
>;

export function assertLegacyFormat(schemaVersion: number): void {
  if (schemaVersion !== 1)
    throw new HttpError(
      426,
      'UPGRADE_REQUIRED',
      'Actualizá la aplicación para ver este contenido. Tus cambios pendientes se conservan.',
    );
}
/** Called by ACCESS before any legacy operation after activation. Header opt-in
 * alone cannot make a legacy route understand a v2 payload. */
export function assertLegacyProductAccess(productActive: boolean): void {
  if (productActive) assertLegacyFormat(2);
}
export function assertProductCapability(
  contractHeader: string | undefined,
  activated: boolean,
): void {
  if (contractHeader !== '2') assertLegacyFormat(2);
  if (!activated)
    throw new HttpError(
      409,
      'PRODUCT_NOT_ACTIVE',
      'La actualización del gimnasio todavía no está disponible.',
    );
}
