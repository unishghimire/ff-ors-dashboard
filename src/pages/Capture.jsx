import { useState, useRef, useEffect } from 'react'
import { listEntities, callFunction } from '../api/client'
import { Radio, Play, Square, Camera, Activity } from 'lucide-react'

export default function Capture() {
  const [matches, setMatches] = useState([])
  const [selectedMatch, setSelectedMatch] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [fps, setFps] = useState(2)
  const [frameCount, setFrameCount] = useState(0)
  const [lastConfidence, setLastConfidence] = useState(null)
  const [lastPhase, setLastPhase] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const captureIntervalRef = useRef(null)

  useEffect(() => { listEntities('Match').then(m => { setMatches(m); if (m.length > 0) setSelectedMatch(m[0].id) }).catch(() => {}) }, [])

  async function startCapture() {
    if (!selectedMatch) { setError('Select a match first'); return }
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
      startFrameCapture()
    } catch (e) {
      setError(`Screen capture failed: ${e.message}`)
      setStreaming(false)
    }
  }

  function startFrameCapture() {
    const intervalMs = 1000 / fps
    captureIntervalRef.current = setInterval(captureFrame, intervalMs)
  }

  async function captureFrame() {
    if (!videoRef.current || !canvasRef.current) return
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 1280
    canvas.height = video.videoHeight || 720
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const base64 = canvas.toDataURL('image/png').split(',')[1]

    try {
      const result = await callFunction('ingestCapturedFrame', {
        match_id: selectedMatch,
        frame_number: frameCount + 1,
        image_base64: base64,
        captured_at: new Date().toISOString()
      })
      setFrameCount(prev => prev + 1)
      if (result.frame_id) {
        setStatus(`Frame ${frameCount + 1} ingested. Running OCR...`)
        // Run OCR after a brief delay
        setTimeout(async () => {
          const ocrResult = await callFunction('runOcrVisionProcessing', { frame_id: result.frame_id }).catch(() => null)
          if (ocrResult) {
            setLastConfidence(ocrResult.ocr_confidence)
            setLastPhase(ocrResult.game_phase)
            setStatus(`Frame ${frameCount + 1} processed. Confidence: ${(ocrResult.ocr_confidence * 100).toFixed(0)}%`)
            // Normalize and detect violations
            await callFunction('normalizeFrameData', { frame_id: result.frame_id }).catch(() => {})
            await callFunction('detectRuleViolation', { match_id: selectedMatch, frame_id: result.frame_id }).catch(() => {})
            // Push to external APIs
            await callFunction('pushMatchDataToExternal', { match_id: selectedMatch }).catch(() => {})
          }
        }, 2000)
      }
    } catch (e) {
      setStatus(`Frame capture error: ${e.message}`)
    }
  }

  function stopCapture() {
    if (captureIntervalRef.current) { clearInterval(captureIntervalRef.current); captureIntervalRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    if (videoRef.current) videoRef.current.srcObject = null
    setStreaming(false)
    setStatus('Capture stopped')
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Screen Capture</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Capture live Free Fire spectator feed and process through OCR pipeline</p>
      </div>

      {/* Controls */}
      <div className="card p-5 space-y-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>SELECT MATCH</label>
            <select className="input" value={selectedMatch} onChange={e => setSelectedMatch(e.target.value)} disabled={streaming}>
              <option value="">Select a match...</option>
              {matches.map(m => <option key={m.id} value={m.id}>Match #{m.match_number} — {m.status}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>CAPTURE FPS</label>
            <select className="input" value={fps} onChange={e => setFps(Number(e.target.value))} disabled={streaming}>
              <option value={1}>1 FPS (Low)</option>
              <option value={2}>2 FPS (Normal)</option>
              <option value={5}>5 FPS (High)</option>
              <option value={10}>10 FPS (Max)</option>
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

      {/* Preview */}
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
                <p className="text-sm">Select a match and click Start Capture</p>
              </div>
            </div>
          )}
        </div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Processing stats */}
      <div className="grid grid-cols-3 gap-4">
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
      </div>

      {/* Status log */}
      {status && (
        <div className="card p-4">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4" style={{ color: 'var(--ors-accent)' }} />
            <span className="text-sm">{status}</span>
          </div>
        </div>
      )}
    </div>
  )
}
