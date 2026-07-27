// Base44 API configuration
// The ORS dashboard communicates with the Base44 backend through a single gateway function.
// Backend functions are accessible at https://<app-domain>/functions/<function-name>
// They use asServiceRole internally — NO authentication token needed for external HTTP calls.
//
// To find your app domain:
// 1. Open your Base44 app in the builder (https://app.base44.com)
// 2. Click "Publish" if not already published
// 3. Your app domain will be shown (e.g., https://ors.base44.app)

export const BASE44_APP_ID = '6a6321f7f7401f199de01d4e'

// Auto-detect the Base44 app domain
const DEFAULT_DOMAIN = 'https://ors.base44.app'

export function getAppDomain() {
  return localStorage.getItem('ors_app_domain') || DEFAULT_DOMAIN
}

export function setAppDomain(domain) {
  const clean = domain.replace(/\/$/, '')
  localStorage.setItem('ors_app_domain', clean)
}

export function getAuthToken() {
  return localStorage.getItem('base44_token') || ''
}

export function setAuthToken(token) {
  localStorage.setItem('base44_token', token)
}

export function gatewayUrl() {
  const domain = getAppDomain()
  if (!domain) return ''
  return `${domain}/functions/orsGateway`
}

export function functionUrl(functionName) {
  const domain = getAppDomain()
  if (!domain) return ''
  return `${domain}/functions/${functionName}`
}

export function isConfigured() {
  return !!getAppDomain()
}
