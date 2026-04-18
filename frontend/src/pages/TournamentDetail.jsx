import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const typeLabels = { league: 'Liga', ko: 'KO-Turnier', lk_day: 'LK-Tagesturnier', doubles: 'Doppel' };
const statusLabels = { draft: 'Entwurf', registration_open: 'Anmeldung offen', registration_closed: 'Anmeldung geschlossen', draw_complete: 'Auslosung fertig', in_progress: 'Läuft', completed: 'Beendet' };

export default function TournamentDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [showScoreModal, setShowScoreModal] = useState(null);
  const [tabInit, setTabInit] = useState(false);

  const load = async () => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setData(res.data);
      // Beim ersten Laden den sinnvollsten Tab setzen
      if (!tabInit) {
        const d = res.data;
        if (d.tournament.type === 'league' && d.standings?.length > 0) {
          setTab('standings');
        } else if (d.matches?.length > 0) {
          setTab('matches');
        } else {
          setTab('info');
        }
        setTabInit(true);
      }
    } catch { setError('Turnier nicht gefunden.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const handleRegister = async () => {
    setMsg(''); setError('');
    try {
      const res = await api.post(`/tournaments/${id}/register`);
      setMsg(res.data.message);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Anmeldung fehlgeschlagen.'); }
  };

  const handleWithdraw = async () => {
    if (!confirm('Anmeldung wirklich zurückziehen?')) return;
    try {
      await api.delete(`/tournaments/${id}/register`);
      setMsg('Abgemeldet.');
      load();
    } catch (err) { setError(err.response?.data?.error || 'Fehler.'); }
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data?.tournament) return <div className="page"><div className="alert alert-error">Turnier nicht gefunden.</div></div>;

  const { tournament, participants, rounds, matches, standings, myRegistration } = data;

  return (
    <div className="page">
      <div className="page-header">
        <div className="flex-between">
          <div>
            <h1>{tournament.name}</h1>
            <div className="flex gap-2 mt-1">
              <span className={`badge badge-${tournament.type}`}>{typeLabels[tournament.type]}</span>
              <span className="badge badge-info">{statusLabels[tournament.status]}</span>
            </div>
          </div>
          {user && !myRegistration && tournament.status === 'registration_open' && (
            <button className="btn btn-primary btn-lg" onClick={handleRegister}>Anmelden</button>
          )}
          {myRegistration && myRegistration.status !== 'withdrawn' && tournament.status === 'registration_open' && (
            <button className="btn btn-outline" onClick={handleWithdraw}>Abmelden</button>
          )}
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {myRegistration && (
        <div className={`alert ${myRegistration.status === 'approved' ? 'alert-success' : myRegistration.status === 'pending' ? 'alert-warning' : 'alert-info'}`}>
          {myRegistration.status === 'approved' ? '✅ Du bist für dieses Turnier zugelassen.' : 
           myRegistration.status === 'pending' ? '⏳ Deine Anmeldung wartet auf Bestätigung.' :
           `Status: ${myRegistration.status}`}
        </div>
      )}

      <div className="tabs">
        {(tournament.type === 'league' && standings.length > 0) && (
          <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Tabelle</button>
        )}
        {matches.length > 0 && (
          <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>
            {tournament.type === 'ko' ? 'Turnierbaum' : 'Spiele'}
          </button>
        )}
        <button className={`tab ${tab === 'info' ? 'active' : ''}`} onClick={() => setTab('info')}>Info</button>
        <button className={`tab ${tab === 'participants' ? 'active' : ''}`} onClick={() => setTab('participants')}>
          Teilnehmer ({participants.length})
        </button>
      </div>

      {tab === 'info' && (
        <div className="card">
          {tournament.description && <p style={{ marginBottom: '1.5rem' }}>{tournament.description}</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            <InfoItem label="Typ" value={typeLabels[tournament.type]} />
            <InfoItem label="Max. Teilnehmer" value={tournament.max_participants} />
            <InfoItem label="Ort" value={tournament.location || '-'} />
            <InfoItem label="Turnier-Zeitraum" value={
              tournament.tournament_start ? 
              `${new Date(tournament.tournament_start).toLocaleDateString('de')}${tournament.tournament_end ? ' - ' + new Date(tournament.tournament_end).toLocaleDateString('de') : ''}` : '-'
            } />
            <InfoItem label="Meldefrist" value={tournament.registration_deadline ? new Date(tournament.registration_deadline).toLocaleDateString('de') : '-'} />
            <InfoItem label="Auslosung" value={tournament.draw_date ? new Date(tournament.draw_date).toLocaleDateString('de') : '-'} />
            <InfoItem label="Gewinnsätze" value={tournament.winning_sets} />
            <InfoItem label="No-Ad" value={tournament.no_ad ? 'Ja' : 'Nein'} />
            <InfoItem label="Match-Tiebreak" value={tournament.match_tiebreak ? `Ja (bei ${tournament.match_tiebreak_at})` : 'Nein'} />
            {tournament.type === 'league' && (
              <>
                <InfoItem label="Punkte Sieg" value={tournament.points_win} />
                <InfoItem label="Punkte Niederlage" value={tournament.points_loss} />
                <InfoItem label="LK-Handicap" value={tournament.lk_handicap_enabled ? `Ja (Faktor: ${tournament.lk_handicap_factor})` : 'Nein'} />
              </>
            )}
            {tournament.type === 'doubles' && (
              <>
                <InfoItem label="Runden" value={tournament.doubles_rounds} />
                <InfoItem label="Partner" value={tournament.doubles_random_partners ? 'Zufällig pro Runde' : 'Fest'} />
              </>
            )}
            <InfoItem label="Selbsteintragung" value={tournament.self_reporting ? 'Ja' : 'Nein'} />
            <InfoItem label="DTB-ID erforderlich" value={tournament.dtb_id_required ? 'Ja' : 'Nein'} />
          </div>
        </div>
      )}

      {tab === 'participants' && (
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead><tr><th>#</th><th>Spieler</th><th>LK</th>{tournament.type === 'ko' && <th>Setzplatz</th>}</tr></thead>
              <tbody>
                {participants.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td>
                      <div className="flex gap-1" style={{ alignItems: 'center' }}>
                        {p.profile_photo ? (
                          <img src={`/uploads/profiles/${p.profile_photo}`} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary-light)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700 }}>
                            {p.name?.charAt(0)}
                          </div>
                        )}
                        <span>{p.name}</span>
                      </div>
                    </td>
                    <td>{p.lk}</td>
                    {tournament.type === 'ko' && <td>{p.seed_number || '-'}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'standings' && (
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
                    <td>{s.points}</td>
                    <td>{s.bonus_points > 0 ? `+${s.bonus_points.toFixed(1)}` : '-'}</td>
                    <td className="points">{(s.points + s.bonus_points).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'matches' && tournament.type === 'ko' && (
        <KOBracket rounds={rounds} matches={matches} tournament={tournament} user={user} onReload={load} />
      )}

      {tab === 'matches' && tournament.type !== 'ko' && (
        <MatchList rounds={rounds} matches={matches} tournament={tournament} user={user} onReload={load} />
      )}

      {showScoreModal && (
        <ScoreModal match={showScoreModal} tournament={tournament} onClose={() => setShowScoreModal(null)} onSaved={() => { setShowScoreModal(null); load(); }} />
      )}
    </div>
  );
}

function InfoItem({ label, value }) {
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function KOBracket({ rounds, matches, tournament, user, onReload }) {
  const [reportMatch, setReportMatch] = useState(null);
  const [disputeMatch, setDisputeMatch] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const matchesByRound = {};
  matches.forEach(m => {
    const rn = m.round_number || 1;
    if (!matchesByRound[rn]) matchesByRound[rn] = [];
    matchesByRound[rn].push(m);
  });

  const handleConfirm = async (matchId) => {
    if (!confirm('Ergebnis bestätigen?')) return;
    setActionLoading(matchId);
    setActionMsg(''); setActionError('');
    try {
      const res = await api.post(`/matches/${matchId}/confirm-result`);
      setActionMsg(res.data.message);
      onReload();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Fehler beim Bestätigen.');
    } finally { setActionLoading(null); }
  };

  const handleDispute = async () => {
    if (!disputeMatch) return;
    setActionLoading(disputeMatch.id);
    try {
      const res = await api.post(`/matches/${disputeMatch.id}/dispute-result`, { reason: disputeReason });
      setActionMsg(res.data.message);
      setDisputeMatch(null);
      setDisputeReason('');
      onReload();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Fehler beim Reklamieren.');
    } finally { setActionLoading(null); }
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }) : '';

  return (
    <div>
      {actionMsg && <div className="alert alert-success mb-1">{actionMsg}</div>}
      {actionError && <div className="alert alert-error mb-1">{actionError}</div>}

      <div className="bracket">
        {rounds.map(r => (
          <div className="bracket-round" key={r.id}>
            <div className="bracket-round-title">{r.name}</div>
            {(matchesByRound[r.round_number] || []).map(m => {
              const canReport = tournament.self_reporting && user && m.result_status === 'pending' &&
                (m.player1_id === user.id || m.player2_id === user.id);
              const canConfirmDispute = user && m.result_status === 'reported' && m.reported_by !== user.id &&
                (m.player1_id === user.id || m.player2_id === user.id);

              return (
                <div className="bracket-match" key={m.id}>
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
                  {(m.scheduled_date || m.scheduled_time || m.court) && (
                    <div className="bracket-schedule-bar">
                      <span className="bracket-schedule-info">
                        {formatDate(m.scheduled_date)}{m.scheduled_time ? ` ${m.scheduled_time}` : ''}{m.court ? ` · ${m.court}` : ''}
                      </span>
                    </div>
                  )}
                  {m.score && m.result_status !== 'pending' && (
                    <div className="bracket-score-detail">
                      {m.sets && m.sets.length > 0
                        ? m.sets.map((s, i) => <span key={i} className="score-set">{s.games_player1}:{s.games_player2} </span>)
                        : m.score}
                    </div>
                  )}
                  {user && (canReport || canConfirmDispute) && (
                    <div className="bracket-actions">
                      {canReport && (
                        <button className="btn btn-sm btn-primary" onClick={() => setReportMatch(m)}>Ergebnis eintragen</button>
                      )}
                      {canConfirmDispute && (
                        <>
                          <button className="btn btn-sm btn-success" disabled={actionLoading === m.id} onClick={() => handleConfirm(m.id)}>
                            {actionLoading === m.id ? '...' : '✓ Bestätigen'}
                          </button>
                          <button className="btn btn-sm btn-danger" disabled={actionLoading === m.id}
                            onClick={() => { setDisputeMatch(m); setDisputeReason(''); }}>
                            ✗ Reklamieren
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {reportMatch && (
        <ScoreModal match={reportMatch} tournament={tournament} onClose={() => setReportMatch(null)} onSaved={() => { setReportMatch(null); onReload(); }} />
      )}

      {disputeMatch && (
        <div className="modal-overlay" onClick={() => setDisputeMatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ergebnis reklamieren</h2>
              <button className="modal-close" onClick={() => setDisputeMatch(null)}>✕</button>
            </div>
            <p className="mb-2">
              <strong>{disputeMatch.player1_name}</strong> vs <strong>{disputeMatch.player2_name}</strong>
              {disputeMatch.score && <> – Gemeldetes Ergebnis: <strong>{disputeMatch.score}</strong></>}
            </p>
            <div className="form-group">
              <label>Grund der Reklamation (optional)</label>
              <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={3}
                placeholder="Beschreibe, warum das Ergebnis nicht stimmt..." />
            </div>
            <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setDisputeMatch(null)}>Abbrechen</button>
              <button className="btn btn-danger" disabled={actionLoading === disputeMatch.id} onClick={handleDispute}>
                {actionLoading === disputeMatch.id ? 'Wird gesendet...' : 'Reklamieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchList({ rounds, matches, tournament, user, onReload }) {
  const [reportMatch, setReportMatch] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [disputeMatch, setDisputeMatch] = useState(null);
  const [disputeReason, setDisputeReason] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [actionMsg, setActionMsg] = useState('');
  const [actionError, setActionError] = useState('');

  const filteredMatches = onlyMine && user
    ? matches.filter(m => m.player1_id === user.id || m.player2_id === user.id)
    : matches;

  const handleConfirm = async (matchId) => {
    if (!confirm('Ergebnis bestätigen?')) return;
    setActionLoading(matchId);
    setActionMsg(''); setActionError('');
    try {
      const res = await api.post(`/matches/${matchId}/confirm-result`);
      setActionMsg(res.data.message);
      onReload();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Fehler beim Bestätigen.');
    } finally { setActionLoading(null); }
  };

  const handleDispute = async () => {
    if (!disputeMatch) return;
    setActionLoading(disputeMatch.id);
    setActionMsg(''); setActionError('');
    try {
      const res = await api.post(`/matches/${disputeMatch.id}/dispute-result`, { reason: disputeReason });
      setActionMsg(res.data.message);
      setDisputeMatch(null);
      setDisputeReason('');
      onReload();
    } catch (err) {
      setActionError(err.response?.data?.error || 'Fehler beim Reklamieren.');
    } finally { setActionLoading(null); }
  };

  // Punkteberechnung für LK-Handicap anzeigen
  const calcPoints = (m) => {
    if (!tournament.lk_handicap_enabled || !m.winner_id) return null;
    const winnerId = m.winner_id;
    const loserId = m.player1_id === winnerId ? m.player2_id : m.player1_id;
    const winnerLk = m.player1_id === winnerId ? m.player1_lk : m.player2_lk;
    const loserLk = m.player1_id === loserId ? m.player1_lk : m.player2_lk;
    if (winnerLk == null || loserLk == null) return null;
    const lkDiff = Math.abs(winnerLk - loserLk);
    const factor = tournament.lk_handicap_factor || 0;
    let effectiveWin = tournament.points_win;
    let bonus = 0;
    if (winnerLk < loserLk) {
      effectiveWin = Math.max(tournament.points_win - lkDiff * factor, tournament.points_loss);
    } else if (winnerLk > loserLk) {
      bonus = lkDiff * factor;
    }
    const winnerName = m.player1_id === winnerId ? m.player1_name : m.player2_name;
    const loserName = m.player1_id === loserId ? m.player1_name : m.player2_name;
    return { winnerName, loserName, winnerLk, loserLk, lkDiff, effectiveWin, bonus, lossPoints: tournament.points_loss };
  };

  return (
    <div>
      {actionMsg && <div className="alert alert-success mb-1">{actionMsg}</div>}
      {actionError && <div className="alert alert-error mb-1">{actionError}</div>}

      {user && (
        <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input type="checkbox" id="onlyMine" checked={onlyMine} onChange={e => setOnlyMine(e.target.checked)} />
          <label htmlFor="onlyMine" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>Nur meine Spiele anzeigen</label>
        </div>
      )}
      {rounds.map(r => {
        const roundMatches = filteredMatches.filter(m => m.round_number === r.round_number);
        if (roundMatches.length === 0) return null;
        return (
          <div key={r.id} className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '1rem' }}>{r.name}</h3>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{tournament.type === 'doubles' ? 'Team 1' : 'Spieler 1'}</th>
                    <th>vs</th>
                    <th>{tournament.type === 'doubles' ? 'Team 2' : 'Spieler 2'}</th>
                    <th>Ergebnis</th>
                    <th>Status</th>
                    {user && <th>Aktion</th>}
                  </tr>
                </thead>
                <tbody>
                  {roundMatches.map(m => {
                    const canReport = tournament.self_reporting && user && m.result_status === 'pending' && 
                      (m.player1_id === user.id || m.player2_id === user.id);
                    const canConfirmDispute = user && m.result_status === 'reported' && m.reported_by !== user.id &&
                      (m.player1_id === user.id || m.player2_id === user.id);
                    const pts = (m.result_status === 'confirmed' || m.result_status === 'admin_set') ? calcPoints(m) : null;
                    return (
                      <tr key={m.id}>
                        <td>{m.match_number}</td>
                        <td>
                          <span className={m.winner_id === m.player1_id ? 'fw-bold text-success' : ''}>
                            {m.player1_name || 'TBD'}
                          </span>
                          {m.partner1_name && <span className="text-muted"> / {m.partner1_name}</span>}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>vs</td>
                        <td>
                          <span className={m.winner_id === m.player2_id ? 'fw-bold text-success' : ''}>
                            {m.player2_name || 'TBD'}
                          </span>
                          {m.partner2_name && <span className="text-muted"> / {m.partner2_name}</span>}
                        </td>
                        <td>
                          {m.sets && m.sets.length > 0
                            ? <span className="fw-bold">{m.sets.map((s, i) => <span key={i} className="score-set">{s.games_player1}:{s.games_player2} </span>)}</span>
                            : <span className="fw-bold">{m.score || '-'}</span>}
                          {pts && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}
                                 title={`LK ${pts.winnerName}: ${pts.winnerLk} | LK ${pts.loserName}: ${pts.loserLk} | Diff: ${pts.lkDiff.toFixed(1)}`}>
                              🏆 {pts.winnerName}: {pts.effectiveWin.toFixed(1)} Pkt{pts.bonus > 0 ? ` +${pts.bonus.toFixed(1)} Bonus` : ''}
                              {' · '}
                              {pts.loserName}: {pts.lossPoints} Pkt
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            m.result_status === 'confirmed' || m.result_status === 'admin_set' ? 'badge-success' :
                            m.result_status === 'reported' ? 'badge-warning' :
                            m.result_status === 'disputed' ? 'badge-danger' : 'badge-neutral'
                          }`}>
                            {m.result_status === 'confirmed' ? 'Bestätigt' : m.result_status === 'reported' ? 'Gemeldet' : 
                             m.result_status === 'disputed' ? 'Reklamiert' : m.result_status === 'admin_set' ? 'Admin' : 'Offen'}
                          </span>
                        </td>
                        {user && (
                          <td>
                            {canReport && (
                              <button className="btn btn-sm btn-primary" onClick={() => setReportMatch(m)}>
                                Ergebnis eintragen
                              </button>
                            )}
                            {canConfirmDispute && (
                              <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                                <button className="btn btn-sm btn-success" disabled={actionLoading === m.id} onClick={() => handleConfirm(m.id)}>
                                  {actionLoading === m.id ? '...' : '✓ Bestätigen'}
                                </button>
                                <button className="btn btn-sm btn-danger" disabled={actionLoading === m.id} onClick={() => { setDisputeMatch(m); setDisputeReason(''); }}>
                                  ✗ Reklamieren
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {reportMatch && (
        <ScoreModal match={reportMatch} tournament={tournament} onClose={() => setReportMatch(null)} onSaved={() => { setReportMatch(null); onReload(); }} />
      )}

      {disputeMatch && (
        <div className="modal-overlay" onClick={() => setDisputeMatch(null)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Ergebnis reklamieren</h2>
              <button className="modal-close" onClick={() => setDisputeMatch(null)}>✕</button>
            </div>
            <p className="mb-2">
              <strong>{disputeMatch.player1_name}</strong> vs <strong>{disputeMatch.player2_name}</strong>
              {disputeMatch.score && <> – Gemeldetes Ergebnis: <strong>{disputeMatch.score}</strong></>}
            </p>
            <div className="form-group">
              <label>Grund der Reklamation (optional)</label>
              <textarea value={disputeReason} onChange={e => setDisputeReason(e.target.value)} rows={3}
                placeholder="Beschreibe, warum das Ergebnis nicht stimmt..." />
            </div>
            <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setDisputeMatch(null)}>Abbrechen</button>
              <button className="btn btn-danger" disabled={actionLoading === disputeMatch.id} onClick={handleDispute}>
                {actionLoading === disputeMatch.id ? 'Wird gesendet...' : 'Reklamieren'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScoreModal({ match, tournament, onClose, onSaved }) {
  const numSets = tournament.winning_sets === 3 ? 5 : 3;
  const useMTB = tournament.match_tiebreak;
  const mtbAt = tournament.match_tiebreak_at || '1:1';
  const [sets, setSets] = useState(Array.from({ length: numSets }, () => ({ games_player1: '', games_player2: '' })));
  const [winnerId, setWinnerId] = useState('');
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSetChange = (idx, field, value) => {
    const newSets = [...sets];
    newSets[idx] = { ...newSets[idx], [field]: value };
    setSets(newSets);
    setWarning('');
  };

  // Tennis-Plausibilitätsprüfung
  function validateTennisResult(setsData, winner) {
    const validSets = setsData.filter(s => s.games_player1 !== '' && s.games_player2 !== '');
    if (validSets.length === 0) return 'Mindestens ein Satz muss eingegeben werden.';

    const setsNeeded = tournament.winning_sets; // 2 or 3
    let setsWonP1 = 0;
    let setsWonP2 = 0;

    for (let i = 0; i < validSets.length; i++) {
      const g1 = parseInt(validSets[i].games_player1);
      const g2 = parseInt(validSets[i].games_player2);
      if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0) return `Satz ${i + 1}: Ungültige Spielanzahl.`;

      const isLastPossibleSet = (setsWonP1 === setsNeeded - 1 && setsWonP2 === setsNeeded - 1);
      const isMTBSet = useMTB && isLastPossibleSet;

      if (isMTBSet) {
        // Match-Tiebreak: typisch 10:X oder X:10, mind. 2 Differenz bei >=10
        if (g1 === g2) return `Satz ${i + 1} (Match-Tiebreak): Unentschieden ist nicht möglich.`;
        const high = Math.max(g1, g2);
        const low = Math.min(g1, g2);
        if (high < 10) return `Satz ${i + 1} (Match-Tiebreak): Der Gewinner muss mindestens 10 Punkte haben (aktuell: ${g1}:${g2}).`;
        if (high > 10 && (high - low) !== 2) return `Satz ${i + 1} (Match-Tiebreak): Bei Stand über 10 muss die Differenz genau 2 betragen (aktuell: ${g1}:${g2}).`;
        if (high === 10 && low > 8) return `Satz ${i + 1} (Match-Tiebreak): Bei 10 Punkten darf der Gegner maximal 8 haben, oder es geht weiter (aktuell: ${g1}:${g2}).`;
      } else {
        // Normaler Satz
        if (g1 === g2) return `Satz ${i + 1}: Unentschieden (${g1}:${g2}) ist im Tennis nicht möglich.`;
        const high = Math.max(g1, g2);
        const low = Math.min(g1, g2);

        if (tournament.no_ad) {
          // No-Ad: Sätze gehen bis 4 mit Entscheidungspunkt bei 3:3, also max 4:3
          // Oder: Standard bis 6 mit No-Ad bei Deuce
          // Meistens normal bis 6/7
        }

        if (high < 6) return `Satz ${i + 1}: Mindestens 6 Games nötig zum Satzgewinn (aktuell: ${g1}:${g2}).`;

        if (high === 6) {
          if (low > 4) return `Satz ${i + 1}: Bei 6 gewonnenen Games darf der Gegner maximal 4 haben (aktuell: ${g1}:${g2}). Bei 6:5 muss weitergespielt werden.`;
        } else if (high === 7) {
          if (low !== 5 && low !== 6) return `Satz ${i + 1}: Bei 7 Games ist nur 7:5 oder 7:6 (Tiebreak) möglich (aktuell: ${g1}:${g2}).`;
        } else {
          return `Satz ${i + 1}: Maximal 7 Games pro Satz möglich (aktuell: ${g1}:${g2}).`;
        }
      }

      // Satzgewinner zählen
      if (g1 > g2) setsWonP1++;
      else setsWonP2++;

      // Match schon entschieden? Dann keine weiteren Sätze
      if (setsWonP1 === setsNeeded || setsWonP2 === setsNeeded) {
        if (i < validSets.length - 1) {
          return `Nach Satz ${i + 1} steht das Match bereits ${setsWonP1}:${setsWonP2} – es sollten keine weiteren Sätze gespielt werden.`;
        }
      }
    }

    // Prüfe ob Match tatsächlich beendet ist
    if (setsWonP1 < setsNeeded && setsWonP2 < setsNeeded) {
      return `Das Match ist noch nicht beendet: ${setsWonP1}:${setsWonP2} Sätze. Es werden ${setsNeeded} Gewinnsätze benötigt.`;
    }

    // Gewinner-Validierung
    if (winner) {
      const winnerInt = parseInt(winner);
      const p1Won = setsWonP1 > setsWonP2;
      if (p1Won && winnerInt !== match.player1_id) {
        return `Der ausgewählte Gewinner stimmt nicht mit dem Ergebnis überein. ${match.player1_name} hat ${setsWonP1}:${setsWonP2} Sätze gewonnen.`;
      }
      if (!p1Won && winnerInt !== match.player2_id) {
        return `Der ausgewählte Gewinner stimmt nicht mit dem Ergebnis überein. ${match.player2_name} hat ${setsWonP2}:${setsWonP1} Sätze gewonnen.`;
      }
    }

    return null; // Alles OK
  }

  // Auto-detect winner from sets
  function autoDetectWinner(setsData) {
    const validSets = setsData.filter(s => s.games_player1 !== '' && s.games_player2 !== '');
    let p1 = 0, p2 = 0;
    for (const s of validSets) {
      const g1 = parseInt(s.games_player1), g2 = parseInt(s.games_player2);
      if (!isNaN(g1) && !isNaN(g2)) {
        if (g1 > g2) p1++; else if (g2 > g1) p2++;
      }
    }
    if (p1 >= tournament.winning_sets) return String(match.player1_id);
    if (p2 >= tournament.winning_sets) return String(match.player2_id);
    return '';
  }

  useEffect(() => {
    // Auto-select winner when sets change
    const detected = autoDetectWinner(sets);
    if (detected) setWinnerId(detected);
  }, [sets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setWarning('');

    const validSets = sets.filter(s => s.games_player1 !== '' && s.games_player2 !== '');
    if (validSets.length === 0) return setError('Mindestens ein Satz eingeben.');
    if (!winnerId) return setError('Gewinner auswählen.');

    const validationError = validateTennisResult(sets, winnerId);
    if (validationError) {
      return setWarning(validationError);
    }

    setLoading(true);
    try {
      await api.post(`/matches/${match.id}/report`, {
        sets: validSets.map(s => ({ 
          games_player1: parseInt(s.games_player1), 
          games_player2: parseInt(s.games_player2) 
        })),
        winnerId: parseInt(winnerId)
      });
      onSaved();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Eintragen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Ergebnis eintragen</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        
        <p className="mb-2">
          <strong>{match.player1_name}</strong> vs <strong>{match.player2_name}</strong>
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {warning && (
          <div className="alert alert-error" style={{ background: '#fff8e1', borderColor: '#f9a825', color: '#6d4c00' }}>
            ⚠️ <strong>Bitte prüfe das Ergebnis:</strong><br />{warning}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="score-input mb-2">
            {sets.map((s, idx) => {
              const isLastDecider = useMTB && idx === numSets - 1;
              return (
                <div className="set-row" key={idx}>
                  <label>{isLastDecider ? 'Match-TB' : `Satz ${idx + 1}`}</label>
                  <input type="number" min="0" max={isLastDecider ? 99 : 7} value={s.games_player1} onChange={e => handleSetChange(idx, 'games_player1', e.target.value)} placeholder="-" />
                  <span className="separator">:</span>
                  <input type="number" min="0" max={isLastDecider ? 99 : 7} value={s.games_player2} onChange={e => handleSetChange(idx, 'games_player2', e.target.value)} placeholder="-" />
                </div>
              );
            })}
          </div>

          <div className="form-group">
            <label>Gewinner</label>
            <select value={winnerId} onChange={e => { setWinnerId(e.target.value); setWarning(''); }} required>
              <option value="">Bitte wählen...</option>
              <option value={match.player1_id}>{match.player1_name}</option>
              <option value={match.player2_id}>{match.player2_name}</option>
            </select>
          </div>

          <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Wird gesendet...' : 'Ergebnis melden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
