import { gatewayUrl, getAuthToken, setAuthToken, getAppDomain, setAppDomain } from '../config'

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = getAuthToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

// Gateway call — handles all entity CRUD and composite operations
export async function gateway(operation, params = {}) {
  const url = gatewayUrl()
  if (!url) throw new Error('App domain not configured. Go to Settings to set it.')
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ operation, ...params })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || `Gateway ${operation} failed: ${res.status}`)
  }
  return res.json()
}

// Entity CRUD via gateway
export async function listEntities(entityName, params = {}) {
  const operationMap = {
    Tournament: 'list_tournaments',
    Team: 'list_teams',
    Player: 'list_players',
    Match: 'list_matches',
    MatchParticipant: 'list_match_participants',
    ExternalApiDestination: 'list_api_destinations',
    RuleViolation: 'list_violations',
    MatchFrame: 'get_latest_frames'
  }
  const op = operationMap[entityName]
  if (!op) throw new Error(`No gateway operation for entity: ${entityName}`)
  const result = await gateway(op, params)
  return result.items || result || []
}

export async function createEntity(entityName, data) {
  const operationMap = {
    Tournament: 'create_tournament',
    Team: 'create_team',
    Player: 'create_player',
    Match: 'create_match',
    ExternalApiDestination: 'create_api_destination'
  }
  const op = operationMap[entityName]
  if (!op) throw new Error(`No gateway create operation for entity: ${entityName}`)
  return gateway(op, { data })
}

export async function updateEntity(entityName, id, data) {
  const operationMap = {
    Tournament: 'update_tournament',
    Team: 'update_team',
    Match: 'update_match',
    ExternalApiDestination: 'update_api_destination',
    RuleViolation: 'resolve_violation'
  }
  const op = operationMap[entityName]
  if (!op) throw new Error(`No gateway update operation for entity: ${entityName}`)
  if (entityName === 'RuleViolation') {
    return gateway('resolve_violation', { id })
  }
  return gateway(op, { id, data })
}

export async function deleteEntity(entityName, id) {
  throw new Error('Delete operations are not supported via gateway. Use the Base44 dashboard.')
}

// Backend function calls (for OCR pipeline)
export async function callFunction(functionName, body = {}) {
  const { functionUrl } = await import('../config')
  const url = functionUrl(functionName)
  if (!url) throw new Error('App domain not configured. Go to Settings to set it.')
  const res = await fetch(url, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Function ${functionName} failed: ${res.status}`)
  return res.json()
}

// Specialized operations
export async function getMatchSummary(matchId) {
  return gateway('get_match_summary', { match_id: matchId })
}

export async function getTournamentStandings(tournamentId) {
  return gateway('get_tournament_standings', { tournament_id: tournamentId })
}

export async function testApiDestination(destinationId) {
  return gateway('test_api_destination', { destination_id: destinationId })
}

export async function resolveViolation(id) {
  return gateway('resolve_violation', { id })
}

export { getAuthToken, setAuthToken, getAppDomain, setAppDomain }
