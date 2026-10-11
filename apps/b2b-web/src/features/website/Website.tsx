import { ApiError } from '@klisteniapp/b2b-client'
import {
  WebsiteInputSchema,
  type Organization,
  type Website,
  type WebsiteInput,
} from '@klisteniapp/b2b-contracts'
import { useAccountClient, useAccountScope, useLoad } from '@klisteniapp/b2b-react'
import { dateLabel, Field, Notice } from '@klisteniapp/b2b-ui'
import { ContentMedia, FloorPlan } from '@klisteniapp/b2b-ui/content'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  editorDraftKey,
  writeEditorDraft,
  type EditorDraft,
} from '../../shared/editor/editorDraftStorage'
import { Heading } from '../../shared/Heading'
import { useAction } from '../../shared/useAction'
import { AssetEditor } from '../media/AssetEditor'
import { SpaceEditor } from './FloorPlanEditor'
import { discardSavedWebsiteCopy, readWebsiteCopy } from './websiteDraft'

type WebsiteEditorProps = {
  userId: string
  organization: Organization
  website: Website
  active: boolean
  reload: () => void
  floorPlanEnabled?: boolean
  publicPath?: string
}

function CurrentWebsite({ content, orgId }: { content: WebsiteInput; orgId: string }) {
  const client = useAccountClient()
  const units = useLoad((signal) => client.withSignal(signal).equipment.listUnits(orgId), orgId)
  return (
    <div className="subtle" style={{ padding: 18, borderRadius: 12, marginBottom: 16 }}>
      <p className="eyebrow">VERSIÓN ACTUAL DEL SERVIDOR</p>
      <h3>{content.headline || 'Sin título'}</h3>
      <p>{content.introduction || 'Sin presentación.'}</p>
      <h4>Actividades</h4>
      {content.activities.length ? (
        <ul>
          {content.activities.map((activity) => (
            <li key={activity.id}>
              <strong>{activity.name}</strong> · {activity.schedule}
              <p>{activity.description}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p>Sin actividades.</p>
      )}
      <h4>Horarios</h4>
      {content.openingHours.length ? (
        <ul>
          {content.openingHours.map((hours) => (
            <li key={hours.id}>
              {hours.days}: {hours.hours}
            </li>
          ))}
        </ul>
      ) : (
        <p>Sin horarios.</p>
      )}
      <h4>Recursos del borrador actual</h4>
      <ContentMedia assets={content.gallery} />
      {!content.gallery.length && <p>Sin galería.</p>}
      {content.floorPlan ? (
        <>
          <Notice error>{units.error}</Notice>
          <FloorPlan plan={content.floorPlan} units={units.data?.units ?? []} />
        </>
      ) : (
        <p>Sin plano.</p>
      )}
      {content.spatialModel ? (
        <ContentMedia assets={[content.spatialModel]} />
      ) : (
        <p>Sin vista 3D del espacio.</p>
      )}
    </div>
  )
}

export function WebsiteEditor(props: WebsiteEditorProps) {
  return <WebsiteEditorContent key={`${props.userId}/${props.organization.id}`} {...props} />
}

function WebsiteEditorContent({
  userId,
  organization,
  website,
  active,
  reload,
  floorPlanEnabled = true,
  publicPath,
}: WebsiteEditorProps) {
  const client = useAccountClient(),
    action = useAction()
  const { branchId, role } = useAccountScope()
  const backupKey = editorDraftKey(userId, organization.id, 'website', 'website', branchId, role)
  const legacyKey = branchId ? null : `klisteni.b2b.website-copy.v1.${organization.id}.${userId}`
  const [saved, setSaved] = useState(website),
    [draft, setDraft] = useState<WebsiteInput>(website.draft)
  const [reviewing, setReviewing] = useState(false),
    [confirmed, setConfirmed] = useState(false)
  const [newer, setNewer] = useState<Website | null>(null)
  const [localCopy, setLocalCopy] = useState<EditorDraft<WebsiteInput> | null>(() => {
    try {
      return readWebsiteCopy(sessionStorage, backupKey, legacyKey)
    } catch {
      return null
    }
  })
  const [draftRevision, setDraftRevision] = useState<number | null>(website.revision)
  const [copyReviewed, setCopyReviewed] = useState(false)
  const [storageError, setStorageError] = useState('')
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.draft)
  const stale = Boolean(newer && newer.revision > saved.revision)
  const copyConflict = draftRevision !== saved.revision
  const publicUrl = new URL(publicPath ?? `/g/${organization.slug}`, location.origin).href
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  useEffect(() => {
    if (website.revision > saved.revision) {
      setNewer(website)
      setReviewing(false)
      setConfirmed(false)
    }
  }, [website.revision, saved.revision])
  function change(patch: Partial<WebsiteInput>) {
    const next = { ...draft, ...patch }
    try {
      writeEditorDraft(sessionStorage, backupKey, next, draftRevision)
      setStorageError('')
    } catch {
      setStorageError(
        'No pudimos conservar una copia en esta pestaña. Guardá el borrador antes de salir.',
      )
    }
    setDraft(next)
    setConfirmed(false)
    setReviewing(false)
    setCopyReviewed(false)
  }
  async function loadCurrent() {
    await action.run(
      async () => {
        if (dirty) {
          try {
            writeEditorDraft(sessionStorage, backupKey, draft, draftRevision)
          } catch {
            throw new Error(
              'No pudimos conservar una copia local. El borrador sigue en pantalla; no lo reemplazamos.',
            )
          }
          setLocalCopy({ version: 1, value: draft, revision: draftRevision })
        }
        const result = await client.website.get(organization.id)
        if (!mounted.current) return
        setSaved(result.website)
        setDraft(result.website.draft)
        setDraftRevision(result.website.revision)
        setCopyReviewed(false)
        setNewer(null)
        setReviewing(false)
        setConfirmed(false)
        reload()
      },
      dirty
        ? 'Versión actual cargada. Conservamos una copia de tus cambios en esta pestaña.'
        : 'Versión actual cargada. Revisala antes de publicar.',
    )
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (stale || copyConflict) return
    await action.run(async () => {
      const sent: EditorDraft<WebsiteInput> = { version: 1, revision: draftRevision, value: draft }
      const body = WebsiteInputSchema.parse(draft)
      let result: { website: Website }
      try {
        result = await client.website.update(organization.id, {
          ...body,
          expectedRevision: saved.revision,
        })
      } catch (error) {
        if (mounted.current && error instanceof ApiError && error.status === 409) reload()
        throw error
      }
      if (!mounted.current) return
      setSaved(result.website)
      setDraft(result.website.draft)
      setDraftRevision(result.website.revision)
      try {
        discardSavedWebsiteCopy(sessionStorage, backupKey, sent)
        if (legacyKey) sessionStorage.removeItem(legacyKey)
      } catch {
        /* The saved server copy is canonical. */
      }
      setLocalCopy(null)
      setStorageError('')
      setReviewing(false)
      setConfirmed(false)
      reload()
    }, 'Borrador del website guardado. Revisalo antes de publicar.')
  }
  async function publication(publish: boolean) {
    if (stale || copyConflict || (publish && (!confirmed || dirty))) return
    const preserveDraft = !publish && dirty
    await action.run(
      async () => {
        let result: { website: Website }
        try {
          result = await client.website[publish ? 'publish' : 'unpublish'](organization.id, {
            expectedRevision: saved.revision,
          })
        } catch (error) {
          if (mounted.current && error instanceof ApiError && error.status === 409) reload()
          throw error
        }
        if (!mounted.current) return
        setSaved(result.website)
        if (preserveDraft) {
          // With the expected revision accepted, unpublishing changes visibility
          // only. Keep local edits based on the unchanged server draft, updating
          // their revision so a reload can recover them without a false conflict.
          const copy: EditorDraft<WebsiteInput> = {
            version: 1,
            revision: result.website.revision,
            value: draft,
          }
          setLocalCopy(copy)
          try {
            writeEditorDraft(sessionStorage, backupKey, copy.value, copy.revision)
            setStorageError('')
          } catch {
            setStorageError(
              'No pudimos conservar una copia en esta pestaña. Tus cambios siguen en pantalla; guardá el borrador antes de salir.',
            )
          }
        } else setDraft(result.website.draft)
        setDraftRevision(result.website.revision)
        setReviewing(false)
        setConfirmed(false)
        reload()
      },
      publish
        ? 'Website publicado. La web y los QR habilitados ya se pueden visitar.'
        : preserveDraft
          ? 'Website despublicado. Tus cambios sin guardar siguen en el formulario.'
          : 'Website despublicado. Conservamos el borrador para volver a publicarlo.',
    )
  }
  return (
    <>
      <Heading
        title="Tu gimnasio, también en la web."
        description="Presentá actividades, horarios y fotos reales del espacio. Guardá y revisá el borrador; la web cambia cuando lo publicás."
      >
        {saved.publishedRevision !== null && (
          <a className="button" href={publicUrl} target="_blank" rel="noreferrer">
            Abrir website publicado ↗
          </a>
        )}
      </Heading>
      <div className="row" style={{ marginBottom: 20 }}>
        <span className={`pill ${saved.publishedRevision === null ? 'warning' : ''}`}>
          {saved.publishedRevision === null
            ? 'SIN PUBLICAR'
            : `PUBLICADO · REVISIÓN ${saved.publishedRevision}`}
        </span>
        {saved.publishedAt && <span className="small muted">{dateLabel(saved.publishedAt)}</span>}
        {saved.publishedRevision !== null && saved.revision !== saved.publishedRevision && (
          <span className="small muted">Hay un borrador posterior a la publicación.</span>
        )}
      </div>
      {action.notices}
      <Notice error>{storageError}</Notice>
      {stale && (
        <section className="card review-panel">
          <Notice>
            Hay una versión más reciente del website. Invalidamos la revisión anterior para evitar
            publicar contenido desactualizado.
          </Notice>
          {dirty && (
            <p>
              Tu borrador local sigue en pantalla. Al cargar la versión actual, guardamos una copia
              recuperable de estos cambios en esta pestaña.
            </p>
          )}
          <button className="button" disabled={action.busy} onClick={() => void loadCurrent()}>
            {dirty ? 'Conservar copia y cargar versión actual' : 'Cargar versión actual'}
          </button>
        </section>
      )}
      {localCopy && (
        <Notice>
          Tenés una copia local de cambios anteriores.{' '}
          <button
            type="button"
            className="text-button"
            disabled={stale || action.busy}
            onClick={() => {
              setDraft(localCopy.value)
              setDraftRevision(localCopy.revision)
              setCopyReviewed(false)
              setReviewing(false)
              setConfirmed(false)
            }}
          >
            Recuperar mi copia local
          </button>{' '}
          Al guardarla, reemplazará el borrador actual; revisá las diferencias antes.
        </Notice>
      )}
      {copyConflict && (
        <section className="card review-panel" aria-label="Comparar copia local del website">
          <Notice>
            Tu copia parte de{' '}
            {draftRevision === null ? 'una revisión desconocida' : `la revisión ${draftRevision}`};
            el servidor está en la revisión {saved.revision}. Compará la versión actual con tu
            formulario antes de continuar.
          </Notice>
          <CurrentWebsite content={saved.draft} orgId={organization.id} />
          <label className="check" style={{ minHeight: 44 }}>
            <input
              type="checkbox"
              checked={copyReviewed}
              onChange={(event) => setCopyReviewed(event.target.checked)}
            />
            Comparé la versión actual con mi copia local y quiero conservar mis cambios.
          </label>
          <button
            type="button"
            className="button"
            disabled={!copyReviewed || stale || action.busy || !active}
            onClick={() => {
              try {
                writeEditorDraft(sessionStorage, backupKey, draft, saved.revision)
                setStorageError('')
              } catch {
                setStorageError(
                  'No pudimos conservar la copia en esta pestaña. Guardá el borrador antes de salir.',
                )
              }
              setDraftRevision(saved.revision)
              setLocalCopy({ version: 1, revision: saved.revision, value: draft })
              setCopyReviewed(false)
            }}
          >
            Continuar con mi copia revisada
          </button>
        </section>
      )}
      <form className="card form-stack" onSubmit={save}>
        <fieldset disabled={!active || action.busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
          <Field label="Título del website">
            <input
              value={draft.headline}
              maxLength={200}
              onChange={(event) => change({ headline: event.target.value })}
              placeholder={organization.brand.name}
            />
          </Field>
          <Field label="Presentación del espacio">
            <textarea
              value={draft.introduction}
              maxLength={4000}
              rows={4}
              onChange={(event) => change({ introduction: event.target.value })}
            />
          </Field>
          <div className="row spread" style={{ marginTop: 24 }}>
            <h2>Actividades</h2>
            <button
              type="button"
              className="button small"
              disabled={draft.activities.length >= 30}
              onClick={() =>
                change({
                  activities: [
                    ...draft.activities,
                    { id: crypto.randomUUID(), name: '', description: '', schedule: '' },
                  ],
                })
              }
            >
              + Agregar actividad
            </button>
          </div>
          {!draft.activities.length && (
            <p className="muted">Sumá las prácticas y clases que ofrece el gimnasio.</p>
          )}
          {draft.activities.map((activity, index) => (
            <div className="content-row" key={activity.id}>
              <div className="form-grid">
                <Field label={`Nombre de actividad ${index + 1}`}>
                  <input
                    value={activity.name}
                    required
                    maxLength={100}
                    onChange={(event) =>
                      change({
                        activities: draft.activities.map((item) =>
                          item.id === activity.id ? { ...item, name: event.target.value } : item,
                        ),
                      })
                    }
                  />
                </Field>
                <Field label={`Horario de actividad ${index + 1}`}>
                  <input
                    value={activity.schedule}
                    maxLength={300}
                    onChange={(event) =>
                      change({
                        activities: draft.activities.map((item) =>
                          item.id === activity.id
                            ? { ...item, schedule: event.target.value }
                            : item,
                        ),
                      })
                    }
                    placeholder="Ej.: martes y jueves · 18:00"
                  />
                </Field>
              </div>
              <Field label={`Descripción de actividad ${index + 1}`}>
                <textarea
                  value={activity.description}
                  maxLength={1000}
                  onChange={(event) =>
                    change({
                      activities: draft.activities.map((item) =>
                        item.id === activity.id
                          ? { ...item, description: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </Field>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  change({ activities: draft.activities.filter((item) => item.id !== activity.id) })
                }
              >
                Quitar actividad {index + 1}
              </button>
            </div>
          ))}
          <div className="row spread" style={{ marginTop: 24 }}>
            <h2>Horarios de apertura</h2>
            <button
              type="button"
              className="button small"
              disabled={draft.openingHours.length >= 21}
              onClick={() =>
                change({
                  openingHours: [
                    ...draft.openingHours,
                    { id: crypto.randomUUID(), days: '', hours: '' },
                  ],
                })
              }
            >
              + Agregar horario
            </button>
          </div>
          {draft.openingHours.map((hours, index) => (
            <div className="content-row" key={hours.id}>
              <div className="form-grid">
                <Field label={`Días del horario ${index + 1}`}>
                  <input
                    value={hours.days}
                    required
                    maxLength={100}
                    onChange={(event) =>
                      change({
                        openingHours: draft.openingHours.map((item) =>
                          item.id === hours.id ? { ...item, days: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="Lunes a viernes"
                  />
                </Field>
                <Field label={`Horas del horario ${index + 1}`}>
                  <input
                    value={hours.hours}
                    required
                    maxLength={150}
                    onChange={(event) =>
                      change({
                        openingHours: draft.openingHours.map((item) =>
                          item.id === hours.id ? { ...item, hours: event.target.value } : item,
                        ),
                      })
                    }
                    placeholder="07:00 a 22:00"
                  />
                </Field>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  change({
                    openingHours: draft.openingHours.filter((item) => item.id !== hours.id),
                  })
                }
              >
                Quitar horario {index + 1}
              </button>
            </div>
          ))}
          <AssetEditor
            orgId={organization.id}
            value={draft.gallery}
            onChange={(gallery) => change({ gallery })}
            imagesOnly
          />
          {floorPlanEnabled ? (
            <SpaceEditor orgId={organization.id} value={draft} onChange={change} />
          ) : (
            <Notice>
              El plano y la vista del espacio están deshabilitados en esta sede. Su contenido se
              conserva.
            </Notice>
          )}
          <div className="row" style={{ marginTop: 24 }}>
            <button className="button primary" disabled={stale || copyConflict}>
              {action.busy ? 'Guardando…' : 'Guardar borrador del website'}
            </button>
            <button
              type="button"
              className="button"
              disabled={dirty || stale || copyConflict}
              onClick={() => {
                setReviewing(true)
                setConfirmed(false)
              }}
            >
              Revisar website
            </button>
          </div>
          {dirty && (
            <p className="small muted" style={{ marginTop: 12 }}>
              Guardá los cambios para revisar la versión que vas a publicar.
            </p>
          )}
        </fieldset>
      </form>
      {reviewing && (
        <section className="card review-panel">
          <p className="eyebrow">REVISIÓN ANTES DE PUBLICAR</p>
          <h2>{saved.draft.headline || organization.brand.name}</h2>
          <p>{saved.draft.introduction || organization.brand.description}</p>
          <div className="grid two">
            {saved.draft.activities.map((activity) => (
              <article className="card" key={activity.id}>
                <h3>{activity.name}</h3>
                <p>{activity.description}</p>
                <p className="small muted">{activity.schedule}</p>
              </article>
            ))}
          </div>
          {saved.draft.openingHours.length > 0 && (
            <dl className="hours-list">
              {saved.draft.openingHours.map((hours) => (
                <div key={hours.id}>
                  <dt>{hours.days}</dt>
                  <dd>{hours.hours}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="website-gallery">
            {saved.draft.gallery.map((asset) => (
              <figure key={asset.id}>
                <img src={asset.url} alt={asset.label} />
                <figcaption className="small muted">
                  {asset.label}
                  {asset.attribution && ` · ${asset.attribution}`}
                </figcaption>
              </figure>
            ))}
          </div>
          <p className="small muted" style={{ marginTop: 20 }}>
            {publicUrl}
          </p>
          {saved.draft.floorPlan && (
            <section>
              <h3>{saved.draft.floorPlan.title}</h3>
              <p>{saved.draft.floorPlan.description}</p>
              <ContentMedia assets={[saved.draft.floorPlan.image]} />
              <p>
                {saved.draft.floorPlan.points.length} puntos vinculados a unidades. Revisá sus
                posiciones antes de publicar.
              </p>
            </section>
          )}
          {saved.draft.spatialModel && <ContentMedia assets={[saved.draft.spatialModel]} />}
          <label className="check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            Revisé los textos, horarios y fotos de esta versión.
          </label>
          <button
            className="button primary"
            style={{ marginTop: 18 }}
            disabled={!active || action.busy || !confirmed || dirty || stale || copyConflict}
            onClick={() => void publication(true)}
          >
            Publicar website
          </button>
        </section>
      )}
      {saved.publishedRevision !== null && (
        <details style={{ marginTop: 24 }}>
          <summary>Despublicar website</summary>
          <Notice>
            La web y sus fichas de equipos dejarán de estar disponibles desde los QR hasta que
            vuelvas a publicar.
          </Notice>
          <button
            className="button"
            disabled={!active || action.busy || stale || copyConflict}
            onClick={() => void publication(false)}
          >
            Confirmar despublicación
          </button>
        </details>
      )}
    </>
  )
}
