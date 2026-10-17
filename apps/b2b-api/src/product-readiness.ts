import type { Pool, PoolClient } from 'pg';
import { HttpError } from './errors.ts';

/** ACCESS must call this before advertising/authorizing an active v2 product.
 * Legacy readiness remains separate until the ACCESS lease returns. */
export const PRODUCT_REQUIRED_MIGRATIONS = [
  '006-product-foundation',
  '007-reviewed-catalog-v1',
] as const;
export async function assertProductMigrations(db: Pool | PoolClient): Promise<void> {
  const found = await db.query<{ id: string }>(
    'SELECT id FROM b2b_migration WHERE id=ANY($1::text[])',
    [PRODUCT_REQUIRED_MIGRATIONS],
  );
  if (PRODUCT_REQUIRED_MIGRATIONS.some((id) => !found.rows.some((row) => row.id === id)))
    throw new HttpError(
      409,
      'PRODUCT_NOT_ACTIVE',
      'La actualización del gimnasio todavía no está disponible.',
    );
}
