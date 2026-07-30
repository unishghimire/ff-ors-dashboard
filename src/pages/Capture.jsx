import { useState, useRef, useEffect } from 'react'
import { listEntities, callFunction, validateFrame } from '../api/client'
import { Radio, Play, Square, Camera, Activity, AlertCircle, Shield, CheckCircle, XCircle, Trophy, MapPin, Eye, Zap, Gauge } from 'lucide-react'

export default function Capture() {
  // === Tournament & Match Selection ===
  const [tournaments, setTournaments] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [selectedTournamentName, setSelectedTournamentName] = useState('')
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [selectedMatchData, setSelectedMatchData] = useState(null)

  // === Capture State ===
  const [captureFps, setCaptureFps] = useState(2)      // Screen capture rate (preview smoothness)
  const [ocrFps, setOcrFps] = useState(1)              // OCR processing rate (data extraction)
  const [streaming, setStreaming] = useState(false)
  const [frameCount, setFrameCount] = useState(0)
  const [processedCount, setProcessedCount] = useState(0)
  const [queueDepth, setQueueDepth] = useState(0)
  const [lastConfidence, setLastConfidence] = useState(null)
  const [lastPhase, setLastPhase] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [backendConnected, setBackendConnected] = useState(true)
  const [pipelineErrors, setPipelineErrors] = useState(0)
  const [droppedFrames, setDroppedFrames] = useState(0)
  const [ocrLatency, setOcrLatency] = useState(null)         // ms per Gemini call
  const [ocrBusy, setOcrBusy] = useState(false)              // Gemini call in progress

  // === Pre-Capture Validation ===
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState(null)
  const [validationError, setValidationError] = useState('')

  // === Refs (stable, avoid stale closures) ===
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const captureTimerRef = useRef(null)
  const ocrTimerRef = useRef(null)
  const frameQueueRef = useRef([])        // Queue of {frameNum, base64, matchId}
  const frameCountRef = useRef(0)
  const processedCountRef = useRef(0)
  const droppedRef = useRef(0)
  const isOcrRunningRef = useRef(false)
  const selectedMatchRef = useRef('')
  const captureFpsRef = useRef(2)
  const ocrFpsRef = useRef(1)
  const backendConnectedRef = useRef(true)
  const ocrLatencyRef = useRef(0)
  const mountedRef = useRef(true)
  const MAX_QUEUE = 5                     // Max frames in queue before dropping old ones

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => { selectedMatchRef.current = selectedMatch }, [selectedMatch])
  useEffect(() => { captureFpsRef.current = captureFps }, [captureFps])
  useEffect(() => { ocrFpsRef.current = ocrFps }, [ocrFps])
  useEffect(() => { backendConnectedRef.current = backendConnected }, [backendConnected])

  useEffect(() => {
    loadTournaments()
    return () => stopCapture(true)
  }, [])

  // === Data Loading ===
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
    if (!tournamentId) { setMatches([]); setSelectedMatch(''); setSelectedMatchData(null); return }
    try {
      const ms = await listEntities('Match', { tournament_id: tournamentId })
      setMatches(ms)
      if (ms.length > 0) { setSelectedMatch(ms[0].id); setSelectedMatchData(ms[0]) }
      else { setSelectedMatch(''); setSelectedMatchData(null) }
    } catch (e) { setError(`Failed to load matches: ${e.message}`); setMatches([]) }
  }

  useEffect(() => { if (selectedTournament) loadMatches(selectedTournament) }, [selectedTournament])
  useEffect(() => {
    if (selectedMatch && matches.length > 0) {
      setSelectedMatchData(matches.find(m => m.id === selectedMatch) || null)
    }
  }, [selectedMatch, matches])

  function handleTournamentChange(e) {
    const id = e.target.value
    setSelectedTournament(id)
    setSelectedTournamentName(tournaments.find(t => t.id === id)?.name || '')
    setValidation(null); setValidationError('')
  }
  function handleMatchChange(e) {
    setSelectedMatch(e.target.value)
    setValidation(null); setValidationError('')
  }

  // === Pre-Capture Validation ===
  async function runValidation() {
    setError(''); setValidationError(''); setValidation(null); setValidating(true)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 1 }, audio: false })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      await new Promise(r => setTimeout(r, 800))
      const video = videoRef.current, canvas = canvasRef.current
      canvas.width = video.videoWidth || 1280; canvas.height = video.videoHeight || 720
      const ctx = canvas.getContext('2d')
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]
      const result = await validateFrame(base64, 'image/jpeg')
      if (result.success) {
        setValidation({ detected: result.detected, confirmed: false })
        setStatus(`Validation complete - Phase: ${result.detected.game_phase}, Confidence: ${((result.detected.confidence || 0) * 100).toFixed(0)}%`)
      } else { setValidationError(result.error || 'Validation failed') }
    } catch (e) { setValidationError(`Validation failed: ${e.message}`) }
    finally {
      setValidating(false)
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
      if (videoRef.current) videoRef.current.srcObject = null
    }
  }

  function confirmValidation() { setValidation(prev => prev ? { ...prev, confirmed: true } : null); setStatus('Screen validated - ready to start live capture') }
  function rejectValidation() { setValidation(null); setStatus('Validation rejected - select the correct match and re-validate') }

  // ========================================
  //  DECOUPLED CAPTURE + OCR ARCHITECTURE
  // ========================================
  //
  // Capture Loop (fast, runs at captureFps):
  //   - Grabs frame from video → canvas → base64
  //   - Pushes to frameQueueRef
  //   - If queue > MAX_QUEUE, drops oldest (memory protection)
  //   - Does NOT call Gemini — just captures
  //
  // OCR Loop (slow, runs at ocrFps):
  //   - Pulls oldest frame from queue
  //   - Sends to Gemini via gateway
  //   - Updates match data, violations, push
  //   - If queue empty, waits
  //
  // This allows 24 FPS smooth preview while Gemini
  // processes at its own pace (1-5 FPS).

  async function startCapture() {
    setError('')
    try {
      // Request screen at the capture FPS for smooth preview
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: captureFps, max: 30 } },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setStreaming(true)
      setStatus('LIVE - Capturing...')
      setFrameCount(0); setProcessedCount(0); setQueueDepth(0); setPipelineErrors(0); setDroppedFrames(0)
      frameCountRef.current = 0; processedCountRef.current = 0; droppedRef.current = 0
      frameQueueRef.current = []
      isOcrRunningRef.current = false

      stream.getVideoTracks()[0].addEventListener('ended', () => stopCapture())

      // Start both loops
      scheduleNextCapture()
      startOcrLoop()
    } catch (e) { setError(`Screen capture failed: ${e.message}`); setStreaming(false) }
  }

  // --- CAPTURE LOOP (fast) ---
  function scheduleNextCapture() {
    if (!streamRef.current || !mountedRef.current) return
    const intervalMs = 1000 / captureFpsRef.current
    captureTimerRef.current = setTimeout(() => {
      if (!streamRef.current || !mountedRef.current) return
      grabFrame()
      scheduleNextCapture()
    }, intervalMs)
  }

  function grabFrame() {
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return
    const video = videoRef.current, canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]

    frameCountRef.current += 1
    const frameNum = frameCountRef.current
    if (mountedRef.current && (frameNum % 5 === 0 || frameNum === 1)) setFrameCount(frameNum)

    const matchId = selectedMatchRef.current
    const isTestMode = matchId === 'test' || !backendConnectedRef.current

    if (isTestMode) {
      if (mountedRef.current) {
        setFrameCount(frameNum)
        setStatus(`Frame ${frameNum} captured (test mode - ${captureFpsRef.current} FPS preview)`)
      }
      return
    }

    // Push to queue — drop oldest if over capacity
    if (frameQueueRef.current.length >= MAX_QUEUE) {
      frameQueueRef.current.shift()
      droppedRef.current += 1
      if (mountedRef.current && droppedRef.current % 5 === 0) setDroppedFrames(droppedRef.current)
    }
    frameQueueRef.current.push({ frameNum, base64, matchId })
    if (mountedRef.current) setQueueDepth(frameQueueRef.current.length)
  }

  // --- OCR LOOP (continuous, LIFO) ---
  // Processes frames as fast as Gemini can respond.
  // Uses LIFO: always processes the LATEST captured frame.
  // Stale frames in the queue are discarded.
  function startOcrLoop() {
    if (!streamRef.current || !mountedRef.current) return
    // Small delay to let capture fill the queue first
    ocrTimerRef.current = setTimeout(() => runOcrCycle(), 500)
  }

  async function runOcrCycle() {
    if (!streamRef.current || !mountedRef.current) return

    // If Gemini is still busy, check again in 100ms
    if (isOcrRunningRef.current) {
      if (streamRef.current && mountedRef.current) {
        ocrTimerRef.current = setTimeout(() => runOcrCycle(), 100)
      }
      return
    }

    // If queue is empty, wait 200ms and check again
    if (frameQueueRef.current.length === 0) {
      if (streamRef.current && mountedRef.current) {
        ocrTimerRef.current = setTimeout(() => runOcrCycle(), 200)
      }
      return
    }

    // LIFO: take the LATEST frame (most current game state)
    // Discard all older frames — they're stale
    const queueLen = frameQueueRef.current.length
    const frame = frameQueueRef.current.pop()
    const discarded = queueLen - 1
    if (discarded > 0) {
      droppedRef.current += discarded
      if (mountedRef.current) setDroppedFrames(droppedRef.current)
    }
    if (mountedRef.current) setQueueDepth(0) // Queue is now empty

    isOcrRunningRef.current = true
    if (mountedRef.current) setOcrBusy(true)
    const ocrStart = Date.now()

    try {
      const result = await callFunction('captureAndProcess', {
        match_id: frame.matchId,
        frame_number: frame.frameNum,
        image_data: frame.base64,
        image_mime_type: 'image/jpeg',
        captured_at: new Date().toISOString()
      })
      if (result.success) {
        processedCountRef.current += 1
        if (mountedRef.current) setProcessedCount(processedCountRef.current)
        const frameData = result.frame || {}
        const nd = frameData.normalized_data || {}
        const conf = nd.confidence || 0
        const latency = Date.now() - ocrStart
        ocrLatencyRef.current = latency
        if (mountedRef.current) {
          setLastConfidence(conf)
          setLastPhase(nd.game_phase || 'unknown')
          setOcrLatency(latency)
        }
        const kills = (nd.kill_feed || []).length
        if (mountedRef.current) setStatus(`Frame ${frame.frameNum} done | ${latency}ms | Queue: 0 | Phase: ${nd.game_phase || '?'} | Alive: ${nd.alive_count ?? '?'} | Kills: ${kills} | Conf: ${(conf * 100).toFixed(0)}%`)
      } else {
        if (mountedRef.current) setPipelineErrors(prev => prev + 1)
        if (mountedRef.current) setStatus(`Frame ${frame.frameNum}: ${result.error || 'processing failed'}`)
      }
    } catch (e) {
      if (mountedRef.current) setPipelineErrors(prev => prev + 1)
      if (mountedRef.current) setStatus(`Frame ${frame.frameNum}: ${e.message}`)
    } finally {
      isOcrRunningRef.current = false
      if (mountedRef.current) setOcrBusy(false)
      // Immediately schedule next cycle — no artificial delay
      if (streamRef.current && mountedRef.current) {
        ocrTimerRef.current = setTimeout(() => runOcrCycle(), 50)
      }
    }
  }

  function stopCapture(isUnmounting = false) {
    // Clear all timers FIRST — prevents any pending callbacks from running
    if (captureTimerRef.current) { clearTimeout(captureTimerRef.current); captureTimerRef.current = null }
    if (ocrTimerRef.current) { clearTimeout(ocrTimerRef.current); ocrTimerRef.current = null }
    // Stop video stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      try { videoRef.current.srcObject = null } catch {}
    }
    // Clear refs
    isOcrRunningRef.current = false
    frameQueueRef.current = []
    // Only update state if NOT unmounting (prevents React warning)
    if (!isUnmounting) {
      setFrameCount(frameCountRef.current)
      setProcessedCount(processedCountRef.current)
      setQueueDepth(0)
      setStreaming(false)
      setStatus(`Capture stopped | ${frameCountRef.current} frames captured, ${processedCountRef.current} processed, ${droppedRef.current} dropped`)
    }
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
    <div className="p-6 space-y-6 page-enter">
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
              <p style={{ color: 'var(--ors-text-muted)' }}>Screen sharing works, but OCR pipeline is disabled. Configure gateway in <a href="/settings" className="underline" style={{ color: 'var(--ors-accent)' }}>Settings</a>.</p>
            </div>
          </div>
        </div>
      )}

      {/* === Step 1: Tournament & Match === */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
          <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ors-text-muted)' }}>Step 1 - Select Tournament & Match</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}><Trophy className="w-3 h-3 inline mr-1" />TOURNAMENT</label>
            <select className="input" value={selectedTournament} onChange={handleTournamentChange} disabled={streaming || validating}>
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name} ({t.status})</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}><MapPin className="w-3 h-3 inline mr-1" />MATCH</label>
            <select className="input" value={selectedMatch} onChange={handleMatchChange} disabled={streaming || validating || matches.length === 0}>
              <option value="test">Test Mode (no match)</option>
              {matches.map(m => <option key={m.id} value={m.id}>Match #{m.match_number} - {m.map || 'No map'} ({m.status})</option>)}
            </select>
          </div>
        </div>
        {matches.length === 0 && selectedTournament && backendConnected && (
          <p className="text-xs" style={{ color: 'var(--ors-yellow)' }}>No matches found for this tournament. Create matches first.</p>
        )}
      </div>

      {/* === Step 2: Validate === */}
      {backendConnected && selectedMatch && selectedMatch !== 'test' && !streaming && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
            <h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: 'var(--ors-text-muted)' }}>Step 2 - Validate Screen</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Capture one frame to verify you're spectating the correct match before going live. OCR shows what it detects - you confirm before data flows.</p>
          <button onClick={runValidation} disabled={validating} className="btn-secondary flex items-center gap-2" style={{ borderColor: 'var(--ors-accent)' }}>
            <Camera className="w-4 h-4" /> {validating ? 'Validating...' : 'Capture & Validate'}
          </button>
          {validationError && <p className="text-sm" style={{ color: 'var(--ors-red)' }}>{validationError}</p>}
          {validation && !validation.confirmed && (
            <div className="rounded-lg p-4" style={{ background: 'var(--ors-bg-input)', border: '1px solid var(--ors-border)' }}>
              <h3 className="text-sm font-bold mb-3">OCR Detection Results</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span style={{ color: 'var(--ors-text-muted)' }}>Game Phase:</span> <span className="font-medium">{validation.detected.game_phase}</span></div>
                <div><span style={{ color: 'var(--ors-text-muted)' }}>Alive Count:</span> <span className="font-medium">{validation.detected.alive_count ?? 'Not visible'}</span></div>
                <div><span style={{ color: 'var(--ors-text-muted)' }}>Zone Phase:</span> <span className="font-medium">{validation.detected.zone_phase || 'Not visible'}</span></div>
                <div><span style={{ color: 'var(--ors-text-muted)' }}>Map Detected:</span> <span className="font-medium">{validation.detected.map_guess || 'Not detected'}</span></div>
                <div><span style={{ color: 'var(--ors-text-muted)' }}>Kill Feed:</span> <span className="font-medium">{validation.detected.kill_feed_count}</span></div>
                <div><span style={{ color: 'var(--ors-text-muted)' }}>Confidence:</span> <span className="font-medium">{((validation.detected.confidence || 0) * 100).toFixed(0)}% ({validation.detected.confidence_label})</span></div>
              </div>
              <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--ors-border)' }}>
                <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>Selected: <span className="font-medium" style={{ color: 'var(--ors-text)' }}>{matchLabel}</span></p>
                {validation.detected.map_guess && matchInfo?.map && (
                  <p className="text-xs mt-1" style={{ color: validation.detected.map_guess.toLowerCase() === (matchInfo.map || '').toLowerCase() ? 'var(--ors-green)' : 'var(--ors-red)' }}>
                    {validation.detected.map_guess.toLowerCase() === (matchInfo.map || '').toLowerCase() ? 'Map matches selected match' : `Detected "${validation.detected.map_guess}" does NOT match "${matchInfo.map}"`}
                  </p>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={confirmValidation} className="btn-primary flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Confirm - Start Capture</button>
                <button onClick={rejectValidation} className="btn-secondary flex items-center gap-2" style={{ color: 'var(--ors-red)', borderColor: 'var(--ors-red)' }}><XCircle className="w-4 h-4" /> Wrong Match</button>
              </div>
            </div>
          )}
          {validation?.confirmed && !streaming && (
            <div className="rounded-lg p-3 flex items-center gap-2" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <CheckCircle className="w-5 h-5 text-green-500" /><span className="text-sm font-medium text-green-400">Screen validated - ready to go live</span>
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
          {/* Capture FPS (preview smoothness) */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>
              <Gauge className="w-3 h-3 inline mr-1" />CAPTURE FPS (Preview)
            </label>
            <select className="input" value={captureFps} onChange={e => setCaptureFps(Number(e.target.value))} disabled={streaming}>
              <option value={1}>1 FPS</option>
              <option value={2}>2 FPS</option>
              <option value={5}>5 FPS</option>
              <option value={10}>10 FPS</option>
              <option value={15}>15 FPS</option>
              <option value={24}>24 FPS (Smooth)</option>
            </select>
          </div>

          {/* OCR Mode (continuous) */}
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>
              <Zap className="w-3 h-3 inline mr-1" />OCR MODE
            </label>
            <div className="input flex items-center justify-center text-sm font-medium" style={{ color: 'var(--ors-accent)' }}>
              {streaming ? (ocrBusy ? 'Processing...' : 'Waiting for frame') : 'Continuous (auto)'}
            </div>
          </div>

          <div className="flex items-end">
            {!streaming ? (
              <button onClick={startCapture} className="btn-primary flex items-center gap-2 w-full justify-center" disabled={!canStartCapture()} style={{ opacity: canStartCapture() ? 1 : 0.5 }}>
                <Play className="w-4 h-4" /> Start Capture
              </button>
            ) : (
              <button onClick={stopCapture} className="btn-secondary flex items-center gap-2 w-full justify-center" style={{ color: 'var(--ors-red)', borderColor: 'var(--ors-red)' }}>
                <Square className="w-4 h-4" /> Stop Capture
              </button>
            )}
          </div>
        </div>

        {/* Rate info banner */}
        {streaming && (
          <div className="text-xs p-2 rounded flex items-center justify-between" style={{ background: 'var(--ors-bg-input)', color: 'var(--ors-text-muted)' }}>
            <span>
              Capturing at <span className="font-medium" style={{ color: 'var(--ors-accent)' }}>{captureFps} FPS</span> |
              Queue: <span className="font-medium">{queueDepth}</span> pending
            </span>
            <span className="flex items-center gap-3">
              {ocrBusy && <span style={{ color: 'var(--ors-yellow)' }} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> Gemini processing...
              </span>}
              {ocrLatency != null && <span>OCR: <span className="font-medium" style={{ color: ocrLatency > 5000 ? 'var(--ors-red)' : ocrLatency > 2000 ? 'var(--ors-yellow)' : 'var(--ors-accent)' }}>{(ocrLatency / 1000).toFixed(1)}s</span>/frame</span>}
              <span>Done: <span className="font-medium" style={{ color: 'var(--ors-accent)' }}>{processedCount}</span></span>
            </span>
          </div>
        )}

        {error && <p className="text-sm" style={{ color: 'var(--ors-red)' }}>{error}</p>}
      </div>

      {/* === Live Preview with Context Overlay === */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Live Preview</h2>
          {streaming && (
            <span className="badge badge-green flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> LIVE - {captureFps} FPS
            </span>
          )}
        </div>
        <div className="rounded-lg overflow-hidden relative" style={{ background: '#000' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ display: streaming || validating ? 'block' : 'none' }} />
          {(streaming || validating) && selectedMatch !== 'test' && (
            <div className="absolute top-3 left-3 rounded-lg px-3 py-2 space-y-1" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
              <div className="flex items-center gap-1.5 text-xs"><Trophy className="w-3 h-3 text-orange-400" /><span className="text-orange-400 font-medium">{tournamentName}</span></div>
              <div className="flex items-center gap-1.5 text-xs"><MapPin className="w-3 h-3 text-blue-400" /><span className="text-blue-400 font-medium">{matchLabel}</span></div>
              {validation?.confirmed && <div className="flex items-center gap-1 text-xs"><CheckCircle className="w-3 h-3 text-green-400" /><span className="text-green-400">Validated</span></div>}
            </div>
          )}
          {!streaming && !validating && (
            <div className="flex items-center justify-center h-72" style={{ color: 'var(--ors-text-muted)' }}>
              <div className="text-center"><Radio className="w-12 h-12 mx-auto mb-3 opacity-30" /><p className="text-sm">Select a tournament and match, validate your screen, then start capture</p></div>
            </div>
          )}
          {validating && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <div className="text-center"><div className="animate-spin w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full mx-auto mb-2"></div><p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Running OCR validation...</p></div>
            </div>
          )}
        </div>
      </div>

      {/* === Pipeline Stats === */}
      {(streaming || frameCount > 0) && (
        <div className="grid grid-cols-5 gap-4">
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>FRAMES CAPTURED</p>
            <p className="text-2xl font-bold mt-1">{frameCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>FRAMES PROCESSED</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ors-accent)' }}>{processedCount}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>OCR LATENCY</p>
            <p className="text-2xl font-bold mt-1" style={{ color: ocrLatency > 5000 ? 'var(--ors-red)' : ocrLatency > 2000 ? 'var(--ors-yellow)' : 'var(--ors-text)' }}>
              {ocrLatency != null ? `${(ocrLatency / 1000).toFixed(1)}s` : '-'}
            </p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>LAST CONFIDENCE</p>
            <p className="text-2xl font-bold mt-1">{lastConfidence != null ? `${(lastConfidence * 100).toFixed(0)}%` : '-'}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>DROPPED / ERRORS</p>
            <p className="text-2xl font-bold mt-1" style={{ color: pipelineErrors + droppedFrames > 0 ? 'var(--ors-red)' : 'var(--ors-text)' }}>{droppedFrames}/{pipelineErrors}</p>
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
