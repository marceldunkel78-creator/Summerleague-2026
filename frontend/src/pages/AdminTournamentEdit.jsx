import { useState, useEffect, Fragment } from 'react';
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
  const [standings, setStandings] = useState([]);
  const [doublesStandings, setDoublesStandings] = useState([]);
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
      setStandings(tRes.data.standings || []);
      setDoublesStandings(tRes.data.doublesStandings || []);
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

  const handlePartnerLink = async (regId, partnerId) => {
    try {
      await api.put(`/admin/registrations/${regId}`, { partner_id: partnerId || null }, { headers });
      setMsg('Partner verknüpft.');
      load();
    } catch { setError('Fehler beim Verknüpfen.'); }
  };

  const handleAutoSeed = async () => {
    setMsg(''); setError('');
    try {
      const res = await api.post(`/admin/tournaments/${id}/auto-seed`, {}, { headers });
      setMsg(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Fehler.'); }
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

        {tournament.type === 'doubles' && !tournament.doubles_random_partners && 
          registrations.some(r => r.status === 'approved' && !r.partner_id) && (
          <div className="alert alert-warning">
            ⚠️ Einige zugelassene Spieler haben noch keinen verknüpften Partner. Die Auslosung ist erst möglich, wenn alle Partner zugeordnet sind.
          </div>
        )}

        {msg && <div className="alert alert-success">{msg}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        <div className="tabs">
          <button className={`tab ${tab === 'settings' ? 'active' : ''}`} onClick={() => setTab('settings')}>Einstellungen</button>
          <button className={`tab ${tab === 'registrations' ? 'active' : ''}`} onClick={() => setTab('registrations')}>
            Anmeldungen ({registrations.length})
          </button>
          {rounds.length > 0 && !['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) && (
            <button className={`tab ${tab === 'rounds' ? 'active' : ''}`} onClick={() => setTab('rounds')}>
              Runden-Spielplan
            </button>
          )}
          {['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) && matches.length > 0 && (
            <button className={`tab ${tab === 'bracket' ? 'active' : ''}`} onClick={() => setTab('bracket')}>
              Turnierbaum
            </button>
          )}
          {((tournament.type === 'league' && standings.length > 0) || (tournament.type === 'doubles' && doublesStandings.length > 0)) && (
            <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Tabelle</button>
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
                <label>Anmeldegebühr</label>
                <input type="text" value={tournament.entry_fee || ''} onChange={e => handleChange('entry_fee', e.target.value)} placeholder="z.B. 15€" />
              </div>
              <div className="form-group">
                <label>Preisgeld / Preise</label>
                <input type="text" value={tournament.prize_description || ''} onChange={e => handleChange('prize_description', e.target.value)} placeholder="z.B. Pokal + 100€" />
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
                <label>Startuhrzeit</label>
                <input type="time" value={tournament.start_time || ''} onChange={e => handleChange('start_time', e.target.value)} />
              </div>
              <div className="form-group"></div>
            </div>

            {!['one_point', 'tiebreak_ko'].includes(tournament.type) && (<>
            <div className="form-row">
              <div className="form-group">
                <label>Gewinnsätze</label>
                <select value={tournament.winning_sets} onChange={e => handleChange('winning_sets', parseInt(e.target.value))}
                  disabled={tournament.type === 'doubles'}>
                  <option value="2">2</option><option value="3">3</option>
                </select>
              </div>
              {tournament.type !== 'doubles' && (
                <div className="form-group">
                  <label>Punkte Sieg</label>
                  <input type="number" step="0.01" value={tournament.points_win} onChange={e => handleChange('points_win', parseFloat(e.target.value))} />
                </div>
              )}
              {tournament.type !== 'doubles' && (
                <div className="form-group">
                  <label>Punkte Niederlage</label>
                  <input type="number" step="0.01" value={tournament.points_loss} onChange={e => handleChange('points_loss', parseFloat(e.target.value))} />
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-1">
              <label><input type="checkbox" checked={!!tournament.no_ad} onChange={e => handleChange('no_ad', e.target.checked ? 1 : 0)} /> No-Ad</label>
              {tournament.type !== 'doubles' && (
                <label><input type="checkbox" checked={!!tournament.match_tiebreak} onChange={e => handleChange('match_tiebreak', e.target.checked ? 1 : 0)} /> Match-Tiebreak</label>
              )}
              <label><input type="checkbox" checked={!!tournament.self_reporting} onChange={e => handleChange('self_reporting', e.target.checked ? 1 : 0)} /> Selbsteintragung</label>
              <label><input type="checkbox" checked={!!tournament.dtb_id_required} onChange={e => handleChange('dtb_id_required', e.target.checked ? 1 : 0)} /> DTB-ID Pflicht</label>
              {tournament.type !== 'doubles' && (
                <label><input type="checkbox" checked={!!tournament.lk_handicap_enabled} onChange={e => handleChange('lk_handicap_enabled', e.target.checked ? 1 : 0)} /> LK-Handicap</label>
              )}
              {tournament.type === 'ko' && (
                <label><input type="checkbox" checked={!!tournament.is_doubles} onChange={e => handleChange('is_doubles', e.target.checked ? 1 : 0)} /> Doppel-KO</label>
              )}
            </div>
            {!!tournament.lk_handicap_enabled && tournament.type !== 'doubles' && (
              <div style={{ marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label>Handicap-Faktor</label>
                  <input type="number" step="0.01" value={tournament.lk_handicap_factor || 0.5} onChange={e => handleChange('lk_handicap_factor', parseFloat(e.target.value))} style={{ width: 120 }} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                  Besserer Spieler gewinnt: Siegpunkte − (LK-Differenz × Faktor), mindestens Mittelwert aus Sieg- und Niederlagepunkten = {((Number(tournament.points_win) + Number(tournament.points_loss)) / 2).toFixed(2)}. Schwächerer Spieler gewinnt: Siegpunkte + (LK-Differenz × Faktor) als Bonus.
                </div>
              </div>
            )}
            </>)}

            {tournament.type === 'doubles' && (
              <div className="mt-3" style={{ padding: '16px', background: 'var(--surface-alt, #f8f9fa)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
                <h4 style={{ margin: '0 0 12px 0' }}>🎾 Doppeleinstellungen</h4>
                <div className="form-row">
                  <div className="form-group">
                    <label>Rundendauer (Min.)</label>
                    <input type="number" min="10" step="5" value={tournament.doubles_round_duration || ''} 
                      onChange={e => handleChange('doubles_round_duration', parseInt(e.target.value) || null)} placeholder="z.B. 30" />
                  </div>
                  <div className="form-group">
                    <label>Start 1. Runde</label>
                    <input type="time" value={tournament.doubles_start_time || ''} 
                      onChange={e => handleChange('doubles_start_time', e.target.value)} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Plätze (Nummern, z.B. 1,2,3)</label>
                    <input type="text" value={tournament.doubles_courts || ''} 
                      onChange={e => handleChange('doubles_courts', e.target.value)} placeholder="1,2,3" />
                  </div>
                  <div className="form-group">
                    <label>Anzahl Runden</label>
                    <input type="number" min="1" value={tournament.doubles_rounds || 3} 
                      onChange={e => handleChange('doubles_rounds', parseInt(e.target.value) || 3)} />
                  </div>
                </div>
                <div className="flex gap-3 mt-1">
                  <label><input type="checkbox" checked={!!tournament.doubles_random_partners} onChange={e => handleChange('doubles_random_partners', e.target.checked ? 1 : 0)} /> Zufällige Partner</label>
                </div>
              </div>
            )}

            <button className="btn btn-primary mt-3" onClick={handleSave}>💾 Speichern</button>
          </div>
        )}

        {tab === 'registrations' && (
          <div className="card">
            <div className="flex-between mb-2">
              <h3>Anmeldungen</h3>
              <div className="flex gap-1">
                {tournament.type === 'lk_day' && (
                  <button className="btn btn-sm btn-outline" onClick={handleAutoSeed}>🏆 Auto-Setzliste (LK)</button>
                )}
                <button className="btn btn-sm btn-primary" onClick={() => {
                registrations.filter(r => r.status === 'pending').forEach(r => handleStatusChange(r.id, 'approved'));
              }}>Alle genehmigen</button>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Name</th><th>E-Mail</th><th>DTB-ID</th><th>LK</th>
                    {tournament.type === 'doubles' && !tournament.doubles_random_partners && <th>Partner</th>}
                    <th>Status</th><th>Setzplatz</th><th>Aktionen</th>
                  </tr>
                </thead>
                <tbody>
                  {registrations.map(r => (
                    <tr key={r.id}>
                      <td className="fw-bold">{r.name}</td>
                      <td style={{ fontSize: '0.85rem' }}>{r.email}</td>
                      <td>{r.dtb_id}</td>
                      <td>{r.lk}</td>
                      {tournament.type === 'doubles' && !tournament.doubles_random_partners && (
                        <td>
                          {r.linked_partner_name ? (
                            <span className="badge badge-success">{r.linked_partner_name}</span>
                          ) : (
                            <div>
                              {r.partner_name && <small className="text-muted">Wunsch: {r.partner_name}</small>}
                              <select style={{ width: 120, padding: '2px 4px', fontSize: '0.8rem' }}
                                value={r.partner_id || ''}
                                onChange={e => handlePartnerLink(r.id, parseInt(e.target.value) || null)}>
                                <option value="">– Verknüpfen –</option>
                                {registrations.filter(o => o.user_id !== r.user_id && o.status === 'approved').map(o => (
                                  <option key={o.user_id} value={o.user_id}>{o.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </td>
                      )}
                      <td>
                        <span className={`badge ${r.status === 'approved' ? 'badge-success' : r.status === 'pending' ? 'badge-warning' : r.status === 'waitlist' ? 'badge-info' : 'badge-danger'}`}>
                          {r.status === 'approved' ? 'Zugelassen' : r.status === 'pending' ? 'Ausstehend' : r.status === 'waitlist' ? 'Warteliste' : r.status}
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
                    <tr><td colSpan={tournament.type === 'doubles' && !tournament.doubles_random_partners ? 8 : 7} className="text-center text-muted">Keine Anmeldungen.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'standings' && tournament.type === 'league' && standings.length > 0 && (
          <div className="card league-table">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th><th>Spieler</th><th>LK</th><th>Sp.</th><th>S</th><th>N</th>
                    <th>Sätze</th><th>Games</th><th>Pkt</th><th>Bonus</th><th>Gesamt</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((s, i) => (
                    <tr key={s.user_id}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <div className="player-cell">
                          {s.profile_photo ? <img src={`/uploads/profiles/${s.profile_photo}`} alt="" className="mini-avatar" /> : null}
                          {s.name}
                        </div>
                      </td>
                      <td>{s.lk}</td>
                      <td>{s.matches_played}</td>
                      <td className="text-success fw-bold">{s.wins}</td>
                      <td className="text-danger">{s.losses}</td>
                      <td>{s.sets_won}:{s.sets_lost}</td>
                      <td>{s.games_won}:{s.games_lost}</td>
                      <td>{Number(s.points).toFixed(2)}</td>
                      <td>{s.bonus_points > 0 ? `+${s.bonus_points.toFixed(2)}` : '-'}</td>
                      <td className="points">{(s.points + s.bonus_points).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'standings' && tournament.type === 'doubles' && doublesStandings.length > 0 && (
          <div className="card league-table">
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{tournament.doubles_random_partners ? 'Spieler' : 'Team'}</th>
                    <th>Sp.</th><th>S</th><th>N</th>
                    <th>Games +/-</th><th>Diff</th><th>MP</th>
                  </tr>
                </thead>
                <tbody>
                  {doublesStandings.map((s, i) => (
                    <tr key={s.user_id}>
                      <td className="rank">{i + 1}</td>
                      <td>
                        <div className="player-cell">
                          {s.profile_photo ? <img src={`/uploads/profiles/${s.profile_photo}`} alt="" className="mini-avatar" /> : null}
                          {s.name}{s.partner_name ? ` / ${s.partner_name}` : ''}
                        </div>
                      </td>
                      <td>{s.matches_played}</td>
                      <td className="text-success fw-bold">{s.wins}</td>
                      <td className="text-danger">{s.losses}</td>
                      <td>{s.games_won}:{s.games_lost}</td>
                      <td className="fw-bold">{s.games_won - s.games_lost}</td>
                      <td className="points">{s.match_points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'rounds' && !['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) && (
          <RoundScheduleEditor rounds={rounds} headers={headers} onReload={load} />
        )}

        {tab === 'bracket' && ['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) && (
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
  Object.values(matchesByRound).forEach(rm => rm.sort((a, b) => (a.bracket_position || a.match_number) - (b.bracket_position || b.match_number)));

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

  const formatFullScore = (sets) => {
    if (!sets?.length) return '';
    return sets.map(s => {
      let str = `${s.games_player1}:${s.games_player2}`;
      if (s.tiebreak_points_player1 != null && s.tiebreak_points_player2 != null) {
        str += `(${Math.min(s.tiebreak_points_player1, s.tiebreak_points_player2)})`;
      }
      return str;
    }).join(', ');
  };

  const sortedRounds = [...rounds].sort((a, b) => a.round_number - b.round_number);

  return (
    <div>
      {saveMsg && <div className="alert alert-success mb-1">{saveMsg}</div>}

      <div className="ko-bracket">
        {sortedRounds.map((r, ri) => {
          const roundMatches = matchesByRound[r.round_number] || [];
          const nextRound = sortedRounds[ri + 1];
          const nextRoundMatchCount = nextRound ? (matchesByRound[nextRound.round_number] || []).length : 0;
          const isLastRound = ri === sortedRounds.length - 1;

          return (
            <Fragment key={r.id}>
              <div className="bracket-round">
                <div className="bracket-round-title">{r.name}</div>
                <div className="bracket-round-body">
                  {roundMatches.map(m => {
                    const hasResult = m.result_status !== 'pending' && m.winner_id;

                    return (
                      <div className="bracket-slot" key={m.id}>
                        <div className={`bracket-match bracket-match-admin ${editingMatch?.id === m.id ? 'bracket-match-editing' : ''}`}>
                          <div className={`bracket-player ${m.winner_id && m.winner_id === m.player1_id ? 'winner' : ''}`}>
                            <span className="bracket-player-info">
                              {m.player1_seed && <span className="bracket-seed">[{m.player1_seed}]</span>}
                              <span>{m.player1_name || 'TBD'}{tournament.type === 'one_point' && m.server_id === m.player1_id && ' 🎾'}</span>
                              {m.player1_lk && <span className="bracket-lk">LK {m.player1_lk}</span>}
                            </span>
                            <span className="bracket-scores">
                              {m.sets?.length > 0 && m.sets.map((s, i) => (
                                <span key={i} className={`bracket-game ${s.games_player1 > s.games_player2 ? 'set-won' : ''}`}>{s.games_player1}</span>
                              ))}
                            </span>
                          </div>
                          <div className={`bracket-player ${m.winner_id && m.winner_id === m.player2_id ? 'winner' : ''}`}>
                            <span className="bracket-player-info">
                              {m.player2_seed && <span className="bracket-seed">[{m.player2_seed}]</span>}
                              <span>{m.player2_name || 'TBD'}{tournament.type === 'one_point' && m.server_id === m.player2_id && ' 🎾'}</span>
                              {m.player2_lk && <span className="bracket-lk">LK {m.player2_lk}</span>}
                            </span>
                            <span className="bracket-scores">
                              {m.sets?.length > 0 && m.sets.map((s, i) => (
                                <span key={i} className={`bracket-game ${s.games_player2 > s.games_player1 ? 'set-won' : ''}`}>{s.games_player2}</span>
                              ))}
                            </span>
                          </div>
                          {hasResult && (m.sets?.length > 0 || m.walkover) && (
                            <div className="bracket-score-detail">
                              {m.walkover ? 'Freilos' : formatFullScore(m.sets)}
                            </div>
                          )}
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
                      </div>
                    );
                  })}
                </div>
              </div>
              {!isLastRound && nextRoundMatchCount > 0 && (
                <div className="bracket-connectors">
                  <div className="bracket-round-title" style={{ visibility: 'hidden' }}>&nbsp;</div>
                  <div className="bracket-connector-body">
                    {Array.from({ length: nextRoundMatchCount }).map((_, ci) => (
                      <div className="bracket-connector-group" key={ci}>
                        <div className="connector-top" />
                        <div className="connector-bottom" />
                        <div className="connector-vertical" />
                        <div className="connector-horizontal" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
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

function RoundScheduleEditor({ rounds, headers, onReload }) {
  const [editingRound, setEditingRound] = useState(null);
  const [form, setForm] = useState({ scheduled_date: '', scheduled_time: '', scheduled_duration: '', location: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  const openEdit = (r) => {
    setEditingRound(r);
    setForm({
      scheduled_date: r.scheduled_date || '',
      scheduled_time: r.scheduled_time || '',
      scheduled_duration: r.scheduled_duration || '',
      location: r.location || ''
    });
    setMsg('');
  };

  const handleSave = async () => {
    if (!editingRound) return;
    setSaving(true); setMsg('');
    try {
      await api.put(`/admin/rounds/${editingRound.id}/schedule`, form, { headers });
      setMsg('Gespeichert!');
      setEditingRound(null);
      onReload();
    } catch (err) {
      setMsg(err.response?.data?.error || 'Fehler beim Speichern.');
    } finally { setSaving(false); }
  };

  return (
    <div className="card">
      <h3 className="mb-2">Runden-Spielplan</h3>
      {msg && <div className="alert alert-success mb-1">{msg}</div>}
      <div className="table-wrapper">
        <table>
          <thead>
            <tr><th>Runde</th><th>Datum</th><th>Uhrzeit</th><th>Dauer</th><th>Ort</th><th>Aktionen</th></tr>
          </thead>
          <tbody>
            {rounds.map(r => (
              <tr key={r.id}>
                <td className="fw-bold">{r.name}</td>
                <td>{r.scheduled_date ? new Date(r.scheduled_date).toLocaleDateString('de') : '—'}</td>
                <td>{r.scheduled_time || '—'}</td>
                <td>{r.scheduled_duration ? `${r.scheduled_duration} Min.` : '—'}</td>
                <td>{r.location || '—'}</td>
                <td><button className="btn btn-sm btn-primary" onClick={() => openEdit(r)}>✏️</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editingRound && (
        <div className="modal-overlay" onClick={() => setEditingRound(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h3>Runde planen: {editingRound.name}</h3>
              <button className="modal-close" onClick={() => setEditingRound(null)}>✕</button>
            </div>
            <div className="form-group">
              <label>Datum</label>
              <input type="date" value={form.scheduled_date}
                onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Uhrzeit</label>
              <input type="time" value={form.scheduled_time}
                onChange={e => setForm(f => ({ ...f, scheduled_time: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Dauer (Minuten)</label>
              <input type="number" min="0" placeholder="z.B. 30" value={form.scheduled_duration}
                onChange={e => setForm(f => ({ ...f, scheduled_duration: e.target.value }))} />
            </div>
            <div className="form-group">
              <label>Ort</label>
              <input type="text" placeholder="z.B. TC Musterstadt" value={form.location}
                onChange={e => setForm(f => ({ ...f, location: e.target.value }))} />
            </div>
            <div className="flex gap-1 mt-2" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setEditingRound(null)}>Abbrechen</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleSave}>
                {saving ? 'Speichert...' : '💾 Speichern'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
