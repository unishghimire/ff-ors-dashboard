import { useState, useEffect, useRef, useCallback } from 'react'
import { listEntities, getMatchSummary, getLiveCapture } from '../api/client'
import { Activity, Calendar, Crosshair, AlertTriangle, RefreshCw, Plug, Settings as SettingsIcon, Radio, Eye, Zap, Skull, MapPin, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  const [matches, setMatches] = useState([])
  const [tournaments, setTournaments] = useState([])
  const [violations, setViolations] = useState([])
  const [destinations, setDestinations] = useState([])
  const [matchSummary, setMatchSummary] = useState(null)
  const [liveCapture, setLiveCapture] = useState(null)
  const [loading, setLoading] = useState(true)
  const [configError, setConfigError] = useState(false)
  const [liveRefreshing, setLiveRefreshing] = useState(false)
  const mountedRef = useRef(true)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setConfigError(false)
    try {
      const [m, t, v, d] = await Promise.all([
        listEntities('Match').catch(() => []),
        listEntities('Tournament').catch(() => []),
        listEntities('RuleViolation', { limit: 10 }).catch(() => []),
        listEntities('ExternalApiDestination').catch(() => [])
      ])
      if (!mountedRef.current) return
      setMatches(m)
      setTournaments(t)
      setViolations(v)
      setDestinations(d)
      const liveMatch = m.find(x => x.status === 'in_match')
      if (liveMatch) {
        const summary = await getMatchSummary(liveMatch.id).catch(() => null)
        if (!mountedRef.current) return
        setMatchSummary(summary)
      }
    } catch (e) {
      if (e.message?.includes('not configured')) setConfigError(true)
    }
    if (mountedRef.current) setLoading(false)
  }, [])

  // Fetch live capture data (more frequent when a match is live)
  const fetchLiveCapture = useCallback(async () => {
    if (!mountedRef.current) return
    setLiveRefreshing(true)
    try {
      const result = await getLiveCapture()
      if (!mountedRef.current) return
      setLiveCapture(result)
    } catch {
      if (mountedRef.current) setLiveCapture(null)
    }
    if (mountedRef.current) setLiveRefreshing(false)
  }, [])

  useEffect(() => {
    mountedRef.current = true
    fetchData()
    const interval = setInterval(fetchData, 15000)
    return () => { mountedRef.current = false; clearInterval(interval) }
  }, [fetchData])

  // Poll live capture data every 5 seconds
  useEffect(() => {
    fetchLiveCapture()
    const liveInterval = setInterval(fetchLiveCapture, 5000)
    return () => clearInterval(liveInterval)
  }, [fetchLiveCapture])

  if (configError) {
    return (
      <div className="p-6 page-enter">
        <div className="card p-8 text-center max-w-md mx-auto mt-12">
          <SettingsIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <h2 className="text-lg font-bold mb-2">Dashboard Not Connected</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--ors-text-muted)' }}>
            Set your gateway domain in Settings to connect.
          </p>
          <Link to="/settings" className="btn-primary inline-flex items-center gap-2">
            <SettingsIcon className="w-4 h-4" /> Go to Settings
          </Link>
        </div>
      </div>
    )
  }

  const liveMatches = matches.filter(m => m.status === 'in_match')
  const scheduledMatches = matches.filter(m => m.status === 'scheduled')
  const enabledDestinations = destinations.filter(d => d.enabled)
  const unresolvedViolations = violations.filter(v => !v.resolved)
  const isLive = liveCapture?.live === true
  const lf = liveCapture?.latest_frame
  const fs = liveCapture?.frame_stats
  const kf = liveCapture?.kill_feed_recent || []
  const lb = liveCapture?.kill_leaderboard || []

  return (
    <div className="p-6 space-y-6 page-enter">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Live match overview and system health</p>
        </div>
        <div className="flex items-center gap-3">
          {isLive && (
            <span className="badge badge-green flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> CAPTURING
            </span>
          )}
          <button onClick={fetchData} className="btn-secondary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>
      </div>

      {/* === LIVE CAPTURE FEED === */}
      {isLive && lf && (
        <div className="card p-5 space-y-4" style={{ borderLeft: '3px solid var(--ors-green)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5" style={{ color: 'var(--ors-green)' }} />
              <h2 className="text-lg font-bold">Live Capture Feed</h2>
              {liveCapture.tournament && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--ors-accent)' }}>
                  {liveCapture.tournament.name}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {liveRefreshing && <RefreshCw className="w-3 h-3 animate-spin" style={{ color: 'var(--ors-text-muted)' }} />}
              <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>
                Frame #{lf.frame_number} | {new Date(lf.created_at).toLocaleTimeString()}
              </span>
            </div>
          </div>

          {/* Match info bar */}
          <div className="flex items-center gap-4 text-sm" style={{ color: 'var(--ors-text-muted)' }}>
            <span className="flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--ors-accent)' }} />
              Match #{liveCapture.match?.match_number || '?'}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5" style={{ color: 'var(--ors-accent)' }} />
              {lf.map_name || liveCapture.match?.map || 'Unknown map'}
            </span>
            <span className="flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5" style={{ color: 'var(--ors-accent)' }} />
              Phase: <span className="font-medium" style={{ color: 'var(--ors-text)' }}>{lf.game_phase}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" style={{ color: 'var(--ors-yellow)' }} />
              Zone: <span className="font-medium" style={{ color: 'var(--ors-text)' }}>{lf.zone_phase || '?'}</span>
            </span>
          </div>

          {/* Live stats grid */}
          <div className="grid grid-cols-5 gap-3">
            <div className="stat-tile">
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-3.5 h-3.5" style={{ color: 'var(--ors-green)' }} />
                <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>ALIVE</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--ors-green)' }}>
                {lf.alive_count ?? liveCapture.alive_count ?? '-'}
              </div>
            </div>
            <div className="stat-tile">
              <div className="flex items-center gap-2 mb-1">
                <Crosshair className="w-3.5 h-3.5" style={{ color: 'var(--ors-red)' }} />
                <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>TOTAL KILLS</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--ors-red)' }}>
                {liveCapture.total_kills ?? '-'}
              </div>
            </div>
            <div className="stat-tile">
              <div className="flex items-center gap-2 mb-1">
                <Radio className="w-3.5 h-3.5" style={{ color: 'var(--ors-accent)' }} />
                <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>FRAMES</span>
              </div>
              <div className="text-2xl font-bold">{fs?.total ?? '-'}</div>
            </div>
            <div className="stat-tile">
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5" style={{ color: 'var(--ors-green)' }} />
                <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>PROCESSED</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: 'var(--ors-green)' }}>
                {fs ? fs.completed + fs.flagged : '-'}
              </div>
            </div>
            <div className="stat-tile">
              <div className="flex items-center gap-2 mb-1">
                <Eye className="w-3.5 h-3.5" style={{ color: 'var(--ors-text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>CONFIDENCE</span>
              </div>
              <div className="text-2xl font-bold" style={{ color: (lf.ocr_confidence || 0) >= 0.6 ? 'var(--ors-green)' : (lf.ocr_confidence || 0) >= 0.4 ? 'var(--ors-yellow)' : 'var(--ors-red)' }}>
                {lf.ocr_confidence != null ? `${(lf.ocr_confidence * 100).toFixed(0)}%` : '-'}
              </div>
            </div>
          </div>

          {/* Frame processing status bar */}
          {fs && fs.total > 0 && (
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--ors-text-muted)' }}>
              <span>Processing:</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden flex" style={{ background: 'var(--ors-bg)' }}>
                {fs.completed > 0 && <div style={{ width: `${(fs.completed / fs.total) * 100}%`, background: 'var(--ors-green)' }} />}
                {fs.flagged > 0 && <div style={{ width: `${(fs.flagged / fs.total) * 100}%`, background: 'var(--ors-yellow)' }} />}
                {fs.failed > 0 && <div style={{ width: `${(fs.failed / fs.total) * 100}%`, background: 'var(--ors-red)' }} />}
                {fs.processing > 0 && <div style={{ width: `${(fs.processing / fs.total) * 100}%`, background: 'var(--ors-accent)' }} />}
              </div>
              <span>{fs.completed} done | {fs.flagged} flagged | {fs.failed} failed</span>
            </div>
          )}

          {/* Kill feed + Leaderboard side by side */}
          <div className="grid grid-cols-2 gap-4">
            {/* Recent Kill Feed */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Skull className="w-4 h-4" style={{ color: 'var(--ors-red)' }} /> Recent Kills
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto scroll-thin">
                {kf.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>No kills detected yet</p>
                ) : kf.map((k, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded" style={{ background: 'var(--ors-bg)' }}>
                    <span>
                      <span style={{ color: 'var(--ors-green)' }}>{k.killer}</span>
                      <span style={{ color: 'var(--ors-text-muted)' }}> eliminated </span>
                      <span style={{ color: 'var(--ors-red)' }}>{k.victim}</span>
                    </span>
                    <span style={{ color: 'var(--ors-text-muted)' }}>#{k.frame}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Kill Leaderboard */}
            <div>
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <Crosshair className="w-4 h-4" style={{ color: 'var(--ors-red)' }} /> Kill Leaderboard
              </h3>
              <div className="space-y-1 max-h-40 overflow-y-auto scroll-thin">
                {lb.length === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>No kills recorded</p>
                ) : lb.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-xs py-1.5 px-2 rounded" style={{ background: 'var(--ors-bg)' }}>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: i < 3 ? 'var(--ors-accent)' : 'var(--ors-border)', color: i < 3 ? 'white' : 'var(--ors-text-muted)' }}>{i + 1}</span>
                      <span className="font-medium">{p.player_id?.substring(0, 12) || '?'}</span>
                    </div>
                    <span className="font-bold" style={{ color: 'var(--ors-red)' }}>{p.kills}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Link to capture page */}
          <Link to="/capture" className="text-xs flex items-center gap-1" style={{ color: 'var(--ors-accent)' }}>
            <Radio className="w-3 h-3" /> View capture screen →
          </Link>
        </div>
      )}

      {/* Not live but match exists */}
      {!isLive && liveMatches.length === 0 && matches.length > 0 && (
        <div className="card p-4 flex items-center gap-3" style={{ borderLeft: '3px solid var(--ors-text-muted)' }}>
          <Radio className="w-5 h-5" style={{ color: 'var(--ors-text-muted)' }} />
          <div className="text-sm">
            <span style={{ color: 'var(--ors-text-muted)' }}>No live capture in progress. </span>
            <Link to="/capture" className="underline" style={{ color: 'var(--ors-accent)' }}>Start capturing →</Link>
          </div>
        </div>
      )}

      {/* === Stat tiles === */}
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
            <span className="text-xs font-medium" style={{ color: 'var(--ors-text-muted)' }}>VIOLATIONS</span>
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

      {/* === Match summary (if live match with summary) === */}
      {matchSummary && matchSummary.success && !isLive && (
        <div className="card p-6 page-enter">
          <h2 className="text-lg font-bold mb-4">Live Match Overview</h2>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>ALIVE COUNT</div>
              <div className="text-3xl font-bold mt-1" style={{ color: 'var(--ors-green)' }}>
                {matchSummary.current_state?.alive_count ?? '-'}
              </div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>ZONE PHASE</div>
              <div className="text-2xl font-bold mt-1 capitalize">{matchSummary.current_state?.zone_phase ?? '-'}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>GAME PHASE</div>
              <div className="text-2xl font-bold mt-1 capitalize">{matchSummary.current_state?.game_phase ?? '-'}</div>
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

      {/* === Matches list === */}
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

      {/* === API Push Health === */}
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
