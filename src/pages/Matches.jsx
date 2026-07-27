import { useState, useEffect } from 'react'
import { listEntities, createEntity, updateEntity, deleteEntity } from '../api/client'
import { Plus, Calendar, MapPin, AlertCircle, Pencil, Trash2, X } from 'lucide-react'

const LOCAL_MATCHES_KEY = 'ors_local_matches'

export default function Matches() {
  const [tournaments, setTournaments] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editModal, setEditModal] = useState(null) // match object or null
  const [deleteModal, setDeleteModal] = useState(null) // { data, message }
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({ match_number: 1, map: 'Bermuda', scheduled_at: '', observer_feed_label: 'Spectator 1' })
  const [editForm, setEditForm] = useState({})
  const [backendConnected, setBackendConnected] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    listEntities('Tournament').then(t => {
      setTournaments(t)
      if (t.length > 0) setSelectedTournament(t[0].id)
      setBackendConnected(true)
    }).catch(() => {
      setBackendConnected(false)
      const defaultT = { id: 'local-tournament', name: 'Free Fire Championship 2026' }
      setTournaments([defaultT])
      setSelectedTournament('local-tournament')
      const local = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || '[]')
      setMatches(local)
    })
  }, [])

  async function fetchMatches() {
    if (!selectedTournament) return
    if (selectedTournament.startsWith('local-')) {
      const local = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || '[]')
      setMatches(local)
      return
    }
    const m = await listEntities('Match', { tournament_id: selectedTournament, limit: 500 }).catch(() => [])
    setMatches(m)
  }
  useEffect(() => { fetchMatches() }, [selectedTournament])

  async function createMatch() {
    if (!selectedTournament) return
    setError('')
    if (selectedTournament.startsWith('local-')) {
      const local = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || '[]')
      const newMatch = { id: `local-match-${Date.now()}`, ...form, tournament_id: selectedTournament, status: 'scheduled', created_at: new Date().toISOString() }
      local.push(newMatch)
      localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(local))
      setMatches(local)
      setForm({ match_number: form.match_number + 1, map: 'Bermuda', scheduled_at: '', observer_feed_label: 'Spectator 1' })
      setShowForm(false)
      return
    }
    try {
      await createEntity('Match', { ...form, tournament_id: selectedTournament, status: 'scheduled' })
      setForm({ match_number: form.match_number + 1, map: 'Bermuda', scheduled_at: '', observer_feed_label: 'Spectator 1' })
      setShowForm(false)
      fetchMatches()
    } catch (e) { setError(`Failed to create match: ${e.message}`) }
  }

  function openEdit(m) {
    const dt = m.scheduled_at ? new Date(m.scheduled_at).toISOString().slice(0, 16) : ''
    setEditForm({ ...m, scheduled_at: dt })
    setEditModal(m)
  }

  async function saveEdit() {
    if (!editModal) return
    setError('')
    const data = {
      match_number: Number(editForm.match_number),
      map: editForm.map,
      scheduled_at: editForm.scheduled_at ? new Date(editForm.scheduled_at).toISOString() : null,
      observer_feed_label: editForm.observer_feed_label || 'Spectator 1',
      status: editForm.status || 'scheduled'
    }
    if (editModal.id.startsWith('local-')) {
      const local = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || '[]')
      const updated = local.map(m => m.id === editModal.id ? { ...m, ...data } : m)
      localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(updated))
      setMatches(updated)
    } else {
      try {
        await updateEntity('Match', editModal.id, data)
        fetchMatches()
      } catch (e) { setError(`Failed to update match: ${e.message}`) }
    }
    setEditModal(null)
  }

  async function confirmDelete() {
    if (!deleteModal) return
    setDeleting(true)
    try {
      if (deleteModal.data.id.startsWith('local-')) {
        const local = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || '[]')
        const updated = local.filter(m => m.id !== deleteModal.data.id)
        localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(updated))
        setMatches(updated)
      } else {
        await deleteEntity('Match', deleteModal.data.id).catch(() => {})
        fetchMatches()
      }
    } finally {
      setDeleting(false)
      setDeleteModal(null)
    }
  }

  async function updateMatchStatus(id, status) {
    if (id.startsWith('local-')) {
      const local = JSON.parse(localStorage.getItem(LOCAL_MATCHES_KEY) || '[]')
      const updated = local.map(m => m.id === id ? { ...m, status } : m)
      localStorage.setItem(LOCAL_MATCHES_KEY, JSON.stringify(updated))
      setMatches(updated)
      return
    }
    try {
      await updateEntity('Match', id, { status })
      fetchMatches()
    } catch (e) { setError(`Failed to update match: ${e.message}`) }
  }

  const MAPS = ['Bermuda', 'Purgatory', 'Kalahari', 'Alpine', 'Nexterra']
  const STATUS_COLORS = { scheduled: 'gray', lobby: 'yellow', in_match: 'green', results: 'orange', cancelled: 'gray' }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Matches</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Schedule and manage matches</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Match
        </button>
      </div>

      {!backendConnected && (
        <div className="card p-4 border-l-4" style={{ borderColor: 'var(--ors-yellow)' }}>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--ors-yellow)' }} />
            <div className="text-sm">
              <p className="font-medium mb-1">Local Mode — Backend Not Connected</p>
              <p style={{ color: 'var(--ors-text-muted)' }}>
                Matches are saved locally in your browser. They will sync to the backend once you configure your Base44 app domain in{' '}
                <a href="/settings" className="underline" style={{ color: 'var(--ors-accent)' }}>Settings</a>.
              </p>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="card p-3 border-l-4" style={{ borderColor: 'var(--ors-red)' }}>
          <span className="text-sm" style={{ color: 'var(--ors-red)' }}>{error}</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto scroll-thin">
        {tournaments.map(t => (
          <button key={t.id} onClick={() => setSelectedTournament(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedTournament === t.id ? 'btn-primary' : 'btn-secondary'}`}>
            {t.name}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold">Schedule Match</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>MATCH NUMBER</label>
              <input type="number" className="input" value={form.match_number} onChange={e => setForm({...form, match_number: Number(e.target.value)})} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>MAP</label>
              <select className="input" value={form.map} onChange={e => setForm({...form, map: e.target.value})}>
                {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>SCHEDULED AT</label>
              <input type="datetime-local" className="input" value={form.scheduled_at} onChange={e => setForm({...form, scheduled_at: e.target.value})} />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>OBSERVER FEED</label>
              <input className="input" placeholder="Spectator 1" value={form.observer_feed_label} onChange={e => setForm({...form, observer_feed_label: e.target.value})} />
            </div>
          </div>
          <button onClick={createMatch} className="btn-primary">Schedule Match</button>
        </div>
      )}

      <div className="space-y-2">
        {matches.length === 0 ? (
          <div className="card p-8 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No matches scheduled. Click New Match to create one.</p>
          </div>
        ) : (
          matches.map(m => (
            <div key={m.id} className="card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'var(--ors-border)' }}>
                    <span className="font-bold text-sm">{m.match_number}</span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">Match #{m.match_number}</div>
                    <div className="flex items-center gap-3 text-xs mt-0.5" style={{ color: 'var(--ors-text-muted)' }}>
                      <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {m.map}</span>
                      {m.observer_feed_label && <span>Feed: {m.observer_feed_label}</span>}
                      {m.scheduled_at && <span>{new Date(m.scheduled_at).toLocaleString()}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge badge-${STATUS_COLORS[m.status] || 'gray'}`}>{m.status}</span>
                  <select value={m.status} onChange={e => updateMatchStatus(m.id, e.target.value)} className="input" style={{ width: 'auto', padding: '6px 8px' }}>
                    <option value="scheduled">scheduled</option>
                    <option value="lobby">lobby</option>
                    <option value="in_match">in_match</option>
                    <option value="results">results</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <button onClick={() => openEdit(m)} className="p-1.5 rounded-lg" style={{ color: 'var(--ors-text-muted)' }} title="Edit match">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => setDeleteModal({ data: m, message: `Delete Match #${m.match_number} (${m.map})? Match participants and captured frames will also be deleted.` })}
                    className="p-1.5 rounded-lg" style={{ color: 'var(--ors-red)' }} title="Delete match">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card p-6 w-full max-w-md space-y-4" style={{ background: 'var(--ors-bg-card)' }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Edit Match #{editModal.match_number}</h2>
              <button onClick={() => setEditModal(null)} className="p-1 rounded" style={{ color: 'var(--ors-text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>MATCH NUMBER</label>
                <input type="number" className="input" value={editForm.match_number || ''} onChange={e => setEditForm({...editForm, match_number: Number(e.target.value)})} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>MAP</label>
                <select className="input" value={editForm.map || 'Bermuda'} onChange={e => setEditForm({...editForm, map: e.target.value})}>
                  {MAPS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>STATUS</label>
                <select className="input" value={editForm.status || 'scheduled'} onChange={e => setEditForm({...editForm, status: e.target.value})}>
                  <option value="scheduled">scheduled</option>
                  <option value="lobby">lobby</option>
                  <option value="in_match">in_match</option>
                  <option value="results">results</option>
                  <option value="cancelled">cancelled</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>SCHEDULED AT</label>
                <input type="datetime-local" className="input" value={editForm.scheduled_at || ''} onChange={e => setEditForm({...editForm, scheduled_at: e.target.value})} />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--ors-text-muted)' }}>OBSERVER FEED</label>
                <input className="input" value={editForm.observer_feed_label || ''} onChange={e => setEditForm({...editForm, observer_feed_label: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setEditModal(null)} className="btn-secondary">Cancel</button>
              <button onClick={saveEdit} className="btn-primary">Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className="card p-6 w-full max-w-md space-y-4" style={{ background: 'var(--ors-bg-card)' }}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg p-2 shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
                <Trash2 className="w-5 h-5" style={{ color: '#ef4444' }} />
              </div>
              <div>
                <p className="font-medium">Match #{deleteModal.data.match_number} — {deleteModal.data.map}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>{deleteModal.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setDeleteModal(null)} disabled={deleting} className="btn-secondary" style={{ opacity: deleting ? 0.5 : 1 }}>Cancel</button>
              <button onClick={confirmDelete} disabled={deleting}
                className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2" style={{ background: '#ef4444', color: '#fff', opacity: deleting ? 0.6 : 1 }}>
                {deleting ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#fff' }}></span>
                    Deleting...
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
