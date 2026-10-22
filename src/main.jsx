import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

import { startAutoUpdate } from './lib/autoUpdate'
import { supabase } from './lib/supabase'

if (import.meta.env.PROD) {
  startAutoUpdate({ client: supabase, currentVersion: __APP_BUILD_VERSION__, versionUrl: import.meta.env.BASE_URL + 'app-version.json' })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
