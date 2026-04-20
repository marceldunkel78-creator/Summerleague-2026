import { useState, useEffect, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const typeLabels = { league: 'Liga', ko: 'KO-Turnier', lk_day: 'LK-Tagesturnier', doubles: 'Doppel', one_point: 'One Point Slam', tiebreak_ko: 'Tiebreak-Turnier' };
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
  const [partnerName, setPartnerName] = useState('');
  const [challengeTarget, setChallengeTarget] = useState(null);

  const load = async () => {
    try {
      const res = await api.get(`/tournaments/${id}`);
      setData(res.data);
      // Beim ersten Laden den sinnvollsten Tab setzen
      if (!tabInit) {
        const d = res.data;
        if (d.tournament.type === 'league' && d.standings?.length > 0) {
          setTab('standings');
        } else if (d.tournament.type === 'doubles' && d.doublesStandings?.length > 0) {
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
      const body = {};
      if (partnerName.trim()) body.partner_name = partnerName.trim();
      const res = await api.post(`/tournaments/${id}/register`, body);
      setMsg(res.data.message);
      setPartnerName('');
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

  const { tournament, participants, rounds, matches, standings, doublesStandings, myRegistration } = data;

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
            <div className="flex gap-1" style={{ alignItems: 'flex-end' }}>
              {tournament.type === 'doubles' && !tournament.doubles_random_partners && (
                <div className="form-group" style={{ margin: 0 }}>
                  <label style={{ fontSize: '0.8rem' }}>Partnername</label>
                  <input type="text" placeholder="Name des Partners" value={partnerName}
                    onChange={e => setPartnerName(e.target.value)} style={{ width: 180, padding: '8px 12px' }} />
                </div>
              )}
              <button className="btn btn-primary btn-lg" onClick={handleRegister}>Anmelden</button>
            </div>
          )}
          {myRegistration && myRegistration.status !== 'withdrawn' && tournament.status === 'registration_open' && (
            <button className="btn btn-outline" onClick={handleWithdraw}>Abmelden</button>
          )}
        </div>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {myRegistration && (
        <div className={`alert ${myRegistration.status === 'approved' ? 'alert-success' : myRegistration.status === 'pending' ? 'alert-warning' : myRegistration.status === 'waitlist' ? 'alert-warning' : 'alert-info'}`}>
          {myRegistration.status === 'approved' ? '✅ Du bist für dieses Turnier zugelassen.' : 
           myRegistration.status === 'pending' ? '⏳ Deine Anmeldung wartet auf Bestätigung.' :
           myRegistration.status === 'waitlist' ? '⏳ Du stehst auf der Warteliste. Du rückst automatisch nach, wenn ein Platz frei wird.' :
           `Status: ${myRegistration.status}`}
        </div>
      )}

      <div className="tabs">
        {((tournament.type === 'league' && standings.length > 0) || (tournament.type === 'doubles' && doublesStandings?.length > 0)) && (
          <button className={`tab ${tab === 'standings' ? 'active' : ''}`} onClick={() => setTab('standings')}>Tabelle</button>
        )}
        {matches.length > 0 && (
          <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>
            {['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) ? 'Turnierbaum' : 'Spiele'}
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
            {tournament.entry_fee && <InfoItem label="Anmeldegebühr" value={tournament.entry_fee} />}
            {tournament.prize_description && <InfoItem label="Preisgeld / Preise" value={tournament.prize_description} />}
            <InfoItem label="Turnier-Zeitraum" value={
              tournament.tournament_start ? 
              `${new Date(tournament.tournament_start).toLocaleDateString('de')}${tournament.tournament_end ? ' - ' + new Date(tournament.tournament_end).toLocaleDateString('de') : ''}` : '-'
            } />
            {tournament.start_time && <InfoItem label="Startuhrzeit" value={tournament.start_time + ' Uhr'} />}
            <InfoItem label="Meldefrist" value={tournament.registration_deadline ? new Date(tournament.registration_deadline).toLocaleDateString('de') : '-'} />
            <InfoItem label="Auslosung" value={tournament.draw_date ? new Date(tournament.draw_date).toLocaleDateString('de') : '-'} />
            {!['doubles', 'one_point', 'tiebreak_ko'].includes(tournament.type) && <InfoItem label="Gewinnsätze" value={tournament.winning_sets} />}
            {!['one_point', 'tiebreak_ko'].includes(tournament.type) && <InfoItem label="No-Ad" value={tournament.no_ad ? 'Ja' : 'Nein'} />}
            {!['doubles', 'one_point', 'tiebreak_ko'].includes(tournament.type) && <InfoItem label="Match-Tiebreak" value={tournament.match_tiebreak ? `Ja (bei ${tournament.match_tiebreak_at})` : 'Nein'} />}
            {tournament.type === 'one_point' && <InfoItem label="Modus" value="Ein Punkt pro Match – Gewinner des Ballwechsels zieht weiter" />}
            {tournament.type === 'tiebreak_ko' && <InfoItem label="Modus" value="3 Gewinnsätze – jeder Satz ist ein Tiebreak bis 5" />}
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
              <thead><tr><th>#</th><th>Spieler</th><th>LK</th>{['ko', 'tiebreak_ko'].includes(tournament.type) && <th>Setzplatz</th>}{tournament.type === 'league' && user && myRegistration?.status === 'approved' && <th>Aktion</th>}</tr></thead>
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
                    {['ko', 'tiebreak_ko'].includes(tournament.type) && <td>{p.seed_number || '-'}</td>}
                    {tournament.type === 'league' && user && myRegistration?.status === 'approved' && (
                      <td>
                        {p.id !== user.id && (
                          <button className="btn btn-sm btn-primary" onClick={() => setChallengeTarget(p)}>
                            Herausfordern
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'standings' && tournament.type === 'league' && (
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

      {tab === 'standings' && tournament.type === 'doubles' && doublesStandings?.length > 0 && (
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

      {tab === 'matches' && ['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) && (
        <KOBracket rounds={rounds} matches={matches} tournament={tournament} user={user} onReload={load} />
      )}

      {tab === 'matches' && !['ko', 'one_point', 'tiebreak_ko'].includes(tournament.type) && (
        <MatchList rounds={rounds} matches={matches} tournament={tournament} user={user} onReload={load} />
      )}

      {showScoreModal && (
        <ScoreModal match={showScoreModal} tournament={tournament} onClose={() => setShowScoreModal(null)} onSaved={() => { setShowScoreModal(null); load(); }} />
      )}

      {challengeTarget && (
        <ChallengeModal
          opponent={challengeTarget}
          tournamentId={tournament.id}
          onClose={() => setChallengeTarget(null)}
          onSent={(message) => { setChallengeTarget(null); setMsg(message); }}
        />
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

function ChallengeModal({ opponent, tournamentId, onClose, onSent }) {
  const [form, setForm] = useState({ location: '', proposedDate: '', proposedTime: '', message: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.location || !form.proposedDate || !form.proposedTime) {
      return setError('Ort, Datum und Uhrzeit sind erforderlich.');
    }
    setLoading(true);
    try {
      const res = await api.post(`/tournaments/${tournamentId}/challenge`, {
        opponentId: opponent.id,
        location: form.location,
        proposedDate: form.proposedDate,
        proposedTime: form.proposedTime,
        message: form.message
      });
      onSent(res.data.message);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Senden.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🎾 Herausforderung</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <p className="mb-2">
          Du forderst <strong>{opponent.name}</strong> (LK {opponent.lk}) heraus.
        </p>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Deine Kontaktdaten (E-Mail und Telefonnummer) werden dem Gegner per E-Mail mitgeteilt.
        </p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vorgeschlagener Ort *</label>
            <input type="text" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              required placeholder="z.B. Tennisclub Musterstadt, Platz 3" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Datum *</label>
              <input type="date" value={form.proposedDate} onChange={e => setForm(f => ({ ...f, proposedDate: e.target.value }))}
                required min={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-group">
              <label>Uhrzeit *</label>
              <input type="time" value={form.proposedTime} onChange={e => setForm(f => ({ ...f, proposedTime: e.target.value }))}
                required />
            </div>
          </div>
          <div className="form-group">
            <label>Nachricht (optional)</label>
            <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
              rows={3} placeholder="z.B. Alternativtermine, besondere Hinweise..." />
          </div>
          <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Wird gesendet...' : 'Herausforderung senden'}
            </button>
          </div>
        </form>
      </div>
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
  Object.values(matchesByRound).forEach(rm => rm.sort((a, b) => (a.bracket_position || a.match_number) - (b.bracket_position || b.match_number)));

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
      {actionMsg && <div className="alert alert-success mb-1">{actionMsg}</div>}
      {actionError && <div className="alert alert-error mb-1">{actionError}</div>}

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
                    const canReport = tournament.self_reporting && user && m.result_status === 'pending' &&
                      (m.player1_id === user.id || m.player2_id === user.id) &&
                      m.player1_id && m.player2_id;
                    const canConfirmDispute = user && m.result_status === 'reported' && m.reported_by !== user.id &&
                      (m.player1_id === user.id || m.player2_id === user.id);
                    const hasResult = m.result_status !== 'pending' && m.winner_id;

                    return (
                      <div className="bracket-slot" key={m.id}>
                        <div className="bracket-match">
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
                          {(m.scheduled_date || m.scheduled_time || m.court) && (
                            <div className="bracket-schedule-bar">
                              <span className="bracket-schedule-info">
                                {formatDate(m.scheduled_date)}{m.scheduled_time ? ` ${m.scheduled_time}` : ''}{m.court ? ` · ${m.court}` : ''}
                              </span>
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
      const minPoints = (tournament.points_win + tournament.points_loss) / 2;
      effectiveWin = Math.max(tournament.points_win - lkDiff * factor, minPoints);
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
        const hasRoundSchedule = r.scheduled_date || r.scheduled_time || r.scheduled_duration || r.location;
        return (
          <div key={r.id} className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>{r.name}</h3>
            {hasRoundSchedule && (
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                {r.scheduled_date && <span>📅 {new Date(r.scheduled_date).toLocaleDateString('de')}</span>}
                {r.scheduled_time && <span>🕐 {r.scheduled_time}{r.scheduled_duration ? ` (${r.scheduled_duration} Min.)` : ''}</span>}
                {r.location && <span>📍 {r.location}</span>}
              </div>
            )}
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
                    {(tournament.type === 'doubles' || tournament.type === 'lk_day') && <th>Platz</th>}
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
                          {tournament.type === 'lk_day' && m.player1_lk && <span className="text-muted" style={{ fontSize: '0.8rem' }}> (LK {m.player1_lk})</span>}
                          {m.partner1_name && <span className="text-muted"> / {m.partner1_name}</span>}
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>vs</td>
                        <td>
                          <span className={m.winner_id === m.player2_id ? 'fw-bold text-success' : ''}>
                            {m.player2_name || 'TBD'}
                          </span>
                          {tournament.type === 'lk_day' && m.player2_lk && <span className="text-muted" style={{ fontSize: '0.8rem' }}> (LK {m.player2_lk})</span>}
                          {m.partner2_name && <span className="text-muted"> / {m.partner2_name}</span>}
                        </td>
                        <td>
                          {m.sets && m.sets.length > 0
                            ? <span className="fw-bold">{m.sets.map((s, i) => <span key={i} className="score-set">{s.games_player1}:{s.games_player2} </span>)}</span>
                            : <span className="fw-bold">{m.score || '-'}</span>}
                          {pts && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}
                                 title={`LK ${pts.winnerName}: ${pts.winnerLk} | LK ${pts.loserName}: ${pts.loserLk} | Diff: ${pts.lkDiff.toFixed(1)}`}>
                              🏆 {pts.winnerName}: {pts.effectiveWin.toFixed(2)} Pkt{pts.bonus > 0 ? ` +${pts.bonus.toFixed(2)} Bonus` : ''}
                              {' · '}
                              {pts.loserName}: {Number(pts.lossPoints).toFixed(2)} Pkt
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
                        {(tournament.type === 'doubles' || tournament.type === 'lk_day') && (
                          <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                            {m.court || '—'}
                            {m.scheduled_time && <div>{m.scheduled_time}</div>}
                          </td>
                        )}
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
  const isDoubles = tournament.type === 'doubles';
  const isOnePoint = tournament.type === 'one_point';
  const isTiebreakKO = tournament.type === 'tiebreak_ko';
  const numSets = isOnePoint ? 0 : isTiebreakKO ? 5 : isDoubles ? 1 : (tournament.winning_sets === 3 ? 5 : 3);
  const winningSets = isTiebreakKO ? 3 : tournament.winning_sets;
  const useMTB = !isOnePoint && !isTiebreakKO && tournament.match_tiebreak;
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
    if (p1 >= winningSets) return String(match.player1_id);
    if (p2 >= winningSets) return String(match.player2_id);
    return '';
  }

  useEffect(() => {
    // Auto-select winner when sets change (not for doubles since draws are possible, not for one_point)
    if (!isDoubles && !isOnePoint) {
      const detected = autoDetectWinner(sets);
      if (detected) setWinnerId(detected);
    }
  }, [sets]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setWarning('');

    if (!winnerId) return setError('Gewinner auswählen.');

    // One Point Slam: Kein Satz-Ergebnis nötig
    if (isOnePoint) {
      setLoading(true);
      try {
        await api.post(`/matches/${match.id}/report`, {
          sets: [{ games_player1: parseInt(winnerId) === match.player1_id ? 1 : 0, games_player2: parseInt(winnerId) === match.player2_id ? 1 : 0 }],
          winnerId: parseInt(winnerId)
        });
        onSaved();
      } catch (err) {
        setError(err.response?.data?.error || 'Fehler beim Eintragen.');
      } finally { setLoading(false); }
      return;
    }

    const validSets = sets.filter(s => s.games_player1 !== '' && s.games_player2 !== '');
    if (validSets.length === 0) return setError('Mindestens ein Satz eingeben.');

    // Tiebreak-KO: Validierung (jeder Satz ist Tiebreak bis 5, mind. 2 Differenz ab 5)
    if (isTiebreakKO) {
      let sP1 = 0, sP2 = 0;
      for (let i = 0; i < validSets.length; i++) {
        const g1 = parseInt(validSets[i].games_player1), g2 = parseInt(validSets[i].games_player2);
        if (isNaN(g1) || isNaN(g2) || g1 < 0 || g2 < 0) return setError(`Satz ${i + 1}: Ungültige Punktzahl.`);
        if (g1 === g2) return setError(`Satz ${i + 1}: Unentschieden nicht möglich.`);
        const high = Math.max(g1, g2), low = Math.min(g1, g2);
        if (high < 5) return setError(`Satz ${i + 1}: Mindestens 5 Punkte zum Gewinn (aktuell: ${g1}:${g2}).`);
        if (high > 5 && (high - low) !== 2) return setError(`Satz ${i + 1}: Ab 5:4 muss die Differenz 2 betragen (aktuell: ${g1}:${g2}).`);
        if (high === 5 && low > 3) return setError(`Satz ${i + 1}: Bei 5 Punkten darf der Gegner max. 3 haben, oder es geht weiter (aktuell: ${g1}:${g2}).`);
        if (g1 > g2) sP1++; else sP2++;
        if (sP1 === 3 || sP2 === 3) {
          if (i < validSets.length - 1) return setError(`Nach Satz ${i + 1} steht es ${sP1}:${sP2} – keine weiteren Sätze nötig.`);
        }
      }
      if (sP1 < 3 && sP2 < 3) return setError(`Match nicht beendet: ${sP1}:${sP2} Sätze. 3 Gewinnsätze benötigt.`);
    } else {
      const validationError = isDoubles ? null : validateTennisResult(sets, winnerId);
      if (validationError) return setWarning(validationError);
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
          {isOnePoint && match.server_id && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}> — Aufschlag: <strong>{match.server_id === match.player1_id ? match.player1_name : match.player2_name}</strong> 🎾</span>
          )}
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {warning && (
          <div className="alert alert-error" style={{ background: '#fff8e1', borderColor: '#f9a825', color: '#6d4c00' }}>
            ⚠️ <strong>Bitte prüfe das Ergebnis:</strong><br />{warning}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {isOnePoint ? (
            <div className="alert alert-info mb-2">🎯 Nur ein Punkt wird gespielt – wähle den Gewinner des Ballwechsels.</div>
          ) : (
          <div className="score-input mb-2">
            {sets.map((s, idx) => {
              const isLastDecider = useMTB && idx === numSets - 1;
              return (
                <div className="set-row" key={idx}>
                  <label>{isDoubles ? 'Games' : isTiebreakKO ? `TB ${idx + 1}` : isLastDecider ? 'Match-TB' : `Satz ${idx + 1}`}</label>
                  <input type="number" min="0" max={isDoubles ? 99 : isTiebreakKO ? 99 : isLastDecider ? 99 : 7} value={s.games_player1} onChange={e => handleSetChange(idx, 'games_player1', e.target.value)} placeholder="-" />
                  <span className="separator">:</span>
                  <input type="number" min="0" max={isDoubles ? 99 : isTiebreakKO ? 99 : isLastDecider ? 99 : 7} value={s.games_player2} onChange={e => handleSetChange(idx, 'games_player2', e.target.value)} placeholder="-" />
                </div>
              );
            })}
          </div>
          )}

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
