import { useState } from 'react'
import { getAppDomain, setAppDomain, getAuthToken, setAuthToken } from '../api/client'
import { Settings as SettingsIcon, Save, Key, Globe, Check, ExternalLink, AlertCircle, Copy, Link, Code } from 'lucide-react'

const CONNECTION_TOKEN = 'ORS-f0b3ac2034a9bd3a8768d77ea7d74fd9cdf6e0c087a9525babff1e4d9e61b794'
const API_ENDPOINT = 'https://api.base44.com/api/agents/6a6321f7f7401f199de01d4e/functions/orsDataApi'

export default function Settings() {
  const [domain, setDomain] = useState(getAppDomain())
  const [token, setToken] = useState(getAuthToken())
  const [savedDomain, setSavedDomain] = useState(false)
  const [savedToken, setSavedToken] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedExample, setCopiedExample] = useState(false)

  function saveDomain() { setAppDomain(domain); setSavedDomain(true); setTimeout(() => setSavedDomain(false), 3000) }
  function saveToken() { setAuthToken(token); setSavedToken(true); setTimeout(() => setSavedToken(false), 3000) }

  function copyToClipboard(text, setter) {
    navigator.clipboard.writeText(text).then(() => { setter(true); setTimeout(() => setter(false), 2000) })
  }

  const exampleCode = `// JavaScript example — fetch match standings
fetch('${API_ENDPOINT}?resource=standings', {
  headers: {
    'X-API-Key': '${CONNECTION_TOKEN}',
    'Content-Type': 'application/json'
  }
})
.then(r => r.json())
.then(data => console.log(data))`

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Configure the dashboard and manage API connections</p>
      </div>

      {/* Connection Token — THE MAIN FEATURE */}
      <div className="card p-5 space-y-4" style={{ borderColor: 'var(--ors-accent)', borderWidth: 2 }}>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Key className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Connection Token
        </h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          Copy this token and paste it into your external software. The ORS uses this token to authenticate when pushing match data.
        </p>

        {/* Token display with copy button */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>YOUR CONNECTION TOKEN</label>
          <div className="flex gap-2">
            <div className="input flex items-center justify-between" style={{ fontFamily: 'monospace', overflowX: 'auto' }}>
              <span className="text-sm">{CONNECTION_TOKEN}</span>
            </div>
            <button onClick={() => copyToClipboard(CONNECTION_TOKEN, setCopiedToken)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedToken ? 'Copied!' : 'Copy Token'}
            </button>
          </div>
        </div>

        {/* API Endpoint */}
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>API ENDPOINT (for pull requests)</label>
          <div className="flex gap-2">
            <div className="input flex items-center justify-between" style={{ fontFamily: 'monospace', overflowX: 'auto' }}>
              <span className="text-sm">{API_ENDPOINT}</span>
            </div>
            <button onClick={() => copyToClipboard(API_ENDPOINT, setCopiedUrl)} className="btn-secondary flex items-center gap-2 whitespace-nowrap">
              {copiedUrl ? <Check className="w-4 h-4" /> : <Link className="w-4 h-4" />}
              {copiedUrl ? 'Copied!' : 'Copy URL'}
            </button>
          </div>
        </div>

        {/* Auth scheme */}
        <div className="grid grid-cols-2 gap-4">
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>AUTH SCHEME</div>
            <div className="text-sm font-medium">X-API-Key header</div>
          </div>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>PAYLOAD FORMAT</div>
            <div className="text-sm font-medium">JSON</div>
          </div>
        </div>
      </div>

      {/* API Documentation */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Code className="w-5 h-5" /> API Endpoints</h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>External software can call these endpoints with your connection token:</p>

        <div className="space-y-2">
          {[
            { method: 'GET', url: '?resource=matches', desc: 'List all matches' },
            { method: 'GET', url: '?resource=match&match_id=X', desc: 'Get single match details + current state' },
            { method: 'GET', url: '?resource=standings', desc: 'Get tournament standings with placement points' },
            { method: 'GET', url: '?resource=participants&match_id=X', desc: 'Get participants with kills, alive status' },
            { method: 'GET', url: '?resource=violations&match_id=X', desc: 'Get rule violations for a match' },
            { method: 'GET', url: '?resource=frames&match_id=X', desc: 'Get captured frames for a match' },
            { method: 'POST', url: '{action: "push", match_id, destination_url}', desc: 'Push match data to external URL' },
          ].map(ep => (
            <div key={ep.url} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${ep.method === 'GET' ? 'bg-green-600' : 'bg-blue-600'}`} style={{ color: 'white' }}>{ep.method}</span>
              <div className="flex-1">
                <code className="text-xs" style={{ fontFamily: 'monospace' }}>{ep.url}</code>
                <p className="text-xs mt-0.5" style={{ color: 'var(--ors-text-muted)' }}>{ep.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code Example */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Quick Start Example</h2>
          <button onClick={() => copyToClipboard(exampleCode, setCopiedExample)} className="btn-secondary flex items-center gap-2 text-xs">
            {copiedExample ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedExample ? 'Copied!' : 'Copy Code'}
          </button>
        </div>
        <pre className="text-xs p-4 rounded-lg overflow-x-auto" style={{ background: 'var(--ors-bg)', fontFamily: 'monospace' }}>{exampleCode}</pre>
      </div>

      {/* Backend Domain Config */}
      {!getAppDomain() && (
        <div className="card p-4 border-l-4" style={{ borderColor: 'var(--ors-accent)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ors-accent)' }} />
            <div className="text-sm">
              <p className="font-medium mb-2">Backend Setup (Optional):</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                To enable OCR processing (reading kills/alive from screen captures), publish your Base44 app and paste the domain below.
                The connection token works independently for external software integration.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Globe className="w-5 h-5" style={{ color: 'var(--ors-text-muted)' }} /> Base44 Backend Domain (Optional)
        </h2>
        <div className="flex gap-2">
          <input className="input" placeholder="https://wren-ors.base44.app" value={domain} onChange={e => setDomain(e.target.value)} />
          <button onClick={saveDomain} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Save className="w-4 h-4" /> Save
          </button>
          {savedDomain && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ors-green)' }}><Check className="w-4 h-4" /> Saved!</span>}
        </div>
      </div>

      {/* System Info */}
      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> System Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span style={{ color: 'var(--ors-text-muted)' }}>App ID:</span> 6a6321f7f7401f199de01d4e</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>OCR Engine:</span> Google Gemini (Free Tier)</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Backend Functions:</span> 10 deployed</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Entities:</span> 9 data tables</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Workflows:</span> 4 automated</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Scoring:</span> FF Standard (12-1 + kills)</div>
        </div>
      </div>

      {/* Point Table */}
      <div className="card p-5">
        <h2 className="text-lg font-bold mb-3">Free Fire Point Table</h2>
        <div className="grid grid-cols-3 gap-2">
          {[['1st','12'],['2nd','9'],['3rd','8'],['4th','7'],['5th','6'],['6th','5'],['7th','4'],['8th','3'],['9th','2'],['10th','1'],['11th','0'],['12th','0']].map(([pos,pts]) => (
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
