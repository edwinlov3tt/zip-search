import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { runStartupDiagnostics } from './utils/diagnostics.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fire-and-forget diagnostics (non-blocking)
runStartupDiagnostics().catch(() => {})
