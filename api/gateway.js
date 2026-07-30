/**
 * ORS Gateway — Vercel serverless backend using Firebase Firestore.
 * Replaces the Base44 orsGateway function.
 * Uses Firebase Admin SDK for Firestore + Gemini API for OCR.
 */
import admin from 'firebase-admin';

// === Config ===
const ORS_API_KEY = process.env.ORS_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const PLACEMENT_POINTS = { 1: 12, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3, 9: 2, 10: 1 };
const KILL_POINT = 1;

// === Firebase Init (cached for serverless reuse) ===
let dbInstance = null;
function getDb() {
  if (dbInstance) return dbInstance;
  if (admin.apps.length === 0) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
    admin.initializeApp({ credential: admin.credential.cert(sa), projectId: sa.project_id });
  }
  dbInstance = admin.firestore();
  return dbInstance;
}

// === Helpers ===
const now = () => new Date().toISOString();
const docData = d => d.exists ? { id: d.id, ...d.data() } : null;
const snapData = s => s.docs.map(docData);

async function listColl(db, coll, params) {
  let q = db.collection(coll);
  const hasFilter = params.tournament_id || params.match_id || params.team_id || params.status || params.resolved !== undefined;
  if (params.tournament_id) q = q.where('tournament_id', '==', params.tournament_id);
  if (params.match_id) q = q.where('match_id', '==', params.match_id);
  if (params.team_id) q = q.where('team_id', '==', params.team_id);
  if (params.status) q = q.where('status', '==', params.status);
  if (params.resolved !== undefined) q = q.where('resolved', '==', params.resolved);
  q = q.limit(Math.min(params.limit || 100, 500));
  // When there's a filter, skip orderBy (avoids composite index requirement + double query)
  // and sort in memory instead
  const snap = await q.get();
  const items = snapData(snap);
  items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return items;
}

async function createDoc(db, coll, data) {
  const doc = { ...data, created_at: now(), updated_at: now() };
  const ref = await db.collection(coll).add(doc);
  const snap = await ref.get();
  return docData(snap);
}

async function updateDoc(db, coll, id, data) {
  await db.collection(coll).doc(id).update({ ...data, updated_at: now() });
  const snap = await db.collection(coll).doc(id).get();
  return docData(snap);
}

// === Auth ===
function checkAuth(req) {
  if (!ORS_API_KEY) return { ok: false, status: 503, error: 'Server missing ORS_API_KEY env var' };
  const key = req.headers['x-api-key'];
  if (key !== ORS_API_KEY) return { ok: false, status: 401, error: 'Invalid or missing API key' };
  return { ok: true };
}

// === OCR via Gemini ===
async function runGeminiOCR(imageData, mimeType = 'image/jpeg') {
  if (!GOOGLE_API_KEY) throw new Error('GOOGLE_API_KEY not set');
  // Shorter prompt = fewer input tokens = faster response
  const prompt = `Free Fire screenshot. Extract as JSON only:
{"game_phase":"lobby|loading|in_game|results","map_name":null,"alive_count":null,"total_players":null,"zone_phase":null,"kill_feed":[],"player_stats":[],"placements":[],"confidence":0.0}
Set null for not visible. Kill feed: [{"killer":"","victim":""}]. Player stats: [{"name":"","kills":0}]. Placements only if results screen.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${GOOGLE_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: imageData } }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    }
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${res.status} ${err.substring(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Gemini response');
  return JSON.parse(jsonMatch[0]);
}

// === Violation Detection ===
async function checkViolations(db, matchId, frameId, normalized, prevFrame) {
  const violations = [];
  const confidence = normalized.confidence || 0;

  if (confidence < 0.4) {
    violations.push({ type: 'low_confidence', severity: 'warning', description: `OCR confidence ${confidence.toFixed(2)} below 0.4 threshold` });
  }
  if (prevFrame) {
    const prevAlive = prevFrame.normalized_data?.alive_count;
    const currAlive = normalized.alive_count;
    if (prevAlive != null && currAlive != null && currAlive > prevAlive) {
      violations.push({ type: 'alive_count_increase', severity: 'critical', description: `Alive count increased from ${prevAlive} to ${currAlive}` });
    }
  }
  for (const v of violations) {
    await createDoc(db, 'rule_violations', {
      match_id: matchId, frame_id: frameId, type: v.type, severity: v.severity,
      description: v.description, resolved: false
    });
  }
  return violations;
}

// === API Destination Push ===
async function pushToDestinations(db, matchId, matchData) {
  const snap = await db.collection('api_destinations').where('enabled', '==', true).get();
  const dests = snapData(snap).filter(d => d.api_key);
  const results = [];

  for (const dest of dests) {
    let attempts = 0, success = false, lastError = '';
    for (let i = 0; i < 3; i++) {
      attempts++;
      try {
        const headers = { 'Content-Type': 'application/json' };
        let url = dest.base_url;
        if (dest.auth_scheme === 'bearer') headers['Authorization'] = `Bearer ${dest.api_key}`;
        else if (dest.auth_scheme === 'header') headers['X-API-Key'] = dest.api_key;
        else if (dest.auth_scheme === 'query') url += (url.includes('?') ? '&' : '?') + `api_key=${dest.api_key}`;
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ ...matchData, pushed_at: now() }) });
        await createDoc(db, 'api_push_logs', {
          destination_id: dest.id, match_id: matchId, status: res.ok ? 'success' : 'failed',
          http_status: res.status, attempt_count: attempts, error_message: res.ok ? null : `HTTP ${res.status}`
        });
        if (res.ok) { success = true; break; }
        lastError = `HTTP ${res.status}`;
      } catch (e) { lastError = e.message; }
      await new Promise(r => setTimeout(r, 200 * Math.pow(2, i)));
    }
    await db.collection('api_destinations').doc(dest.id).update({
      last_status: success ? 'success' : 'degraded', last_push_at: now()
    });
    results.push({ destination: dest.name, success, attempts, error: success ? null : lastError });
  }
  return results;
}

async function buildMatchData(db, matchId) {
  const matchSnap = await db.collection('matches').doc(matchId).get();
  const partSnap = await db.collection('match_participants').where('match_id', '==', matchId).get();
  const participants = snapData(partSnap);
  const totalKills = participants.reduce((s, p) => s + (p.kills || 0), 0);
  return {
    match: docData(matchSnap),
    current_state: { alive_count: participants.filter(p => p.alive_status !== false).length, total_kills: totalKills },
    participants,
    total_kills: totalKills
  };
}

// === Main Handler ===
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });

  const { operation, ...params } = req.body || {};
  if (!operation) return res.status(400).json({ error: 'operation is required' });

  if (operation !== 'gateway_status') {
    const auth = checkAuth(req);
    if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  }

  try {
    const db = await getDb();
    switch (operation) {
      // === Health ===
      case 'gateway_status':
        return res.status(200).json({ ok: true, timestamp: now(), service: 'ors-gateway', auth_required: !!ORS_API_KEY, database: 'firestore' });

      // === Seed ===
      case 'seed_data': {
        const existing = await db.collection('tournaments').limit(1).get();
        if (!existing.empty) return res.status(200).json({ success: true, message: 'Data already exists' });
        const tournament = await createDoc(db, 'tournaments', {
          name: 'Free Fire Championship 2026', game: 'Free Fire', format: 'squad',
          ruleset: '1st=12, 2nd=9, 3rd=8, 4th=7, 5th=6, 6th=5, 7th=4, 8th=3, 9th=2, 10th=1, 11th+=0. 1 kill = 1 point.',
          status: 'scheduled', organizer_id: 'unish-ghimire',
          start_date: '2026-07-25T14:00:00Z', end_date: '2026-07-26T18:00:00Z'
        });
        const teamsData = [
          ['Nepal Elite', 'NEL', ['Aarav', 'Bibek', 'Chiran', 'Dipak']],
          ['Himalayan Wolves', 'HWV', ['Eshan', 'Falgun', 'Gaurav', 'Hari']],
          ['Gorkha Warriors', 'GRW', ['Ishan', 'Jivan', 'Kiran', 'Lokesh']],
          ['Everest Squad', 'EVS', ['Manish', 'Nabin', 'Om', 'Prabin']],
          ['Thunder Strikers', 'TST', ['Qadir', 'Rohit', 'Sagar', 'Tilak']],
          ['Dragon Fire', 'DRF', ['Ujjwal', 'Vikram', 'Wangchuk', 'Yubaraj']],
          ['Phoenix Rising', 'PHX', ['Zenith', 'Anmol', 'Bibhushan', 'Chetan']],
          ['Shadow Squad', 'SHD', ['Dinesh', 'Eklavya', 'Firoz', 'Ganesh']]
        ];
        const teamIds = [];
        for (const [name, code, players] of teamsData) {
          const team = await createDoc(db, 'teams', { tournament_id: tournament.id, name, team_code: code, total_kills: 0, placement: null, logo_url: null });
          teamIds.push(team.id);
          for (const pn of players) await createDoc(db, 'players', { team_id: team.id, name: pn, ign: pn, in_game_uid: null, status: 'active' });
        }
        const matchesData = [
          { match_number: 1, map: 'Bermuda', scheduled_at: '2026-07-25T14:00:00Z' },
          { match_number: 2, map: 'Purgatory', scheduled_at: '2026-07-25T15:00:00Z' },
          { match_number: 3, map: 'Kalahari', scheduled_at: '2026-07-25T16:00:00Z' }
        ];
        for (const m of matchesData) {
          const match = await createDoc(db, 'matches', {
            tournament_id: tournament.id, match_number: m.match_number, map: m.map,
            status: 'scheduled', scheduled_at: m.scheduled_at, started_at: null,
            ended_at: null, observer_feed_label: `Match ${m.match_number}`
          });
          for (const teamId of teamIds) {
            const players = await db.collection('players').where('team_id', '==', teamId).get();
            for (const p of players.docs) {
              await createDoc(db, 'match_participants', {
                match_id: match.id, player_id: p.id, team_id: teamId,
                kills: 0, kills_timeline: [], alive_status: true, deaths: 0, placement: null
              });
            }
          }
        }
        return res.status(200).json({ success: true, message: 'Seed data created', tournament: tournament.name, teams: 8, players: 32, matches: 3 });
      }

      // === Tournaments ===
      case 'list_tournaments': return res.status(200).json({ items: await listColl(db, 'tournaments', params) });
      case 'create_tournament': return res.status(200).json(await createDoc(db, 'tournaments', params.data));
      case 'update_tournament': return res.status(200).json(await updateDoc(db, 'tournaments', params.id, params.data));
      case 'delete_tournament': {
        const tTeams = await db.collection('teams').where('tournament_id', '==', params.id).get();
        const batch = db.batch();
        // Collect all player refs for all teams
        for (const teamDoc of tTeams.docs) {
          batch.delete(teamDoc.ref);
          const tPlayers = await db.collection('players').where('team_id', '==', teamDoc.id).get();
          tPlayers.docs.forEach(p => batch.delete(p.ref));
        }
        batch.delete(db.collection('tournaments').doc(params.id));
        await batch.commit();
        return res.status(200).json({ success: true });
      }

      // === Matches ===
      case 'list_matches': return res.status(200).json({ items: await listColl(db, 'matches', params) });
      case 'create_match': return res.status(200).json(await createDoc(db, 'matches', params.data));
      case 'update_match': return res.status(200).json(await updateDoc(db, 'matches', params.id, params.data));
      case 'get_match': { const d = await db.collection('matches').doc(params.id).get(); return res.status(200).json(docData(d)); }
      case 'delete_match': {
        await db.collection('matches').doc(params.id).delete();
        const parts = await db.collection('match_participants').where('match_id', '==', params.id).get();
        const frames = await db.collection('match_frames').where('match_id', '==', params.id).get();
        const batch = db.batch();
        parts.docs.forEach(d => batch.delete(d.ref));
        frames.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return res.status(200).json({ success: true });
      }

      // === Teams ===
      case 'list_teams': return res.status(200).json({ items: await listColl(db, 'teams', params) });
      case 'create_team': return res.status(200).json(await createDoc(db, 'teams', params.data));
      case 'update_team': return res.status(200).json(await updateDoc(db, 'teams', params.id, params.data));
      case 'delete_team': {
        await db.collection('teams').doc(params.id).delete();
        const players = await db.collection('players').where('team_id', '==', params.id).get();
        const batch = db.batch();
        players.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        return res.status(200).json({ success: true });
      }

      // === Players ===
      case 'list_players': return res.status(200).json({ items: await listColl(db, 'players', params) });
      case 'list_players_for_tournament': {
        const teamSnap = await db.collection('teams').where('tournament_id', '==', params.tournament_id).get();
        const teamIds = teamSnap.docs.map(d => d.id);
        if (teamIds.length === 0) return res.status(200).json({ items: [] });
        // Firestore 'in' query supports max 30 values
        const chunks = [];
        for (let i = 0; i < teamIds.length; i += 30) chunks.push(teamIds.slice(i, i + 30));
        const allPlayers = [];
        for (const chunk of chunks) {
          const snap = await db.collection('players').where('team_id', 'in', chunk).get();
          snap.docs.forEach(d => allPlayers.push({ id: d.id, ...d.data() }));
        }
        allPlayers.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return res.status(200).json({ items: allPlayers });
      }
      case 'create_player': return res.status(200).json(await createDoc(db, 'players', params.data));
      case 'update_player': return res.status(200).json(await updateDoc(db, 'players', params.id, params.data));
      case 'delete_player': { await db.collection('players').doc(params.id).delete(); return res.status(200).json({ success: true }); }

      // === Import Players from Excel ===
      case 'import_players': {
        const { tournament_id, players: playerRows } = params;
        if (!tournament_id || !Array.isArray(playerRows) || playerRows.length === 0) {
          return res.status(400).json({ error: 'tournament_id and players array are required' });
        }
        // Fetch existing teams for this tournament
        const existingTeamsSnap = await db.collection('teams').where('tournament_id', '==', tournament_id).get();
        const teamMap = new Map();
        for (const t of existingTeamsSnap.docs) {
          const td = t.data();
          teamMap.set(td.name?.toLowerCase(), { id: t.id, ...td });
          if (td.team_code) teamMap.set(td.team_code?.toLowerCase(), { id: t.id, ...td });
        }
        const createdTeams = [];
        const createdPlayers = [];
        const errors = [];
        for (let i = 0; i < playerRows.length; i++) {
          const row = playerRows[i];
          try {
            const teamName = (row.team_name || row.team || '').toString().trim();
            const teamCode = (row.team_code || row.code || '').toString().trim();
            const playerName = (row.name || row.player_name || '').toString().trim();
            const ign = (row.ign || row.ingame_name || row.in_game_name || playerName).toString().trim();
            const uid = (row.uid || row.in_game_uid || row.ff_uid || '').toString().trim();
            if (!playerName) { errors.push(`Row ${i+2}: Missing player name`); continue; }
            if (!teamName && !teamCode) { errors.push(`Row ${i+2}: Missing team for player "${playerName}"`); continue; }
            // Find or create team
            const lookupKey = (teamCode || teamName).toLowerCase();
            let team = teamMap.get(lookupKey);
            if (!team && teamName) team = teamMap.get(teamName.toLowerCase());
            if (!team) {
              const newTeam = await createDoc(db, 'teams', {
                tournament_id, name: teamName || teamCode, team_code: teamCode || '',
                total_kills: 0, placement: null, logo_url: null
              });
              teamMap.set(lookupKey, newTeam);
              if (teamName) teamMap.set(teamName.toLowerCase(), newTeam);
              createdTeams.push(newTeam);
              team = newTeam;
            }
            // Create player
            const player = await createDoc(db, 'players', {
              team_id: team.id, name: playerName, ign, in_game_uid: uid || null,
              status: 'active'
            });
            createdPlayers.push(player);
          } catch (e) {
            errors.push(`Row ${i+2}: ${e.message}`);
          }
        }
        return res.status(200).json({
          success: true,
          imported: createdPlayers.length,
          teams_created: createdTeams.length,
          errors: errors.length > 0 ? errors : undefined,
          players: createdPlayers,
          teams: createdTeams
        });
      }

      // === Match Participants ===
      case 'list_match_participants': return res.status(200).json({ items: await listColl(db, 'match_participants', params) });
      case 'update_match_participant': return res.status(200).json(await updateDoc(db, 'match_participants', params.id, params.data));
      case 'create_match_participant': return res.status(200).json(await createDoc(db, 'match_participants', params.data));

      // === Frames ===
      case 'ingest_frame': {
        const frame = await createDoc(db, 'match_frames', {
          match_id: params.match_id, frame_number: params.frame_number || 0,
          captured_at: params.captured_at || now(), image_url: params.image_url || '',
          game_phase: 'unknown', ocr_confidence: 0, processing_status: 'pending', ocr_raw: {}, normalized_data: {}
        });
        return res.status(200).json({ success: true, frame_id: frame.id, frame });
      }
      // === Live Capture Feed (for Dashboard) ===
      case 'get_live_capture': {
        // Find any match currently being captured
        const matchSnap = await db.collection('matches').get();
        const allMatches = snapData(matchSnap);
        const liveMatch = allMatches.find(m => m.status === 'in_match');
        if (!liveMatch) return res.status(200).json({ live: false, message: 'No match currently being captured' });

        // Get latest frames for the live match
        const frameSnap = await db.collection('match_frames')
          .where('match_id', '==', liveMatch.id).limit(20).get();
        const frames = snapData(frameSnap).sort((a, b) =>
          (b.created_at || '').localeCompare(a.created_at || '')
        );
        const latestFrame = frames[0];
        const nd = latestFrame?.normalized_data || {};

        // Get participants for kill leaderboard
        const partSnap = await db.collection('match_participants')
          .where('match_id', '==', liveMatch.id).get();
        const participants = snapData(partSnap);

        // Get tournament info
        const tourSnap = await db.collection('tournaments').doc(liveMatch.tournament_id || '').get();
        const tournament = tourSnap.exists ? docData(tourSnap) : null;

        // Count frames by status
        const frameStats = {
          total: frames.length,
          completed: frames.filter(f => f.processing_status === 'completed').length,
          flagged: frames.filter(f => f.processing_status === 'flagged').length,
          failed: frames.filter(f => f.processing_status === 'failed').length,
          processing: frames.filter(f => f.processing_status === 'processing').length
        };

        // Get last 5 kill feed entries across all frames
        const killFeed = [];
        for (const f of frames.slice(0, 10)) {
          const kf = f.normalized_data?.kill_feed || [];
          for (const k of kf) {
            killFeed.push({ killer: k.killer, victim: k.victim, frame: f.frame_number, time: f.created_at });
          }
        }

        return res.status(200).json({
          live: true,
          match: liveMatch,
          tournament: tournament ? { name: tournament.name, id: tournament.id } : null,
          latest_frame: latestFrame ? {
            frame_number: latestFrame.frame_number,
            game_phase: latestFrame.game_phase,
            ocr_confidence: latestFrame.ocr_confidence,
            processing_status: latestFrame.processing_status,
            captured_at: latestFrame.captured_at,
            created_at: latestFrame.created_at,
            alive_count: nd.alive_count,
            total_players: nd.total_players,
            zone_phase: nd.zone_phase,
            map_name: nd.map_name,
            kill_feed: (nd.kill_feed || []).slice(0, 5),
            player_stats: (nd.player_stats || []).slice(0, 10),
            placements: (nd.placements || []).slice(0, 12)
          } : null,
          frame_stats: frameStats,
          kill_feed_recent: killFeed.slice(0, 10),
          kill_leaderboard: participants
            .filter(p => (p.kills || 0) > 0)
            .sort((a, b) => (b.kills || 0) - (a.kills || 0))
            .slice(0, 10)
            .map(p => ({ player_id: p.player_id, kills: p.kills || 0, placement: p.placement || null })),
          alive_count: participants.filter(p => p.alive_status !== false).length,
          total_kills: participants.reduce((s, p) => s + (p.kills || 0), 0),
          participants_count: participants.length
        });
      }

      case 'get_latest_frames': {
        let q = db.collection('match_frames');
        if (params.match_id) q = q.where('match_id', '==', params.match_id);
        const lSnap = await q.limit(params.limit || 10).get();
        const items = snapData(lSnap).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
        return res.status(200).json({ items });
      }

      // === OCR Processing ===
      case 'process_frame': {
        const frameSnap = await db.collection('match_frames').doc(params.frame_id).get();
        if (!frameSnap.exists) return res.status(404).json({ error: 'Frame not found' });
        const frame = docData(frameSnap);
        await db.collection('match_frames').doc(params.frame_id).update({ processing_status: 'processing' });
        try {
          let imageData = params.image_data, mimeType = params.image_mime_type || 'image/jpeg';
          if (!imageData && frame.image_url) {
            const imgRes = await fetch(frame.image_url);
            const buf = await imgRes.arrayBuffer();
            imageData = Buffer.from(buf).toString('base64');
            mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
          }
          if (!imageData) throw new Error('No image data provided');
          const ocr = await runGeminiOCR(imageData, mimeType);
          const confidence = ocr.confidence || 0;
          const normalized = {
            game_phase: ocr.game_phase || 'unknown', map_name: ocr.map_name || null,
            alive_count: ocr.alive_count ?? null, total_players: ocr.total_players ?? null,
            zone_phase: ocr.zone_phase || null, kill_feed: ocr.kill_feed || [],
            player_stats: ocr.player_stats || [], placements: ocr.placements || [], confidence
          };
          // Update participant kills
          if (ocr.player_stats?.length) {
            for (const s of ocr.player_stats) {
              const players = await db.collection('players').get();
              for (const p of players.docs) {
                const pd = p.data();
                if (pd.ign?.toLowerCase().includes(s.name?.toLowerCase())) {
                  const parts = await db.collection('match_participants')
                    .where('match_id', '==', frame.match_id).get();
                  parts.docs.forEach(d => {
                    if (d.data().player_id === p.id) d.ref.update({ kills: s.kills || 0 });
                  });
                }
              }
            }
          }
          // Update placements
          if (ocr.placements?.length && ocr.game_phase === 'results') {
            for (const p of ocr.placements) {
              const teams = await db.collection('teams').get();
              for (const t of teams.docs) {
                if (t.data().name?.toLowerCase().includes(p.name?.toLowerCase())) {
                  const parts = await db.collection('match_participants')
                    .where('match_id', '==', frame.match_id).get();
                  parts.docs.forEach(d => {
                    if (d.data().team_id === t.id) d.ref.update({ placement: p.placement });
                  });
                }
              }
            }
          }
          // Violations
          const prevSnap = await db.collection('match_frames')
            .where('match_id', '==', frame.match_id).limit(50).get();
          const prevDocs = snapData(prevSnap)
            .filter(d => d.id !== params.frame_id)
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
            .slice(0, 1);
          const violations = await checkViolations(db, frame.match_id, params.frame_id, normalized, prevDocs[0]);
          const status = confidence >= 0.6 ? 'completed' : 'flagged';
          await db.collection('match_frames').doc(params.frame_id).update({
            ocr_raw: ocr, ocr_confidence: confidence, normalized_data: normalized,
            game_phase: normalized.game_phase, processing_status: status, updated_at: now()
          });
          return res.status(200).json({ success: true, frame_id: params.frame_id, ocr_confidence: confidence, game_phase: normalized.game_phase, alive_count: normalized.alive_count, violations: violations.length, processing_status: status });
        } catch (e) {
          await db.collection('match_frames').doc(params.frame_id).update({ processing_status: 'failed', updated_at: now() });
          return res.status(500).json({ success: false, error: e.message });
        }
      }

      // === Pre-Capture Validation (no storage, no side effects) ===
      case 'validate_frame': {
        // Runs OCR on a single frame WITHOUT storing anything
        // Returns detected game phase, map guess, alive count for operator verification
        if (!params.image_data) return res.status(400).json({ error: 'image_data required' });
        try {
          const ocr = await runGeminiOCR(params.image_data, params.image_mime_type || 'image/jpeg');
          const confidence = ocr.confidence || 0;
          // Try to detect map from the screenshot (Free Fire shows map name in lobby/loading)
          const mapGuess = ocr.map_name || null;
          return res.status(200).json({
            success: true,
            detected: {
              game_phase: ocr.game_phase || 'unknown',
              alive_count: ocr.alive_count ?? null,
              zone_phase: ocr.zone_phase || null,
              map_guess: mapGuess,
              kill_feed_count: (ocr.kill_feed || []).length,
              player_stats_count: (ocr.player_stats || []).length,
              placements_count: (ocr.placements || []).length,
              confidence: confidence,
              confidence_label: confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : confidence >= 0.4 ? 'low' : 'very_low'
            }
          });
        } catch (e) {
          return res.status(500).json({ success: false, error: e.message });
        }
      }

      // === Capture + Process + Push (all-in-one) ===
      case 'capture_and_process': {
        // 1. Create frame doc first (non-blocking — we don't wait for this to call Gemini)
        const frame = await createDoc(db, 'match_frames', {
          match_id: params.match_id, frame_number: params.frame_number || 0,
          captured_at: now(), image_url: params.image_url || '',
          game_phase: 'unknown', ocr_confidence: 0, processing_status: 'processing', ocr_raw: {}, normalized_data: {}
        });
        try {
          if (!params.image_data) throw new Error('No image_data provided');

          // 2. Gemini OCR (the big cost — 2-5s)
          const ocr = await runGeminiOCR(params.image_data, params.image_mime_type || 'image/jpeg');
          const confidence = ocr.confidence || 0;
          const normalized = {
            game_phase: ocr.game_phase || 'unknown', map_name: ocr.map_name || null,
            alive_count: ocr.alive_count ?? null, total_players: ocr.total_players ?? null,
            zone_phase: ocr.zone_phase || null, kill_feed: ocr.kill_feed || [],
            player_stats: ocr.player_stats || [], placements: ocr.placements || [], confidence
          };
          const status = confidence >= 0.6 ? 'completed' : 'flagged';

          // 3. Fetch previous frame + match_participants IN PARALLEL (was sequential)
          const [prevSnap, partSnap] = await Promise.all([
            db.collection('match_frames').where('match_id', '==', params.match_id)
              .orderBy('created_at', 'desc').limit(2).get().catch(() => null),
            db.collection('match_participants').where('match_id', '==', params.match_id).get()
          ]);

          // 4. Update frame doc with OCR results (single write, includes everything)
          await db.collection('match_frames').doc(frame.id).update({
            ocr_raw: ocr, ocr_confidence: confidence, normalized_data: normalized,
            game_phase: normalized.game_phase, processing_status: status, updated_at: now()
          });

          // 5. Violations check (uses prevSnap — only 2 docs, not 50)
          const prevDocs = prevSnap ? snapData(prevSnap).filter(d => d.id !== frame.id).slice(0, 1) : [];
          const violations = await checkViolations(db, params.match_id, frame.id, normalized, prevDocs[0]);

          // 6. Update participants — batch write, single fetch of match_participants
          const participants = snapData(partSnap);
          const batch = db.batch();
          let batchUpdates = 0;

          if (ocr.player_stats?.length) {
            // Fetch players ONCE, not per stat
            const playersSnap = await db.collection('players').get();
            const players = snapData(playersSnap);
            for (const s of ocr.player_stats) {
              const matchedPlayer = players.find(p => p.ign?.toLowerCase().includes(s.name?.toLowerCase()));
              if (matchedPlayer) {
                const part = participants.find(p => p.player_id === matchedPlayer.id);
                if (part) {
                  batch.update(db.collection('match_participants').doc(part.id), { kills: s.kills || 0 });
                  batchUpdates++;
                }
              }
            }
          }

          // 7. Placements — only on results phase, reuse same participants data
          if (ocr.placements?.length && ocr.game_phase === 'results') {
            const teamsSnap = await db.collection('teams').get();
            const teams = snapData(teamsSnap);
            for (const p of ocr.placements) {
              const matchedTeam = teams.find(t => t.name?.toLowerCase().includes(p.name?.toLowerCase()));
              if (matchedTeam) {
                const parts = participants.filter(part => part.team_id === matchedTeam.id);
                for (const part of parts) {
                  batch.update(db.collection('match_participants').doc(part.id), { placement: p.placement });
                  batchUpdates++;
                }
              }
            }
          }

          if (batchUpdates > 0) await batch.commit();

          // 8. Push to destinations — fire and forget (don't block the response)
          const matchData = {
            match: { id: params.match_id },
            current_state: {
              alive_count: normalized.alive_count,
              total_kills: (ocr.kill_feed || []).length
            },
            participants: participants.map(p => ({ ...p, kills: ocr.player_stats?.find(s =>
              participants.find(pp => pp.player_id === p.player_id)?.ign?.toLowerCase().includes(s.name?.toLowerCase())
            )?.kills ?? p.kills })),
            total_kills: participants.reduce((s, p) => s + (p.kills || 0), 0),
            pushed_at: now()
          };
          // Fire and forget — don't await
          pushToDestinations(db, params.match_id, matchData).catch(() => {});

          // 9. Return immediately — no final frame re-read
          return res.status(200).json({
            success: true, frame_id: frame.id,
            frame: { id: frame.id, ocr_confidence: confidence, normalized_data: normalized,
              game_phase: normalized.game_phase, processing_status: status, created_at: now() },
            ocr_confidence: confidence,
            game_phase: normalized.game_phase, alive_count: normalized.alive_count,
            zone_phase: normalized.zone_phase, violations: violations.length,
            processing_status: status
          });
        } catch (e) {
          await db.collection('match_frames').doc(frame.id).update({ processing_status: 'failed', updated_at: now() });
          return res.status(500).json({ success: false, error: e.message, frame_id: frame.id });
        }
      }

      // === Violations ===
      case 'list_violations': {
        let q = db.collection('rule_violations').orderBy('created_at', 'desc').limit(params.limit || 50);
        if (params.match_id) q = q.where('match_id', '==', params.match_id);
        if (params.resolved !== undefined) q = q.where('resolved', '==', params.resolved);
        const snap = await q.get();
        return res.status(200).json({ items: snapData(snap) });
      }
      case 'resolve_violation':
        return res.status(200).json(await updateDoc(db, 'rule_violations', params.id, { resolved: true, resolved_at: now(), resolved_by: params.resolved_by || 'dashboard' }));

      // === API Destinations ===
      case 'list_api_destinations': {
        const snap = await db.collection('api_destinations').orderBy('created_at', 'desc').get();
        return res.status(200).json({ items: snapData(snap).map(d => { const { api_key, ...rest } = d; return rest; }) });
      }
      case 'create_api_destination': {
        const item = await createDoc(db, 'api_destinations', {
          name: params.data.name, base_url: params.data.base_url,
          auth_scheme: params.data.auth_scheme || 'header', api_key: params.data.api_key || '',
          enabled: params.data.enabled ?? true, last_push_at: null, last_status: null,
          payload_format: params.data.payload_format || 'json'
        });
        const { api_key, ...safe } = item;
        return res.status(200).json(safe);
      }
      case 'update_api_destination': {
        const item = await updateDoc(db, 'api_destinations', params.id, params.data);
        const { api_key, ...safe } = item;
        return res.status(200).json(safe);
      }
      case 'test_api_destination': {
        const d = await db.collection('api_destinations').doc(params.destination_id).get();
        if (!d.exists) return res.status(404).json({ error: 'Not found' });
        const dest = docData(d);
        if (!dest.enabled) return res.status(400).json({ error: 'Disabled' });
        try {
          const headers = { 'Content-Type': 'application/json' };
          let url = dest.base_url;
          if (dest.auth_scheme === 'bearer') headers['Authorization'] = `Bearer ${dest.api_key}`;
          else if (dest.auth_scheme === 'header') headers['X-API-Key'] = dest.api_key;
          else if (dest.auth_scheme === 'query') url += (url.includes('?') ? '&' : '?') + `api_key=${dest.api_key}`;
          const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ test: true, source: 'ors-gateway', timestamp: now() }) });
          await db.collection('api_destinations').doc(params.destination_id).update({ last_status: r.ok ? 'success' : 'failed', last_push_at: now() });
          return res.status(200).json({ success: r.ok, http_status: r.status });
        } catch (e) {
          await db.collection('api_destinations').doc(params.destination_id).update({ last_status: 'failed' });
          return res.status(200).json({ success: false, error: e.message });
        }
      }
      case 'delete_api_destination': { await db.collection('api_destinations').doc(params.id).delete(); return res.status(200).json({ success: true }); }

      // === Push Match Data ===
      case 'push_match_data': {
        const matchData = await buildMatchData(db, params.match_id);
        const results = await pushToDestinations(db, params.match_id, matchData);
        return res.status(200).json({ success: true, push_results: results });
      }

      // === Match Summary ===
      case 'get_match_summary': {
        const matchSnap = await db.collection('matches').doc(params.match_id).get();
        if (!matchSnap.exists) return res.status(404).json({ error: 'Match not found' });
        const match = docData(matchSnap);
        const partSnap = await db.collection('match_participants').where('match_id', '==', params.match_id).get();
        const participants = snapData(partSnap);
        const frameSnap = await db.collection('match_frames').where('match_id', '==', params.match_id).limit(50).get();
        const lastFrame = snapData(frameSnap).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))[0];
        return res.status(200).json({
          success: true, match,
          current_state: {
            alive_count: participants.filter(p => p.alive_status !== false).length,
            total_kills: participants.reduce((s, p) => s + (p.kills || 0), 0),
            zone_phase: lastFrame?.normalized_data?.zone_phase || 'unknown',
            game_phase: lastFrame?.game_phase || match.status
          },
          kill_leaderboard: participants.filter(p => (p.kills || 0) > 0).sort((a, b) => (b.kills || 0) - (a.kills || 0)).map(p => ({ player_id: p.player_id, kills: p.kills })),
          participants_count: participants.length,
          last_frame_confidence: lastFrame?.ocr_confidence || null
        });
      }

      // === Tournament Standings ===
      case 'get_tournament_standings': {
        const matchSnap = await db.collection('matches').where('tournament_id', '==', params.tournament_id).where('status', '==', 'results').get();
        const matches = snapData(matchSnap);
        const teamSnap = await db.collection('teams').where('tournament_id', '==', params.tournament_id).get();
        const teams = snapData(teamSnap);
        const standings = {};
        for (const team of teams) {
          standings[team.id] = { team_id: team.id, team_name: team.name, team_code: team.team_code, matches_played: 0, total_kills: 0, total_placement_points: 0, total_kill_points: 0, total_points: 0, best_placement: null };
        }
        for (const match of matches) {
          const partSnap = await db.collection('match_participants').where('match_id', '==', match.id).get();
          const participants = snapData(partSnap);
          const teamInMatch = {};
          for (const p of participants) {
            if (!p.team_id) continue;
            if (!teamInMatch[p.team_id]) teamInMatch[p.team_id] = { kills: 0, placement: null };
            teamInMatch[p.team_id].kills += p.kills || 0;
            if (p.placement != null) teamInMatch[p.team_id].placement = p.placement;
          }
          for (const [teamId, data] of Object.entries(teamInMatch)) {
            if (!standings[teamId]) continue;
            const pp = data.placement != null ? (PLACEMENT_POINTS[data.placement] || 0) : 0;
            const kp = data.kills * KILL_POINT;
            standings[teamId].matches_played++;
            standings[teamId].total_kills += data.kills;
            standings[teamId].total_placement_points += pp;
            standings[teamId].total_kill_points += kp;
            standings[teamId].total_points += pp + kp;
            if (standings[teamId].best_placement == null || data.placement < standings[teamId].best_placement) standings[teamId].best_placement = data.placement;
          }
        }
        const ranked = Object.values(standings).sort((a, b) => b.total_points - a.total_points).map((s, i) => ({ ...s, rank: i + 1 }));
        return res.status(200).json({ success: true, total_matches_completed: matches.length, scoring: { placement_points_table: PLACEMENT_POINTS, kill_points_per_kill: KILL_POINT }, standings: ranked });
      }

      // === Push Logs ===
      case 'list_push_logs': {
        let q = db.collection('api_push_logs').orderBy('pushed_at', 'desc').limit(params.limit || 50);
        if (params.match_id) q = q.where('match_id', '==', params.match_id);
        if (params.destination_id) q = q.where('destination_id', '==', params.destination_id);
        const snap = await q.get();
        return res.status(200).json({ items: snapData(snap) });
      }

      default:
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }
  } catch (error) {
    return res.status(500).json({ error: error.message, operation });
  }
}
