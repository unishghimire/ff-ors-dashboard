import { useState, useRef, useEffect, useCallback } from 'react'
import { listEntities, callFunction } from '../api/client'
import { Radio, Play, Square, Camera, Activity, AlertCircle } from 'lucide-react'

export default function Capture() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [fps, setFps] = useState(1)
  const [frameCount, setFrameCount] = useState(0)
  const [lastConfidence, setLastConfidence] = useState(null)
  const [lastPhase, setLastPhase] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [backendConnected, setBackendConnected] = useState(true)
  const [pipelineErrors, setPipelineErrors] = useState(0)

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const captureTimerRef = useRef(null) // recursive setTimeout
  const pendingTimeoutsRef = useRef([]) // track OCR setTimeouts for cleanup
  const isCapturingRef = useRef(false) // prevent overlapping captureFrame
  const frameCountRef = useRef(0) // stable counter, avoids stale closure
  const selectedMatchRef = useRef('')
  const fpsRef = useRef(1)
  const backendConnectedRef = useRef(true)

  // Keep refs in sync with state
  useEffect(() => { selectedMatchRef.current = selectedMatch }, [selectedMatch])
  useEffect(() => { fpsRef.current = fps }, [fps])
  useEffect(() => { backendConnectedRef.current = backendConnected }, [backendConnected])

  useEffect(() => {
    listEntities('Match').then(m => {
      setMatches(m)
      if (m.length > 0) setSelectedMatch(m[0].id)
      setBackendConnected(true)
    }).catch(() => {
      setBackendConnected(false)
      setSelectedMatch('test')
    })
    return () => stopCapture()
  }, [])

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
      setStatus('Capturing screen...')
      setFrameCount(0)
      setPipelineErrors(0)
      frameCountRef.current = 0
      isCapturingRef.current = false

      stream.getVideoTracks()[0].addEventListener('ended', () => stopCapture())

      // Use recursive setTimeout — waits for each captureFrame to finish before scheduling next
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
      scheduleNextCapture() // only schedule next AFTER current finishes
    }, intervalMs)
  }

  async function captureFrame() {
    // Prevent overlapping — skip if previous frame still processing
    if (isCapturingRef.current) return
    if (!videoRef.current || !canvasRef.current || !streamRef.current) return

    isCapturingRef.current = true
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    // JPEG 0.7 quality — much faster than PNG, 10x smaller payload
    const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1]

    frameCountRef.current += 1
    const frameNum = frameCountRef.current
    // Only update React state every 5 frames to avoid re-render lag
    if (frameNum % 5 === 0 || frameNum === 1) {
      setFrameCount(frameNum)
    }

    const matchId = selectedMatchRef.current
    const isTestMode = matchId === 'test' || !backendConnectedRef.current

    if (isTestMode) {
      setFrameCount(frameNum)
      setStatus(`Frame ${frameNum} captured (test mode). Screen sharing is working!`)
      isCapturingRef.current = false
      return
    }

    // Production — fire and forget, don't block next capture
    processFrameInBackground(frameNum, base64, matchId)
    isCapturingRef.current = false
  }

  async function processFrameInBackground(frameNum, base64, matchId) {
    try {
      const result = await callFunction('ingestCapturedFrame', {
        match_id: matchId,
        frame_number: frameNum,
        image_base64: base64,
        captured_at: new Date().toISOString()
      })
      if (result.frame_id) {
        setStatus(`Frame ${frameNum} ingested. Running OCR...`)
        // Track timeout so we can cancel on stop
        const timer = setTimeout(async () => {
          try {
            const ocrResult = await callFunction('runOcrVisionProcessing', { frame_id: result.frame_id })
            if (ocrResult) {
              setLastConfidence(ocrResult.ocr_confidence)
              setLastPhase(ocrResult.game_phase)
              setStatus(`Frame ${frameNum} processed. Confidence: ${(ocrResult.ocr_confidence * 100).toFixed(0)}%`)
              // Fire remaining steps in parallel — don't block
              Promise.allSettled([
                callFunction('normalizeFrameData', { frame_id: result.frame_id }),
                callFunction('detectRuleViolation', { match_id: matchId, frame_id: result.frame_id }),
                callFunction('pushMatchDataToExternal', { match_id: matchId })
              ])
            }
          } catch (e) {
            setPipelineErrors(prev => prev + 1)
            setStatus(`Frame ${frameNum}: OCR error: ${e.message}`)
          }
        }, 2000)
        pendingTimeoutsRef.current.push(timer)
      }
    } catch (e) {
      setPipelineErrors(prev => prev + 1)
      setStatus(`Frame ${frameNum}: backend error: ${e.message}`)
    }
  }

  function stopCapture() {
    // Clear the recursive capture timer
    if (captureTimerRef.current) {
      clearTimeout(captureTimerRef.current)
      captureTimerRef.current = null
    }
    // Clear all pending OCR timeouts
    pendingTimeoutsRef.current.forEach(t => clearTimeout(t))
    pendingTimeoutsRef.current = []
    // Stop video tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) videoRef.current.srcObject = null
    isCapturingRef.current = false
    // Final frame count sync
    setFrameCount(frameCountRef.current)
    setStreaming(false)
    setStatus('Capture stopped')
  }

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
              <p className="font-medium mb-1">Test Mode — Backend Not Connected</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                Screen sharing will work, but the OCR pipeline is disabled. Configure your Base44 app domain in{' '}
                <a href="/settings" className="underline" style={{ color: 'var(--ors-accent)' }}>Settings</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>SELECT MATCH</label>
            <select className="input" value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)} disabled={streaming}>
              <option value="test">Test Mode (no match)</option>
              {matches.map(m => <option key={m.id} value={m.id}>Match #{m.match_number} — {m.map || 'No map'} ({m.status})</option>)}
            </select>
          </div>
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
              <button onClick={startCapture} className="btn-primary flex items-center gap-2 w-full justify-center">
                <Play className="w-4 h-4" /> Start Capture
              </button>
            ) : (
              <button onClick={stopCapture} className="btn-secondary flex items-center gap-2 w-full justify-center" style={{ color: 'var(--ors-red)', borderColor: 'var(--ors-red)' }}>
                <Square className="w-4 h-4" /> Stop Capture
              </button>
            )}
          </div>
        </div>
        {error && <p className="text-sm" style={{ color: 'var(--ors-red)' }}>{error}</p>}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Live Preview</h2>
          {streaming && <span className="badge badge-green flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> LIVE</span>}
        </div>
        <div className="rounded-lg overflow-hidden" style={{ background: '#000' }}>
          <video ref={videoRef} autoPlay playsInline muted className="w-full" style={{ display: streaming ? 'block' : 'none' }} />
          {!streaming && (
            <div className="flex items-center justify-center h-72" style={{ color: 'var(--ors-text-muted)' }}>
              <div className="text-center">
                <Radio className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a match (or use Test Mode) and click Start Capture</p>
              </div>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="stat-tile">
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--ors-text-muted)' }}>FRAMES CAPTURED</div>
          <div className="text-2xl font-bold">{frameCount}</div>
        </div>
        <div className="stat-tile">
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--ors-text-muted)' }}>LAST OCR CONFIDENCE</div>
          <div className="text-2xl font-bold" style={{ color: lastConfidence >= 0.6 ? 'var(--ors-green)' : 'var(--ors-yellow)' }}>
            {lastConfidence !== null ? `${(lastConfidence * 100).toFixed(0)}%` : '—'}
          </div>
        </div>
        <div className="stat-tile">
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--ors-text-muted)' }}>LAST GAME PHASE</div>
          <div className="text-2xl font-bold capitalize">{lastPhase || '—'}</div>
        </div>
        <div className="stat-tile">
          <div className="text-xs font-medium mb-1" style={{ color: 'var(--ors-text-muted)' }}>PIPELINE ERRORS</div>
          <div className="text-2xl font-bold" style={{ color: pipelineErrors > 0 ? 'var(--ors-red)' : 'var(--ors-green)' }}>
            {pipelineErrors}
          </div>
        </div>
      </div>

      {status && (
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
            <span className="text-sm font-mono">{status}</span>
          </div>
        </div>
      )}
    </div>
  )
}
