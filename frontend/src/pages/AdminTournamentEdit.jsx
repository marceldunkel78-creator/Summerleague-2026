import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { AdminSidebar } from './AdminDashboard';

const statusOptions = ['draft', 'registration_open', 'registration_closed', 'draw_complete', 'in_progress', 'completed', 'cancelled'];
const statusLabels = { draft: 'Entwurf', registration_open: 'Anmeldung offen', registration_closed: 'Geschlossen', draw_complete: 'Auslosung fertig', in_progress: 'Läuft', completed: 'Beendet', cancelled: 'Abgesagt' };

export default function AdminTournamentEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [matches, setMatches] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [tab, setTab] = useState('settings');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const [tRes, rRes] = await Promise.all([
        api.get(`/tournaments/${id}`),
        api.get(`/admin/tournaments/${id}/registrations`, { headers })
      ]);
      setTournament(tRes.data.tournament);
      setRegistrations(rRes.data.registrations);
      setMatches(tRes.data.matches || []);
      setRounds(tRes.data.rounds || []);
    } catch { setError('Turnier nicht gefunden.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleSave = async () => {
    setMsg(''); setError('');
    try {
      await api.put(`/admin/tournaments/${id}`, tournament, { headers });
      setMsg('Turnier gespeichert!');
    } catch (err) { setError(err.response?.data?.error || 'Fehler.'); }
  };

  const handleStatusChange = async (regId, status) => {
    try {
      await api.put(`/admin/registrations/${regId}`, { status }, { headers });
      setMsg(`Anmeldung ${status === 'approved' ? 'genehmigt' : 'aktualisiert'}.`);
      load();
    } catch { setError('Fehler.'); }
  };

  const handleSeedChange = async (regId, seedNumber) => {
    try {
      await api.put(`/admin/registrations/${regId}`, { seed_number: seedNumber || null }, { headers });
    } catch { /* ignore */ }
  };

  const handleDraw = async () => {
    if (!confirm('Auslosung durchführen? Bestehende Matches werden überschrieben.')) return;
    setMsg(''); setError('');
    try {
      const res = await api.post(`/admin/tournaments/${id}/draw`, {}, { headers });
      setMsg(`Auslosung erstellt! ${JSON.stringify(res.data.result)}`);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Fehler bei der Auslosung.'); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!tournament) return <div className="page"><div className="alert alert-error">Turnier nicht gefunden.</div></div>;

  const handleChange = (field, value) => {
    setTournament(t => ({ ...t, [field]: value }));
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <div className="flex-between mb-2">
          <div>
            <h1>{tournament.name}</h1>
            <span className="badge badge-info">{statusLabels[tournament.status]}</span>
          </div>
          <div className="flex gap-1">
            <Link to={`/admin/matches/${id}`} className="btn btn-outline">Matches verwalten</Link>
            <button className="btn btn-accent" onClick={handleDraw}>🎲 Auslosung</button>
          </div>
        </div>

        {msg && <div className="alert alert-success">{msg}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Einstellungen</button>
          <button className={`tab ${tab === 'registrations' ? 'active' : ''}`} onClick={() => setTab('registrations')}>
            Anmeldungen ({registrations.length})
          </button>
          {tournament.type === 'ko' && matches.length > 0 && (
            <button className={`tab ${tab === 'bracket' ? 'active' : ''}`} onClick={() => setTab('bracket')}>
              Turnierbaum
            </button>
          )}
        </div>

        {tab === 'settings' && (
          <div className="card">
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={tournament.name} onChange={e => handleChange('name', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Status</label>
                <select value={tournament.status} onChange={e => handleChange('status', e.target.value)}>
                  {statusOptions.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>Beschreibung</label>
              <textarea value={tournament.description || ''} onChange={e => handleChange('description', e.target.value)} rows={2}
                style={{ width: '100%', padding: '10px', border: '2px solid var(--border)', borderRadius: 'var(--radius)' }} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Max. Teilnehmer</label>
                <input type="number" value={tournament.max_participants} onChange={e => handleChange('max_participants', parseInt(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Ort</label>
                <input type="text" value={tournament.location || ''} onChange={e => handleChange('location', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Meldefrist</label>
                <input type="date" value={tournament.registration_deadline?.split('T')[0] || ''} onChange={e => handleChange('registration_deadline', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Auslosung</label>
                <input type="date" value={tournament.draw_date?.split('T')[0] || ''} onChange={e => handleChange('draw_date', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Start</label>
                <input type="date" value={tournament.tournament_start?.split('T')[0] || ''} onChange={e => handleChange('tournament_start', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ende</label>
                <input type="date" value={tournament.tournament_end?.split('T')[0] || ''} onChange={e => handleChange('tournament_end', e.target.value)} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Gewinnsätze</label>
                <select value={tournament.winning_sets} onChange={e => handleChange('winning_sets', parseInt(e.target.value))}>
                  <option value="2">2</option><option value="3">3</option>
                </select>
              </div>
              <div className="form-group">
                <label>Punkte Sieg</label>
                <input type="number" value={tournament.points_win} onChange={e => handleChange('points_win', parseInt(e.target.value))} />
              </div>
            </div>

            <div className="flex gap-3 mt-1">
              <label><input type="checkbox" checked={!!tournament.no_ad} onChange={e => handleChange('no_ad', e.target.checked ? 1 : 0)} /> No-Ad</label>
              <label><input type="checkbox" checked={!!tournament.match_tiebreak} onChange={e => handleChange('match_tiebreak', e.target.checked ? 1 : 0)} /> Match-Tiebreak</label>
              <label><input type="checkbox" checked={!!tournament.self_reporting} onChange={e => handleChange('self_reporting', e.target.checked ? 1 : 0)} /> Selbsteintragung</label>
              <label><input type="checkbox" checked={!!tournament.dtb_id_required} onChange={e => handleChange('dtb_id_required', e.target.checked ? 1 : 0)} /> DTB-ID Pflicht</label>
              <label><input type="checkbox" checked={!!tournament.lk_handicap_enabled} onChange={e => handleChange('lk_handicap_enabled', e.target.checked ? 1 : 0)} /> LK-Handicap</label>
            </div>

            <button className="btn btn-primary mt-3" onClick={handleSave}>💾 Speichern</button>
          </div>
        )}

        {tab === 'registrations' && (
          <div className="card">
            <div className="flex-between mb-2">
              <h3>Anmeldungen</h3>
              <button className="btn btn-sm btn-primary" onClick={() => {
                registrations.filter(r => r.status === 'pending').forEach(r => handleStatusChange(r.id, 'approved'));
              }}>Alle genehmigen</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Name</th><th>E-Mail</th><th>DTB-ID</th><th>LK</th><th>Status</th><th>Setzplatz</th><th>Aktionen</th></tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id}>
                      <td className="fw-bold">{r.name}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.email}</td>
                      <td>{r.dtb_id}</td>
                      <td>{r.lk}</td>
                      <td>
                        <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : 'badge-danger'}`}>
                          {r.status === 'approved' ? 'Zugelassen' : r.status === 'pending' ? 'Ausstehend' : r.status}
                        </span>
                      </td>
                      <td>
                        <input type="number" min="1" style={{ width: 60, padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4 }}
                          defaultValue={r.seed_number || ''}
                          onBlur={e => handleSeedChange(r.id, parseInt(e.target.value) || null)} />
                      </td>
                      <td>
                        <div className="flex gap-1">
                          {r.status !== 'approved' && (
                            <button className="btn btn-sm btn-primary" onClick={() => handleStatusChange(r.id, 'approved')}>✅</button>
                          )}
                          {r.status !== 'rejected' && (
                            <button className="btn btn-sm btn-danger" onClick={() => handleStatusChange(r.id, 'rejected')}>❌</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {registrations.length === 0 && (
                    <tr><td colSpan="7" className="text-center text-muted">Keine Anmeldungen.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'bracket' && tournament.type === 'ko' && (
          <AdminKOBracket rounds={rounds} matches={matches} headers={headers} onReload={load} />
        )}
      </div>
    </div>
  );
}

function AdminKOBracket({ rounds, matches, headers, onReload }) {
  const [editingMatch, setEditingMatch] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({ scheduled_date: '', scheduled_time: '', court: '' });
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const matchesByRound = {};
  matches.forEach(m => {
    const rn = m.round_number || 1;
    if (!matchesByRound[rn]) matchesByRound[rn] = [];
    matchesByRound[rn].push(m);
  });

  const openSchedule = (m) => {
    setEditingMatch(m);
    setScheduleForm({
      scheduled_date: m.scheduled_date || '',
      scheduled_time: m.scheduled_time || '',
      court: m.court || ''
    });
    setSaveMsg('');
  };

  const handleSaveSchedule = async () => {
    if (!editingMatch) return;
    setSaving(true);
    setSaveMsg('');
    try {
      await api.put(`/admin/matches/${editingMatch.id}/schedule`, scheduleForm, { headers });
      setSaveMsg('Gespeichert!');
      setEditingMatch(null);
      onReload();
    } catch (err) {
      setSaveMsg(err.response?.data?.error || 'Fehler beim Speichern.');
    } finally {
      setSaving(false);
    }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) : '';

  return (
    <div>
      {saveMsg && <div className="alert alert-success mb-1">{saveMsg}</div>}

      <div className="bracket bracket-admin">
        {rounds.map(r => (
          <div className="bracket-round" key={r.id}>
            <div className="bracket-round-title">{r.name}</div>
            {(matchesByRound[r.round_number] || []).map(m => (
              <div className={`bracket-match bracket-match-admin ${editingMatch?.id === m.id ? 'bracket-match-editing' : ''}`} key={m.id}>
                <div className={`bracket-player ${m.winner_id === m.player1_id ? 'winner' : ''}`}>
                  <span className="bracket-player-info">
                    {m.player1_seed && <span className="bracket-seed">[{m.player1_seed}]</span>}
                    <span>{m.player1_name || 'TBD'}</span>
                    {m.player1_lk && <span className="bracket-lk">LK {m.player1_lk}</span>}
                  </span>
                  <span className="score">{m.sets_player1 ?? ''}</span>
                </div>
                <div className={`bracket-player ${m.winner_id === m.player2_id ? 'winner' : ''}`}>
                  <span className="bracket-player-info">
                    {m.player2_seed && <span className="bracket-seed">[{m.player2_seed}]</span>}
                    <span>{m.player2_name || 'TBD'}</span>
                    {m.player2_lk && <span className="bracket-lk">LK {m.player2_lk}</span>}
                  </span>
                  <span className="score">{m.sets_player2 ?? ''}</span>
                </div>
                <div className="bracket-schedule-bar">
                  {m.scheduled_date || m.scheduled_time || m.court ? (
                    <span className="bracket-schedule-info" onClick={() => openSchedule(m)} title="Klicken zum Bearbeiten">
                      {formatDate(m.scheduled_date)}{m.scheduled_time ? ` ${m.scheduled_time}` : ''}{m.court ? ` · ${m.court}` : ''}
                    </span>
                  ) : (
                    <button className="bracket-schedule-btn" onClick={() => openSchedule(m)}>
                      + Termin/Ort
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {editingMatch && (
        <div className="modal-overlay" onClick={() => setEditingMatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Spielplan festlegen</h3>
              <button className="modal-close" onClick={() => setEditingMatch(null)}>✕</button>
            </div>
            <p className="mb-2" style={{ fontSize: '0.9rem' }}>
              <strong>{editingMatch.player1_name || 'TBD'}</strong> vs <strong>{editingMatch.player2_name || 'TBD'}</strong>
            </p>
            <div className="form-group">
              <label>Datum</label>
              <input type="date" value={scheduleForm.scheduled_date}
                onChange={e => setScheduleForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Uhrzeit</label>
              <input type="time" value={scheduleForm.scheduled_time}
                onChange={e => setScheduleForm(f => ({ ...f, scheduled_time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Anlage / Platz</label>
              <input type="text" placeholder="z.B. TC Musterstadt, Platz 3"
                value={scheduleForm.court}
                onChange={e => setScheduleForm(f => ({ ...f, court: e.target.value }))} />
            </div>
            <div className="flex gap-1 mt-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setEditingMatch(null)}>Abbrechen</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSaveSchedule}>
                {saving ? 'Speichert...' : '💾 Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
