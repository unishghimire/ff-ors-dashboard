// Base44 API configuration
// The app calls Base44 backend functions and entity APIs
export const BASE44_APP_ID = '6a6321f7f7401f199de01d4e'
export const BASE44_API_BASE = 'https://app.base44.com/api'

// Get the auth token from localStorage (set in Settings page)
export function getAuthToken() {
  return localStorage.getItem('base44_token') || ''
}

export function setAuthToken(token) {
  localStorage.setItem('base44_token', token)
}

// API endpoints
export function entityUrl(entityName) {
  return `${BASE44_API_BASE}/apps/${BASE44_APP_ID}/entities/${entityName}`
}

export function functionUrl(functionName) {
  return `${BASE44_API_BASE}/apps/${BASE44_APP_ID}/backend-functions/${functionName}`
}
