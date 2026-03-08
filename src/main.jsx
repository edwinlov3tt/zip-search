import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { runStartupDiagnostics } from './utils/diagnostics.js'
import App from './App.jsx'
import { RuntimeScope } from '@runtimescope/sdk'

// Initialize RuntimeScope in development mode
if (import.meta.env.DEV) {
  RuntimeScope.init({
    appName: 'zip-search',
    endpoint: 'ws://localhost:9090',
    captureNetwork: true,
    captureConsole: true,
    capturePerformance: true,
    captureRenders: true,
    captureBody: false,
    maxBodySize: 65536
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Fire-and-forget diagnostics (non-blocking)
runStartupDiagnostics().catch(() => {})
