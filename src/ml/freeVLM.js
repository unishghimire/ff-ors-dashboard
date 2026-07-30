/**
 * Free VLM Engine — Ollama (local) or Hugging Face (cloud)
 *
 * Replaces Gemini with a free Vision-Language Model.
 * No API key needed for Ollama (runs locally).
 * Hugging Face free tier requires a token (free to create).
 *
 * Supported models:
 *   Ollama:     llava:7b, qwen2-vl:7b, minicpm-v:8b
 *   HuggingFace: Qwen/Qwen2-VL-7B-Instruct, meta-llama/Llama-3.2-11B-Vision-Instruct
 */

// === VLM Provider Configuration ===

// Ollama runs locally at http://localhost:11434
// No API key needed. Free. No rate limits.
const OLLAMA_URL = 'http://localhost:11434/api/chat'

// Default Ollama VLM model (best for structured extraction)
const OLLAMA_MODEL = 'llava:7b'

// Hugging Face Inference API (free tier)
// Get token at: https://huggingface.co/settings/tokens
const HF_URL = 'https://api-inference.huggingface.co/models'
const HF_MODEL = 'Qwen/Qwen2-VL-7B-Instruct'

// Same prompt as Gemini — outputs structured JSON
const VLM_PROMPT = `You are a Free Fire esports HUD reader. Look at this screenshot and extract data as JSON only, no other text:
{"game_phase":"lobby|loading|in_game|results","map_name":null,"alive_count":null,"total_players":null,"zone_phase":null,"kill_feed":[{"killer":"","victim":""}],"player_stats":[{"name":"","kills":0}],"placements":[{"team":"","placement":0,"kills":0}],"confidence":0.0}
Set null for fields not visible. Only include kill_feed entries that are clearly visible. Only include placements if this is a results screen.`

/**
 * Run OCR using Ollama (local VLM — free, no API key)
 *
 * @param {string} base64Image - base64 encoded image
 * @param {string} mimeType - image mime type
 * @param {string} model - Ollama model name (default: llava:7b)
 * @returns {Promise<object>} parsed JSON result
 */
export async function runOllamaOCR(base64Image, mimeType = 'image/jpeg', model = OLLAMA_MODEL) {
  // Ollama accepts images as base64 in the chat API
  const response = await fetch(OLLAMA_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      messages: [
        {
          role: 'user',
          content: VLM_PROMPT,
          images: [base64Image],
        }
      ],
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 1024,
      }
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Ollama error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text = data.message?.content || ''

  // Extract JSON from the response (VLMs sometimes wrap JSON in markdown)
  return parseVLMResponse(text)
}

/**
 * Run OCR using Hugging Face Inference API (cloud, free tier)
 *
 * @param {string} base64Image - base64 encoded image
 * @param {string} mimeType - image mime type
 * @param {string} hfToken - Hugging Face token (free)
 * @returns {Promise<object>} parsed JSON result
 */
export async function runHuggingFaceOCR(base64Image, mimeType, hfToken) {
  if (!hfToken) throw new Error('Hugging Face token required')

  const url = `${HF_URL}/${HF_MODEL}`
  const imageBlob = base64ToBlob(base64Image, mimeType)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${hfToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {
        image: base64Image,
        prompt: VLM_PROMPT,
      },
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`HuggingFace error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const text = data[0]?.generated_text || data.generated_text || ''

  return parseVLMResponse(text)
}

/**
 * Check if Ollama is running locally
 * @returns {Promise<{available: boolean, models: string[], error: string|null}>}
 */
export async function checkOllama() {
  try {
    const response = await fetch('http://localhost:11434/api/tags', {
      signal: AbortSignal.timeout(2000),
    })
    if (!response.ok) return { available: false, models: [], error: `HTTP ${response.status}` }
    const data = await response.json()
    const vlmModels = (data.models || [])
      .filter(m => ['llava', 'qwen2-vl', 'minicpm-v', 'bakllava', 'llama3.2-vision'].some(n => m.name.includes(n)))
      .map(m => m.name)
    return { available: true, models: vlmModels, error: null }
  } catch (e) {
    return { available: false, models: [], error: e.message }
  }
}

/**
 * Parse VLM response — extracts JSON from text
 * Handles markdown code blocks, extra text, etc.
 */
function parseVLMResponse(text) {
  // Try direct JSON parse first
  try {
    return JSON.parse(text)
  } catch {}

  // Try extracting from markdown code block
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[1])
    } catch {}
  }

  // Try finding JSON object in text
  const objMatch = text.match(/\{[\s\S]*\}/)
  if (objMatch) {
    try {
      return JSON.parse(objMatch[0])
    } catch {}
  }

  // Fallback — return raw text with low confidence
  return {
    game_phase: 'unknown',
    confidence: 0,
    _raw: text.substring(0, 500),
    _parse_error: true,
  }
}

function base64ToBlob(base64, mimeType) {
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mimeType })
}

export { VLM_PROMPT, OLLAMA_MODEL, OLLAMA_URL, HF_MODEL, HF_URL }
