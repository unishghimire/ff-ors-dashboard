// Base44 API configuration
// The ORS dashboard communicates with the Superagent backend gateway function.
// The gateway is at: https://wren-9de01d4e.base44.app/functions/orsGateway
// Authentication: X-API-Key header with the ORS connection token.
//
// The connection token is auto-injected on first load and can be
// changed in Settings → Connection Token.

export const BASE44_APP_ID = '6a6321f7f7401f199de01d4e'

// The Superagent's external function URL — always works, no publish needed
const SUPERAGENT_DOMAIN = 'https://wren-9de01d4e.base44.app'
const GATEWAY_PATH = '/functions/orsGateway'

// Default connection token (pre-configured for the dashboard)
const DEFAULT_TOKEN = 'ORS-5b1ef207375dbe0dc9497d5466603741961e8a7d46afbaa8a3e8cbab92d5d2b3'

export function getAppDomain() {
  return localStorage.getItem('ors_app_domain') || SUPERAGENT_DOMAIN
}

export function setAppDomain(domain) {
  const clean = domain.replace(/\/$/, '')
  localStorage.setItem('ors_app_domain', clean)
}

export function getConnectionToken() {
  return localStorage.getItem('ors_connection_token') || DEFAULT_TOKEN
}

export function setConnectionToken(token) {
  localStorage.setItem('ors_connection_token', token)
}

// Legacy compat
export function getAuthToken() {
  return getConnectionToken()
}

export function setAuthToken(token) {
  setConnectionToken(token)
}

export function gatewayUrl() {
  return `${getAppDomain()}${GATEWAY_PATH}`
}

export function functionUrl(functionName) {
  return `${getAppDomain()}/functions/${functionName}`
}

export function isConfigured() {
  return !!getAppDomain() && !!getConnectionToken()
}

// Reset to Superagent defaults
export function resetToDefaults() {
  localStorage.removeItem('ors_app_domain')
  localStorage.removeItem('ors_connection_token')
}
