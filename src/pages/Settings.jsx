import { useState } from 'react'
import { getAppDomain, setAppDomain, getAuthToken, setAuthToken } from '../api/client'
import { Settings as SettingsIcon, Save, Key, Globe, Check, ExternalLink, AlertCircle } from 'lucide-react'

export default function Settings() {
  const [domain, setDomain] = useState(getAppDomain())
  const [token, setToken] = useState(getAuthToken())
  const [savedDomain, setSavedDomain] = useState(false)
  const [savedToken, setSavedToken] = useState(false)

  function saveDomain() {
    setAppDomain(domain)
    setSavedDomain(true)
    setTimeout(() => setSavedDomain(false), 3000)
  }

  function saveToken() {
    setAuthToken(token)
    setSavedToken(true)
    setTimeout(() => setSavedToken(false), 3000)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Configure the dashboard to connect to your Base44 ORS backend</p>
      </div>

      {/* Setup banner */}
      {!getAppDomain() && (
        <div className="card p-4 border-l-4" style={{ borderColor: 'var(--ors-accent)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ors-accent)' }} />
            <div className="text-sm">
              <p className="font-medium mb-2">Quick Setup — 3 steps:</p>
              <ol className="space-y-1.5 list-decimal list-inside" style={{ color: 'var(--ors-text-muted)' }}>
                <li>Open your Base44 app "Wren ORS" in the builder and click <span className="font-medium" style={{ color: 'var(--ors-text)' }}>Publish</span> to get your app domain</li>
                <li>Copy your app domain (e.g., <code className="px-1.5 py-0.5 rounded" style={{ background: 'var(--ors-bg)' }}>https://wren-ors.base44.app</code>) and paste it below</li>
                <li>Click Save — the dashboard will connect automatically. No API token needed!</li>
              </ol>
            </div>
          </div>
        </div>
      )}

      {/* App Domain */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Globe className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Base44 App Domain
        </h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          Enter your published Base44 app domain. The dashboard connects to the ORS gateway function at this URL — no authentication token required (the gateway uses service-role access internally).
        </p>
        <div className="flex gap-2">
          <input
            className="input"
            placeholder="https://wren-ors.base44.app"
            value={domain}
            onChange={e => setDomain(e.target.value)}
          />
          <button onClick={saveDomain} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Save className="w-4 h-4" /> Save Domain
          </button>
          {savedDomain && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ors-green)' }}><Check className="w-4 h-4" /> Saved!</span>}
        </div>
        <a href="https://app.base44.com" target="_blank" rel="noopener noreferrer" className="text-xs flex items-center gap-1.5" style={{ color: 'var(--ors-accent)' }}>
          <ExternalLink className="w-3.5 h-3.5" /> Open Base44 Builder to publish your app
        </a>
      </div>

      {/* API Token (optional) */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Key className="w-5 h-5" style={{ color: 'var(--ors-text-muted)' }} /> API Token (Optional)
        </h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          Only needed if your backend functions require user authentication. Most operations work without a token via the gateway function's service-role access.
        </p>
        <div className="flex gap-2">
          <input
            className="input"
            type="password"
            placeholder="Optional — leave blank if not needed"
            value={token}
            onChange={e => setToken(e.target.value)}
          />
          <button onClick={saveToken} className="btn-secondary flex items-center gap-2 whitespace-nowrap">
            <Save className="w-4 h-4" /> Save Token
          </button>
          {savedToken && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ors-green)' }}><Check className="w-4 h-4" /> Saved!</span>}
        </div>
      </div>

      {/* System Info */}
      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> System Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span style={{ color: 'var(--ors-text-muted)' }}>App ID:</span> 6a6321f7f7401f199de01d4e</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Gateway Function:</span> orsGateway</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>OCR Engine:</span> Google Gemini (Free Tier)</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Backend Functions:</span> 9 deployed</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Entities:</span> 9 data tables</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Workflows:</span> 4 automated</div>
        </div>
      </div>

      {/* Point Table Reference */}
      <div className="card p-5">
        <h2 className="text-lg font-bold mb-3">Free Fire Point Table</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            ['1st', '12'], ['2nd', '9'], ['3rd', '8'], ['4th', '7'], ['5th', '6'],
            ['6th', '5'], ['7th', '4'], ['8th', '3'], ['9th', '2'], ['10th', '1'],
            ['11th', '0'], ['12th', '0']
          ].map(([pos, pts]) => (
            <div key={pos} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
              <span className="text-sm">{pos}</span>
              <span className="text-sm font-bold" style={{ color: parseInt(pts) > 0 ? 'var(--ors-accent)' : 'var(--ors-text-muted)' }}>{pts} pts</span>
            </div>
          ))}
        </div>
        <div className="mt-3 pt-3 border-t flex items-center justify-between" style={{ borderColor: 'var(--ors-border)' }}>
          <span className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Per Kill</span>
          <span className="text-sm font-bold" style={{ color: 'var(--ors-accent)' }}>1 point</span>
        </div>
      </div>
    </div>
  )
}
