// Synthetic fixtures only; the caller owns an isolated schema and media directory.
import { Readable } from 'node:stream'
import { createMediaStore } from '../apps/b2b-api/src/media.ts'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'

const tables = [
  'b2b_branch',
  'b2b_website',
  'b2b_unit',
  'b2b_machine',
  'b2b_exercise',
  'b2b_module_configuration',
]
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAKAAAAB4CAYAAAB1ovlvAAABS0lEQVR4nO3SIQEAIBDAwO9CQ2oREmJMcOL8xGbtc6EydQB/MyApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDkjIgKQOSMiApA5IyICkDknrGTH7ZmarwKAAAAABJRU5ErkJggg==',
  'base64',
)
export async function anonymousFixtures(pool, mediaRoot, fixture) {
  const store = createMediaStore(mediaRoot),
    media = {}
  const videoPath = join(mediaRoot, 'synthetic-source.mp4')
  execFileSync('ffmpeg', [
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=160x120:d=1',
    '-an',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    videoPath,
  ])
  for (const [key, label, org, kind] of [
    ['root', 'Foto pública de la marca Atlas', 'atlas-demo', 'image'],
    ['branch', 'Foto pública de Atlas Norte', 'atlas-demo', 'image'],
    ['private', 'Foto privada sin publicar', 'atlas-demo', 'image'],
    ['sur', 'Foto pública de Sur Oeste', 'sur-demo', 'image'],
    ['video', 'Clip sintético publicado', 'atlas-demo', 'video'],
  ]) {
    const bytes = kind === 'video' ? readFileSync(videoPath) : png
    const stored = await store.ingest({
      body: Readable.from([bytes]),
      contentType: kind === 'video' ? 'video/mp4' : 'image/png',
      kind,
    })
    await pool.query(
      `INSERT INTO b2b_media(id,organization_id,created_by,kind,label,attribution,relative_path,mime,bytes,sha256)
      VALUES($1,$2,$3,$4,$5,'Fixture sintético QA',$6,$7,$8,$9)`,
      [
        stored.id,
        org,
        fixture.gyms.find((gym) => gym.id === org).admin.id,
        kind,
        label,
        stored.relativePath,
        stored.mime,
        stored.bytes,
        stored.sha256,
      ],
    )
    media[key] = {
      id: stored.id,
      kind,
      url: `/api/b2b/media/${stored.id}`,
      label,
      attribution: 'Fixture sintético QA',
    }
  }
  await pool.query(
    `UPDATE b2b_website SET published=jsonb_set(published,'{content,gallery}',$1),draft=jsonb_set(draft,'{gallery}',$2) WHERE organization_id='atlas-demo'`,
    [JSON.stringify([media.root]), JSON.stringify([media.private])],
  )
  for (const [org, slug] of [
    ['atlas-demo', 'norte'],
    ['sur-demo', 'oeste'],
  ]) {
    const image = org === 'atlas-demo' ? media.branch : media.sur
    await pool.query(
      `UPDATE b2b_branch SET address='Dirección borrador NO PUBLICAR',contact='Contacto borrador NO PUBLICAR',
      published_profile=jsonb_set(jsonb_set(published_profile,'{address}',to_jsonb($2::text)),'{contact}',to_jsonb($3::text)),
      published=jsonb_set(jsonb_set(published,'{gallery}',$4),'{floorPlan}',$5),
      draft=jsonb_set(draft,'{headline}','"BORRADOR PRIVADO NO PUBLICAR"') WHERE organization_id=$1 AND slug=$6`,
      [
        org,
        `Avenida ${slug} 200`,
        `Contacto ${slug} público`,
        JSON.stringify([image, ...(org === 'atlas-demo' ? [media.video] : [])]),
        JSON.stringify({
          title: `Plano ${slug}`,
          description: 'Plano sintético',
          image,
          points: [{ unitId: `${org}-${slug}-cable-01`, x: 50, y: 50 }],
        }),
        slug,
      ],
    )
  }
  await pool.query(`UPDATE b2b_unit SET assets=$1 WHERE id='atlas-demo-norte-cable-01'`, [
    JSON.stringify([media.branch]),
  ])
  const original = {}
  for (const table of tables) original[table] = (await pool.query(`SELECT * FROM ${table}`)).rows
  async function reset() {
    await pool.query('BEGIN')
    try {
      await pool.query('DELETE FROM b2b_branch_module')
      for (const table of tables)
        for (const row of original[table]) {
          const key =
            table === 'b2b_website'
              ? 'organization_id'
              : table === 'b2b_module_configuration'
                ? null
                : 'id'
          if (!key) continue
          const columns = Object.keys(row).filter((column) => column !== key)
          await pool.query(
            `UPDATE ${table} SET (${columns.join(',')})=(SELECT ${columns.join(',')} FROM jsonb_populate_record(NULL::${table},$1)) WHERE ${key}=$2`,
            [JSON.stringify(row), row[key]],
          )
        }
      await pool.query('DELETE FROM b2b_auth_rate_limit')
      await pool.query('COMMIT')
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  }
  const cases = {
    normal: async () => {},
    hiddenBranch: () =>
      pool.query("UPDATE b2b_branch SET public=false WHERE id='atlas-demo-norte'"),
    archivedBranch: () =>
      pool.query("UPDATE b2b_branch SET status='archived' WHERE id='atlas-demo-norte'"),
    unpublishedBranch: () =>
      pool.query(
        "UPDATE b2b_branch SET published=NULL,published_profile=NULL WHERE id='atlas-demo-norte'",
      ),
    empty: () => pool.query("UPDATE b2b_unit SET public=false WHERE branch_id='atlas-demo-norte'"),
    hiddenUnit: () =>
      pool.query("UPDATE b2b_unit SET public=false WHERE id='atlas-demo-norte-cable-01'"),
    archivedUnit: () =>
      pool.query("UPDATE b2b_unit SET archived=true WHERE id='atlas-demo-norte-cable-01'"),
    unpublishedMachine: () =>
      pool.query("UPDATE b2b_machine SET status='draft' WHERE id='base-cable-station-v1'"),
    unpublishedRoot: () =>
      pool.query("UPDATE b2b_website SET published=NULL WHERE organization_id='atlas-demo'"),
    noBranches: () =>
      pool.query("UPDATE b2b_branch SET public=false WHERE organization_id='atlas-demo'"),
    websiteOff: () =>
      pool.query(
        "INSERT INTO b2b_branch_module(organization_id,branch_id,module,enabled) VALUES('atlas-demo','atlas-demo-norte','website',false)",
      ),
    equipmentOff: () =>
      pool.query(
        "INSERT INTO b2b_branch_module(organization_id,branch_id,module,enabled) VALUES('atlas-demo','atlas-demo-norte','equipment',false)",
      ),
    mediaOff: () =>
      pool.query(
        "INSERT INTO b2b_branch_module(organization_id,branch_id,module,enabled) VALUES('atlas-demo','atlas-demo-norte','media',false)",
      ),
    noExercises: () =>
      pool.query("UPDATE b2b_exercise SET status='draft' WHERE status='published'"),
  }
  async function state() {
    const result = {}
    for (const table of [
      ...tables,
      'b2b_execution',
      'b2b_audit',
      'b2b_auth_user',
      'b2b_program_assignment',
      'b2b_media',
    ]) {
      const rows = (await pool.query(`SELECT * FROM ${table} ORDER BY to_jsonb(${table})::text`))
        .rows
      result[table] = {
        count: rows.length,
        hash: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
      }
    }
    return result
  }
  return {
    media,
    state,
    async apply(name) {
      if (!Object.hasOwn(cases, name)) throw new Error('Unknown QA fixture')
      await reset()
      await cases[name]()
      return { media, state: await state() }
    },
  }
}
