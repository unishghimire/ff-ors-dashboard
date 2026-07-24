import { useState, useEffect } from 'react'
import { listEntities, createEntity, updateEntity } from '../api/client'
import { Plus, Calendar, MapPin } from 'lucide-react'

export default function Matches() {
  const [tournaments, setTournaments] = useState([])
  const [matches, setMatches] = useState([])
  const [selectedTournament, setSelectedTournament] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ match_number: 1, map: 'Bermuda', scheduled_at: '', observer_feed_label: 'Spectator 1' })

  useEffect(() => { listEntities('Tournament').then(t => { setTournaments(t); if (t.length > 0) setSelectedTournament(t[0].id) }).catch(() => {}) }, [])

  async function fetchMatches() {
    if (!selectedTournament) return
    const m = await listEntities('Match').catch(() => [])
    setMatches(m.filter(x => x.tournament_id === selectedTournament))
  }
  useEffect(() => { fetchMatches() }, [selectedTournament])

  async function createMatch() {
    if (!selectedTournament) return
    await createEntity('Match', { ...form, tournament_id: selectedTournament, status: 'scheduled' })
    setForm({ match_number: form.match_number + 1, map: 'Bermuda', scheduled_at: '', observer_feed_label: 'Spectator 1' })
    setShowForm(false)
    fetchMatches()
  }

  async function updateMatchStatus(id, status) {
    await updateEntity('Match', id, { status })
    fetchMatches()
  }

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
                <option value="Bermuda">Bermuda</option>
                <option value="Purgatory">Purgatory</option>
                <option value="Kalahari">Kalahari</option>
                <option value="Alpine">Alpine</option>
                <option value="Nexterra">Nexterra</option>
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
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`badge badge-${m.status === 'in_match' ? 'green' : m.status === 'results' ? 'orange' : m.status === 'lobby' ? 'yellow' : 'gray'}`}>{m.status}</span>
                  <select value={m.status} onChange={e => updateMatchStatus(m.id, e.target.value)} className="input" style={{ width: 'auto', padding: '6px 8px' }}>
                    <option value="scheduled">scheduled</option>
                    <option value="lobby">lobby</option>
                    <option value="in_match">in_match</option>
                    <option value="results">results</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
