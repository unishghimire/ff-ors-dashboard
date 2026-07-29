import { useState, useEffect, useRef } from 'react'
import { listEntities, createEntity, updateEntity, deleteEntity, gateway } from '../api/client'
import { Plus, Trash2, Trophy, Users, Upload, FileSpreadsheet, CheckCircle, XCircle, Edit3, AlertTriangle } from 'lucide-react'


// === Modal Component ===
function Modal({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="rounded-xl shadow-2xl w-full mx-4" style={{ background: 'var(--ors-surface)', border: '1px solid var(--ors-border)', maxWidth: wide ? '640px' : '480px' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid var(--ors-border)' }}>
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose} className="text-2xl leading-none" style={{ color: 'var(--ors-text-muted)' }}>&times;</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

// === Confirm Delete Modal ===
function ConfirmDelete({ title, message, detail, onConfirm, onCancel }) {
  return (
    <Modal title="Confirm Delete" onClose={onCancel}>
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg p-2 shrink-0" style={{ background: 'rgba(239,68,68,0.1)' }}>
            <AlertTriangle className="w-5 h-5" style={{ color: '#ef4444' }} />
          </div>
          <div>
            <p className="font-medium">{title}</p>
            <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>{message}</p>
            {detail && <p className="text-xs mt-2 p-2 rounded" style={{ background: 'rgba(239,68,68,0.05)', color: '#ef4444' }}>{detail}</p>}
          </div>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ background: '#ef4444', color: '#fff' }}>Delete</button>
        </div>
      </div>
    </Modal>
  )
}

// === Tournament Form Modal ===
function TournamentModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', format: 'squad', start_date: '', end_date: '', ruleset: 'Standard FF: 12pts for 1st, 1pt per kill', status: 'scheduled' })
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial

  return (
    <Modal title={isEdit ? 'Edit Tournament' : 'New Tournament'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Tournament Name *</label>
          <input className="input" placeholder="e.g. Free Fire Championship 2026" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Format</label>
            <select className="input" value={form.format} onChange={e => setForm({ ...form, format: e.target.value })}>
              <option value="squad">Squad (4v4)</option>
              <option value="duo">Duo</option>
              <option value="solo">Solo</option>
              <option value="clash_squad">Clash Squad</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Status</label>
            <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
              <option value="scheduled">Scheduled</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Start Date</label>
            <input type="datetime-local" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>End Date</label>
            <input type="datetime-local" className="input" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Ruleset</label>
          <input className="input" placeholder="Ruleset description" value={form.ruleset} onChange={e => setForm({ ...form, ruleset: e.target.value })} />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={async () => { if (!form.name) return; setSaving(true); await onSave(form); setSaving(false); }} disabled={saving || !form.name} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Tournament'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// === Team Form Modal ===
function TeamModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', team_code: '' })
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial

  return (
    <Modal title={isEdit ? 'Edit Team' : 'New Team'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Team Name *</label>
          <input className="input" placeholder="e.g. Nepal Elite" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Team Code (short)</label>
          <input className="input" placeholder="e.g. NEL" value={form.team_code} onChange={e => setForm({ ...form, team_code: e.target.value.toUpperCase() })} maxLength={6} />
        </div>
        {isEdit && (
          <div>
            <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Total Kills</label>
            <input type="number" className="input" placeholder="0" value={form.total_kills || 0} onChange={e => setForm({ ...form, total_kills: parseInt(e.target.value) || 0 })} />
          </div>
        )}
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={async () => { if (!form.name) return; setSaving(true); await onSave(form); setSaving(false); }} disabled={saving || !form.name} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// === Player Form Modal ===
function PlayerModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', ign: '', in_game_uid: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const isEdit = !!initial

  return (
    <Modal title={isEdit ? 'Edit Player' : 'New Player'} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Real Name *</label>
          <input className="input" placeholder="e.g. Aarav Sharma" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>IGN (In-Game Name)</label>
          <input className="input" placeholder="e.g. A4RAV" value={form.ign} onChange={e => setForm({ ...form, ign: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Free Fire UID</label>
          <input className="input" placeholder="e.g. 287382363" value={form.in_game_uid} onChange={e => setForm({ ...form, in_game_uid: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium block mb-1" style={{ color: 'var(--ors-text-muted)' }}>Status</label>
          <select className="input" value={form.status || 'active'} onChange={e => setForm({ ...form, status: e.target.value })}>
            <option value="active">Active</option>
            <option value="eliminated">Eliminated</option>
            <option value="substitute">Substitute</option>
          </select>
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={async () => { if (!form.name) return; setSaving(true); await onSave(form); setSaving(false); }} disabled={saving || !form.name} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Player'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// === Main Component ===
export default function Tournaments() {
  const [tournaments, setTournaments] = useState([])
  const [teams, setTeams] = useState([])
  const [players, setPlayers] = useState([])
  const [selectedTournament, setSelectedTournament] = useState(null)
  const [loading, setLoading] = useState(false)

  // Modal state
  const [modal, setModal] = useState(null) // { type: 'tournament'|'team'|'player', mode: 'create'|'edit', data: {...} }
  const [deleteModal, setDeleteModal] = useState(null) // { type, data, message, detail }

  // Excel import state
  const [showImport, setShowImport] = useState(false)
  const [excelData, setExcelData] = useState(null)
  const [excelHeaders, setExcelHeaders] = useState([])
  const [columnMapping, setColumnMapping] = useState({})
  const [importStep, setImportStep] = useState('upload')
  const [importResult, setImportResult] = useState(null)
  const [importError, setImportError] = useState('')
  const [importTournament, setImportTournament] = useState(null)
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
    setLoading(true)
    const [tm, pl] = await Promise.all([
      listEntities('Team', { tournament_id: tid }).catch(() => []),
      gateway('list_players_for_tournament', { tournament_id: tid }).catch(() => ({ items: [] }))
    ])
    setTeams(tm)
    setPlayers(pl.items || [])
    setLoading(false)
  }
  useEffect(() => {
    if (selectedTournament) {
      fetchTournamentData(selectedTournament)
      if (showImport && importStep !== 'importing') resetImportState()
      setImportTournament(selectedTournament)
    }
  }, [selectedTournament])

  useEffect(() => {
    if (!importTournament && tournaments.length > 0) setImportTournament(selectedTournament || tournaments[0].id)
  }, [tournaments])

  const selectedTournamentObj = tournaments.find(t => t.id === selectedTournament)
  const importTournamentName = tournaments.find(t => t.id === importTournament)?.name || '—'

  // === Tournament CRUD ===
  async function saveTournament(form) {
    if (modal?.mode === 'edit') {
      await updateEntity('Tournament', modal.data.id, form)
    } else {
      await createEntity('Tournament', form)
    }
    setModal(null)
    await fetchData()
  }

  async function deleteTournament(t) {
    const teamCount = teams.length
    const playerCount = players.length
    let detail = ''
    if (teamCount > 0) detail += `${teamCount} team(s) will be deleted. `
    if (playerCount > 0) detail += `${playerCount} player(s) will be deleted.`
    setDeleteModal({
      type: 'tournament',
      data: t,
      message: `Delete "${t.name}" and all its teams and players?`,
      detail: detail || 'No teams or players attached.'
    })
  }

  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!deleteModal) return
    const { type, data } = deleteModal
    setDeleting(true)
    try {
      if (type === 'tournament') {
        // Gateway cascades: deletes all teams + players + tournament in one batch
        await deleteEntity('Tournament', data.id).catch(() => {})
        if (selectedTournament === data.id) setSelectedTournament(null)
        await fetchData()
      } else if (type === 'team') {
        // Gateway cascades: deletes team + its players in one batch
        await deleteEntity('Team', data.id).catch(() => {})
        await fetchTournamentData(selectedTournament)
      } else if (type === 'player') {
        await deleteEntity('Player', data.id).catch(() => {})
        await fetchTournamentData(selectedTournament)
      }
    } finally {
      setDeleting(false)
      setDeleteModal(null)
    }
  }

  // === Team CRUD ===
  async function saveTeam(form) {
    if (modal?.mode === 'edit') {
      await updateEntity('Team', modal.data.id, { ...form, tournament_id: selectedTournament })
    } else {
      await createEntity('Team', { ...form, tournament_id: selectedTournament, total_kills: form.total_kills || 0 })
    }
    setModal(null)
    await fetchTournamentData(selectedTournament)
  }

  // === Player CRUD ===
  async function savePlayer(form) {
    if (modal?.mode === 'edit') {
      await updateEntity('Player', modal.data.id, form)
    } else {
      await createEntity('Player', { ...form, team_id: modal?.teamId, status: form.status || 'active' })
    }
    setModal(null)
    await fetchTournamentData(selectedTournament)
  }

  // === Excel Import ===
  const FIELDS = [
    { key: 'name', label: 'Player Name', required: true },
    { key: 'ign', label: 'IGN (In-Game Name)', required: false },
    { key: 'uid', label: 'Free Fire UID', required: false },
    { key: 'team_name', label: 'Team Name', required: false },
    { key: 'team_code', label: 'Team Code', required: false },
  ]

  function resetImportState() {
    setExcelData(null); setExcelHeaders([]); setColumnMapping({}); setImportStep('upload'); setImportResult(null); setImportError('')
    if (fileRef.current) fileRef.current.value = ''
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setImportError(''); setImportResult(null)
    const reader = new FileReader()
    reader.onload = async (evt) => {
      try {
        const data = new Uint8Array(evt.target.result)
        const XLSX = await import('xlsx')
        const wb = XLSX.read(data, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) { setImportError('No data rows found in the Excel file.'); return }
        const headers = Object.keys(rows[0])
        setExcelHeaders(headers); setExcelData(rows)
        const autoMap = {}
        FIELDS.forEach(f => {
          const match = headers.find(h =>
            h.toLowerCase().includes(f.key.toLowerCase()) || h.toLowerCase().includes(f.label.toLowerCase()) ||
            (f.key === 'name' && (h.toLowerCase() === 'name' || h.toLowerCase().includes('player'))) ||
            (f.key === 'ign' && (h.toLowerCase().includes('ign') || h.toLowerCase().includes('game name'))) ||
            (f.key === 'uid' && (h.toLowerCase().includes('uid') || h.toLowerCase().includes('ff id'))) ||
            (f.key === 'team_name' && (h.toLowerCase().includes('team') && !h.toLowerCase().includes('code'))) ||
            (f.key === 'team_code' && (h.toLowerCase().includes('code') || h.toLowerCase().includes('abbrev')))
          )
          if (match) autoMap[f.key] = match
        })
        setColumnMapping(autoMap); setImportStep('map')
      } catch (err) { setImportError(`Failed to parse Excel: ${err.message}`) }
    }
    reader.readAsArrayBuffer(file)
  }

  function mappedRows() {
    if (!excelData || !columnMapping.name) return []
    return excelData.map(row => {
      const mapped = {}
      FIELDS.forEach(f => { const col = columnMapping[f.key]; if (col) mapped[f.key] = row[col] })
      if (!mapped.ign) mapped.ign = mapped.name
      return mapped
    }).filter(r => r.name)
  }

  async function doImport() {
    if (!importTournament) { setImportError('Select a tournament to import into.'); return }
    setImportStep('importing'); setImportError('')
    try {
      const result = await gateway('import_players', { tournament_id: importTournament, players: mappedRows() })
      setImportResult(result); setImportStep('done')
      if (importTournament === selectedTournament) fetchTournamentData(selectedTournament)
    } catch (err) { setImportError(`Import failed: ${err.message}`); setImportStep('map') }
  }

  function resetImport() { setShowImport(false); resetImportState() }
  function switchImportTournament(tid) { setImportTournament(tid); resetImportState() }

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tournaments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--ors-text-muted)' }}>Manage tournaments, teams, and players</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setShowImport(!showImport); if (!showImport) setImportTournament(selectedTournament) }} className="btn-secondary flex items-center gap-2">
            <Upload className="w-4 h-4" /> Import from Excel
          </button>
          <button onClick={() => setModal({ type: 'tournament', mode: 'create' })} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Tournament
          </button>
        </div>
      </div>

      {/* Excel Import Panel */}
      {showImport && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Import Players from Excel
            </h2>
            <button onClick={resetImport} className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Close</button>
          </div>
          <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'var(--ors-bg)', border: '1px solid var(--ors-border)' }}>
            <Trophy className="w-4 h-4 shrink-0" style={{ color: 'var(--ors-accent)' }} />
            <span className="text-sm shrink-0" style={{ color: 'var(--ors-text-muted)' }}>Importing into:</span>
            <select className="input flex-1" value={importTournament || ''} onChange={e => switchImportTournament(e.target.value)} disabled={importStep === 'importing'}>
              <option value="">— Select tournament —</option>
              {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          {importTournament && importStep === 'upload' && (
            <div className="text-xs flex items-center gap-2" style={{ color: 'var(--ors-text-muted)' }}>
              <span>This tournament currently has <strong className="text-white">{teams.filter(t => t.tournament_id === importTournament).length}</strong> teams.</span>
              <span>Imported players go to this tournament only — others are unaffected.</span>
            </div>
          )}
          {importError && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <XCircle className="w-4 h-4" style={{ color: '#ef4444' }} />
              <span className="text-sm" style={{ color: '#ef4444' }}>{importError}</span>
            </div>
          )}
          {importStep === 'upload' && (
            <div>
              <p className="text-sm mb-3" style={{ color: 'var(--ors-text-muted)' }}>Upload an Excel file (.xlsx or .xls). The first sheet will be used. Columns are auto-detected but you can remap them.</p>
              <div onClick={() => fileRef.current?.click()} className="rounded-lg p-8 text-center cursor-pointer transition-all" style={{ border: '2px dashed var(--ors-border)', background: 'var(--ors-bg)' }}>
                <Upload className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--ors-text-muted)' }} />
                <p className="text-sm font-medium">Click to select Excel file</p>
                <p className="text-xs mt-1" style={{ color: 'var(--ors-text-muted)' }}>Supports .xlsx, .xls, .csv</p>
              </div>
              <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileUpload} style={{ display: 'none' }} />
            </div>
          )}
          {importStep === 'map' && excelData && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--ors-text-muted)' }}>
                <span>Found <strong className="text-white">{excelData.length}</strong> rows. Map columns to player fields:</span>
              </div>
              <div className="grid grid-cols-1 gap-3">
                {FIELDS.map(field => (
                  <div key={field.key} className="flex items-center gap-4">
                    <div className="w-48 shrink-0"><span className="text-sm font-medium">{field.label}</span>{field.required && <span className="text-red-500 ml-1">*</span>}</div>
                    <select className="input flex-1" value={columnMapping[field.key] || ''} onChange={e => setColumnMapping({ ...columnMapping, [field.key]: e.target.value })}>
                      <option value="">— Skip —</option>
                      {excelHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--ors-border)' }}>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full text-sm">
                    <thead><tr style={{ background: 'var(--ors-bg)' }}>
                      <th className="px-3 py-2 text-left font-medium text-xs" style={{ color: 'var(--ors-text-muted)' }}>#</th>
                      {FIELDS.filter(f => columnMapping[f.key]).map(f => <th key={f.key} className="px-3 py-2 text-left font-medium text-xs" style={{ color: 'var(--ors-text-muted)' }}>{f.label}</th>)}
                    </tr></thead>
                    <tbody>
                      {mappedRows().slice(0, 5).map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--ors-border)' }}>
                          <td className="px-3 py-2 text-xs" style={{ color: 'var(--ors-text-muted)' }}>{i + 1}</td>
                          {FIELDS.filter(f => columnMapping[f.key]).map(f => <td key={f.key} className="px-3 py-2">{row[f.key] || '—'}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              {mappedRows().length > 5 && <p className="text-xs text-center" style={{ color: 'var(--ors-text-muted)' }}>Showing 5 of {mappedRows().length} rows</p>}
              <div className="flex items-center gap-2 p-2 rounded-lg text-xs" style={{ background: 'var(--ors-bg)', border: '1px solid var(--ors-border)' }}>
                <Trophy className="w-3.5 h-3.5" style={{ color: 'var(--ors-accent)' }} />
                <span style={{ color: 'var(--ors-text-muted)' }}>These <strong className="text-white">{mappedRows().length}</strong> players will be imported into <strong className="text-white">{importTournamentName}</strong></span>
              </div>
              <div className="flex gap-3">
                <button onClick={doImport} disabled={!columnMapping.name || !importTournament} className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                  <Upload className="w-4 h-4" /> Import {mappedRows().length} Players
                </button>
                <button onClick={() => setImportStep('upload')} className="btn-secondary">Back</button>
              </div>
            </div>
          )}
          {importStep === 'importing' && (
            <div className="text-center py-8">
              <div className="inline-block w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>Importing {mappedRows().length} players to {importTournamentName}...</p>
            </div>
          )}
          {importStep === 'done' && importResult && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 rounded-lg" style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)' }}>
                <CheckCircle className="w-6 h-6" style={{ color: '#22c55e' }} />
                <div>
                  <p className="font-medium">Import complete!</p>
                  <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>{importResult.imported} players imported to {importTournamentName}, {importResult.teams_created} new teams created.</p>
                </div>
              </div>
              {importResult.errors?.length > 0 && (
                <div className="p-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  <p className="text-sm font-medium mb-2" style={{ color: '#ef4444' }}>{importResult.errors.length} row(s) had errors:</p>
                  <ul className="text-xs space-y-1" style={{ color: 'var(--ors-text-muted)' }}>{importResult.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
                </div>
              )}
              <div className="flex gap-3">
                <button onClick={() => { resetImportState(); setImportStep('upload') }} className="btn-secondary">Import Another File</button>
                <button onClick={resetImport} className="btn-primary">Done</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tournament Tabs with Edit/Delete */}
      <div className="card p-4">
        <div className="flex flex-wrap gap-2">
          {tournaments.map(t => (
            <div key={t.id} className={`flex items-center gap-1 rounded-lg ${selectedTournament === t.id ? 'bg-orange-500 text-white' : 'btn-secondary'}`}>
              <button onClick={() => setSelectedTournament(t.id)} className="px-4 py-2 text-sm font-medium">
                {t.name}
              </button>
              <button onClick={() => setModal({ type: 'tournament', mode: 'edit', data: t })} className={`px-1.5 py-2 text-xs ${selectedTournament === t.id ? 'text-white/70 hover:text-white' : 'hover:text-white'}`} title="Edit tournament">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => deleteTournament(t)} className={`px-1.5 py-2 text-xs mr-1 ${selectedTournament === t.id ? 'text-white/70 hover:text-red-300' : 'hover:text-red-400'}`} title="Delete tournament">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {tournaments.length === 0 && <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No tournaments yet. Click "New Tournament" to create one.</p>}
        </div>
      </div>

      {/* Teams & Players */}
      {selectedTournament && (
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold flex items-center gap-2"><Trophy className="w-5 h-5" style={{ color: 'var(--ors-accent)' }} /> Teams {loading && <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>loading...</span>}</h2>
            <button onClick={() => setModal({ type: 'team', mode: 'create' })} className="btn-secondary flex items-center gap-2 text-xs">
              <Plus className="w-3.5 h-3.5" /> Add Team
            </button>
          </div>
          <div className="space-y-3">
            {teams.map(team => {
              const teamPlayers = players.filter(p => p.team_id === team.id)
              return (
                <div key={team.id} className="rounded-lg p-4" style={{ background: 'var(--ors-bg)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{team.name}</span>
                      {team.team_code && <span className="badge badge-gray">{team.team_code}</span>}
                      <span className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>{team.total_kills || 0} kills · {teamPlayers.length} player{teamPlayers.length !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setModal({ type: 'team', mode: 'edit', data: team })} className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg" style={{ color: 'var(--ors-text-muted)', border: '1px solid var(--ors-border)' }} title="Edit team">
                        <Edit3 className="w-3 h-3" /> Edit
                      </button>
                      <button onClick={() => setDeleteModal({ type: 'team', data: team, message: `Delete "${team.name}" and all its players?`, detail: `${teamPlayers.length} player(s) will be deleted.` })} className="text-xs flex items-center gap-1 px-2 py-1.5 rounded-lg" style={{ color: '#ef4444', border: '1px solid var(--ors-border)' }} title="Delete team">
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                      <button onClick={() => setModal({ type: 'player', mode: 'create', teamId: team.id })} className="text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg" style={{ color: 'var(--ors-accent)', border: '1px solid var(--ors-border)' }}>
                        <Plus className="w-3 h-3" /> Add Player
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {teamPlayers.map(player => (
                      <div key={player.id} className="flex items-center gap-2 text-sm px-3 py-2 rounded-lg group" style={{ background: 'var(--ors-surface)' }}>
                        <Users className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--ors-text-muted)' }} />
                        <div className="flex-1 min-w-0">
                          <span className="truncate">{player.name}</span>
                          {player.ign && player.ign !== player.name && <span style={{ color: 'var(--ors-text-muted)' }}> ({player.ign})</span>}
                          {player.in_game_uid && <span className="text-xs ml-1" style={{ color: 'var(--ors-text-muted)' }}>UID: {player.in_game_uid}</span>}
                          {player.status === 'eliminated' && <span className="badge badge-red ml-1">eliminated</span>}
                          {player.status === 'substitute' && <span className="badge badge-gray ml-1">sub</span>}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setModal({ type: 'player', mode: 'edit', data: player })} className="p-1 rounded" style={{ color: 'var(--ors-text-muted)' }} title="Edit player">
                            <Edit3 className="w-3 h-3" />
                          </button>
                          <button onClick={() => setDeleteModal({ type: 'player', data: player, message: `Delete player "${player.name}"?`, detail: 'This cannot be undone.' })} className="p-1 rounded" style={{ color: '#ef4444' }} title="Delete player">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {teamPlayers.length === 0 && <p className="text-xs" style={{ color: 'var(--ors-text-muted)' }}>No players yet. Click "Add Player" or import from Excel.</p>}
                  </div>
                </div>
              )
            })}
            {teams.length === 0 && <p className="text-sm" style={{ color: 'var(--ors-text-muted)' }}>No teams yet. Click "Add Team" or import from Excel to get started.</p>}
          </div>
        </div>
      )}

      {/* === Modals === */}
      {modal?.type === 'tournament' && (
        <TournamentModal
          initial={modal.mode === 'edit' ? modal.data : null}
          onSave={saveTournament}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'team' && (
        <TeamModal
          initial={modal.mode === 'edit' ? modal.data : null}
          onSave={saveTeam}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'player' && (
        <PlayerModal
          initial={modal.mode === 'edit' ? modal.data : null}
          onSave={savePlayer}
          onClose={() => setModal(null)}
        />
      )}
      {deleteModal && (
        <ConfirmDelete
          title={deleteModal.data?.name || deleteModal.data?.name || 'Item'}
          message={deleteModal.message}
          detail={deleteModal.detail}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteModal(null)}
        />
      )}
    </div>
  )
}
