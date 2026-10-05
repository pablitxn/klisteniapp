import { useTranslation } from 'react-i18next'
import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { computePlanProgress, dateInTimeZone, type Exercise, type MuscleId, type PersonalRoutine } from '@klisteniapp/scene-schema'
import {
  exercises,
  muscles,
  getExercise,
  starterRoutine,
} from './data/exercises'
import { computeProgress } from './lib/progress'
import { useAppStore } from './lib/store'
import Icon, { type IconName } from './components/Icon'
import Modal from './components/Modal'
import {
  CardioForm,
  RoutineEditor,
  WorkoutSession,
} from './components/Forms'
import Progress from './components/Progress'
import BodyGuide from './components/BodyGuide'
import ExercisePreview from './components/ExercisePreview'
import ExercisePlanningDetails from './components/ExercisePlanningDetails'
import { instanceMode } from './lib/deployment'
import SettingsPanel, { type SettingsSection } from './components/SettingsPanel'
import { cloudWriteAllowed } from './lib/cloud-access'
import { scrollPageToTop } from './lib/modal-scroll'
const HealthPage = lazy(() => import('./components/HealthPage'))
const AnatomyViewer = lazy(() => import('./components/AnatomyViewer'))
type Page = 'routine' | 'library' | 'anatomy' | 'progress' | 'health'
type Overlay = 'cardio' | 'settings' | 'routine' | null
const pages: { id: Page; label: string; icon: IconName }[] = [
  { id: 'routine', label: 'Mi rutina', icon: 'home' },
  { id: 'library', label: 'Ejercicios', icon: 'book' },
  { id: 'anatomy', label: 'Mi cuerpo', icon: 'body' },
  { id: 'progress', label: 'Mi progreso', icon: 'chart' },
  { id: 'health', label: 'Mi salud', icon: 'heart' },
]

export default function App({ privacyControls, privacySettings, suspended = false }: { privacyControls?: ReactNode; privacySettings?: ReactNode; suspended?: boolean }) {
  const { t } = useTranslation('core')

  const [page, setPage] = useState<Page>('routine')
  const [selectedId, setSelectedId] = useState('squat')
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(() => instanceMode && (new URLSearchParams(location.search).get('account') === 'login' || new URLSearchParams(location.search).get('billing') === 'return') ? 'settings' : null)
  const [settingsSection, setSettingsSection] = useState<SettingsSection>(() => instanceMode && (new URLSearchParams(location.search).get('account') === 'login' || new URLSearchParams(location.search).get('billing') === 'return') ? 'account' : 'appearance')
  const openSettings = (section: SettingsSection = 'appearance') => { setSettingsSection(section); setOverlay('settings') }
  const [session, setSession] = useState<{
    ids: string[]
    sets: number
    routineSnapshot?: PersonalRoutine
    timeZone?: string
  } | null>(null)
  const [query, setQuery] = useState('')
  const [pattern, setPattern] = useState('Todos')
  const [difficulty, setDifficulty] = useState('Todos')
  const [equipment, setEquipment] = useState('all')
  const [lesson, setLesson] = useState<'steps' | 'tips' | 'variants'>('steps')
  const progress = useAppStore((s) => s.progress),
    preferences = useAppStore((s) => s.preferences),
    storageError = useAppStore((s) => s.storageError)
  const userState = useAppStore(s => s.user)
  const user = instanceMode ? userState : null
  const authStatus = useAppStore(s => s.authStatus)
  const personalData = useAppStore(s => s.personalData)
  const access = useAppStore(s => s.access)
  const cloudBlocked = instanceMode && Boolean(user && !cloudWriteAllowed(access))
  const accountLoading = useAppStore(s => s.accountLoading)
  const syncStatus = useAppStore(s => s.syncStatus)
  const pendingCount = useAppStore(s => s.pendingCount)
  const accountError = useAppStore(s => s.accountError)
  const privateUnavailable = instanceMode && (authStatus === 'loading' || Boolean(user && (!personalData || accountLoading)))
  const personalSettings = personalData?.settings
  const displayName = (personalSettings?.profile.displayName || user?.name || '').trim()
  const nameParts = displayName.normalize('NFC').split(/\s+/u).filter(Boolean)
  const userInitials = user && nameParts.length
    ? [nameParts[0]!, ...(nameParts.length > 1 ? [nameParts.at(-1)!] : [])].map(part => Array.from(part)[0]).join('').toLocaleUpperCase()
    : null
  const currentRoutine = personalSettings?.routines.find(r => r.id === personalSettings.activeRoutineId)
  const planStats = personalSettings && computePlanProgress(personalSettings.plans, progress.workouts, dateInTimeZone(new Date(), personalSettings.profile.timeZone))
  const stats = computeProgress(progress.workouts, progress.cardio, personalSettings ? new Date(`${dateInTimeZone(new Date(), personalSettings.profile.timeZone)}T12:00:00`) : new Date())
  const exercise = getExercise(selectedId) ?? exercises[0]!
  const normalizeSearch = (value: string) => value.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
  const libraryExercises = exercises.filter((item) =>
    (pattern === 'Todos' || item.pattern === pattern) &&
    (difficulty === 'Todos' || item.difficulty === difficulty) &&
    (equipment === 'all' || item.equipment === equipment) &&
    normalizeSearch(`${item.name} ${item.shortName} ${t(item.name)} ${t(item.shortName)} ${item.englishName} ${item.pattern} ${t(item.pattern)} ${[...item.primaryMuscles, ...item.secondaryMuscles].map((id) => `${muscles[id].name} ${t(muscles[id].name)}`).join(' ')}`)
      .includes(normalizeSearch(query)),
  )
  const libraryFiltered = Boolean(query || pattern !== 'Todos' || difficulty !== 'Todos' || equipment !== 'all')
  const routine = preferences.exerciseIds
    .map(getExercise)
    .filter((e): e is Exercise => Boolean(e))
  const selectedInfo = selectedMuscle
    ? muscles[selectedMuscle as MuscleId]
    : null
  const choose = (id: string) => {
    setSelectedId(id)
    setSelectedMuscle(null)
    setLesson('steps')
  }
  const navigate = (next: Page) => {
    setPage(next)
    setSelectedMuscle(null)
    scrollPageToTop()
  }
  const openExercise = (id: string) => {
    choose(id)
    setPage('routine')
    scrollPageToTop()
  }
  useEffect(() => {
    if (suspended) return
    document.title = `${t(pages.find((p) => p.id === page)!.label)} · Klisteni`
  }, [page, t, suspended])
  useEffect(() => {
    // Keep the one-time intent until session discovery chooses the final App key.
    if (!instanceMode || authStatus === 'loading') return
    const url = new URL(location.href)
    if (url.searchParams.get('account') === 'login' || url.searchParams.get('billing') === 'return') {
      url.searchParams.delete('account')
      url.searchParams.delete('billing')
      history.replaceState(history.state, '', `${url.pathname}${url.search}${url.hash}`)
    }
  }, [authStatus])
  const descriptions = {
    routine: t("Seguí tu rutina, entendé cada ejercicio y descubrí cómo progresar."),
    library: t("Conocé el movimiento antes de sumar repeticiones."),
    anatomy: t("Aprendé qué trabaja y cómo se complementa."),
    progress: t("Lo que cuenta es volver, a tu ritmo."),
    health: t("Tu punto de partida, tus registros y tus próximos pasos."),
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">{t("Ir al contenido")}</a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate('routine')}
          aria-label={t("Klisteni, ir a mi rutina")}
        >
          <span className="brand-mark">
            <span />
            <span />
            <span />
          </span>
          <span>
            klisteni<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="sidebar-label">{t("TU ESPACIO DE MOVIMIENTO")}</div>
        <nav aria-label={t("Navegación principal")}>
          {pages.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? 'active' : ''}`}
              onClick={() => navigate(p.id)}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <Icon name={p.icon} />
              <span>{t(p.label)}</span>
              {page === p.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-card">
            <span className="little-orbit">
              <Icon name="spark" size={22} />
            </span>
            <small>{t("UN MOVIMIENTO A LA VEZ")}</small>
            <strong>{t("Empezar también")}<br />{t("es progresar.")}</strong>
            <p>{t("Tu única comparación:")}<br />{t("vos, ayer.")}</p>
          </div>
          <button className="nav-item" onClick={() => openSettings()}>
            <Icon name="sliders" />
            <span>{t("Ajustes")}</span>
          </button>
          <div className="local-badge">
            <span />{' '}
            {user ? (syncStatus === 'saving' ? t("Guardando en tu cuenta…") : pendingCount ? t("{{count}} envíos pendientes", { count: pendingCount }) : privateUnavailable ? t("Conectando con tu cuenta…") : cloudBlocked ? t("Nube pausada · datos disponibles") : t("Sincronizado con tu cuenta")) : storageError
              ? t("Pendiente de guardar")
              : t("Guardado en este dispositivo")}
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="breadcrumb">{t("Tu práctica")}<span>/</span> {t(pages.find((p) => p.id === page)!.label)}
          </span>
          <span className="mobile-brand">klisteni.</span>
          <div className="topbar-right">
            {instanceMode && !user && <button className="text-button account-login" onClick={() => openSettings('account')} disabled={Boolean(session)}>{t("Iniciar sesión")}</button>}
            <button
              id="open-settings"
              className="profile-button"
              aria-label={t("Abrir ajustes")}
              onClick={() => openSettings()}
            >
              <span aria-hidden="true">{userInitials ?? <Icon name="sliders" size={21} />}</span>
            </button>
          </div>
        </header>
        <main id="main">
          {privacyControls}
          {instanceMode && (privateUnavailable || cloudBlocked || pendingCount > 0 || accountError) && <div className="account-notice">
            {privateUnavailable && <p role="status">{t(authStatus === 'loading' ? "Verificando tu sesión… Podés explorar el catálogo mientras esperamos." : "Tu práctica todavía no está disponible. Esperá la conexión antes de registrar cambios.")}</p>}
            {cloudBlocked && <p>{t("Podés consultar y exportar tus datos. Abrí tu cuenta para renovar o seguir gratis en modo local.")} <button className="text-button" onClick={() => openSettings('account')}>{t("Mi cuenta y planificación")}</button></p>}
            {(pendingCount > 0 || accountError) && user && <button className="text-button" onClick={() => void useAppStore.getState().refreshState()}>{t("Reintentar sincronización")}</button>}
            {accountError && user && <span role="alert">{accountError}</span>}
            {accountError?.includes('cerrar la sesión') && !user && <><span role="alert">{accountError}</span><button className="text-button" onClick={() => void useAppStore.getState().signOut()}>{t("Reintentar cierre de sesión")}</button></>}
          </div>}
          {page === 'routine' && instanceMode && planStats && personalSettings?.plans.length !== 0 && <div className="plan-summary">
            <div><strong>{t("{{completed}} / {{target}} días de fuerza esta semana", { completed: planStats.weeklyCompleted, target: planStats.weeklyTarget })}</strong><p>{t("{{count}} semanas cumpliendo tu plan. Los días de descanso no cortan tu racha.", { count: planStats.fulfilledWeeksStreak })}</p></div>
            <button className="text-button" onClick={() => openSettings('account')} disabled={Boolean(session)}>{t("Mi planificación")}</button>
          </div>}
          {storageError && (
            <div className="storage-warning" role="alert">
              <Icon name="info" />
              {storageError}
            </div>
          )}
          <section className="page-heading">
            <div>
              <span className="eyebrow">{t("APRENDÉ. MOVETE. REPETÍ.")}</span>
              <h1>
                {page === 'routine' ? (
                  <>{t("Hacé lugar")}<br className="mobile-break" /> {t("al movimiento.")}</>
                ) : page === 'library' ? (
                  t("Cada movimiento tiene su porqué.")
                ) : page === 'anatomy' ? (
                  t("Conocé tu cuerpo.")
                ) : page === 'health' ? (
                  t("Conocerte también es cuidarte.")
                ) : (
                  t("Cada paso cuenta.")
                )}
              </h1>
              <p>{descriptions[page]}</p>
            </div>
          </section>
          {page === 'routine' && <div className="stats-bar">
            <div>
              <span className="stat-icon peach">
                <Icon name="fire" />
              </span>
              <span>
                <strong>
                  {stats.streak}{' '}
                  <small>{stats.streak === 1 ? t("día") : t("días")}</small>
                </strong>
                <span>{t("Racha de movimiento")}</span>
              </span>
            </div>
            <div>
              <span className="stat-icon purple">
                <Icon name="target" />
              </span>
              <span>
                <strong>
                  {user && planStats?.weeklyTarget ? planStats.weeklyCompleted : stats.weeklyWorkouts}
                  {(!user || Boolean(planStats?.weeklyTarget)) && <small> / {user ? planStats?.weeklyTarget : preferences.weeklyGoal}</small>}
                </strong>
                <span>{user && planStats?.weeklyTarget ? t("Días de fuerza esta semana") : t("Sesiones esta semana")}</span>
              </span>
              <span className="mini-bars">
                {Array.from({ length: user ? planStats?.weeklyTarget ?? 0 : preferences.weeklyGoal }, (_, i) => (
                  <i
                    className={i < (user ? planStats?.weeklyCompleted ?? 0 : stats.weeklyWorkouts) ? 'filled' : ''}
                    key={i}
                  />
                ))}
              </span>
            </div>
            <div>
              <span className="stat-icon green">
                <Icon name="walk" />
              </span>
              <span>
                <strong>
                  {stats.weeklyCardioMinutes}
                  <small> min</small>
                </strong>
                <span>{t("Aeróbico esta semana")}</span>
              </span>
            </div>
            <div className="level-stat">
              <span className="stat-icon yellow">
                <Icon name="spark" />
              </span>
              <span>
                <strong>{t("Nivel")} {stats.level}
                  <small> · {stats.xp} XP</small>
                </strong>
                <span>{t("Construyendo el hábito")}</span>
              </span>
            </div>
          </div>}
          {page === 'routine' && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{t("TU PUNTO DE PARTIDA")}</span>
                  <h2>{t("Mi rutina de hoy")}</h2>
                </div>
                <button
                  className="text-button"
                  disabled={Boolean(session) || privateUnavailable}
                  onClick={() => setOverlay('routine')}
                >
                  <Icon name="edit" size={16} /> {t("Personalizar")}</button>
              </div>
              <div className="routine-meta">
                <span>
                  <Icon name="body" size={15} /> {t("Cuerpo completo · base inicial")}</span>
                <span>
                  <Icon name="clock" size={15} /> {t("A tu ritmo")}</span>
                <span>{t("Sin equipo")}</span>
                <span>
                  {preferences.sets}{' '}
                  {preferences.sets === 1 ? t("serie") : t("series")} {t("por ejercicio")}</span>
              </div>
              <details className="warmup-note">
                <summary>
                  <Icon name="spark" size={15} /> {t("Consejos antes de empezar")}</summary>
                <p>{starterRoutine.warmup}</p>
                <p>{starterRoutine.effort}</p>
                <p>{starterRoutine.progression}</p>
              </details>
              <div className="routine-layout">
                <div className="routine-selection">
                <aside
                  className="exercise-list"
                  aria-label={t("Ejercicios de tu rutina")}
                >
                  {routine.map((e, i) => (
                    <button
                      key={e.id}
                      onClick={() => choose(e.id)}
                      className={`exercise-row ${e.id === selectedId ? 'selected' : ''}`}
                      aria-pressed={e.id === selectedId}
                    >
                      <span className="exercise-thumb">
                        <ExercisePreview
                          id={e.id}
                          active={e.id === selectedId}
                        />
                      </span>
                      <span className="exercise-row-copy">
                        <span className="exercise-number">
                          {String(i + 1).padStart(2, '0')}{' '}
                          <span>· {t(e.pattern)}</span>
                        </span>
                        <strong>{t(e.shortName)}</strong>
                        <small>
                          {preferences.sets} × {e.reps.min}–{e.reps.max}
                          {e.reps.perSide ? t(" / lado") : ''}
                        </small>
                      </span>
                      <Icon name="chevron" size={15} />
                    </button>
                  ))}
                </aside>
                  <button
                    className="primary-button routine-start"
                    disabled={Boolean(session) || privateUnavailable}
                    onClick={() => {
                      setSession({
                        ids: preferences.exerciseIds,
                        sets: preferences.sets,
                        routineSnapshot: currentRoutine ? structuredClone(currentRoutine) : undefined,
                        timeZone: personalSettings?.profile.timeZone,
                      })
                      choose(preferences.exerciseIds[0]!)
                    }}
                  >
                    <Icon name="play" size={17} /> {t("Empezar mi rutina")}{' '}
                    <Icon name="arrow" size={18} />
                  </button>
                  <div className="routine-footnote">
                    <Icon name="info" size={16} />
                    <p>{t("Dejá un día de descanso entre sesiones de fuerza. La técnica va primero.")}</p>
                  </div>
                </div>
                <div className="workbench">
                  <div className="workbench-title">
                    <div>
                      <span className="pill">{t(exercise.pattern)}</span>
                      <h3>{t(exercise.name)}</h3>
                      <p>{exercise.englishName}</p>
                      {exercise.equipment !== 'none' && (
                        <span className="equipment-note">{t("Necesita barra o anillas")}{!preferences.exerciseIds.includes(exercise.id) && t(" · fuera de tu rutina")}
                        </span>
                      )}
                    </div>
                    <span className="exercise-difficulty">
                      <span /> {t(exercise.difficulty)}
                    </span>
                  </div>
                  {exercise.note && (
                    <p className="exercise-note">{exercise.note}</p>
                  )}
                  <div className="demonstration">
                    <div className="viewer-wrap">
                      <Suspense
                        fallback={
                          <div className="viewer-loading">{t("Preparando tu espacio 3D…")}</div>
                        }
                      >
                        <AnatomyViewer
                          exerciseId={exercise.id}
                          primaryMuscles={exercise.primaryMuscles}
                          secondaryMuscles={exercise.secondaryMuscles}
                          selectedMuscle={selectedMuscle}
                          onSelectMuscle={setSelectedMuscle}
                          reducedMotion={preferences.reducedMotion || suspended}
                        />
                      </Suspense>
                    </div>
                    <div className="muscle-panel">
                      <span className="eyebrow">{t("¿QUÉ ESTÁS TRABAJANDO?")}</span>
                      <h4>{t("Conectá con")}<br />{t("el movimiento.")}</h4>
                      <p>{exercise.description}</p>
                      <MuscleButtons
                        exercise={exercise}
                        selected={selectedMuscle}
                        onSelect={setSelectedMuscle}
                      />
                      {selectedInfo && (
                        <div className="muscle-definition">
                          <strong>{t(selectedInfo.name)}</strong>
                          <p>{selectedInfo.description}</p>
                        </div>
                      )}
                      <div className="muscle-tip">
                        <Icon name="info" size={15} />
                        <span>{t("Tocá un músculo para ubicarlo en el modelo.")}</span>
                      </div>
                    </div>
                  </div>
                  <div className="lesson">
                    <div
                      className="lesson-tabs"
                      role="tablist"
                      aria-label={t("Guía del ejercicio")}
                    >
                      {(
                        [
                          { id: 'steps', label: t("Cómo se hace") },
                          { id: 'tips', label: t("Claves de técnica") },
                          { id: 'variants', label: t("A tu nivel") },
                        ] as const
                      ).map((tab) => (
                        <button
                          role="tab"
                          aria-selected={lesson === tab.id}
                          aria-controls="lesson-panel"
                          id={`tab-${tab.id}`}
                          key={tab.id}
                          onClick={() => setLesson(tab.id)}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div
                      id="lesson-panel"
                      role="tabpanel"
                      aria-labelledby={`tab-${lesson}`}
                    >
                      {lesson === 'steps' ? (
                        <>
                          <div className="setup-line">
                            <strong>{t("Preparación")}</strong>{' '}
                            {exercise.setup.join(' ')}
                          </div>
                          <ol className="movement-steps">
                            {exercise.steps.map((step, i) => (
                              <li key={step}>
                                <span>{i + 1}</span>
                                {step}
                              </li>
                            ))}
                          </ol>
                        </>
                      ) : lesson === 'tips' ? (
                        <div className="tips-grid">
                          <div>
                            <h4>{t("Buscá esto")}</h4>
                            {exercise.cues.map((cue) => (
                              <p key={cue}>
                                <Icon name="check" size={16} />
                                {cue}
                              </p>
                            ))}
                          </div>
                          <div>
                            <h4>{t("Evitá esto")}</h4>
                            {exercise.mistakes.map((mistake) => (
                              <p key={mistake}>
                                <Icon name="close" size={16} />
                                {mistake}
                              </p>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="variants-grid">
                          <div>
                            <small>{t("UN POCO MÁS FÁCIL")}</small>
                            <h4>{exercise.easier.name}</h4>
                            <p>{exercise.easier.description}</p>
                          </div>
                          <div>
                            <small>{t("CUANDO DOMINES LA BASE")}</small>
                            <h4>{exercise.harder.name}</h4>
                            <p>{exercise.harder.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <ExercisePlanningDetails exercise={exercise} onExplore={choose} />
                    <div className="exercise-footer">
                      <span>
                        <Icon name="clock" size={14} /> {t("Descanso orientativo:")}{' '}
                        {exercise.restSeconds} s
                      </span>
                      <details>
                        <summary>{t("Fuentes del ejercicio")}</summary>
                        {exercise.sources.map((source) => (
                          <a
                            key={source.url}
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {source.title} ↗
                          </a>
                        ))}
                      </details>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bottom-cards">
                <div className="balance-card">
                  <span className="stat-icon purple">
                    <Icon name="body" />
                  </span>
                  <div>
                    <h3>{t("Los ejercicios se complementan.")}</h3>
                    <p>{t("Empuje, piernas, cadera y abdomen construyen tu base. El trabajo escapular ayuda al control de espalda; para sumar una tracción con carga vas a necesitar equipo.")}</p>
                    <button
                      className="text-button"
                      onClick={() => navigate('anatomy')}
                    >{t("Entender mi rutina")}<Icon name="arrow" size={16} />
                    </button>
                  </div>
                </div>
                <div className="cardio-card">
                  <span className="stat-icon green">
                    <Icon name="walk" />
                  </span>
                  <div>
                    <h3>{t("Hay movimiento fuera de la rutina.")}</h3>
                    <p>{t("Una caminata, una vuelta en bici, un trote. Tu actividad aeróbica también tiene lugar acá.")}</p>
                    <button
                      className="text-button"
                      onClick={() => setOverlay('cardio')}
                      disabled={privateUnavailable}
                    >{t("Registrar actividad")}<Icon name="plus" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          {page === 'library' && (
            <section className="library-section">
              <div className="library-tools">
                <label className="search-input">
                  <Icon name="search" />
                  <input
                    placeholder={t("Buscar ejercicio o músculo…")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label={t("Buscar ejercicio o músculo")}
                  />
                </label>
                <div className="filter-pills">
                  {['Todos', ...new Set(exercises.map((e) => e.pattern))].map(
                    (p) => (
                      <button
                        key={p}
                        className={pattern === p ? 'selected' : ''}
                        aria-pressed={pattern === p}
                        onClick={() => setPattern(p)}
                      >
                        {t(p)}
                      </button>
                    ),
                  )}
                </div>
                <div className="library-refinements">
                  <label>{t("Nivel")}<select value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
                      <option value="Todos">{t("Todos los niveles")}</option>
                      <option value="Inicial">{t("Inicial")}</option>
                      <option value="Intermedio">{t("Intermedio")}</option>
                    </select>
                  </label>
                  <label>{t("Equipo")}<select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
                      <option value="all">{t("Todo el equipo")}</option>
                      <option value="none">{t("Sin equipo")}</option>
                      <option value="bar-or-rings">{t("Barra o anillas")}</option>
                    </select>
                  </label>
                  {libraryFiltered && <button className="text-button" onClick={() => {
                    setQuery(''); setPattern('Todos'); setDifficulty('Todos'); setEquipment('all')
                  }}>{t("Limpiar filtros")}</button>}
                </div>
                <p className="library-count" role="status">{t("{{count}} de {{total}} ejercicios", { count: libraryExercises.length, total: exercises.length })}</p>
              </div>
              <div className="library-grid">
                {libraryExercises.map((e) => (
                    <button
                      className="library-card"
                      key={e.id}
                      onClick={() => openExercise(e.id)}
                    >
                      <div className="library-visual">
                        <ExercisePreview id={e.id} />
                        <span className="pill">{t(e.difficulty)}</span>
                      </div>
                      <div className="library-card-content">
                        <small>
                          {t(e.pattern)} ·{' '}
                          {e.equipment === 'none'
                            ? t("Sin equipo")
                            : t("Necesita barra o anillas")}
                        </small>
                        <h3>{t(e.name)}</h3>
                        <p>{e.description}</p>
                        <span>{t("Explorar movimiento")}<Icon name="arrow" size={17} />
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
              {libraryExercises.length === 0 && (
                <div className="empty-state">
                  <h3>{t("No encontramos ese movimiento.")}</h3>
                  <p>{t("Probá con otro nombre o limpiá los filtros de movimiento, nivel y equipo.")}</p>
                </div>
              )}
            </section>
          )}
          {page === 'anatomy' && <BodyGuide routine={routine} onOpenExercise={openExercise} />}
          {page === 'progress' && (
            <Progress
              onCardio={() => { if (!privateUnavailable) setOverlay('cardio') }}
              onStart={() => navigate('routine')}
            />
          )}
          {page === 'health' && <Suspense fallback={<p role="status">{t("Cargando tu espacio de salud…")}</p>}>
            <HealthPage onSignIn={() => openSettings('account')} />
          </Suspense>}

        </main>
      </div>
      <nav className="mobile-nav" aria-label={t("Navegación móvil")}>
        {pages.map((p) => (
          <button
            key={p.id}
            aria-current={page === p.id ? 'page' : undefined}
            className={page === p.id ? 'active' : ''}
            onClick={() => navigate(p.id)}
          >
            <Icon name={p.icon} size={21} />
            <span>{t(p.label)}</span>
          </button>
        ))}
      </nav>
      {overlay === 'cardio' && (
        <Modal title={t("Cada movimiento suma")} onClose={() => setOverlay(null)}>
          <CardioForm
            onDone={() => {
              setOverlay(null)
              navigate('progress')
            }}
          />
        </Modal>
      )}
      {overlay === 'settings' && (
        <Modal
          title={t("Configuración", { ns: 'settings' })}
          wide
          suspended={suspended}
          onClose={() => setOverlay(null)}
        >
          <SettingsPanel section={settingsSection} onSectionChange={setSettingsSection} privacySettings={privacySettings} onClose={() => setOverlay(null)} />
        </Modal>
      )}
      {overlay === 'routine' && (
        <Modal title={t("Armá tu rutina")} onClose={() => setOverlay(null)}>
          <RoutineEditor onDone={() => setOverlay(null)} />
        </Modal>
      )}
      {session && (
        <WorkoutSession
          plan={session}
          onSelect={choose}
          onClose={() => setSession(null)}
          onComplete={() => {
            setSession(null)
            navigate('progress')
          }}
        />
      )}
    </div>
  )
}
function MuscleButtons({
  exercise,
  selected,
  onSelect,
}: {
  exercise: Exercise
  selected: string | null
  onSelect: (id: string | null) => void
}) {
  const { t } = useTranslation('core')

  return (
    <div className="muscle-groups">
      {[
        {
          label: t("Protagonistas"),
          ids: exercise.primaryMuscles,
          className: 'primary',
        },
        {
          label: t("Acompañan y estabilizan"),
          ids: exercise.secondaryMuscles,
          className: 'secondary',
        },
      ].map((group) => (
        <div key={group.label}>
          <span className={`muscle-group-label ${group.className}`}>
            <i />
            {group.label}
          </span>
          <div className="muscle-chips">
            {group.ids.map((id) => (
              <button
                className={selected === id ? 'selected' : ''}
                key={id}
                onClick={() => onSelect(selected === id ? null : id)}
                aria-pressed={selected === id}
              >
                {t(muscles[id].name)}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
