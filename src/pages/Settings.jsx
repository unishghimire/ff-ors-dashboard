import { useState } from 'react'
import { getAppDomain, setAppDomain, getAuthToken, setAuthToken } from '../api/client'
import { Settings as SettingsIcon, Save, Key, Globe, Check, ExternalLink, AlertCircle, Copy, Link, Code, Rocket } from 'lucide-react'

export default function Settings() {
  const [domain, setDomain] = useState(getAppDomain())
  const [token, setToken] = useState(getAuthToken())
  const [savedDomain, setSavedDomain] = useState(false)
  const [savedToken, setSavedToken] = useState(false)
  const [copiedGateway, setCopiedGateway] = useState(false)

  function saveDomain() { setAppDomain(domain); setSavedDomain(true); setTimeout(() => setSavedDomain(false), 3000) }
  function saveToken() { setAuthToken(token); setSavedToken(true); setTimeout(() => setSavedToken(false), 3000) }

  function copyToClipboard(text, setter) {
    navigator.clipboard.writeText(text).then(() => { setter(true); setTimeout(() => setter(false), 2000) })
  }

  const gatewayEndpoint = `${domain}/functions/orsGateway`

  const exampleCode = `// JavaScript — call the ORS Gateway
fetch('${gatewayEndpoint}', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
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

      {/* Setup Guide */}
      <div className="card p-5 space-y-4" style={{ borderColor: 'var(--ors-accent)', borderWidth: 2 }}>
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Rocket className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Quick Setup
        </h2>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--ors-accent)', color: 'white' }}>1</div>
            <div className="text-sm flex-1">
              <p className="font-medium">Publish your Base44 app</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                Open the <a href="https://app.base44.com/apps/6a6321f7f7401f199de01d4e/editor/preview" target="_blank" className="underline" style={{ color: 'var(--ors-accent)' }}>Base44 builder</a> and click <b>Publish</b>. This activates <code style={{ fontFamily: 'monospace' }}>ors.base44.app</code>.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--ors-accent)', color: 'white' }}>2</div>
            <div className="text-sm flex-1">
              <p className="font-medium">Dashboard auto-connects</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                Once published, this dashboard automatically connects to <code style={{ fontFamily: 'monospace' }}>https://ors.base44.app/functions/orsGateway</code>. No token needed — the gateway uses service-role access internally.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'var(--ors-accent)', color: 'white' }}>3</div>
            <div className="text-sm flex-1">
              <p className="font-medium">Start capturing</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                Go to Screen Capture, select a match, share your screen, and start capturing frames. Data flows through OCR → normalization → API push automatically.
              </p>
            </div>
          </div>
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
            <div className="text-sm font-medium">None (service-role)</div>
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
            { op: 'gateway_status', desc: 'Health check' },
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
          <h2 className="text-lg font-bold">Quick Start Example</h2>
        </div>
        <pre className="text-xs p-4 rounded-lg overflow-x-auto" style={{ background: 'var(--ors-bg)', fontFamily: 'monospace' }}>{exampleCode}</pre>
      </div>

      {/* Backend Domain Config */}
      <div className="card p-5 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Globe className="w-5 h-5" style={{ color: 'var(--ors-text-muted)' }} /> Base44 App Domain
        </h2>
        <div className="flex gap-2">
          <input className="input" placeholder="https://ors.base44.app" value={domain} onChange={e => setDomain(e.target.value)} />
          <button onClick={saveDomain} className="btn-primary flex items-center gap-2 whitespace-nowrap">
            <Save className="w-4 h-4" /> Save
          </button>
          {savedDomain && <span className="text-sm flex items-center gap-1" style={{ color: 'var(--ors-green)' }}><Check className="w-4 h-4" /> Saved!</span>}
        </div>
        <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>
          Default is <code style={{ fontFamily: 'monospace' }}>https://ors.base44.app</code>. Change this only if you connect a custom domain to your Base44 app.
        </p>
      </div>

      {/* System Info */}
      <div className="card p-5 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><SettingsIcon className="w-5 h-5" /> System Info</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><span style={{ color: 'var(--ors-text-muted)' }}>App ID:</span> 6a6321f7f7401f199de01d4e</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>OCR Engine:</span> Google Gemini (Free Tier)</div>
          <div><span style={{ color: 'var(--ors-text-muted)' }}>Gateway Function:</span> orsGateway (Base44 app)</div>
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
              <span className="text-sm font-medium">{pos}</span>
              <span className="text-sm font-bold" style={{ color: 'var(--ors-accent)' }}>{pts} pts</span>
            </div>
          ))}
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--ors-text-muted)' }}>Plus 1 point per kill</p>
      </div>
    </div>
  )
}
