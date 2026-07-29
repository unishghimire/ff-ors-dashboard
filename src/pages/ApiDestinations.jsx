import { useState, useEffect } from 'react'
import { listEntities, createEntity, updateEntity, testApiDestination } from '../api/client'
import { Plus, Plug, TestTube, Check, X } from 'lucide-react'

export default function ApiDestinations() {
  const [destinations, setDestinations] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', base_url: '', api_key_encrypted: '', auth_scheme: 'bearer', payload_format: 'json' })
  const [testResults, setTestResults] = useState({})

  async function fetchDests() { setDestinations(await listEntities('ExternalApiDestination').catch(() => [])) }
  useEffect(() => { fetchDests() }, [])

  async function createDest() {
    if (!form.name || !form.base_url) return
    await createEntity('ExternalApiDestination', { ...form, enabled: true, last_status: 'never' })
    setForm({ name: '', base_url: '', api_key_encrypted: '', auth_scheme: 'bearer', payload_format: 'json' })
    setShowForm(false)
    fetchDests()
  }

  async function toggleEnabled(dest) {
    await updateEntity('ExternalApiDestination', dest.id, { enabled: !dest.enabled })
    fetchDests()
  }

  async function testDest(id) {
    setTestResults(prev => ({ ...prev, [id]: { loading: true } }))
    const result = await testApiDestination(id).catch(e => ({ success: false, error: e.message }))
    setTestResults(prev => ({ ...prev, [id]: result }))
    fetchDests()
  }

  return (
    <div className="p-6 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Destinations</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Configure external software to receive match data pushes</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Destination
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold">Add API Destination</h2>
          <div className="grid grid-cols-2 gap-4">
            <input className="input" placeholder="Destination name (e.g., Overlay Software)" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <input className="input" placeholder="https://api.example.com/endpoint" value={form.base_url} onChange={e => setForm({...form, base_url: e.target.value})} />
            <input className="input" type="password" placeholder="API Key" value={form.api_key_encrypted} onChange={e => setForm({...form, api_key_encrypted: e.target.value})} />
            <select className="input" value={form.auth_scheme} onChange={e => setForm({...form, auth_scheme: e.target.value})}>
              <option value="bearer">Bearer Token</option>
              <option value="header">X-API-Key Header</option>
              <option value="query">Query Parameter</option>
              <option value="none">No Auth</option>
            </select>
            <select className="input" value={form.payload_format} onChange={e => setForm({...form, payload_format: e.target.value})}>
              <option value="json">JSON</option>
              <option value="protobuf">Protobuf</option>
            </select>
          </div>
          <button onClick={createDest} className="btn-primary">Add Destination</button>
        </div>
      )}

      <div className="space-y-3">
        {destinations.length === 0 ? (
          <div className="card p-8 text-center">
            <Plug className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No API destinations configured. Add one to start pushing match data.</p>
          </div>
        ) : (
          destinations.map(d => (
            <div key={d.id} className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: d.enabled ? 'rgba(34,197,94,0.1)' : 'var(--ors-border)' }}>
                    <Plug className="w-5 h-5" style={{ color: d.enabled ? 'var(--ors-green)' : 'var(--ors-text-muted)' }} />
                  </div>
                  <div>
                    <div className="font-medium text-sm">{d.name}</div>
                    <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>{d.base_url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge badge-gray">{d.auth_scheme}</span>
                  <span className={`badge badge-${d.enabled ? 'green' : 'gray'}`}>{d.enabled ? 'enabled' : 'disabled'}</span>
                  <span className={`badge badge-${d.last_status === 'success' ? 'green' : d.last_status === 'degraded' || d.last_status === 'failed' ? 'red' : 'gray'}`}>{d.last_status}</span>
                  <button onClick={() => toggleEnabled(d)} className="btn-secondary text-xs">{d.enabled ? 'Disable' : 'Enable'}</button>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => testDest(d.id)} className="btn-secondary flex items-center gap-2 text-xs">
                  <TestTube className="w-3.5 h-3.5" /> Test Connection
                </button>
                {testResults[d.id] && !testResults[d.id].loading && (
                  <div className="flex items-center gap-2 text-sm">
                    {testResults[d.id].success ? (
                      <><Check className="w-4 h-4" style={{ color: 'var(--ors-green)' }} /><span style={{ color: 'var(--ors-green)' }}>Connected (HTTP {testResults[d.id].http_status})</span></>
                    ) : (
                      <><X className="w-4 h-4" style={{ color: 'var(--ors-red)' }} /><span style={{ color: 'var(--ors-red)' }}>{testResults[d.id].error || testResults[d.id].message || 'Failed'}</span></>
                    )}
                  </div>
                )}
                {testResults[d.id]?.loading && <span className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Testing...</span>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
