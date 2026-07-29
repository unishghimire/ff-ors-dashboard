import { useState, useRef, useEffect, useCallback } from 'react'
import { listEntities, callFunction, validateFrame } from '../api/client'
import { Radio, Play, Square, Camera, Activity, AlertCircle, Shield, CheckCircle, XCircle, Trophy, MapPin, Eye } from 'lucide-react'

export default function Capture() {
  // === Tournament & Match Selection ===
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [selectedTournamentName, setSelectedTournamentName] = useState('')
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [selectedMatchData, setSelectedMatchData] = useState(null)

  // === Capture State ===
  const [streaming, setStreaming] = useState(false)
  const [fps, setFps] = useState(1)
  const [frameCount, setFrameCount] = useState(0)
  const [lastConfidence, setLastConfidence] = useState(null)
  const [lastPhase, setLastPhase] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [backendConnected, setBackendConnected] = useState(true)
  const [pipelineErrors, setPipelineErrors] = useState(0)

  // === Pre-Capture Validation ===
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState(null)
  const [validationError, setValidationError] = useState('')

  // === Refs ===
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const captureTimerRef = useRef(null)
  const isCapturingRef = useRef(false)
  const frameCountRef = useRef(0)
  const selectedMatchRef = useRef('')
  const fpsRef = useRef(1)
  const backendConnectedRef = useRef(true)

  useEffect(() => { selectedMatchRef.current = selectedMatch }, [selectedMatch])
  useEffect(() => { fpsRef.current = fps }, [fps])
  useEffect(() => { backendConnectedRef.current = backendConnected }, [backendConnected])

  useEffect(() => {
    loadTournaments()
    return () => stopCapture()
  }, [])

  async function loadTournaments() {
    try {
      const ts = await listEntities('Tournament')
      setTournaments(ts)
      if (ts.length > 0) {
        setSelectedTournament(ts[0].id)
        setSelectedTournamentName(ts[0].name)
      }
      setBackendConnected(true)
    } catch (e) {
      setBackendConnected(false)
      setSelectedMatch('test')
    }
  }

  async function loadMatches(tournamentId) {
    if (!tournamentId) {
      setMatches([])
      setSelectedMatch('')
      setSelectedMatchData(null)
      return
    }
    try {
      const ms = await listEntities('Match', { tournament_id: tournamentId })
      setMatches(ms)
      if (ms.length > 0) {
        setSelectedMatch(ms[0].id)
        setSelectedMatchData(ms[0])
      } else {
        setSelectedMatch('')
        setSelectedMatchData(null)
      }
    } catch (e) {
      setError(`Failed to load matches: ${e.message}`)
      setMatches([])
    }
  }

  useEffect(() => {
    if (selectedTournament) {
      loadMatches(selectedTournament)
    }
  }, [selectedTournament])

  useEffect(() => {
    if (selectedMatch && matches.length > 0) {
      const m = matches.find(m => m.id === selectedMatch)
      setSelectedMatchData(m || null)
    }
  }, [selectedMatch, matches])

  function handleTournamentChange(e) {
    const id = e.target.value
    const t = tournaments.find(t => t.id === id)
    setSelectedTournament(id)
    setSelectedTournamentName(t ? t.name : '')
    setValidation(null)
    setValidationError('')
  }

  function handleMatchChange(e) {
    setSelectedMatch(e.target.value)
    setValidation(null)
    setValidationError('')
  }

  // === Pre-Capture Validation ===
  async function runValidation() {
    setError('')
    setValidationError('')
    setValidation(null)
    setValidating(true)

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 1 },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      await new Promise(r => setTimeout(r, 800))

      const video = videoRef.current
      const canvas = canvasRef.current
      canvas.width = video.videoWidth || 1280
      canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]

      const result = await validateFrame(base64, 'image/jpeg')

      if (result.success) {
        setValidation({
          detected: result.detected,
          confirmed: false
        })
        setStatus(`Validation complete - Phase: ${result.detected.game_phase}, Confidence: ${((result.detected.confidence || 0) * 100).toFixed(0)}%`)
      } else {
        setValidationError(result.error || 'Validation failed')
      }
    } catch (e) {
      setValidationError(`Validation failed: ${e.message}`)
    } finally {
      setValidating(false)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }

  function confirmValidation() {
    setValidation(prev => prev ? { ...prev, confirmed: true } : null)
    setStatus('Screen validated - ready to start live capture')
  }

  function rejectValidation() {
    setValidation(null)
    setStatus('Validation rejected - select the correct match and re-validate')
  }

  // === Live Capture ===
  async function startCapture() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: fps },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setStreaming(true)
      setStatus('LIVE - Capturing frames...')
      setFrameCount(0)
      setPipelineErrors(0)
      frameCountRef.current = 0
      isCapturingRef.current = false

      stream.getVideoTracks()[0].addEventListener('ended', () => stopCapture())
      scheduleNextCapture()
    } catch (e) {
      setError(`Screen capture failed: ${e.message}`)
      setStreaming(false)
    }
  }

  function scheduleNextCapture() {
    if (!streamRef.current) return
    const intervalMs = 1000 / fpsRef.current
    captureTimerRef.current = setTimeout(async () => {
      await captureFrame()
      scheduleNextCapture()
    }, intervalMs)
  }

  async function captureFrame() {
    if (isCapturingRef.current) return
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return

    isCapturingRef.current = true
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
    frameCountRef.current += 1
    const frameNum = frameCountRef.current
    if (frameNum % 5 === 0 || frameNum === 1) setFrameCount(frameNum)

    const matchId = selectedMatchRef.current
    const isTestMode = matchId === 'test' || !backendConnectedRef.current

    if (isTestMode) {
      setFrameCount(frameNum)
      setStatus(`Frame ${frameNum} captured (test mode). Screen sharing is working!`)
      isCapturingRef.current = false
      return
    }

    processFrameInBackground(frameNum, base64, matchId)
    isCapturingRef.current = false
  }

  async function processFrameInBackground(frameNum, base64, matchId) {
    try {
      const result = await callFunction('captureAndProcess', {
        match_id: matchId,
        frame_number: frameNum,
        image_data: base64,
        image_mime_type: 'image/jpeg',
        captured_at: new Date().toISOString()
      })
      if (result.success) {
        const frame = result.frame || {}
        const nd = frame.normalized_data || {}
        const conf = nd.confidence || 0
        setLastConfidence(conf)
        setLastPhase(nd.game_phase || 'unknown')
        const kills = (nd.kill_feed || []).length
        setStatus(`Frame ${frameNum} | Phase: ${nd.game_phase || '?'} | Alive: ${nd.alive_count ?? '?'} | Kills: ${kills} | Conf: ${(conf * 100).toFixed(0)}%`)
      } else {
        setPipelineErrors(prev => prev + 1)
        setStatus(`Frame ${frameNum}: ${result.error || 'processing failed'}`)
      }
    } catch (e) {
      setPipelineErrors(prev => prev + 1)
      setStatus(`Frame ${frameNum}: ${e.message}`)
    }
  }

  function stopCapture() {
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current)
      captureTimerRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    isCapturingRef.current = false
    setFrameCount(frameCountRef.current)
    setStreaming(false)
    setStatus('Capture stopped')
  }

  const canStartCapture = () => {
    if (!backendConnected) return true
    if (!selectedTournament) return false
    if (!selectedMatch || selectedMatch === 'test') return false
    if (streaming) return false
    return true
  }

  const tournamentName = selectedTournamentName || (tournaments.find(t => t.id === selectedTournament)?.name || '')
  const matchInfo = selectedMatchData
  const matchLabel = matchInfo ? `Match #${matchInfo.match_number} - ${matchInfo.map || 'No map'}` : 'No match selected'

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Screen Capture</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Capture live Free Fire spectator feed and process through OCR pipeline</p>
      </div>

      {!backendConnected && (
        <div className="card p-4 border-l-4" style={{ borderColor: 'var(--ors-yellow)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ors-yellow)' }} />
            <div className="text-sm">
              <p className="font-medium mb-1">Test Mode - Backend Not Connected</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                Screen sharing will work, but the OCR pipeline is disabled. Configure your gateway in{' '}
                <a href="/settings" className="underline" style={{ color: 'var(--ors-accent)' }}>Settings</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* === Step 1: Tournament & Match Selection === */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ors-text-muted)' }}>Step 1 - Select Tournament & Match</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>
              <Trophy className="w-3 h-3 inline mr-1" />TOURNAMENT
            </label>
            <select
              className="input"
              value={selectedTournament}
              onChange={handleTournamentChange}
              disabled={streaming || validating}
            >
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name} ({t.status})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>
              <MapPin className="w-3 h-3 inline mr-1" />MATCH
            </label>
            <select
              className="input"
              value={selectedMatch}
              onChange={handleMatchChange}
              disabled={streaming || validating || matches.length === 0}
            >
              <option value="test">Test Mode (no match)</option>
              {matches.map(m => (
                <option key={m.id} value={m.id}>
                  Match #{m.match_number} - {m.map || 'No map'} ({m.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        {matches.length === 0 && selectedTournament && backendConnected && (
          <p className="text-xs" style={{ color: 'var(--ors-yellow)' }}>
            No matches found for this tournament. Create matches on the Matches page first.
          </p>
        )}
      </div>

      {/* === Step 2: Pre-Capture Validation === */}
      {backendConnected && selectedMatch && selectedMatch !== 'test' && !streaming && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ors-text-muted)' }}>Step 2 - Validate Screen</h2>
          </div>

          <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
            Capture one frame to verify you're spectating the correct match before going live.
            The system will run OCR and show what it detects - you confirm before data starts flowing.
          </p>

          <div className="flex gap-3">
            <button
              onClick={runValidation}
              disabled={validating}
              className="btn-secondary flex items-center gap-2"
              style={{ borderColor: 'var(--ors-accent)' }}
            >
              <Camera className="w-4 h-4" /> {validating ? 'Validating...' : 'Capture & Validate'}
            </button>
          </div>

          {validationError && (
            <p className="text-sm" style={{ color: 'var(--ors-red)' }}>{validationError}</p>
          )}

          {validation && !validation.confirmed && (
            <div className="rounded-lg p-4" style={{ background: 'var(--ors-bg-input)', border: '1px solid var(--ors-border)' }}>
              <h3 className="text-sm font-bold mb-3">OCR Detection Results</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span style={{ color: 'var(--ors-text-muted)' }}>Game Phase:</span>{' '}
                  <span className="font-medium">{validation.detected.game_phase}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ors-text-muted)' }}>Alive Count:</span>{' '}
                  <span className="font-medium">{validation.detected.alive_count ?? 'Not visible'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ors-text-muted)' }}>Zone Phase:</span>{' '}
                  <span className="font-medium">{validation.detected.zone_phase || 'Not visible'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ors-text-muted)' }}>Map Detected:</span>{' '}
                  <span className="font-medium">{validation.detected.map_guess || 'Not detected'}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ors-text-muted)' }}>Kill Feed Entries:</span>{' '}
                  <span className="font-medium">{validation.detected.kill_feed_count}</span>
                </div>
                <div>
                  <span style={{ color: 'var(--ors-text-muted)' }}>Confidence:</span>{' '}
                  <span className="font-medium">
                    {((validation.detected.confidence || 0) * 100).toFixed(0)}%
                    {' '}
                    <span style={{
                      color: validation.detected.confidence >= 0.6 ? 'var(--ors-green)' : 'var(--ors-yellow)'
                    }}>
                      ({validation.detected.confidence_label})
                    </span>
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--ors-border)' }}>
                <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>
                  Selected match: <span className="font-medium" style={{ color: 'var(--ors-text)' }}>{matchLabel}</span>
                </p>
                {validation.detected.map_guess && matchInfo?.map && (
                  <p className="text-xs mt-1" style={{
                    color: validation.detected.map_guess.toLowerCase() === (matchInfo.map || '').toLowerCase()
                      ? 'var(--ors-green)' : 'var(--ors-red)'
                  }}>
                    {validation.detected.map_guess.toLowerCase() === (matchInfo.map || '').toLowerCase()
                      ? 'Detected map matches selected match'
                      : `Detected map "${validation.detected.map_guess}" does NOT match selected map "${matchInfo.map}"`}
                  </p>
                )}
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={confirmValidation} className="btn-primary flex items-center gap-2">
                  <CheckCircle className="w-4 h-4" /> Confirm - Start Capture
                </button>
                <button onClick={rejectValidation} className="btn-secondary flex items-center gap-2" style={{ color: 'var(--ors-red)', borderColor: 'var(--ors-red)' }}>
                  <XCircle className="w-4 h-4" /> Wrong Match - Re-select
                </button>
              </div>
            </div>
          )}

          {validation?.confirmed && !streaming && (
            <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span className="text-sm font-medium text-green-400">Screen validated - ready to go live</span>
            </div>
          )}
        </div>
      )}

      {/* === Step 3: Live Capture === */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ors-text-muted)' }}>Step 3 - Live Capture</h2>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>CAPTURE FPS</label>
            <select className="input" value={fps} onChange={e => setFps(Number(e.target.value))} disabled={streaming}>
              <option value={1}>1 FPS (Recommended)</option>
              <option value={2}>2 FPS</option>
              <option value={5}>5 FPS (May lag)</option>
            </select>
          </div>
          <div className="flex items-end">
            {!streaming ? (
              <button
                onClick={startCapture}
                className="btn-primary flex items-center gap-2 w-full justify-center"
                disabled={!canStartCapture()}
                style={{ opacity: canStartCapture() ? 1 : 0.5 }}
              >
                <Play className="w-4 h-4" /> Start Capture
              </button>
            ) : (
              <button
                onClick={stopCapture}
                className="btn-secondary flex items-center gap-2 w-full justify-center"
                style={{ color: 'var(--ors-red)', borderColor: 'var(--ors-red)' }}
              >
                <Square className="w-4 h-4" /> Stop Capture
              </button>
            )}
          </div>
          <div>
            {validation?.confirmed && !streaming && (
              <div className="text-xs flex items-center gap-1.5 h-full pt-6" style={{ color: 'var(--ors-green)' }}>
                <CheckCircle className="w-3 h-3" /> Validated
              </div>
            )}
            {!validation?.confirmed && selectedMatch && selectedMatch !== 'test' && backendConnected && !streaming && (
              <div className="text-xs flex items-center gap-1.5 h-full pt-6" style={{ color: 'var(--ors-text-muted)' }}>
                <AlertCircle className="w-3 h-3" /> Validate first
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--ors-red)' }}>{error}</p>}
      </div>

      {/* === Live Preview with Context Overlay === */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Live Preview</h2>
          {streaming && (
            <span className="badge badge-green flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> LIVE
            </span>
          )}
        </div>

        <div className="rounded-lg overflow-hidden relative" style={{ background: '#000' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ display: streaming || validating ? 'block' : 'none' }} />

          {(streaming || validating) && selectedMatch !== 'test' && (
            <div className="absolute top-3 left-3 rounded-lg px-3 py-2 space-y-1" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
              <div className="flex items-center gap-1.5 text-xs">
                <Trophy className="w-3 h-3 text-orange-400" />
                <span className="text-orange-400 font-medium">{tournamentName}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <MapPin className="w-3 h-3 text-blue-400" />
                <span className="text-blue-400 font-medium">{matchLabel}</span>
              </div>
              {validation?.confirmed && (
                <div className="flex items-center gap-1 text-xs">
                  <CheckCircle className="w-3 h-3 text-green-400" />
                  <span className="text-green-400">Validated</span>
                </div>
              )}
            </div>
          )}

          {!streaming && !validating && (
            <div className="flex items-center justify-center h-72" style={{ color: 'var(--ors-text-muted)' }}>
              <div className="text-center">
                <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a tournament and match, validate your screen, then start capture</p>
              </div>
            </div>
          )}

          {validating && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Running OCR validation...</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {(streaming || frameCount > 0) && (
        <div className="grid grid-cols-4 gap-4">
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>FRAMES CAPTURED</p>
            <p className="text-2xl font-bold mt-1">{frameCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>LAST CONFIDENCE</p>
            <p className="text-2xl font-bold mt-1">
              {lastConfidence != null ? `${(lastConfidence * 100).toFixed(0)}%` : '-'}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>GAME PHASE</p>
            <p className="text-2xl font-bold mt-1">{lastPhase || '-'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>PIPELINE ERRORS</p>
            <p className="text-2xl font-bold mt-1" style={{ color: pipelineErrors > 0 ? 'var(--ors-red)' : 'var(--ors-text)' }}>
              {pipelineErrors}
            </p>
          </div>
        </div>
      )}

      {status && (
        <div className="card p-3">
          <p className="text-sm font-mono" style={{ color: 'var(--ors-text-muted)' }}>{status}</p>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  )
}
