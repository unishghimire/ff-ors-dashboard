import { useState, useEffect } from 'react'
import { listEntities, callFunction } from '../api/client'
import { Activity, Calendar, Crosshair, AlertTriangle, RefreshCw, Plug } from 'lucide-react'

export default function Dashboard() {
  const [matches, setMatches] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [violations, setViolations] = useState([])
  const [destinations, setDestinations] = useState([])
  const [matchSummary, setMatchSummary] = useState(null)
  const [loading, setLoading] = useState(true)

  async function fetchData() {
    setLoading(true)
    try {
      const [m, t, v, d] = await Promise.all([
        listEntities('Match').catch(() => []),
        listEntities('Tournament').catch(() => []),
        listEntities('RuleViolation', { limit: 10 }).catch(() => []),
        listEntities('ExternalApiDestination').catch(() => [])
      ])
      setMatches(m)
      setTournaments(t)
      setViolations(v)
      setDestinations(d)
      const liveMatch = m.find(x => x.status === 'in_match')
      if (liveMatch) {
        const summary = await callFunction('generateMatchSummary', { match_id: liveMatch.id }).catch(() => null)
        setMatchSummary(summary)
      }
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchData(); const interval = setInterval(fetchData, 15000); return () => clearInterval(interval) }, [])

  const liveMatches = matches.filter(m => m.status === 'in_match')
  const scheduledMatches = matches.filter(m => m.status === 'scheduled')
  const enabledDestinations = destinations.filter(d => d.enabled)
  const unresolvedViolations = violations.filter(v => !v.resolved)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Live match overview and system health</p>
        </div>
        <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-tile">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--ors-green)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--ors-text-muted)' }}>LIVE MATCHES</span>
          </div>
          <div className="text-2xl font-bold">{liveMatches.length}</div>
        </div>
        <div className="stat-tile">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--ors-text-muted)' }}>SCHEDULED</span>
          </div>
          <div className="text-2xl font-bold">{scheduledMatches.length}</div>
        </div>
        <div className="stat-tile">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4" style={{ color: 'var(--ors-red)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--ors-text-muted)' }}>UNRESOLVED VIOLATIONS</span>
          </div>
          <div className="text-2xl font-bold">{unresolvedViolations.length}</div>
        </div>
        <div className="stat-tile">
          <div className="flex items-center gap-2 mb-2">
            <Plug className="w-4 h-4" style={{ color: 'var(--ors-green)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--ors-text-muted)' }}>API DESTINATIONS</span>
          </div>
          <div className="text-2xl font-bold">{enabledDestinations.length} / {destinations.length}</div>
        </div>
      </div>

      {matchSummary && matchSummary.success && (
        <div className="card p-6">
          <h2 className="text-lg font-bold mb-4">Live Match Overview</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>ALIVE COUNT</div>
              <div className="text-3xl font-bold mt-1" style={{ color: 'var(--ors-green)' }}>
                {matchSummary.current_state?.alive_count ?? '—'}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>ZONE PHASE</div>
              <div className="text-2xl font-bold mt-1 capitalize">{matchSummary.current_state?.zone_phase ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>GAME PHASE</div>
              <div className="text-2xl font-bold mt-1 capitalize">{matchSummary.current_state?.game_phase ?? '—'}</div>
            </div>
          </div>
          <h3 className="text-sm font-semibold mb-3">Kill Leaderboard</h3>
          <div className="space-y-2">
            {(matchSummary.kill_leaderboard || []).slice(0, 10).map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: i < 3 ? 'var(--ors-accent)' : 'var(--ors-border)' }}>{i + 1}</span>
                  <span className="text-sm font-medium">{p.player_id}</span>
                </div>
                <div className="flex items-center gap-4">
                  <Crosshair className="w-4 h-4" style={{ color: 'var(--ors-red)' }} />
                  <span className="font-bold" style={{ color: 'var(--ors-red)' }}>{p.kills}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4">Matches</h2>
        {matches.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No matches yet. Create a tournament and schedule matches.</p>
        ) : (
          <div className="space-y-2">
            {matches.slice(0, 10).map(m => (
              <div key={m.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium">Match #{m.match_number}</span>
                  <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>{m.map || 'No map'}</span>
                </div>
                <span className={`badge badge-${m.status === 'in_match' ? 'green' : m.status === 'results' ? 'orange' : 'gray'}`}>{m.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-bold mb-4">API Push Health</h2>
        {destinations.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No API destinations configured.</p>
        ) : (
          <div className="space-y-2">
            {destinations.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2.5 px-3 rounded-lg" style={{ background: 'var(--ors-bg)' }}>
                <div className="flex items-center gap-3">
                  <span className={`badge badge-${d.enabled ? 'green' : 'gray'}`}>{d.enabled ? 'enabled' : 'disabled'}</span>
                  <span className="text-sm font-medium">{d.name}</span>
                </div>
                <span className={`badge badge-${d.last_status === 'success' ? 'green' : d.last_status === 'degraded' || d.last_status === 'failed' ? 'red' : 'gray'}`}>{d.last_status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
