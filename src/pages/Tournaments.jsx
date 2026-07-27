import { useState, useEffect, useRef } from 'react'
import { listEntities, createEntity, deleteEntity, gateway } from '../api/client'
import { Plus, Trash2, Trophy, Users, Upload, FileSpreadsheet, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', format: 'squad', start_date: '', end_date: '', ruleset: 'Standard FF: 12pts for 1st, 1pt per kill' })

  // Excel import state
  const [showImport, setShowImport] = useState(false)
  const [excelData, setExcelData] = useState(null) // raw parsed rows
  const [excelHeaders, setExcelHeaders] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [importStep, setImportStep] = useState('upload') // upload -> map -> importing -> done
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [importTournament, setImportTournament] = useState(null) // tournament selected in import panel
  const fileRef = useRef(null)

  async function fetchData() {
    const t = await listEntities('Tournament').catch(() => [])
    setTournaments(t)
    if (t.length > 0 && !selectedTournament) {
      setSelectedTournament(t[0].id)
      setImportTournament(t[0].id)
    }
  }
  useEffect(() => { fetchData() }, [])

  async function fetchTournamentData(tid) {
    const [tm, pl] = await Promise.all([
      listEntities('Team', { tournament_id: tid }).catch(() => []),
      gateway('list_players_for_tournament', { tournament_id: tid }).catch(() => ({ items: [] }))
    ])
    setTeams(tm)
    setPlayers(pl.items || [])
  }
  useEffect(() => {
    if (selectedTournament) {
      fetchTournamentData(selectedTournament)
      // Reset import state when tournament changes
      if (showImport && importStep !== 'importing') {
        setExcelData(null)
        setExcelHeaders([])
        setColumnMapping({})
        setImportStep('upload')
        setImportResult(null)
        setImportError('')
        if (fileRef.current) fileRef.current.value = ''
      }
      setImportTournament(selectedTournament)
    }
  }, [selectedTournament])

  // Sync importTournament when tournament list changes
  useEffect(() => {
    if (!importTournament && tournaments.length > 0) {
      setImportTournament(selectedTournament || tournaments[0].id)
    }
  }, [tournaments])

  const selectedTournamentName = tournaments.find(t => t.id === importTournament)?.name || '—'

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

  // === Excel Import ===
  const FIELDS = [
    { key: 'name', label: 'Player Name', required: true },
    { key: 'ign', label: 'IGN (In-Game Name)', required: false },
    { key: 'uid', label: 'Free Fire UID', required: false },
    { key: 'team_name', label: 'Team Name', required: false },
    { key: 'team_code', label: 'Team Code', required: false },
  ]

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportError('')
    setImportResult(null)
    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) {
          setImportError('No data rows found in the Excel file.')
          return
        }
        const headers = Object.keys(rows[0])
        setExcelHeaders(headers)
        setExcelData(rows)
        // Auto-detect column mapping
        const autoMap = {}
        FIELDS.forEach(f => {
          const match = headers.find(h =>
            h.toLowerCase().includes(f.key.toLowerCase()) ||
            h.toLowerCase().includes(f.label.toLowerCase()) ||
            (f.key === 'name' && (h.toLowerCase() === 'name' || h.toLowerCase().includes('player'))) ||
            (f.key === 'ign' && (h.toLowerCase().includes('ign') || h.toLowerCase().includes('game name'))) ||
            (f.key === 'uid' && (h.toLowerCase().includes('uid') || h.toLowerCase().includes('ff id'))) ||
            (f.key === 'team_name' && (h.toLowerCase().includes('team') && !h.toLowerCase().includes('code'))) ||
            (f.key === 'team_code' && (h.toLowerCase().includes('code') || h.toLowerCase().includes('abbrev')))
          )
          if (match) autoMap[f.key] = match
        })
        setColumnMapping(autoMap)
        setImportStep('map')
      } catch (err) {
        setImportError(`Failed to parse Excel: ${err.message}`)
      }
    }
    reader.readAsArrayBuffer(file)
  }

  function mappedRows() {
    if (!excelData || !columnMapping.name) return []
    return excelData.map(row => {
      const mapped = {}
      FIELDS.forEach(f => {
        const col = columnMapping[f.key]
        if (col) mapped[f.key] = row[col]
      })
      // Default ign to name if not mapped
      if (!mapped.ign) mapped.ign = mapped.name
      return mapped
    }).filter(r => r.name)
  }

  async function doImport() {
    if (!importTournament) {
      setImportError('Select a tournament to import into.')
      return
    }
    setImportStep('importing')
    setImportError('')
    const rows = mappedRows()
    try {
      const result = await gateway('import_players', {
        tournament_id: importTournament,
        players: rows
      })
      setImportResult(result)
      setImportStep('done')
      // If imported into the currently viewed tournament, refresh its data
      if (importTournament === selectedTournament) {
        fetchTournamentData(selectedTournament)
      }
    } catch (err) {
      setImportError(`Import failed: ${err.message}`)
      setImportStep('map')
    }
  }

  function resetImport() {
    setShowImport(false)
    setExcelData(null)
    setExcelHeaders([])
    setColumnMapping({})
    setImportStep('upload')
    setImportResult(null)
    setImportError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function switchImportTournament(tid) {
    setImportTournament(tid)
    // Reset import state when switching target tournament
    setExcelData(null)
    setExcelHeaders([])
    setColumnMapping({})
    setImportStep('upload')
    setImportResult(null)
    setImportError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Manage tournaments, teams, and players</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(!showImport); if (!showImport) setImportTournament(selectedTournament) }} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import from Excel
          </button>
          <button onClick={() => setShowForm(!showForm)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Tournament
          </button>
        </div>
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

      {/* === Excel Import Panel === */}
      {showImport && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} />
              Import Players from Excel
            </h2>
            <button onClick={resetImport} className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Close</button>
          </div>

          {/* Tournament selector — shows which tournament data goes into */}
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--ors-bg)', border: '1px solid var(--ors-border)' }}>
            <Trophy className="w-4 h-4 shrink-0" style={{ color: 'var(--ors-accent)' }} />
            <span className="text-sm shrink-0" style={{ color: 'var(--ors-text-muted)' }}>Importing into:</span>
            <select
              className="input flex-1"
              value={importTournament || ''}
              onChange={e => switchImportTournament(e.target.value)}
              disabled={importStep === 'importing'}
            >
              <option value="">— Select tournament —</option>
              {tournaments.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Info banner showing teams count in target tournament */}
          {importTournament && importStep === 'upload' && (
            <div className="text-xs flex items-center gap-2" style={{ color: 'var(--ors-text-muted)' }}>
              <span>This tournament currently has <strong className="text-white">{teams.filter(t => t.tournament_id === importTournament).length}</strong> teams.</span>
              <span>Imported players will be added to this tournament only — other tournaments are unaffected.</span>
            </div>
          )}

          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
              <span className="text-sm" style={{ color: '#ef4444' }}>{importError}</span>
            </div>
          )}

          {/* Step 1: Upload */}
          {importStep === 'upload' && (
            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--ors-text-muted)' }}>
                Upload an Excel file (.xlsx or .xls). The first sheet will be used. Columns are auto-detected but you can remap them.
              </p>
              <div
                onClick={() => fileRef.current?.click()}
                className="rounded-lg p-8 text-center cursor-pointer transition-all"
                style={{
                  border: '2px dashed var(--ors-border)',
                  background: 'var(--ors-bg)',
                }}
              >
                <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ors-text-muted)' }} />
                <p className="text-sm font-medium">Click to select Excel file</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ors-text-muted)' }}>Supports .xlsx, .xls, .csv</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Step 2: Column Mapping */}
          {importStep === 'map' && excelData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ors-text-muted)' }}>
                <span>Found <strong className="text-white">{excelData.length}</strong> rows. Map columns to player fields:</span>
              </div>

              {/* Mapping selectors */}
              <div className="grid grid-cols-1 gap-3">
                {FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-48 shrink-0">
                      <span className="text-sm font-medium">{field.label}</span>
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </div>
                    <select
                      className="input flex-1"
                      value={columnMapping[field.key] || ''}
                      onChange={e => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}
                    >
                      <option value="">— Skip —</option>
                      {excelHeaders.map(h => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Preview table */}
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ors-border)' }}>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: 'var(--ors-bg)' }}>
                        <th className="px-3 py-2 text-left font-medium text-xs" style={{ color: 'var(--ors-text-muted)' }}>#</th>
                        {FIELDS.filter(f => columnMapping[f.key]).map(f => (
                          <th key={f.key} className="px-3 py-2 text-left font-medium text-xs" style={{ color: 'var(--ors-text-muted)' }}>
                            {f.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {mappedRows().slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--ors-border)' }}>
                          <td className="px-3 py-2 text-xs" style={{ color: 'var(--ors-text-muted)' }}>{i + 1}</td>
                          {FIELDS.filter(f => columnMapping[f.key]).map(f => (
                            <td key={f.key} className="px-3 py-2">{row[f.key] || '—'}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {mappedRows().length > 5 && (
                <p className="text-xs text-center" style={{ color: 'var(--ors-text-muted)' }}>
                  Showing 5 of {mappedRows().length} rows
                </p>
              )}

              {/* Import target reminder */}
              <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: 'var(--ors-bg)', border: '1px solid var(--ors-border)' }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--ors-accent)' }} />
                <span style={{ color: 'var(--ors-text-muted)' }}>
                  These <strong className="text-white">{mappedRows().length}</strong> players will be imported into <strong className="text-white">{selectedTournamentName}</strong>
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={doImport}
                  disabled={!columnMapping.name || !importTournament}
                  className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-4 h-4" /> Import {mappedRows().length} Players
                </button>
                <button onClick={() => setImportStep('upload')} className="btn-secondary">
                  Back
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Importing */}
          {importStep === 'importing' && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
                Importing {mappedRows().length} players to {selectedTournamentName}...
              </p>
            </div>
          )}

          {/* Step 4: Done */}
          {importStep === 'done' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <CheckCircle className="w-6 h-6" style={{ color: '#22c55e' }} />
                <div>
                  <p className="font-medium">Import complete!</p>
                  <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>
                    {importResult.imported} players imported to {selectedTournamentName}, {importResult.teams_created} new teams created.
                  </p>
                </div>
              </div>

              {importResult.errors && importResult.errors.length > 0 && (
                <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: '#ef4444' }}>
                    {importResult.errors.length} row(s) had errors:
                  </p>
                  <ul className="text-xs space-y-1" style={{ color: 'var(--ors-text-muted)' }}>
                    {importResult.errors.map((e, i) => <li key={i}>{e}</li>)}
                  </ul>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={() => { resetImport(); setShowImport(true); setImportStep('upload') }} className="btn-secondary">
                  Import Another File
                </button>
                <button onClick={resetImport} className="btn-primary">Done</button>
              </div>
            </div>
          )}
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
                        {player.ign && player.ign !== player.name && <span style={{ color: 'var(--ors-text-muted)' }}>({player.ign})</span>}
                        {player.in_game_uid && <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>UID: {player.in_game_uid}</span>}
                        {player.status === 'eliminated' && <span className="badge badge-red">eliminated</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {teams.length === 0 && <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No teams yet. Click Add Team or import from Excel to get started.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
