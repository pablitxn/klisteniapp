import { lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { instanceMode } from '../lib/deployment'
import { useAppStore } from '../lib/store'
import { accessLabel } from '../lib/access-label'
import Icon, { type IconName } from './Icon'
import { PreferencesForm } from './Forms'
import './settings.css'

const AccountPanel = import.meta.env.VITE_APP_MODE === 'instance' ? lazy(() => import('./AccountPanel')) : () => null
const InitialSetup = lazy(() => import('./InitialSetup'))
export type SettingsSection = 'account' | 'appearance' | 'privacy' | 'data' | 'setup'

export default function SettingsPanel({ section, onSectionChange, privacySettings, onClose }: {
  section: SettingsSection
  onSectionChange: (section: SettingsSection) => void
  privacySettings?: ReactNode
  onClose: () => void
}) {
  const { t } = useTranslation('settings')
  const user = useAppStore(state => state.user)
  const profile = useAppStore(state => state.personalData?.settings.profile)
  const access = useAppStore(state => state.access)
  const [visited, setVisited] = useState<SettingsSection[]>([section])
  const sections: { id: SettingsSection; label: string; icon: IconName }[] = [
    ...(instanceMode ? [{ id: 'account' as const, label: 'Cuenta y planificación', icon: 'body' as const }] : []),
    { id: 'appearance', label: 'Apariencia', icon: 'sliders' },
    { id: 'privacy', label: 'Privacidad', icon: 'info' },
    { id: 'data', label: 'Datos', icon: 'download' },
    { id: 'setup', label: 'Configuración inicial', icon: 'spark' },
  ]
  const select = (next: SettingsSection) => {
    setVisited(current => current.includes(next) ? current : [...current, next])
    onSectionChange(next)
  }
  return <div className="settings-panel">
    <nav className="settings-nav" aria-label={t('Secciones de configuración')}>
      {sections.map(item => <button key={item.id} type="button" aria-current={section === item.id ? 'page' : undefined} onClick={() => select(item.id)}>
        <Icon name={item.icon} size={19} /><span>{t(item.label)}</span>
      </button>)}
    </nav>
    <div className="settings-content">
      {sections.filter(item => item.id === section || visited.includes(item.id)).map(item => <section key={item.id} hidden={section !== item.id} aria-label={t(item.label)}>
        {item.id !== 'setup' && <h3 className="settings-section-title">{t(item.label)}</h3>}
        <Suspense fallback={<p role="status">{t('Cargando…', { ns: 'core' })}</p>}>
          {item.id === 'appearance' && <PreferencesForm section="appearance" />}
          {item.id === 'data' && <PreferencesForm section="data" />}
          {item.id === 'privacy' && privacySettings}
          {item.id === 'setup' && <InitialSetup onDone={onClose} />}
          {instanceMode && item.id === 'account' && <>
            {user && <div className="settings-account-summary"><strong>{profile?.displayName ?? user.name}</strong><span>{accessLabel(access, (key, values) => t(key, { ...values, ns: 'account' }))}</span></div>}
            <AccountPanel onDone={onClose} />
          </>}
        </Suspense>
      </section>)}
    </div>
  </div>
}
