// ORS Gateway Configuration
// The backend runs as a Vercel serverless function at /api/gateway
// Auth: X-API-Key header with the ORS connection token

const DEFAULT_GATEWAY_URL = '/api/gateway';
const DEFAULT_TOKEN = 'ORS-5b1ef207375dbe0dc9497d5466603741961e8a7d46afbaa8a3e8cbab92d5d2b3';

export function gatewayUrl() {
  return localStorage.getItem('ors_gateway_url') || DEFAULT_GATEWAY_URL;
}

export function setGatewayUrl(url) {
  const clean = url.replace(/\/$/, '');
  localStorage.setItem('ors_gateway_url', clean);
}

export function getConnectionToken() {
  return localStorage.getItem('ors_connection_token') || DEFAULT_TOKEN;
}

export function setConnectionToken(token) {
  localStorage.setItem('ors_connection_token', token);
}

// Legacy compat
export function getAppDomain() { return gatewayUrl(); }
export function setAppDomain(d) { setGatewayUrl(d); }
export function getAuthToken() { return getConnectionToken(); }
export function setAuthToken(t) { setConnectionToken(t); }
export function functionUrl(name) { return gatewayUrl(); }
export function isConfigured() { return !!gatewayUrl() && !!getConnectionToken(); }
export function resetToDefaults() {
  localStorage.removeItem('ors_gateway_url');
  localStorage.removeItem('ors_connection_token');
}
