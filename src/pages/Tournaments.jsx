import { useState, useEffect } from 'react'
import { listEntities, createEntity, deleteEntity } from '../api/client'
import { Plus, Trash2, Trophy, Users } from 'lucide-react'

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', format: 'squad', start_date: '', end_date: '', ruleset: 'Standard FF: 12pts for 1st, 1pt per kill' })

  async function fetchData() {
    const t = await listEntities('Tournament').catch(() => [])
    setTournaments(t)
    if (t.length > 0 && !selectedTournament) setSelectedTournament(t[0].id)
  }
  useEffect(() => { fetchData() }, [])

  async function fetchTournamentData(tid) {
    const [tm, pl] = await Promise.all([
      listEntities('Team', { filter: JSON.stringify({ tournament_id: tid }) }).catch(() => []),
      listEntities('Player').catch(() => [])
    ])
    setTeams(tm)
    setPlayers(pl)
  }
  useEffect(() => { if (selectedTournament) fetchTournamentData(selectedTournament) }, [selectedTournament])

  async function createTournament() {
    if (!form.name) return
    await createEntity('Tournament', form)
    setForm({ name: '', format: 'squad', start_date: '', end_date: '', ruleset: 'Standard FF: 12pts for 1st, 1pt per kill' })
    setShowForm(false)
    fetchData()
  }

  async function addTeam() {
    const name = prompt('Team name:')
    if (!name || !selectedTournament) return
    const code = prompt('Team code (short):') || ''
    await createEntity('Team', { tournament_id: selectedTournament, name, team_code: code, total_kills: 0 })
    fetchTournamentData(selectedTournament)
  }

  async function addPlayer(teamId) {
    const name = prompt('Player real name:')
    if (!name) return
    const ign = prompt('In-game name (IGN):') || name
    const uid = prompt('Free Fire UID:') || ''
    await createEntity('Player', { team_id: teamId, name, ign, in_game_uid: uid, status: 'active' })
    fetchTournamentData(selectedTournament)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Manage tournaments, teams, and players</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Tournament
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4">
          <h2 className="text-lg font-bold">Create Tournament</h2>
          <div className="grid grid-cols-2 gap-4">
            <input className="input" placeholder="Tournament name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            <select className="input" value={form.format} onChange={e => setForm({...form, format: e.target.value})}>
              <option value="squad">Squad (4v4)</option>
              <option value="duo">Duo</option>
              <option value="solo">Solo</option>
              <option value="clash_squad">Clash Squad</option>
            </select>
            <input type="datetime-local" className="input" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} />
            <input type="datetime-local" className="input" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} />
          </div>
          <input className="input" placeholder="Ruleset description" value={form.ruleset} onChange={e => setForm({...form, ruleset: e.target.value})} />
          <button onClick={createTournament} className="btn-primary">Create Tournament</button>
        </div>
      )}

      {/* Tournament list */}
      <div className="card p-5">
        <div className="flex gap-2 mb-4 overflow-x-auto scroll-thin">
          {tournaments.map(t => (
            <button key={t.id} onClick={() => setSelectedTournament(t.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${selectedTournament === t.id ? 'btn-primary' : 'btn-secondary'}`}>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {selectedTournament && (
        <>
          {/* Teams */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Teams</h2>
              <button onClick={addTeam} className="btn-secondary flex items-center gap-2 text-xs">
                <Plus className="w-3.5 h-3.5" /> Add Team
              </button>
            </div>
            <div className="space-y-3">
              {teams.map(team => (
                <div key={team.id} className="rounded-lg p-4" style={{ background: 'var(--ors-bg)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{team.name}</span>
                      {team.team_code && <span className="badge badge-gray">{team.team_code}</span>}
                      <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>{team.total_kills || 0} kills</span>
                    </div>
                    <button onClick={() => addPlayer(team.id)} className="text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ color: 'var(--ors-accent)', border: '1px solid var(--ors-border)' }}>
                      <Plus className="w-3 h-3" /> Add Player
                    </button>
                  </div>
                  {/* Players */}
                  <div className="grid grid-cols-2 gap-2">
                    {players.filter(p => p.team_id === team.id).map(player => (
                      <div key={player.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg" style={{ background: 'var(--ors-surface)' }}>
                        <Users className="w-3.5 h-3.5" style={{ color: 'var(--ors-text-muted)' }} />
                        <span>{player.name}</span>
                        {player.ign && <span style={{ color: 'var(--ors-text-muted)' }}>({player.ign})</span>}
                        {player.status === 'eliminated' && <span className="badge badge-red">eliminated</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {teams.length === 0 && <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No teams yet. Click Add Team to get started.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
