import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import type { Exercise, MuscleId } from '@klisteniapp/scene-schema'
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
  PreferencesForm,
  RoutineEditor,
  WorkoutSession,
} from './components/Forms'
import Progress from './components/Progress'
const AnatomyViewer = lazy(() => import('./components/AnatomyViewer'))
type Page = 'routine' | 'library' | 'anatomy' | 'progress'
type Overlay = 'cardio' | 'settings' | 'routine' | null
const pages: { id: Page; label: string; icon: IconName }[] = [
  { id: 'routine', label: 'Mi rutina', icon: 'home' },
  { id: 'library', label: 'Ejercicios', icon: 'book' },
  { id: 'anatomy', label: 'Mi cuerpo', icon: 'body' },
  { id: 'progress', label: 'Mi progreso', icon: 'chart' },
]

function ExerciseGlyph({ id }: { id: string }) {
  const forms: Record<string, string> = {
    squat:
      'M35 16a5 5 0 1 0 0-10a5 5 0 1 0 0 10M34 21l-5 15 14 7-10 14m-4-21-12 8 6 13m9-31 14 7 9-6',
    pushup:
      'M45 27a5 5 0 1 0 0-10a5 5 0 1 0 0 10M40 30 22 40 12 40m10 0 9 12h11m-2-22 9 10-3 12h10',
    'glute-bridge':
      'M12 49a5 5 0 1 0 0-10a5 5 0 1 0 0 10M19 44l19-18 13 20h8M22 44h16m0-18 4 21',
    'dead-bug':
      'M16 48a5 5 0 1 0 0-10a5 5 0 1 0 0 10M23 44h22l6-19-13-4M28 44l-2-21m19 21 12-9-5-12',
    'prone-w':
      'M49 39a5 5 0 1 0 0-10a5 5 0 1 0 0 10M43 41 21 46 7 44m14 2-10 7m32-12-10-11 10-7m0 18-8 10 9 6',
    'calf-raise':
      'M34 16a5 5 0 1 0 0-10a5 5 0 1 0 0 10M34 21v20m0-18-12 15m12-15 12 15M34 41l-5 17 6 1m-1-18 6 17 6 1',
    row: 'M47 27a5 5 0 1 0 0-10a5 5 0 1 0 0 10M41 30 23 41 8 48m28-14-5-13 11-8M23 41l9 10',
  }
  return (
    <svg viewBox="0 0 68 68" aria-hidden="true">
      <path
        d={forms[id] ?? forms.squat}
        fill="none"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
export default function App({ privacyControls, suspended = false }: { privacyControls?: ReactNode; suspended?: boolean }) {
  const [page, setPage] = useState<Page>('routine')
  const [selectedId, setSelectedId] = useState('squat')
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null)
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [session, setSession] = useState<{
    ids: string[]
    sets: number
  } | null>(null)
  const [query, setQuery] = useState('')
  const [pattern, setPattern] = useState('Todos')
  const [lesson, setLesson] = useState<'steps' | 'tips' | 'variants'>('steps')
  const progress = useAppStore((s) => s.progress),
    preferences = useAppStore((s) => s.preferences),
    storageError = useAppStore((s) => s.storageError)
  const stats = computeProgress(progress.workouts, progress.cardio)
  const exercise = getExercise(selectedId) ?? exercises[0]!
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
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const openExercise = (id: string) => {
    choose(id)
    setPage('routine')
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  useEffect(() => {
    document.title = `${pages.find((p) => p.id === page)?.label} · Klisteni`
  }, [page])
  const descriptions = {
    routine: 'Un poco de práctica. Mucho por descubrir.',
    library: 'Conocé el movimiento antes de sumar repeticiones.',
    anatomy: 'Aprendé qué trabaja y cómo se complementa.',
    progress: 'Lo que cuenta es volver, a tu ritmo.',
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <aside className="sidebar">
        <button
          className="brand"
          onClick={() => navigate('routine')}
          aria-label="Klisteni, ir a mi rutina"
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
        <div className="sidebar-label">TU ESPACIO DE MOVIMIENTO</div>
        <nav aria-label="Navegación principal">
          {pages.map((p) => (
            <button
              key={p.id}
              className={`nav-item ${page === p.id ? 'active' : ''}`}
              onClick={() => navigate(p.id)}
              aria-current={page === p.id ? 'page' : undefined}
            >
              <Icon name={p.icon} />
              <span>{p.label}</span>
              {page === p.id && <span className="nav-active-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="journey-card">
            <span className="little-orbit">
              <Icon name="spark" size={22} />
            </span>
            <small>UN MOVIMIENTO A LA VEZ</small>
            <strong>
              Empezar también
              <br />
              es progresar.
            </strong>
            <p>
              Tu única comparación:
              <br />
              vos, ayer.
            </p>
          </div>
          <button className="nav-item" onClick={() => setOverlay('settings')}>
            <Icon name="settings" />
            <span>Ajustes</span>
          </button>
          <div className="local-badge">
            <span />{' '}
            {storageError
              ? 'Pendiente de guardar'
              : 'Guardado en este dispositivo'}
          </div>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <span className="breadcrumb">
            Tu práctica <span>/</span> {pages.find((p) => p.id === page)?.label}
          </span>
          <span className="mobile-brand">klisteni.</span>
          <div className="topbar-right">
            <span className="beginner-badge">
              <span /> Principiante
            </span>
            <button
              className="profile-button"
              aria-label="Abrir ajustes"
              onClick={() => setOverlay('settings')}
            >
              V
            </button>
          </div>
        </header>
        <main id="main">
          {privacyControls}
          {storageError && (
            <div className="storage-warning" role="alert">
              <Icon name="info" />
              {storageError}
            </div>
          )}
          <section className="page-heading">
            <div>
              <span className="eyebrow">APRENDÉ. MOVETE. REPETÍ.</span>
              <h1>
                {page === 'routine' ? (
                  <>
                    Tu cuerpo.
                    <br className="mobile-break" /> Tu primer gimnasio.
                  </>
                ) : page === 'library' ? (
                  'Cada movimiento tiene su porqué.'
                ) : page === 'anatomy' ? (
                  'Conocé tu cuerpo.'
                ) : (
                  'Cada paso cuenta.'
                )}
              </h1>
              <p>{descriptions[page]}</p>
            </div>
            {page === 'routine' ? (
              <button
                className="primary-button"
                disabled={Boolean(session)}
                onClick={() => {
                  setSession({
                    ids: preferences.exerciseIds,
                    sets: preferences.sets,
                  })
                  choose(preferences.exerciseIds[0]!)
                }}
              >
                <Icon name="play" size={17} /> Empezar mi rutina{' '}
                <Icon name="arrow" size={18} />
              </button>
            ) : (
              <button
                className="secondary-button"
                onClick={() => setOverlay('cardio')}
              >
                <Icon name="plus" size={18} /> Registrar actividad
              </button>
            )}
          </section>
          <div className="stats-bar">
            <div>
              <span className="stat-icon peach">
                <Icon name="fire" />
              </span>
              <span>
                <strong>
                  {stats.streak}{' '}
                  <small>{stats.streak === 1 ? 'día' : 'días'}</small>
                </strong>
                <span>Racha de movimiento</span>
              </span>
            </div>
            <div>
              <span className="stat-icon purple">
                <Icon name="target" />
              </span>
              <span>
                <strong>
                  {stats.weeklyWorkouts}
                  <small> / {preferences.weeklyGoal}</small>
                </strong>
                <span>Sesiones esta semana</span>
              </span>
              <span className="mini-bars">
                {Array.from({ length: preferences.weeklyGoal }, (_, i) => (
                  <i
                    className={i < stats.weeklyWorkouts ? 'filled' : ''}
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
                <span>Aeróbico esta semana</span>
              </span>
            </div>
            <div className="level-stat">
              <span className="stat-icon yellow">
                <Icon name="spark" />
              </span>
              <span>
                <strong>
                  Nivel {stats.level}
                  <small> · {stats.xp} XP</small>
                </strong>
                <span>Construyendo el hábito</span>
              </span>
            </div>
          </div>
          {page === 'routine' && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">TU PUNTO DE PARTIDA</span>
                  <h2>
                    Una base para empezar<span className="soft-dot">.</span>
                  </h2>
                </div>
                <button
                  className="text-button"
                  disabled={Boolean(session)}
                  onClick={() => setOverlay('routine')}
                >
                  <Icon name="settings" size={16} /> Personalizar
                </button>
              </div>
              <div className="routine-meta">
                <span>
                  <Icon name="body" size={15} /> Cuerpo completo · base inicial
                </span>
                <span>
                  <Icon name="clock" size={15} /> A tu ritmo
                </span>
                <span>Sin equipo</span>
                <span>
                  {preferences.sets}{' '}
                  {preferences.sets === 1 ? 'serie' : 'series'} por ejercicio
                </span>
              </div>
              <details className="warmup-note">
                <summary>
                  <Icon name="spark" size={15} /> Antes de empezar · preparación
                  y esfuerzo
                </summary>
                <p>{starterRoutine.warmup}</p>
                <p>{starterRoutine.effort}</p>
                <p>{starterRoutine.progression}</p>
              </details>
              <div className="routine-layout">
                <aside
                  className="exercise-list"
                  aria-label="Ejercicios de tu rutina"
                >
                  {routine.map((e, i) => (
                    <button
                      key={e.id}
                      onClick={() => choose(e.id)}
                      className={`exercise-row ${e.id === selectedId ? 'selected' : ''}`}
                      aria-pressed={e.id === selectedId}
                    >
                      <span className="exercise-thumb">
                        <ExerciseGlyph id={e.id} />
                      </span>
                      <span className="exercise-row-copy">
                        <span className="exercise-number">
                          {String(i + 1).padStart(2, '0')}{' '}
                          <span>· {e.pattern}</span>
                        </span>
                        <strong>{e.shortName}</strong>
                        <small>
                          {preferences.sets} × {e.reps.min}–{e.reps.max}
                          {e.reps.perSide ? ' / lado' : ''}
                        </small>
                      </span>
                      <Icon name="chevron" size={15} />
                    </button>
                  ))}
                  <div className="routine-footnote">
                    <Icon name="info" size={16} />
                    <p>
                      Dejá un día de descanso entre sesiones de fuerza. La
                      técnica va primero.
                    </p>
                  </div>
                </aside>
                <div className="workbench">
                  <div className="workbench-title">
                    <div>
                      <span className="pill">{exercise.pattern}</span>
                      <h3>{exercise.name}</h3>
                      <p>{exercise.englishName}</p>
                      {exercise.equipment !== 'none' && (
                        <span className="equipment-note">
                          Necesita barra o anillas · fuera de tu rutina
                        </span>
                      )}
                    </div>
                    <span className="exercise-difficulty">
                      <span /> {exercise.difficulty}
                    </span>
                  </div>
                  {exercise.note && (
                    <p className="exercise-note">{exercise.note}</p>
                  )}
                  <div className="demonstration">
                    <div className="viewer-wrap">
                      <Suspense
                        fallback={
                          <div className="viewer-loading">
                            Preparando tu espacio 3D…
                          </div>
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
                      <span className="eyebrow">¿QUÉ ESTÁS TRABAJANDO?</span>
                      <h4>
                        Conectá con
                        <br />
                        el movimiento.
                      </h4>
                      <p>{exercise.description}</p>
                      <MuscleButtons
                        exercise={exercise}
                        selected={selectedMuscle}
                        onSelect={setSelectedMuscle}
                      />
                      {selectedInfo && (
                        <div className="muscle-definition">
                          <strong>{selectedInfo.name}</strong>
                          <p>{selectedInfo.description}</p>
                        </div>
                      )}
                      <div className="muscle-tip">
                        <Icon name="info" size={15} />
                        <span>Tocá un músculo para ubicarlo en el modelo.</span>
                      </div>
                    </div>
                  </div>
                  <div className="lesson">
                    <div
                      className="lesson-tabs"
                      role="tablist"
                      aria-label="Guía del ejercicio"
                    >
                      {(
                        [
                          { id: 'steps', label: 'Cómo se hace' },
                          { id: 'tips', label: 'Claves de técnica' },
                          { id: 'variants', label: 'A tu nivel' },
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
                            <strong>Preparación</strong>{' '}
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
                            <h4>Buscá esto</h4>
                            {exercise.cues.map((cue) => (
                              <p key={cue}>
                                <Icon name="check" size={16} />
                                {cue}
                              </p>
                            ))}
                          </div>
                          <div>
                            <h4>Evitá esto</h4>
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
                            <small>UN POCO MÁS FÁCIL</small>
                            <h4>{exercise.easier.name}</h4>
                            <p>{exercise.easier.description}</p>
                          </div>
                          <div>
                            <small>CUANDO DOMINES LA BASE</small>
                            <h4>{exercise.harder.name}</h4>
                            <p>{exercise.harder.description}</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="exercise-footer">
                      <span>
                        <Icon name="clock" size={14} /> Descanso orientativo:{' '}
                        {exercise.restSeconds} s
                      </span>
                      <details>
                        <summary>Fuentes del ejercicio</summary>
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
                    <h3>Los ejercicios se complementan.</h3>
                    <p>
                      Empuje, piernas, cadera y abdomen construyen tu base. El
                      trabajo escapular ayuda al control de espalda; para sumar
                      una tracción con carga vas a necesitar equipo.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => navigate('anatomy')}
                    >
                      Entender mi rutina <Icon name="arrow" size={16} />
                    </button>
                  </div>
                </div>
                <div className="cardio-card">
                  <span className="stat-icon green">
                    <Icon name="walk" />
                  </span>
                  <div>
                    <h3>Hay movimiento fuera de la rutina.</h3>
                    <p>
                      Una caminata, una vuelta en bici, un trote. Tu actividad
                      aeróbica también tiene lugar acá.
                    </p>
                    <button
                      className="text-button"
                      onClick={() => setOverlay('cardio')}
                    >
                      Registrar actividad <Icon name="plus" size={16} />
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
                    placeholder="Buscar ejercicio o músculo…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Buscar ejercicio o músculo"
                  />
                </label>
                <div className="filter-pills">
                  {['Todos', ...new Set(exercises.map((e) => e.pattern))].map(
                    (p) => (
                      <button
                        key={p}
                        className={pattern === p ? 'selected' : ''}
                        onClick={() => setPattern(p)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              </div>
              <div className="library-grid">
                {exercises
                  .filter(
                    (e) =>
                      (pattern === 'Todos' || e.pattern === pattern) &&
                      `${e.name} ${e.pattern} ${[...e.primaryMuscles, ...e.secondaryMuscles].map((id) => muscles[id].name).join(' ')}`
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/\p{Diacritic}/gu, '')
                        .includes(
                          query
                            .toLowerCase()
                            .normalize('NFD')
                            .replace(/\p{Diacritic}/gu, ''),
                        ),
                  )
                  .map((e) => (
                    <button
                      className="library-card"
                      key={e.id}
                      onClick={() => openExercise(e.id)}
                    >
                      <div className="library-visual">
                        <ExerciseGlyph id={e.id} />
                        <span className="pill">{e.difficulty}</span>
                      </div>
                      <div className="library-card-content">
                        <small>
                          {e.pattern} ·{' '}
                          {e.equipment === 'none'
                            ? 'Sin equipo'
                            : 'Necesita barra o anillas'}
                        </small>
                        <h3>{e.name}</h3>
                        <p>{e.description}</p>
                        <span>
                          Explorar movimiento <Icon name="arrow" size={17} />
                        </span>
                      </div>
                    </button>
                  ))}
              </div>
              {!exercises.some(
                (e) =>
                  (pattern === 'Todos' || e.pattern === pattern) &&
                  `${e.name} ${e.pattern} ${[...e.primaryMuscles, ...e.secondaryMuscles].map((id) => muscles[id].name).join(' ')}`
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/\p{Diacritic}/gu, '')
                    .includes(
                      query
                        .toLowerCase()
                        .normalize('NFD')
                        .replace(/\p{Diacritic}/gu, ''),
                    ),
              ) && (
                <div className="empty-state">
                  <h3>No encontramos ese movimiento.</h3>
                  <p>Probá con otro nombre o elegí «Todos».</p>
                </div>
              )}
            </section>
          )}
          {page === 'anatomy' && (
            <section className="anatomy-section">
              <div className="anatomy-intro">
                <span className="eyebrow">MOVIMIENTOS QUE SE COMPLEMENTAN</span>
                <h2>Un cuerpo, distintos trabajos.</h2>
                <p>
                  Los colores muestran el papel de cada región en un ejercicio.
                  Son una guía educativa, no porcentajes de activación muscular.
                </p>
              </div>
              <div className="pattern-grid">
                {routine.map((e) => (
                  <button key={e.id} onClick={() => openExercise(e.id)}>
                    <span className="exercise-thumb">
                      <ExerciseGlyph id={e.id} />
                    </span>
                    <small>{e.pattern}</small>
                    <h3>{e.shortName}</h3>
                    <p>
                      {e.primaryMuscles
                        .map((id) => muscles[id].name)
                        .join(' · ')}
                    </p>
                    <Icon name="arrow" size={18} />
                  </button>
                ))}
              </div>
              <div className="pull-gap">
                <Icon name="info" />
                <div>
                  <h3>La pieza que falta sin equipo: la tracción.</h3>
                  <p>
                    La W boca abajo practica el control de las escápulas. No
                    reemplaza un remo o una dominada: para cargar dorsales y
                    bíceps hace falta resistencia y un anclaje seguro.
                  </p>
                  <button
                    className="text-button"
                    onClick={() => openExercise('row')}
                  >
                    Conocer el remo con barra <Icon name="arrow" size={16} />
                  </button>
                </div>
              </div>
              <div className="section-heading">
                <h2>Tu pequeño atlas muscular</h2>
                <span className="muted">Tocá una región para aprender</span>
              </div>
              <div className="muscle-atlas">
                {Object.values(muscles).map((m) => (
                  <details key={m.id}>
                    <summary>
                      <span className="muscle-atlas-dot" />
                      <span>
                        {m.name}
                        <small>{m.region}</small>
                      </span>
                      <Icon name="plus" size={16} />
                    </summary>
                    <p>{m.description}</p>
                    <small>
                      En tu rutina:{' '}
                      {routine
                        .filter(
                          (e) =>
                            e.primaryMuscles.includes(m.id) ||
                            e.secondaryMuscles.includes(m.id),
                        )
                        .map((e) => e.shortName)
                        .join(', ') ||
                        'Sin trabajo directo suficiente en esta selección.'}
                    </small>
                  </details>
                ))}
              </div>
            </section>
          )}
          {page === 'progress' && (
            <Progress
              onCardio={() => setOverlay('cardio')}
              onStart={() => navigate('routine')}
            />
          )}
          <footer className="page-footer">
            <span>Menos prisa. Más conciencia.</span>
            <span>
              Guía educativa · Si un movimiento duele, detenelo y buscá
              orientación.
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Navegación móvil">
        {pages.map((p) => (
          <button
            key={p.id}
            aria-current={page === p.id ? 'page' : undefined}
            className={page === p.id ? 'active' : ''}
            onClick={() => navigate(p.id)}
          >
            <Icon name={p.icon} size={21} />
            <span>{p.label}</span>
          </button>
        ))}
      </nav>
      {overlay === 'cardio' && (
        <Modal title="Cada movimiento suma" onClose={() => setOverlay(null)}>
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
          title="Tu práctica, a tu manera"
          onClose={() => setOverlay(null)}
        >
          <PreferencesForm />
        </Modal>
      )}
      {overlay === 'routine' && (
        <Modal title="Armá tu rutina" onClose={() => setOverlay(null)}>
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
  return (
    <div className="muscle-groups">
      {[
        {
          label: 'Protagonistas',
          ids: exercise.primaryMuscles,
          className: 'primary',
        },
        {
          label: 'Acompañan y estabilizan',
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
                {muscles[id].name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
