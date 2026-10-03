import { useEffect, useRef, useState, type MouseEvent } from 'react'
import App from './App'
import PrivacyControls from './components/PrivacyControls'
import PrivacyPage from './components/PrivacyPage'
import { analytics } from './lib/analytics'
import { isPrivacyPath } from './lib/privacy-route'
import './privacy.css'

export default function AppRoot() {
  const [privacy, setPrivacy] = useState(() => isPrivacyPath(location.pathname))
  const [visitedApp, setVisitedApp] = useState(() => !isPrivacyPath(location.pathname))
  const privacyHeading = useRef<HTMLDivElement>(null)
  const returnTitle = useRef('Klisteni · Aprendé a moverte')
  useEffect(() => {
    const update = () => { const value = isPrivacyPath(location.pathname); analytics.setPrivacyPage(value); setPrivacy(value); if (!value) setVisitedApp(true) }
    window.addEventListener('popstate', update)
    return () => window.removeEventListener('popstate', update)
  }, [])
  useEffect(() => {
    analytics.setPrivacyPage(privacy)
    if (privacy) { document.title = 'Privacidad · Klisteni'; privacyHeading.current?.focus() }
    else document.title = returnTitle.current
  }, [privacy])
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
  return <>
    {visitedApp && <div hidden={privacy}><App privacyControls={controls} suspended={privacy} /></div>}
    {privacy && <div ref={privacyHeading} tabIndex={-1}><PrivacyPage controls={controls} onReturn={event => navigate(event, false)} /></div>}
  </>
}
