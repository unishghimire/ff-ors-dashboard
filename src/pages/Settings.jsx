import { useState } from 'react'
import { getAuthToken, setAuthToken } from '../api/client'
import { Settings as SettingsIcon, Save, Key } from 'lucide-react'

export default function Settings() {
  const [token, setToken] = useState(getAuthToken())
  const [saved, setSaved] = useState(false)

  function save() {
    setAuthToken(token)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Configure API authentication and system preferences</p>
      </div>

      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Key className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Base44 API Token</h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          Enter your Base44 API token to authenticate requests to the ORS backend. This token is stored locally in your browser and used for all entity and function calls.
        </p>
        <input className="input" type="password" placeholder="Paste your Base44 API token here" value={token} onChange={e => setToken(e.target.value)} />
        <div className="flex items-center gap-3">
          <button onClick={save} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> Save Token
          </button>
          {saved && <span className="text-sm" style={{ color: 'var(--ors-green)' }}>Saved!</span>}
        </div>
      </div>

      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> System Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span style={{ color: 'var(--ors-text-muted)' }}>App ID:</span> 6a6321f7f7401f199de01d4e</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>API Base:</span> https://app.base44.com/api</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>OCR Engine:</span> Google Gemini (Free Tier)</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Backend:</span> 8 deployed functions</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Entities:</span> 9 data tables</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Workflows:</span> 4 automated workflows</div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="text-lg font-bold mb-3">Quick Start Guide</h2>
        <div className="space-y-3 text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>1.</span> Set your Base44 API token above</div>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>2.</span> Create a tournament in the Tournaments page</div>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>3.</span> Add teams and players to the tournament</div>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>4.</span> Schedule matches in the Matches page</div>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>5.</span> Configure at least one API Destination for data pushes</div>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>6.</span> Go to Screen Capture, select a match, and start capturing</div>
          <div><span className="font-medium" style={{ color: 'var(--ors-text)' }}>7.</span> The system auto-processes frames through OCR and pushes to your destinations</div>
        </div>
      </div>
    </div>
  )
}
