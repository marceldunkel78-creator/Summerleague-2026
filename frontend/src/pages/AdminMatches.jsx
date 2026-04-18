import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import { AdminSidebar } from './AdminDashboard';

export default function AdminMatches() {
  const { tournamentId } = useParams();
  const [tournament, setTournament] = useState(null);
  const [matches, setMatches] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState('all');
  const [editMatch, setEditMatch] = useState(null);
  const [scores, setScores] = useState([['', ''], ['', ''], ['', ''], ['', ''], ['', '']]);
  const [winner, setWinner] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [disputes, setDisputes] = useState([]);
  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const tRes = await api.get(`/tournaments/${tournamentId}`);
      setTournament(tRes.data.tournament);
      const allMatches = tRes.data.matches || [];
      setMatches(allMatches);

      const uniqueRounds = [...new Set(allMatches.map(m => m.round_number))].sort((a, b) => a - b);
      setRounds(uniqueRounds);

      const d = allMatches.filter(m => m.result_status === 'disputed');
      setDisputes(d);
    } catch { setError('Daten konnten nicht geladen werden.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tournamentId]);

  const filtered = selectedRound === 'all' ? matches : matches.filter(m => m.round_number === parseInt(selectedRound));

  const openEdit = (match) => {
    setEditMatch(match);
    setError(''); setMsg('');

    // Parse existing sets
    const s = [['', ''], ['', ''], ['', ''], ['', ''], ['', '']];
    if (match.sets && match.sets.length) {
      match.sets.forEach((set, i) => {
        if (i < 5) s[i] = [String(set.games_player1), String(set.games_player2)];
      });
    }
    setScores(s);
    setWinner(match.winner_id ? String(match.winner_id) : '');
  };

  const handleSetResult = async () => {
    setMsg(''); setError('');
    const sets = scores
      .filter(s => s[0] !== '' && s[1] !== '')
      .map(s => ({ games_player1: parseInt(s[0]), games_player2: parseInt(s[1]) }));

    if (sets.length === 0) { setError('Mindestens 1 Satz erforderlich.'); return; }
    if (!winner) { setError('Gewinner auswählen.'); return; }

    try {
      await api.put(`/admin/matches/${editMatch.id}`, { sets, winner_id: parseInt(winner) }, { headers });
      setMsg('Ergebnis gespeichert!');
      setEditMatch(null);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Fehler.'); }
  };

  const handleResolveDispute = async (matchId, action) => {
    try {
      await api.put(`/admin/disputes/${matchId}`, { action }, { headers });
      setMsg(`Einspruch ${action === 'accept' ? 'angenommen (Ergebnis zurückgesetzt)' : 'abgelehnt (Ergebnis bestätigt)'}.`);
      load();
    } catch (err) { setError(err.response?.data?.error || 'Fehler.'); }
  };

  const statusLabel = (s) => {
    const map = { pending: 'Offen', reported: 'Gemeldet', confirmed: 'Bestätigt', disputed: 'Einspruch' };
    return map[s] || s;
  };

  const statusClass = (s) => {
    const map = { pending: 'badge-warning', reported: 'badge-info', confirmed: 'badge-success', disputed: 'badge-danger' };
    return map[s] || '';
  };

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <div className="flex-between mb-2">
          <div>
            <h1>Matches</h1>
            {tournament && <p className="text-muted">{tournament.name}</p>}
          </div>
          <Link to={`/admin/tournaments/${tournamentId}`} className="btn btn-outline">← Zurück</Link>
        </div>

        {msg && <div className="alert alert-success">{msg}</div>}
        {error && <div className="alert alert-error">{error}</div>}

        {/* Disputes Section */}
        {disputes.length > 0 && (
          <div className="card mb-2" style={{ borderLeft: '4px solid var(--danger)' }}>
            <h3 style={{ color: 'var(--danger)' }}>⚠️ Offene Einsprüche ({disputes.length})</h3>
            {disputes.map(d => (
              <div key={d.id} className="flex-between mb-1" style={{ padding: '10px', background: 'var(--bg-light)', borderRadius: '8px' }}>
                <div>
                  <strong>Match #{d.match_number}</strong> – {d.player1_name || 'Spieler 1'} vs {d.player2_name || 'Spieler 2'}
                  <span style={{ marginLeft: 12 }}>
                    {d.sets && d.sets.length > 0
                      ? d.sets.map((s, i) => <span key={i} className="score-set">{s.games_player1}:{s.games_player2} </span>)
                      : d.score || '—'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <button className="btn btn-sm btn-primary" onClick={() => handleResolveDispute(d.id, 'accept')}>
                    Einspruch annehmen
                  </button>
                  <button className="btn btn-sm btn-danger" onClick={() => handleResolveDispute(d.id, 'reject')}>
                    Einspruch ablehnen
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="flex gap-1 mb-2">
          <button className={`btn btn-sm ${selectedRound === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedRound('all')}>Alle</button>
          {rounds.map(r => (
            <button key={r} className={`btn btn-sm ${selectedRound === r ? 'btn-primary' : 'btn-outline'}`} onClick={() => setSelectedRound(r)}>
              Runde {r}
            </button>
          ))}
        </div>

        {/* Matches Table */}
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Runde</th>
                  <th>#</th>
                  <th>Spieler 1</th>
                  <th>Spieler 2</th>
                  <th>Ergebnis</th>
                  <th>Status</th>
                  <th>Gewinner</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} style={m.result_status === 'disputed' ? { background: '#fff3f3' } : {}}>
                    <td>{m.round_number}</td>
                    <td>{m.match_number}</td>
                    <td className="fw-bold">{m.player1_name || '—'}</td>
                    <td className="fw-bold">{m.player2_name || '—'}</td>
                    <td>
                      {m.sets && m.sets.length > 0
                        ? m.sets.map((s, i) => <span key={i} className="score-set">{s.games_player1}:{s.games_player2} </span>)
                        : m.score ? <span>{m.score}</span> : <span className="text-muted">—</span>}
                    </td>
                    <td><span className={`badge ${statusClass(m.result_status)}`}>{statusLabel(m.result_status)}</span></td>
                    <td>{m.winner_name || '—'}</td>
                    <td>
                      <button className="btn btn-sm btn-primary" onClick={() => openEdit(m)}>✏️</button>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan="8" className="text-center text-muted">Keine Matches in dieser Runde.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editMatch && (
          <div className="modal-overlay" onClick={() => setEditMatch(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Ergebnis eintragen</h3>
                <button className="modal-close" onClick={() => setEditMatch(null)}>×</button>
              </div>

              <p className="mb-2">
                <strong>{editMatch.player1_name || 'Spieler 1'}</strong> vs <strong>{editMatch.player2_name || 'Spieler 2'}</strong>
              </p>

              <div className="mb-2">
                {scores.map((s, i) => (
                  <div key={i} className="flex gap-1 mb-1" style={{ alignItems: 'center' }}>
                    <span style={{ minWidth: 50, fontSize: '0.85rem', color: 'var(--text-muted)' }}>Satz {i + 1}</span>
                    <input type="number" min="0" max="99" style={{ width: 60, textAlign: 'center', padding: '6px', border: '2px solid var(--border)', borderRadius: 6 }}
                      value={s[0]} onChange={e => { const n = [...scores]; n[i] = [e.target.value, n[i][1]]; setScores(n); }} />
                    <span>:</span>
                    <input type="number" min="0" max="99" style={{ width: 60, textAlign: 'center', padding: '6px', border: '2px solid var(--border)', borderRadius: 6 }}
                      value={s[1]} onChange={e => { const n = [...scores]; n[i] = [n[i][0], e.target.value]; setScores(n); }} />
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label>Gewinner</label>
                <select value={winner} onChange={e => setWinner(e.target.value)}>
                  <option value="">— wählen —</option>
                  {editMatch.player1_id && <option value={editMatch.player1_id}>{editMatch.player1_name || 'Spieler 1'}</option>}
                  {editMatch.player2_id && <option value={editMatch.player2_id}>{editMatch.player2_name || 'Spieler 2'}</option>}
                </select>
              </div>

              <div className="flex gap-1 mt-2">
                <button className="btn btn-primary" onClick={handleSetResult}>💾 Speichern</button>
                <button className="btn btn-outline" onClick={() => setEditMatch(null)}>Abbrechen</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
