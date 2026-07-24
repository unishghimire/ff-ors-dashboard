import { entityUrl, functionUrl, getAuthToken, setAuthToken } from '../config'

function getHeaders() {
  const token = getAuthToken()
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

// Entity CRUD
export async function listEntities(entityName, params = {}) {
  const url = new URL(entityUrl(entityName))
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v)
  })
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) throw new Error(`Failed to list ${entityName}: ${res.status}`)
  const data = await res.json()
  return data.items || data || []
}

export async function createEntity(entityName, data) {
  const res = await fetch(entityUrl(entityName), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Failed to create ${entityName}: ${res.status}`)
  return res.json()
}

export async function updateEntity(entityName, id, data) {
  const res = await fetch(`${entityUrl(entityName)}/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error(`Failed to update ${entityName}: ${res.status}`)
  return res.json()
}

export async function deleteEntity(entityName, id) {
  const res = await fetch(`${entityUrl(entityName)}/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  })
  if (!res.ok) throw new Error(`Failed to delete ${entityName}: ${res.status}`)
  return res.json()
}

// Backend function calls
export async function callFunction(functionName, body = {}) {
  const res = await fetch(functionUrl(functionName), {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body)
  })
  if (!res.ok) throw new Error(`Function ${functionName} failed: ${res.status}`)
  return res.json()
}

export { getAuthToken, setAuthToken }
