import { useState } from 'react'
import { getAppDomain, setAppDomain, getConnectionToken, setConnectionToken } from '../api/client'
import { Settings as SettingsIcon, Save, Key, Globe, Check, Copy, Link, Code, Shield, Zap } from 'lucide-react'

export default function Settings() {
  const [domain, setDomain] = useState(getAppDomain())
  const [token, setToken] = useState(getConnectionToken())
  const [savedDomain, setSavedDomain] = useState(false)
  const [savedToken, setSavedToken] = useState(false)
  const [copiedGateway, setCopiedGateway] = useState(false)
  const [copiedToken, setCopiedToken] = useState(false)
  const [showToken, setShowToken] = useState(false)

  function saveDomain() { setAppDomain(domain); setSavedDomain(true); setTimeout(() => setSavedDomain(false), 3000) }
  function saveToken() { setConnectionToken(token); setSavedToken(true); setTimeout(() => setSavedToken(false), 3000) }

  function copyToClipboard(text, setter) {
    navigator.clipboard.writeText(text).then(() => { setter(true); setTimeout(() => setter(false), 2000) })
  }

  const gatewayEndpoint = `${domain}/functions/orsGateway`

  const exampleCode = `// JavaScript — call the ORS Gateway
fetch('${gatewayEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': '${token}'
  },
  body: JSON.stringify({ operation: 'list_matches' })
})
.then(r => r.json())
.then(data => console.log(data))`

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Configure the dashboard and manage API connections</p>
      </div>

      {/* Connection Token — Primary */}
      <div className="card p-5 space-y-4" style={{ borderColor: 'var(--ors-accent)', borderWidth: 2 }}>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Key className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Connection Token
        </h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          This is your ORS API key. Copy and paste it into any external software that needs to connect to the ORS API.
        </p>
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>ORS CONNECTION TOKEN</label>
          <div className="flex gap-2">
            <div className="input flex items-center justify-between flex-1" style={{ fontFamily: 'monospace', overflowX: 'auto' }}>
              <span className="text-sm">{showToken ? token : '•••••••••••••••••••••••••••••••••••••••••••••••••••••••'}</span>
              <button onClick={() => setShowToken(!showToken)} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--ors-text-muted)' }}>
                {showToken ? 'Hide' : 'Show'}
              </button>
            </div>
            <button onClick={() => copyToClipboard(token, setCopiedToken)} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              {copiedToken ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedToken ? 'Copied!' : 'Copy Token'}
            </button>
          </div>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
          <Shield className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--ors-accent)' }} />
          <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>
            Keep this token secure. It authenticates all API requests. Include it as the <code style={{ fontFamily: 'monospace' }}>X-API-Key</code> header in every request to the gateway.
          </p>
        </div>
      </div>

      {/* Gateway Endpoint */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Link className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Gateway Endpoint
        </h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          All dashboard operations go through this single endpoint. External software can also call it directly.
        </p>
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>GATEWAY URL</label>
          <div className="flex gap-2">
            <div className="input flex items-center justify-between" style={{ fontFamily: 'monospace', overflowX: 'auto' }}>
              <span className="text-sm">{gatewayEndpoint}</span>
            </div>
            <button onClick={() => copyToClipboard(gatewayEndpoint, setCopiedGateway)} className="btn-secondary flex items-center gap-2 whitespace-nowrap">
              {copiedGateway ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copiedGateway ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>METHOD</div>
            <div className="text-sm font-medium">POST</div>
          </div>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>AUTH</div>
            <div className="text-sm font-medium">X-API-Key header</div>
          </div>
          <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
            <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>FORMAT</div>
            <div className="text-sm font-medium">JSON</div>
          </div>
        </div>
      </div>

      {/* API Operations */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2"><Code className="w-5 h-5" /> Available Operations</h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Call the gateway with <code style={{ fontFamily: 'monospace' }}>{`{ operation: "...", ...params }`}</code></p>
        <div className="space-y-2">
          {[
            { op: 'gateway_status', desc: 'Health check (no auth required)' },
            { op: 'list_tournaments', desc: 'List all tournaments' },
            { op: 'create_tournament', desc: 'Create a tournament (data: {...})' },
            { op: 'list_matches', desc: 'List all matches' },
            { op: 'create_match', desc: 'Create a match (data: {...})' },
            { op: 'update_match', desc: 'Update a match (id, data: {...})' },
            { op: 'list_teams', desc: 'List teams (optional: tournament_id)' },
            { op: 'list_players', desc: 'List players (optional: team_id)' },
            { op: 'list_match_participants', desc: 'List participants (optional: match_id)' },
            { op: 'get_match_summary', desc: 'Match state + kills + alive count (match_id)' },
            { op: 'get_tournament_standings', desc: 'Full standings with FF points (tournament_id)' },
            { op: 'list_api_destinations', desc: 'List API push destinations' },
            { op: 'test_api_destination', desc: 'Test a destination (destination_id)' },
            { op: 'list_violations', desc: 'List rule violations' },
            { op: 'resolve_violation', desc: 'Mark violation resolved (id)' },
            { op: 'ingest_frame', desc: 'Ingest a captured frame (match_id, frame_number, image_url)' },
            { op: 'get_latest_frames', desc: 'Get recent frames (optional: match_id)' },
          ].map(ep => (
            <div key={ep.op} className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
              <code className="text-xs font-bold" style={{ fontFamily: 'monospace', color: 'var(--ors-accent)', minWidth: '200px' }}>{ep.op}</code>
              <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>{ep.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Code Example */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2"><Zap className="w-5 h-5" /> Quick Start Example</h2>
        </div>
        <pre className="text-xs p-4 rounded-lg overflow-x-auto" style={{ background: 'var(--ors-bg)', fontFamily: 'monospace' }}>{exampleCode}</pre>
      </div>

      {/* Backend Domain Config */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Globe className="w-5 h-5" style={{ color: 'var(--ors-text-muted)' }} /> Backend Domain
        </h2>
        <div className="flex gap-2">
          <input className="input" placeholder="https://wren-9de01d4e.base44.app" value={domain} onChange={e => setDomain(e.target.value)} />
          <button onClick={saveDomain} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Save className="w-4 h-4" /> Save
          </button>
          {savedDomain && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ors-green)' }}><Check className="w-4 h-4" /> Saved!</span>}
        </div>
        <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>
          Default is <code style={{ fontFamily: 'monospace' }}>https://wren-9de01d4e.base44.app</code> (Superagent backend). Change only if you set up a custom domain.
        </p>
      </div>

      {/* Custom Token Config */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Key className="w-5 h-5" style={{ color: 'var(--ors-text-muted)' }} /> Custom Token (Advanced)
        </h2>
        <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
          If you rotate the connection token on the server, update it here to keep the dashboard connected.
        </p>
        <div className="flex gap-2">
          <input className="input" placeholder="ORS-..." value={token} onChange={e => setToken(e.target.value)} style={{ fontFamily: 'monospace' }} />
          <button onClick={saveToken} className="btn-secondary flex items-center gap-2 whitespace-nowrap">
            <Save className="w-4 h-4" /> Save
          </button>
          {savedToken && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ors-green)' }}><Check className="w-4 h-4" /> Saved!</span>}
        </div>
      </div>

      {/* System Info */}
      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> System Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span style={{ color: 'var(--ors-text-muted)' }}>Gateway:</span> <span className="font-medium">{gatewayEndpoint}</span>
          </div>
          <div>
            <span style={{ color: 'var(--ors-text-muted)' }}>Auth:</span> <span className="font-medium">X-API-Key header</span>
          </div>
          <div>
            <span style={{ color: 'var(--ors-text-muted)' }}>Scoring:</span> <span className="font-medium">FF Points (12-1, +1/kill)</span>
          </div>
          <div>
            <span style={{ color: 'var(--ors-text-muted)' }}>Version:</span> <span className="font-medium">2.0</span>
          </div>
        </div>
      </div>
    </div>
  )
}
