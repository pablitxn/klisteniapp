import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { PoolClient } from 'pg';
import type { Unit } from '@klisteniapp/b2b-contracts';
import { conflict, HttpError } from '../errors.ts';
import { admin, audit, type Context, type ValidateAssets } from '../organization-context.ts';
import type { CatalogModule } from '../catalog/index.ts';

type UnitInput = Omit<Unit, 'id' | 'publicPath' | 'revision'>;
type UnitRow = {
  id: string;
  machine_id: string;
  label: string;
  location: string;
  assets: Unit['assets'];
  adjustments: string;
  revision: number;
  archived: boolean;
  public: boolean;
};
const unitDTO = (row: UnitRow, slug: string): Unit => ({
  id: row.id,
  machineId: row.machine_id,
  label: row.label,
  location: row.location,
  assets: row.assets,
  adjustments: row.adjustments,
  publicPath: `/g/${slug}/units/${row.id}`,
  revision: row.revision,
  archived: row.archived,
  public: row.public,
});

/** Physical inventory belongs to one gym; model definitions come from the
 * catalogue. Batch writes reuse the outer transaction and organization lock. */
export class EquipmentModule {
  private catalog: Pick<CatalogModule, 'validateMachine'>;
  private validateAssets: ValidateAssets;

  constructor(catalog: Pick<CatalogModule, 'validateMachine'>, validateAssets: ValidateAssets) {
    this.catalog = catalog;
    this.validateAssets = validateAssets;
  }

  async units(context: Context): Promise<Unit[]> {
    const found = await context.db.query<UnitRow>(
      "SELECT * FROM b2b_unit WHERE organization_id=$1 AND ($2 <> 'member' OR (NOT archived AND EXISTS(SELECT 1 FROM b2b_machine m WHERE m.id=machine_id AND m.status='published'))) ORDER BY label",
      [context.org.id, context.role],
    );
    return found.rows.map((row) => unitDTO(row, context.org.slug));
  }

  async createUnit(context: Context, input: UnitInput): Promise<Unit> {
    admin(context);
    await this.validateAssets(context, input.assets);
    await this.catalog.validateMachine(context, input.machineId);
    const id = randomUUID();
    const found = await context.db.query<UnitRow>(
      'INSERT INTO b2b_unit(id,organization_id,machine_id,label,location,assets,adjustments,archived,public) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [
        id,
        context.org.id,
        input.machineId,
        input.label,
        input.location,
        JSON.stringify(input.assets),
        input.adjustments,
        input.archived,
        input.public,
      ],
    );
    await audit(context, 'unit.create', id);
    return unitDTO(found.rows[0], context.org.slug);
  }

  async updateUnit(
    context: Context,
    id: string,
    input: UnitInput,
    revision: number,
  ): Promise<Unit> {
    admin(context);
    await this.validateAssets(context, input.assets);
    await this.catalog.validateMachine(context, input.machineId);
    const found = await context.db.query<UnitRow>(
      'UPDATE b2b_unit SET machine_id=$3,label=$4,location=$5,assets=$6,adjustments=$7,archived=$8,public=$9,revision=revision+1 WHERE organization_id=$1 AND id=$2 AND revision=$10 RETURNING *',
      [
        context.org.id,
        id,
        input.machineId,
        input.label,
        input.location,
        JSON.stringify(input.assets),
        input.adjustments,
        input.archived,
        input.public,
        revision,
      ],
    );
    if (!found.rows[0]) throw conflict();
    await audit(context, 'unit.update', id);
    return unitDTO(found.rows[0], context.org.slug);
  }

  async batchUnits(context: Context, input: { id: string; units: UnitInput[] }): Promise<Unit[]> {
    admin(context);
    const previous = (
      await context.db.query<{ input: unknown; result: Unit[] }>(
        'SELECT input,result FROM b2b_unit_batch WHERE organization_id=$1 AND id=$2',
        [context.org.id, input.id],
      )
    ).rows[0];
    if (previous) {
      if (!isDeepStrictEqual(previous.input, input)) {
        throw new HttpError(409, 'BATCH_CONFLICT', 'Este lote ya se guardó con otro contenido.');
      }
      return previous.result;
    }
    const units: Unit[] = [];
    for (const item of input.units) units.push(await this.createUnit(context, item));
    await context.db.query(
      'INSERT INTO b2b_unit_batch(organization_id,id,input,result) VALUES($1,$2,$3,$4)',
      [context.org.id, input.id, input, JSON.stringify(units)],
    );
    return units;
  }

  async activeModels(context: Context): Promise<Set<string>> {
    const found = await context.db.query<{ machine_id: string }>(
      'SELECT DISTINCT machine_id FROM b2b_unit WHERE organization_id=$1 AND NOT archived',
      [context.org.id],
    );
    return new Set(found.rows.map((row) => row.machine_id));
  }

  async publicUnits(
    db: PoolClient,
    organization: { id: string; slug: string },
    publishedModels: ReadonlySet<string>,
  ): Promise<Unit[]> {
    const found = await db.query<UnitRow>(
      'SELECT * FROM b2b_unit WHERE organization_id=$1 AND public AND NOT archived',
      [organization.id],
    );
    return found.rows
      .filter((row) => publishedModels.has(row.machine_id))
      .map((row) => unitDTO(row, organization.slug));
  }
}
