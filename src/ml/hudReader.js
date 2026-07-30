/**
 * TF.js HUD Reader — On-device ML model for Free Fire HUD extraction.
 */

import * as tf from '@tensorflow/tfjs'

const ALIVE_MODEL_URL = '/models/alive_counter/model.json'
const PHASE_MODEL_URL = '/models/phase_classifier/model.json'

const HUD_REGIONS = {
  alive_counter: { x: 560, y: 0, w: 160, h: 60 },
  zone_timer:    { x: 1080, y: 0, w: 200, h: 50 },
  kill_feed:     { x: 880, y: 50, w: 400, h: 150 },
  minimap:       { x: 980, y: 530, w: 300, h: 190 },
}

const PHASE_LABELS = ['lobby', 'loading', 'in_game', 'results']

let aliveModel = null
let phaseModel = null
let modelsLoaded = false
let loadingPromise = null

export async function loadModels() {
  if (modelsLoaded) return { alive: aliveModel !== null, phase: phaseModel !== null }
  if (loadingPromise) return loadingPromise

  loadingPromise = (async () => {
    try {
      console.log('[TF.js] Loading HUD models...')
      const results = await Promise.allSettled([
        tf.loadLayersModel(ALIVE_MODEL_URL),
        tf.loadLayersModel(PHASE_MODEL_URL),
      ])
      if (results[0].status === 'fulfilled') {
        aliveModel = results[0].value
        console.log('[TF.js] Alive counter model loaded')
      } else {
        console.warn('[TF.js] Alive counter model not found')
      }
      if (results[1].status === 'fulfilled') {
        phaseModel = results[1].value
        console.log('[TF.js] Phase classifier model loaded')
      } else {
        console.warn('[TF.js] Phase classifier model not found')
      }
      modelsLoaded = true
      return { alive: aliveModel !== null, phase: phaseModel !== null }
    } catch (e) {
      console.warn('[TF.js] Model loading failed:', e.message)
      modelsLoaded = true
      return { alive: false, phase: false }
    }
  })()
  return loadingPromise
}

export function areModelsReady() {
  return aliveModel !== null || phaseModel !== null
}

export async function predictAliveCount(source, tempCanvas) {
  if (!aliveModel) return null
  try {
    const region = HUD_REGIONS.alive_counter
    const srcW = source.videoWidth || source.width || 1280
    const srcH = source.videoHeight || source.height || 720
    const sx = Math.round(region.x * (srcW / 1280))
    const sy = Math.round(region.y * (srcH / 720))
    const sw = Math.round(region.w * (srcW / 1280))
    const sh = Math.round(region.h * (srcH / 720))
    tempCanvas.width = 100
    tempCanvas.height = 60
    const ctx = tempCanvas.getContext('2d')
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, 100, 60)
    const tensor = tf.browser.fromPixels(tempCanvas).expandDims(0).div(255.0).toFloat()
    const prediction = aliveModel.predict(tensor)
    const probs = await prediction.data()
    const aliveCount = probs.indexOf(Math.max(...probs))
    const confidence = Math.max(...probs)
    tensor.dispose()
    prediction.dispose()
    return { alive_count: aliveCount, confidence }
  } catch (e) {
    console.warn('[TF.js] Alive count prediction failed:', e.message)
    return null
  }
}

export async function predictPhase(source, tempCanvas) {
  if (!phaseModel) return null
  try {
    const srcW = source.videoWidth || source.width || 1280
    const srcH = source.videoHeight || source.height || 720
    tempCanvas.width = 224
    tempCanvas.height = 224
    const ctx = tempCanvas.getContext('2d')
    ctx.drawImage(source, 0, 0, srcW, srcH, 0, 0, 224, 224)
    const tensor = tf.browser.fromPixels(tempCanvas).expandDims(0).div(255.0).toFloat()
    const prediction = phaseModel.predict(tensor)
    const probs = await prediction.data()
    const phaseIdx = probs.indexOf(Math.max(...probs))
    const confidence = Math.max(...probs)
    tensor.dispose()
    prediction.dispose()
    return { game_phase: PHASE_LABELS[phaseIdx], confidence }
  } catch (e) {
    console.warn('[TF.js] Phase prediction failed:', e.message)
    return null
  }
}

export async function extractHUD(source, tempCanvas) {
  const [aliveResult, phaseResult] = await Promise.all([
    predictAliveCount(source, tempCanvas),
    predictPhase(source, tempCanvas),
  ])
  return {
    alive_count: aliveResult?.alive_count ?? null,
    game_phase: phaseResult?.game_phase ?? null,
    alive_confidence: aliveResult?.confidence ?? 0,
    phase_confidence: phaseResult?.confidence ?? 0,
    ml_only: aliveResult !== null && phaseResult !== null,
  }
}

export function shouldCallGemini(mlResult, prevAliveCount, prevPhase) {
  if (!mlResult.ml_only) return { needGemini: true, reason: 'ML models not available' }
  if (mlResult.game_phase !== prevPhase)
    return { needGemini: true, reason: `phase changed: ${prevPhase} -> ${mlResult.game_phase}` }
  if (mlResult.game_phase === 'results')
    return { needGemini: true, reason: 'results screen — need placements' }
  if (prevAliveCount !== null && mlResult.alive_count < prevAliveCount)
    return { needGemini: true, reason: `alive dropped: ${prevAliveCount} -> ${mlResult.alive_count}` }
  if (mlResult.alive_confidence < 0.7 || mlResult.phase_confidence < 0.7)
    return { needGemini: true, reason: 'low ML confidence' }
  return { needGemini: false, reason: 'ML confident — skipping Gemini' }
}

export { HUD_REGIONS, PHASE_LABELS }
