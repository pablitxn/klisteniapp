import '@klisteniapp/b2b-ui/styles.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ApplicationProvider } from './app/ApplicationProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ApplicationProvider>
      <App />
    </ApplicationProvider>
  </StrictMode>,
)
