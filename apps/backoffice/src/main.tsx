import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import '@klisteniapp/b2b-ui/styles.css'
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
