import { useTranslation } from 'react-i18next'
import { lazy, Suspense, useEffect, useRef, useState, type MouseEvent } from 'react'
import App from './App'
import PrivacyControls from './components/PrivacyControls'
import PrivacyPage from './components/PrivacyPage'
import { analytics } from './lib/analytics'
import { isPrivacyPath } from './lib/privacy-route'
import { useAppStore } from './lib/store'
import { initialAccountAccess, readAccountAccessNavigation } from './lib/account-route'
import { instanceMode } from './lib/deployment'
import { scrollPageToTop } from './lib/modal-scroll'
import './privacy.css'

const AccountAccessPage = import.meta.env.VITE_APP_MODE === 'instance' ? lazy(() => import('./components/AccountAccessPage')) : () => null
const ForgotPasswordPage = import.meta.env.VITE_APP_MODE === 'instance' ? lazy(() => import('./components/ForgotPasswordPage')) : () => null

export default function AppRoot() {
  const { t } = useTranslation('core')

  const [accountAccess, setAccountAccess] = useState(() => instanceMode ? initialAccountAccess() : null)
  const accountId = useAppStore(s => s.user?.id ?? 'demo')
  useEffect(() => {
    if (!instanceMode || accountAccess) return
    void useAppStore.getState().refreshSession()
    const refresh = () => { if (document.visibilityState === 'visible') void useAppStore.getState().refreshSession() }
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('online', refresh)
    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('online', refresh)
    }
  }, [accountAccess])
  const [privacy, setPrivacy] = useState(() => isPrivacyPath(location.pathname))
  const [visitedApp, setVisitedApp] = useState(() => !isPrivacyPath(location.pathname) && (!instanceMode || !initialAccountAccess()))
  const privacyHeading = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const update = () => {
      const access = instanceMode ? readAccountAccessNavigation() : null
      const value = isPrivacyPath(location.pathname)
      analytics.setPrivacyPage(value || access !== null)
      setAccountAccess(access)
      setPrivacy(value)
      if (!value && !access) setVisitedApp(true)
    }
    window.addEventListener('popstate', update)
    window.addEventListener('hashchange', update)
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('hashchange', update) }
  }, [])
  useEffect(() => {
    analytics.setPrivacyPage(privacy || accountAccess !== null)
    if (accountAccess) return
    if (privacy) { document.title = t("Privacidad · Klisteni"); privacyHeading.current?.focus() }
  }, [privacy, accountAccess, t])
  function navigate(event: MouseEvent<HTMLAnchorElement>, value: boolean) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    history.pushState(null, '', value ? '/privacy' : '/')
    analytics.setPrivacyPage(value)
    setPrivacy(value)
    if (!value) setVisitedApp(true)
    scrollPageToTop()
  }
  const openPrivacy = (event: MouseEvent<HTMLAnchorElement>) => navigate(event, true)
  const banner = <PrivacyControls variant="banner" onOpenPrivacy={openPrivacy} />
  const privacySettings = <PrivacyControls variant="settings" onOpenPrivacy={openPrivacy} />
  const controls = <PrivacyControls variant="full" onOpenPrivacy={openPrivacy} />
  if (instanceMode && accountAccess?.mode === 'forgot-password') return <Suspense fallback={<p>{t("Cargando…")}</p>}><ForgotPasswordPage key={accountAccess.navigationId} /></Suspense>
  if (instanceMode && accountAccess) return <Suspense fallback={<p>{t("Cargando…")}</p>}><AccountAccessPage key={accountAccess.navigationId} route={accountAccess} /></Suspense>
  return <>
    {visitedApp && <div hidden={privacy}><App key={accountId} privacyControls={banner} privacySettings={privacySettings} suspended={privacy} /></div>}
    {privacy && <div ref={privacyHeading} tabIndex={-1}><PrivacyPage controls={controls} onReturn={event => navigate(event, false)} /></div>}
  </>
}
