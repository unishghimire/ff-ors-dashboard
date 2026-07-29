import { useState, useEffect } from 'react'
import { listEntities, updateEntity } from '../api/client'
import { AlertTriangle, Check, ChevronDown, ChevronRight } from 'lucide-react'

export default function Violations() {
  const [violations, setViolations] = useState([])
  const [expanded, setExpanded] = useState(null)

  async function fetchViolations() { setViolations(await listEntities('RuleViolation', { sort: '-created_date', limit: 50 }).catch(() => [])) }
  useEffect(() => { fetchViolations(); const i = setInterval(fetchViolations, 10000); return () => clearInterval(i) }, [])

  async function resolveViolation(id) {
    await updateEntity('RuleViolation', id, { resolved: true, resolved_at: new Date().toISOString(), resolved_by: 'web-dashboard' })
    fetchViolations()
  }

  const severityColors = {
    critical: 'red', high: 'red', medium: 'yellow', low: 'gray'
  }

  return (
    <div className="p-6 space-y-6 page-enter">
      <div>
        <h1 className="text-2xl font-bold">Rule Violations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Review and resolve data integrity violations</p>
      </div>

      {violations.length === 0 ? (
        <div className="card p-8 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No violations detected. System is clean.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {violations.map(v => (
            <div key={v.id} className="card overflow-hidden">
              <button onClick={() => setExpanded(expanded === v.id ? null : v.id)}
                className="w-full flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  {expanded === v.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <AlertTriangle className="w-4 h-4" style={{ color: v.severity === 'critical' || v.severity === 'high' ? 'var(--ors-red)' : 'var(--ors-yellow)' }} />
                  <div className="text-left">
                    <div className="text-sm font-medium">{v.type.replace(/_/g, ' ')}</div>
                    <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>{v.description}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`badge badge-${severityColors[v.severity] || 'gray'}`}>{v.severity}</span>
                  {v.resolved ? <span className="badge badge-green">resolved</span> : <span className="badge badge-red">unresolved</span>}
                </div>
              </button>
              {expanded === v.id && (
                <div className="p-4 border-t" style={{ borderColor: 'var(--ors-border)' }}>
                  <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                    <div><span style={{ color: 'var(--ors-text-muted)' }}>Match ID:</span> {v.match_id}</div>
                    <div><span style={{ color: 'var(--ors-text-muted)' }}>Frame ID:</span> {v.frame_id || '—'}</div>
                    <div><span style={{ color: 'var(--ors-text-muted)' }}>Type:</span> {v.type}</div>
                    <div><span style={{ color: 'var(--ors-text-muted)' }}>Severity:</span> {v.severity}</div>
                    {v.resolved_at && <div><span style={{ color: 'var(--ors-text-muted)' }}>Resolved at:</span> {v.resolved_at}</div>}
                    {v.resolved_by && <div><span style={{ color: 'var(--ors-text-muted)' }}>Resolved by:</span> {v.resolved_by}</div>}
                  </div>
                  {!v.resolved && (
                    <button onClick={() => resolveViolation(v.id)} className="btn-primary flex items-center gap-2">
                      <Check className="w-4 h-4" /> Mark as Resolved
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
