import { useEffect, useRef, useState, type MouseEvent } from 'react'
import App from './App'
import PrivacyControls from './components/PrivacyControls'
import PrivacyPage from './components/PrivacyPage'
import AccountAccessPage from './components/AccountAccessPage'
import ForgotPasswordPage from './components/ForgotPasswordPage'
import { analytics } from './lib/analytics'
import { isPrivacyPath } from './lib/privacy-route'
import { useAppStore } from './lib/store'
import { initialAccountAccess, readAccountAccessNavigation } from './lib/account-route'
import './privacy.css'

export default function AppRoot() {
  const [accountAccess, setAccountAccess] = useState(initialAccountAccess)
  const accountId = useAppStore(s => s.user?.id ?? 'demo')
  useEffect(() => {
    if (accountAccess) return
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
  const [visitedApp, setVisitedApp] = useState(() => !isPrivacyPath(location.pathname) && !initialAccountAccess())
  const privacyHeading = useRef<HTMLDivElement>(null)
  const returnTitle = useRef('Klisteni · Aprendé a moverte')
  useEffect(() => {
    const update = () => {
      const access = readAccountAccessNavigation()
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
    if (privacy) { document.title = 'Privacidad · Klisteni'; privacyHeading.current?.focus() }
    else document.title = returnTitle.current
  }, [privacy, accountAccess])
  function navigate(event: MouseEvent<HTMLAnchorElement>, value: boolean) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    if (value) returnTitle.current = document.title
    history.pushState(null, '', value ? '/privacy' : '/')
    analytics.setPrivacyPage(value)
    setPrivacy(value)
    if (!value) setVisitedApp(true)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }
  const controls = <PrivacyControls onOpenPrivacy={event => navigate(event, true)} />
  if (accountAccess?.mode === 'forgot-password') return <ForgotPasswordPage key={accountAccess.navigationId} />
  if (accountAccess) return <AccountAccessPage key={accountAccess.navigationId} route={accountAccess} />
  return <>
    {visitedApp && <div hidden={privacy}><App key={accountId} privacyControls={controls} suspended={privacy} /></div>}
    {privacy && <div ref={privacyHeading} tabIndex={-1}><PrivacyPage controls={controls} onReturn={event => navigate(event, false)} /></div>}
  </>
}
