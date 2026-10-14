import { ApiError, createB2BClient } from '@klisteniapp/b2b-client'
import {
  MODULE_IDS,
  type Branch,
  type BrandContext,
  type ModuleId,
  type Theme,
} from '@klisteniapp/b2b-contracts'
import { useAccountClient, useAccountId, useLoad } from '@klisteniapp/b2b-react'
import { BrandThemeProvider, Field, Notice } from '@klisteniapp/b2b-ui'
import { useEffect, useState, type FormEvent } from 'react'
import { DraftConflict, DraftRecovery, useEditorDraft } from '../../shared/editor/useEditorDraft'
import { branchDraft, isBranchDraft, type BranchDraft } from './branchDraft'
import { isThemeDraft } from './themeDraft'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'

function BrandHistoryExport({ orgId }: { orgId: string }) {
  const client = useAccountClient(),
    action = useAction()
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h2>Historial de la marca</h2>
      <p>
        Incluye registros de sedes archivadas y de personas que dejaron la marca. La descarga
        contiene datos privados y conserva la sede de cada registro.
      </p>
      {action.notices}
      <button
        className="button"
        disabled={action.busy}
        onClick={() =>
          void action.run(async () => {
            const records = await client.executions.brandHistory(orgId)
            const url = URL.createObjectURL(
              new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }),
            )
            const link = document.createElement('a')
            link.href = url
            link.download = 'historial-de-la-marca.json'
            link.click()
            URL.revokeObjectURL(url)
          }, 'Historial exportado.')
        }
      >
        Exportar historial de la marca
      </button>
    </section>
  )
}

const moduleNames: Record<ModuleId, string> = {
  website: 'Website público',
  equipment: 'Equipamiento y QR',
  floorPlan: 'Plano del espacio',
  media: 'Archivos',
  voice: 'Voz guiada',
}
function text(form: FormData, key: string) {
  return String(form.get(key) ?? '')
}

export function WhiteLabelSettings({
  orgId,
  branchId,
  context,
  onRefresh,
}: {
  orgId: string
  branchId: string
  context: BrandContext
  onRefresh: () => void
}) {
  const [section, setSection] = useState<'branches' | 'theme' | 'modules' | 'operations'>(
    'branches',
  )
  return (
    <>
      <Heading
        title="Una marca, varios espacios."
        description="Gestioná sedes y accesos; publicá la identidad y elegí qué funciones ofrece cada espacio."
      />
      <div className="row" role="navigation" aria-label="Configuración de marca">
        {(
          [
            ['branches', 'Sedes y accesos'],
            ['theme', 'Diseño publicado'],
            ['modules', 'Módulos'],
            ['operations', 'Catálogo y traslados'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            className="button"
            aria-pressed={section === id}
            disabled={!branchId && (id === 'modules' || id === 'operations')}
            onClick={() => setSection(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {section === 'branches' && (
        <>
          <Branches orgId={orgId} onRefresh={onRefresh} />
          <BrandHistoryExport orgId={orgId} />
        </>
      )}
      {section === 'theme' && <Themes orgId={orgId} context={context} onRefresh={onRefresh} />}
      {section === 'modules' && <Modules orgId={orgId} onRefresh={onRefresh} />}
      {section === 'operations' && <Operations orgId={orgId} branchId={branchId} />}
    </>
  )
}

function Branches({ orgId, onRefresh }: { orgId: string; onRefresh: () => void }) {
  const accountId = useAccountId()
  const client = createB2BClient(accountId)
  const resource = useLoad(async (signal) => {
    const api = client.withSignal(signal)
    const [branches, grants, members] = await Promise.all([
      api.branches.list(orgId),
      api.grants.list(orgId),
      api.members.list(orgId),
    ])
    return { ...branches, ...grants, ...members }
  }, orgId)
  const action = useAction()
  function changed() {
    resource.reload()
    onRefresh()
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    await action.run(async () => {
      await client.branches.create(orgId, {
        name: text(values, 'name'),
        slug: text(values, 'slug'),
        address: text(values, 'address'),
        contact: text(values, 'contact'),
        timezone: text(values, 'timezone'),
      })
      form.reset()
      changed()
    }, 'Sede creada. Asigná accesos y prepará su contenido antes de publicarla.')
  }
  async function grant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    await action.run(async () => {
      await client.grants.update(orgId, {
        userId: text(values, 'user'),
        branchId: text(values, 'branch'),
        role: text(values, 'role') as 'coach' | 'member',
        active: true,
      })
      changed()
    }, 'Acceso concedido en la sede elegida.')
  }
  return (
    <>
      <Notice error>{resource.error}</Notice>
      {action.notices}
      <form className="card form-stack" onSubmit={create} style={{ marginTop: 24 }}>
        <h2>Crear sede</h2>
        <div className="form-grid">
          <Field label="Nombre de sede">
            <input name="name" required maxLength={100} />
          </Field>
          <Field label="Dirección del enlace" hint="Palabras en minúsculas separadas por guiones.">
            <input name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={80} />
          </Field>
          <Field label="Dirección">
            <input name="address" maxLength={300} />
          </Field>
          <Field label="Contacto">
            <input name="contact" maxLength={200} />
          </Field>
          <Field label="Zona horaria">
            <input name="timezone" defaultValue="America/Argentina/Buenos_Aires" required />
          </Field>
        </div>
        <button className="button primary" disabled={action.busy}>
          Crear sede
        </button>
      </form>
      <div className="grid two" style={{ marginTop: 24 }}>
        {resource.data?.branches.map((branch) => (
          <BranchEditor key={branch.id} branch={branch} orgId={orgId} onSaved={changed} />
        ))}
      </div>
      {resource.data && (
        <form className="card form-stack" onSubmit={grant} style={{ marginTop: 24 }}>
          <h2>Dar acceso a una sede</h2>
          <p>
            Una persona puede tener funciones distintas en cada sede. Invitá primero a las personas
            desde Personas.
          </p>
          <div className="form-grid">
            <Field label="Persona">
              <select name="user" required>
                {resource.data.members
                  .filter((m) => m.active)
                  .map((m) => (
                    <option key={m.userId} value={m.userId}>
                      {m.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Sede">
              <select name="branch" required>
                {resource.data.branches
                  .filter((b) => b.status === 'active')
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Función">
              <select name="role">
                <option value="member">Socio</option>
                <option value="coach">Entrenador</option>
              </select>
            </Field>
          </div>
          <button className="button" disabled={action.busy}>
            Conceder acceso
          </button>
          <h3>Accesos vigentes</h3>
          {resource.data.grants
            .filter((g) => g.active)
            .map((g) => (
              <div className="row spread" key={`${g.branchId}/${g.userId}/${g.role}`}>
                <span>
                  {resource.data?.members.find((m) => m.userId === g.userId)?.name ?? 'Persona'} ·{' '}
                  {resource.data?.branches.find((b) => b.id === g.branchId)?.name} ·{' '}
                  {g.role === 'coach' ? 'Entrenador' : 'Socio'}
                </span>
                <button
                  type="button"
                  className="text-button"
                  disabled={action.busy}
                  onClick={() =>
                    void action.run(async () => {
                      await client.grants.update(orgId, {
                        userId: g.userId,
                        branchId: g.branchId,
                        role: g.role,
                        active: false,
                      })
                      changed()
                    }, 'Acceso retirado. El historial propio permanece disponible dentro de la marca.')
                  }
                >
                  Retirar acceso
                </button>
              </div>
            ))}
        </form>
      )}
    </>
  )
}

function BranchEditor({
  branch,
  orgId,
  onSaved,
}: {
  branch: Branch
  orgId: string
  onSaved: () => void
}) {
  const client = useAccountClient(),
    action = useAction()
  const [latest, setLatest] = useState(branch)
  const [conflict, setConflict] = useState(false)
  const local = useEditorDraft(
    orgId,
    'branch',
    branch.id,
    branchDraft(branch),
    branch.revision,
    isBranchDraft,
  )
  const draft = local.value
  useEffect(() => {
    if (branch.revision > latest.revision) setLatest(branch)
  }, [branch, latest.revision])
  const stale = latest.revision !== local.revision
  const blocked = Boolean(local.pending) || stale || conflict
  function change(patch: Partial<BranchDraft>) {
    local.change({ ...draft, ...patch })
  }
  async function readLatest() {
    const result = await client.branches.list(orgId)
    const current = result.branches.find((item) => item.id === branch.id)
    if (!current)
      throw new Error('Esta sede ya no está disponible. Tu copia local sigue conservada.')
    if (local.isCurrent()) setLatest(current)
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (blocked) return
    await action.run(async () => {
      try {
        const result = await client.branches.update(orgId, branch.id, {
          slug: latest.slug,
          openingHours: latest.openingHours,
          public: latest.public,
          ...draft,
          expectedRevision: local.savedRevision(),
        })
        if (!local.isCurrent()) return
        local.reset(branchDraft(result.branch), result.branch.revision)
        setLatest(result.branch)
        setConflict(false)
        onSaved()
      } catch (error) {
        if (!local.isCurrent()) return
        if (
          error instanceof ApiError &&
          error.status === 409 &&
          error.code === 'REVISION_CONFLICT'
        ) {
          setConflict(true)
          await readLatest()
        }
        throw error
      }
    })
  }
  return (
    <form className="card form-stack" onSubmit={save}>
      <h2>{branch.name}</h2>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={action.busy}
        onRecover={local.recover}
        onDiscard={() => local.reset(branchDraft(latest), latest.revision)}
      />
      {!local.pending && (stale || conflict) && (
        <DraftConflict
          key={latest.revision}
          busy={action.busy}
          currentAvailable={stale}
          onRefresh={() => void action.run(readLatest, '')}
          onKeep={() => {
            local.rebase(latest.revision)
            setConflict(false)
            action.clear()
          }}
          onDiscard={() => {
            local.reset(branchDraft(latest), latest.revision)
            setConflict(false)
            action.clear()
          }}
        >
          <h3>{latest.name}</h3>
          <p>{latest.address}</p>
          <p>{latest.contact}</p>
          <p>
            {latest.timezone} · {latest.status === 'active' ? 'Activa' : 'Archivada'}
          </p>
        </DraftConflict>
      )}
      <fieldset
        disabled={action.busy || Boolean(local.pending)}
        style={{ border: 0, padding: 0, minWidth: 0 }}
        className="form-stack"
      >
        <Field label="Nombre">
          <input
            name="name"
            value={draft.name}
            onChange={(event) => change({ name: event.target.value })}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Dirección">
          <input
            name="address"
            value={draft.address}
            onChange={(event) => change({ address: event.target.value })}
            maxLength={300}
          />
        </Field>
        <Field label="Contacto">
          <input
            name="contact"
            value={draft.contact}
            onChange={(event) => change({ contact: event.target.value })}
            maxLength={200}
          />
        </Field>
        <Field label="Zona horaria">
          <input
            name="timezone"
            value={draft.timezone}
            onChange={(event) => change({ timezone: event.target.value })}
            maxLength={100}
            required
          />
        </Field>
        <Field label="Estado">
          <select
            name="status"
            value={draft.status}
            onChange={(event) => change({ status: event.target.value as Branch['status'] })}
          >
            <option value="active">Activa</option>
            <option value="archived">Archivada</option>
          </select>
        </Field>
        <p className="small muted">
          Archivar conserva el historial e impide nuevas actividades. Finalizá las asignaciones
          activas antes de archivar.
        </p>
        {action.notices}
        <button className="button" disabled={blocked || action.busy}>
          Guardar sede
        </button>
      </fieldset>
    </form>
  )
}

function Themes({
  orgId,
  context,
  onRefresh,
}: {
  orgId: string
  context: BrandContext
  onRefresh: () => void
}) {
  const client = useAccountClient()
  const resource = useLoad(async (signal) => {
    const api = client.withSignal(signal)
    return { ...(await api.theme.get(orgId)), ...(await api.theme.versions(orgId)) }
  }, orgId)
  return (
    <>
      <Notice error>{resource.error}</Notice>
      {resource.data && (
        <ThemeEditor
          state={resource.data.theme}
          context={context}
          orgId={orgId}
          versions={resource.data.versions.map((v) => v.version)}
          onSaved={() => {
            resource.reload()
            onRefresh()
          }}
        />
      )}
    </>
  )
}

function ThemeEditor({
  state,
  context,
  orgId,
  versions,
  onSaved,
}: {
  state: { draft: Theme; published: Theme; revision: number; publishedVersion: number }
  context: BrandContext
  orgId: string
  versions: number[]
  onSaved: () => void
}) {
  const client = useAccountClient(),
    action = useAction()
  const local = useEditorDraft(orgId, 'theme', 'brand', state.draft, state.revision, isThemeDraft)
  const draft = local.value
  const [latest, setLatest] = useState(state)
  const [conflict, setConflict] = useState(false)
  const [preview, setPreview] = useState(false),
    [restoreVersion, setRestoreVersion] = useState('')
  useEffect(() => {
    if (state.revision > latest.revision) setLatest(state)
  }, [state, latest.revision])
  const stale = latest.revision !== local.revision
  const blocked = Boolean(local.pending) || stale || conflict
  function update<K extends keyof Theme>(key: K, value: Theme[K]) {
    local.change({ ...draft, [key]: value })
  }
  async function readLatest() {
    const result = await client.theme.get(orgId)
    if (local.isCurrent()) setLatest(result.theme)
  }
  function acceptState(next: typeof state) {
    if (!local.isCurrent()) return
    local.reset(next.draft, next.revision)
    setLatest(next)
    setConflict(false)
    onSaved()
  }
  async function save(publish: boolean) {
    if (blocked) return
    await action.run(
      async () => {
        try {
          const result = await client.theme.update(orgId, {
            ...draft,
            expectedRevision: local.savedRevision(),
          })
          const next = publish
            ? await client.theme.publish(orgId, { expectedRevision: result.theme.revision })
            : result
          acceptState(next.theme)
        } catch (error) {
          if (!local.isCurrent()) return
          if (error instanceof ApiError && error.status === 409) {
            setConflict(true)
            await readLatest()
          }
          throw error
        }
      },
      publish ? 'Diseño publicado.' : 'Borrador guardado. Todavía no se publicó.',
    )
  }
  async function uploadImage(file: File, kind: 'logo' | 'hero') {
    await action.run(async () => {
      const result = await client.media.uploadBrand(
        orgId,
        { kind: 'image', label: file.name, attribution: '' },
        file,
      )
      if (!local.isCurrent()) return
      if (kind === 'logo') update('brand', { ...draft.brand, logoUrl: result.media.url })
      else update('heroImageUrl', result.media.url)
    }, 'Imagen cargada en el borrador. Guardá o publicá para aplicarla.')
  }

  return (
    <section className="card form-stack" style={{ marginTop: 24 }}>
      <h2>Identidad y diseño</h2>
      <p>
        Versión publicada {latest.publishedVersion}. Guardar conserva un borrador privado; publicar
        aplica el diseño a toda la marca.
      </p>
      <DraftRecovery
        pending={Boolean(local.pending)}
        error={local.storageError}
        disabled={action.busy}
        onRecover={local.recover}
        onDiscard={() => local.reset(latest.draft, latest.revision)}
      />
      {!local.pending && (stale || conflict) && (
        <DraftConflict
          key={latest.revision}
          busy={action.busy}
          currentAvailable={stale}
          onRefresh={() => void action.run(readLatest, '')}
          onKeep={() => {
            local.rebase(latest.revision)
            setConflict(false)
            action.clear()
          }}
          onDiscard={() => {
            local.reset(latest.draft, latest.revision)
            setConflict(false)
            action.clear()
          }}
        >
          <h3>{latest.draft.loginTitle || latest.draft.brand.name}</h3>
          <p>{latest.draft.loginDescription}</p>
          <p>
            {latest.draft.brand.name} · {latest.draft.layout} · {latest.draft.font}
          </p>
        </DraftConflict>
      )}
      <fieldset
        disabled={action.busy || Boolean(local.pending)}
        style={{ border: 0, padding: 0, minWidth: 0 }}
      >
        <div className="form-grid">
          <Field label="Subir logo de la marca">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={action.busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadImage(file, 'logo')
              }}
            />
          </Field>
          <Field label="Subir imagen de bienvenida">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={action.busy}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void uploadImage(file, 'hero')
              }}
            />
          </Field>
          <Field label="Nombre de marca">
            <input
              value={draft.brand.name}
              onChange={(e) => update('brand', { ...draft.brand, name: e.target.value })}
            />
          </Field>
          <Field label="Logo">
            <input
              value={draft.brand.logoUrl ?? ''}
              onChange={(e) => update('brand', { ...draft.brand, logoUrl: e.target.value })}
            />
          </Field>
          {(['primary', 'background', 'surface', 'text', 'accent'] as const).map((key) => (
            <Field
              key={key}
              label={
                {
                  primary: 'Color principal',
                  background: 'Fondo',
                  surface: 'Tarjetas',
                  text: 'Texto',
                  accent: 'Acento',
                }[key]
              }
            >
              <input
                type="color"
                value={draft.palette[key]}
                onChange={(e) => update('palette', { ...draft.palette, [key]: e.target.value })}
              />
            </Field>
          ))}
          <Field label="Tipografía">
            <select
              value={draft.font}
              onChange={(e) => update('font', e.target.value as Theme['font'])}
            >
              <option value="system">Sistema</option>
              <option value="humanist">Humanista</option>
              <option value="geometric">Geométrica</option>
            </select>
          </Field>
          <Field label="Forma de componentes">
            <select
              value={draft.radius}
              onChange={(e) => update('radius', e.target.value as Theme['radius'])}
            >
              <option value="square">Recta</option>
              <option value="soft">Suave</option>
              <option value="round">Redondeada</option>
            </select>
          </Field>
          <Field label="Plantilla">
            <select
              value={draft.layout}
              onChange={(e) => update('layout', e.target.value as Theme['layout'])}
            >
              <option value="editorial">Editorial</option>
              <option value="energetic">Dinámica</option>
            </select>
          </Field>
          <Field label="Título de bienvenida">
            <input
              value={draft.loginTitle}
              onChange={(e) => update('loginTitle', e.target.value)}
              maxLength={150}
            />
          </Field>
          <Field label="Texto de bienvenida">
            <textarea
              value={draft.loginDescription}
              onChange={(e) => update('loginDescription', e.target.value)}
              maxLength={1000}
            />
          </Field>
          <Field label="Imagen de bienvenida">
            <input
              value={draft.heroImageUrl}
              onChange={(e) => update('heroImageUrl', e.target.value)}
            />
          </Field>
        </div>
        {action.notices}
        <div className="row">
          <button className="button" onClick={() => setPreview((value) => !value)}>
            Vista previa privada
          </button>
          <button
            className="button"
            disabled={blocked || action.busy}
            onClick={() => void save(false)}
          >
            Guardar borrador
          </button>
          <button
            className="button primary"
            disabled={blocked || action.busy}
            onClick={() => void save(true)}
          >
            Publicar diseño
          </button>
        </div>
        {preview && (
          <BrandThemeProvider context={{ ...context, theme: draft }} metadata={false}>
            <div className="card access-intro">
              <p className="eyebrow">VISTA PREVIA PRIVADA</p>
              <h2>{draft.loginTitle || draft.brand.name}</h2>
              <p>{draft.loginDescription}</p>
              <button type="button" className="button primary">
                Ingresar
              </button>
            </div>
          </BrandThemeProvider>
        )}
        <Field label="Volver a una versión publicada">
          <select
            value={restoreVersion}
            disabled={action.busy}
            onChange={(event) => setRestoreVersion(event.target.value)}
          >
            <option value="" disabled>
              Elegir versión
            </option>
            {versions.map((version) => (
              <option key={version} value={version}>
                Versión {version}
              </option>
            ))}
          </select>
        </Field>
        <button
          className="button"
          disabled={blocked || action.busy || !restoreVersion}
          onClick={() =>
            void action.run(async () => {
              try {
                const result = await client.theme.restore(orgId, {
                  expectedRevision: local.savedRevision(),
                  version: Number(restoreVersion),
                })
                acceptState(result.theme)
              } catch (error) {
                if (!local.isCurrent()) return
                if (error instanceof ApiError && error.status === 409) {
                  setConflict(true)
                  await readLatest()
                }
                throw error
              }
            }, 'Versión restaurada como nueva publicación.')
          }
        >
          Restaurar diseño
        </button>
      </fieldset>
    </section>
  )
}

function Modules({ orgId, onRefresh }: { orgId: string; onRefresh: () => void }) {
  const client = useAccountClient(),
    action = useAction()
  const resource = useLoad((signal) => client.withSignal(signal).modules.get(orgId), orgId)
  return (
    <section className="card" style={{ marginTop: 24 }}>
      <h2>Funciones de la marca y esta sede</h2>
      <p>
        Desactivar conserva registros y medios históricos. La sede puede limitar lo que la marca
        tiene habilitado.
      </p>
      <Notice error>{resource.error}</Notice>
      {action.notices}
      {resource.data &&
        MODULE_IDS.map((module) => {
          const config = resource.data!.configuration.find((c) => c.module === module)
          return (
            <div className="row spread" key={module} style={{ marginBlock: 16 }}>
              <strong>{moduleNames[module]}</strong>
              <label>
                <input
                  type="checkbox"
                  checked={config?.brandEnabled ?? false}
                  disabled={action.busy || !config?.platformEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    void action.run(async () => {
                      await client.modules.updateBrand(orgId, { module, enabled })
                      resource.reload()
                      onRefresh()
                    })
                  }}
                />{' '}
                Marca
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={resource.data!.modules[module]}
                  disabled={action.busy || !config?.platformEnabled || !config.brandEnabled}
                  onChange={(e) => {
                    const enabled = e.target.checked
                    void action.run(async () => {
                      await client.modules.update(orgId, { module, enabled })
                      resource.reload()
                      onRefresh()
                    })
                  }}
                />{' '}
                Sede actual
              </label>
            </div>
          )
        })}
    </section>
  )
}

function Operations({ orgId, branchId }: { orgId: string; branchId: string }) {
  const client = useAccountClient(),
    action = useAction()
  const resource = useLoad(async (signal) => {
    const api = client.withSignal(signal)
    return {
      ...(await api.branches.list(orgId)),
      ...(await api.equipment.listUnits(orgId)),
      ...(await api.assignments.list(orgId)),
      ...(await api.availability.get(orgId)),
      ...(await api.catalog.listExercises(orgId)),
      ...(await api.equipment.listMachines(orgId)),
    }
  }, `${orgId}/${branchId}`)
  const [target, setTarget] = useState('')
  const [source, setSource] = useState(branchId)
  const available = useLoad(async (signal) => {
    const api = client.withContext(source, 'admin').withSignal(signal)
    return {
      ...(await api.catalog.listExercises(orgId)),
      ...(await api.equipment.listMachines(orgId)),
    }
  }, `${orgId}/${source}`)
  async function change(kind: 'machine' | 'exercise', resourceId: string, enabled: boolean) {
    await action.run(async () => {
      await client.availability.update(orgId, { kind, resourceId, enabled })
      resource.reload()
      available.reload()
    })
  }
  return (
    <section className="card form-stack" style={{ marginTop: 24 }}>
      <h2>Catálogo y actividad de esta sede</h2>
      <Notice error>{resource.error || available.error}</Notice>
      {action.notices}
      <Field label="Biblioteca de origen">
        <select value={source} onChange={(e) => setSource(e.target.value)}>
          {resource.data?.branches
            .filter((b) => b.status === 'active')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </select>
      </Field>
      <p>
        Compartir permite seleccionar el contenido en esta sede. La edición permanece en la sede de
        origen. Ocultar no modifica rutinas ya asignadas.
      </p>
      {available.data &&
        [
          ...available.data.machines.map((item) => ({ ...item, kind: 'machine' as const })),
          ...available.data.exercises.map((item) => ({ ...item, kind: 'exercise' as const })),
        ].map((item) => (
          <div className="row spread" key={`${item.kind}/${item.id}`}>
            <span>
              {item.name} · {item.kind === 'machine' ? 'Modelo' : 'Ejercicio'}
            </span>
            <button
              className="button small"
              disabled={action.busy}
              onClick={() => void change(item.kind, item.id, true)}
            >
              Disponible aquí
            </button>
            <button
              className="text-button"
              disabled={action.busy}
              onClick={() => void change(item.kind, item.id, false)}
            >
              Ocultar aquí
            </button>
          </div>
        ))}
      {resource.data?.availability
        .filter((a) => !a.enabled)
        .map((a) => (
          <div className="row spread" key={`${a.kind}/${a.resourceId}`}>
            <span>{a.kind === 'machine' ? 'Modelo oculto' : 'Ejercicio oculto'}</span>
            <button
              className="text-button"
              disabled={action.busy}
              onClick={() => void change(a.kind, a.resourceId, true)}
            >
              Volver a habilitar
            </button>
          </div>
        ))}
      <h3>Finalizar asignaciones antes de un traslado</h3>
      {resource.data?.assignments
        .filter((a) => a.active !== false)
        .map((a) => (
          <div className="row spread" key={a.id}>
            <span>
              {a.memberName} · {a.program.name}
            </span>
            <button
              className="button small"
              disabled={action.busy}
              onClick={() =>
                void action.run(async () => {
                  await client.assignments.retire(orgId, a.id)
                  resource.reload()
                }, 'Asignación finalizada. El historial se conserva.')
              }
            >
              Finalizar asignación
            </button>
          </div>
        ))}
      <h3>Trasladar equipamiento</h3>
      <p>
        Finalizá las asignaciones activas de origen antes del traslado. La ficha se retira del
        público hasta prepararla en destino.
      </p>
      <Field label="Sede de destino">
        <select value={target} onChange={(e) => setTarget(e.target.value)}>
          <option value="">Elegir destino</option>
          {resource.data?.branches
            .filter((b) => b.id !== branchId && b.status === 'active')
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
        </select>
      </Field>
      {resource.data?.units.map((unit) => (
        <div className="row spread" key={unit.id}>
          <span>{unit.label}</span>
          <button
            className="button small"
            disabled={action.busy || !target}
            onClick={() =>
              void action.run(async () => {
                await client.equipment.transfer(orgId, unit.id, {
                  branchId: target,
                  expectedRevision: unit.revision,
                })
                resource.reload()
              }, 'Unidad trasladada. Revisá su publicación en destino.')
            }
          >
            Trasladar
          </button>
        </div>
      ))}
    </section>
  )
}
