import { gatewayUrl, getConnectionToken, setConnectionToken, setGatewayUrl } from '../config'

function getHeaders() {
  const headers = { 'Content-Type': 'application/json' }
  const token = getConnectionToken()
  if (token) headers['X-API-Key'] = token
  return headers
}

// Gateway call — handles all entity CRUD and composite operations
export async function gateway(operation, params = {}) {
  const url = gatewayUrl()
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
    ExternalApiDestination: 'create_api_destination',
    MatchParticipant: 'create_match_participant'
  }
  const op = operationMap[entityName]
  if (!op) throw new Error(`No gateway create operation for entity: ${entityName}`)
  return gateway(op, { data })
}

export async function updateEntity(entityName, id, data) {
  const operationMap = {
    Tournament: 'update_tournament',
    Team: 'update_team',
    Player: 'update_player',
    Match: 'update_match',
    ExternalApiDestination: 'update_api_destination',
    MatchParticipant: 'update_match_participant'
  }
  const op = operationMap[entityName]
  if (!op) throw new Error(`No gateway update operation for entity: ${entityName}`)
  if (entityName === 'RuleViolation') return gateway('resolve_violation', { id })
  return gateway(op, { id, data })
}

export async function deleteEntity(entityName, id) {
  const operationMap = {
    Tournament: 'delete_tournament',
    Team: 'delete_team',
    Player: 'delete_player',
    Match: 'delete_match',
    ExternalApiDestination: 'delete_api_destination'
  }
  const op = operationMap[entityName]
  if (!op) throw new Error(`No gateway delete operation for entity: ${entityName}`)
  return gateway(op, { id })
}

// Backend function calls (OCR pipeline)
export async function callFunction(functionName, body = {}) {
  const opMap = {
    ingestCapturedFrame: 'ingest_frame',
    runOcrVisionProcessing: 'process_frame',
    pushMatchDataToExternal: 'push_match_data',
    captureAndProcess: 'capture_and_process'
  }
  const op = opMap[functionName] || functionName
  return gateway(op, body)
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

export async function seedData() {
  return gateway('seed_data')
}

// Check gateway health
export async function checkGatewayHealth() {
  try {
    const res = await fetch(gatewayUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'gateway_status' })
    })
    return res.ok
  } catch {
    return false
  }
}

export { getConnectionToken, setConnectionToken, setGatewayUrl }
