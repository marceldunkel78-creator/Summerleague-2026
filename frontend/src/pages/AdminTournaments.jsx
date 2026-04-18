import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { AdminSidebar } from './AdminDashboard';

const typeLabels = { league: 'Liga', ko: 'KO-Turnier', lk_day: 'LK-Tagesturnier', doubles: 'Doppel' };
const statusLabels = { draft: 'Entwurf', registration_open: 'Anmeldung offen', registration_closed: 'Geschlossen', draw_complete: 'Auslosung fertig', in_progress: 'Läuft', completed: 'Beendet', cancelled: 'Abgesagt' };

export default function AdminTournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState('');
  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const load = () => {
    api.get('/admin/tournaments', { headers }).then(res => setTournaments(res.data.tournaments)).catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id) => {
    if (!confirm('Turnier wirklich löschen?')) return;
    try {
      await api.delete(`/admin/tournaments/${id}`, { headers });
      setMsg('Gelöscht.');
      load();
    } catch { setMsg('Fehler.'); }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <div className="flex-between mb-2">
          <h1>🏆 Turnierverwaltung</h1>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Neues Turnier</button>
        </div>

        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Name</th><th>Typ</th><th>Status</th><th>Teilnehmer</th><th>Ausstehend</th><th>Start</th><th>Aktionen</th></tr>
              </thead>
              <tbody>
                {tournaments.map(t => (
                  <tr key={t.id}>
                    <td className="fw-bold"><Link to={`/admin/tournaments/${t.id}`}>{t.name}</Link></td>
                    <td><span className={`badge badge-${t.type}`}>{typeLabels[t.type]}</span></td>
                    <td><span className="badge badge-info">{statusLabels[t.status] || t.status}</span></td>
                    <td>{t.participant_count} / {t.max_participants}</td>
                    <td>{t.pending_count > 0 ? <span className="badge badge-warning">{t.pending_count}</span> : '-'}</td>
                    <td>{t.tournament_start ? new Date(t.tournament_start).toLocaleDateString('de') : '-'}</td>
                    <td>
                      <div className="flex gap-1">
                        <Link to={`/admin/tournaments/${t.id}`} className="btn btn-sm btn-outline">Bearbeiten</Link>
                        <Link to={`/admin/matches/${t.id}`} className="btn btn-sm btn-primary">Matches</Link>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(t.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tournaments.length === 0 && (
                  <tr><td colSpan="7" className="text-center text-muted">Keine Turniere vorhanden.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {showCreate && <CreateTournamentModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} headers={headers} />}
      </div>
    </div>
  );
}

function CreateTournamentModal({ onClose, onCreated, headers }) {
  const [form, setForm] = useState({
    name: '', description: '', type: 'league', status: 'draft', max_participants: 16,
    points_win: 3, points_loss: 0, points_draw: 1,
    lk_handicap_enabled: false, lk_handicap_factor: 0.5,
    winning_sets: 2, no_ad: false, match_tiebreak: false, match_tiebreak_at: '1:1',
    doubles_rounds: 3, doubles_random_partners: false,
    self_reporting: true, dtb_id_required: false, registration_deadline: '', draw_date: '',
    tournament_start: '', tournament_end: '', location: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/admin/tournaments', {
        ...form,
        max_participants: parseInt(form.max_participants),
        points_win: parseInt(form.points_win),
        points_loss: parseInt(form.points_loss),
        points_draw: parseInt(form.points_draw),
        lk_handicap_factor: parseFloat(form.lk_handicap_factor),
        winning_sets: parseInt(form.winning_sets),
        doubles_rounds: parseInt(form.doubles_rounds)
      }, { headers });
      onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '700px' }}>
        <div className="modal-header">
          <h2>Neues Turnier erstellen</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Sommerliga 2026" />
            </div>
            <div className="form-group">
              <label>Typ *</label>
              <select name="type" value={form.type} onChange={handleChange}>
                <option value="league">Liga (Jeder gegen Jeden)</option>
                <option value="ko">KO-Turnier</option>
                <option value="lk_day">LK-Tagesturnier</option>
                <option value="doubles">Doppel-Turnier</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Status nach Erstellung</label>
            <select name="status" value={form.status} onChange={handleChange}>
              <option value="draft">Entwurf (nur für Admins sichtbar)</option>
              <option value="registration_open">Anmeldung offen (sofort sichtbar)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Beschreibung</label>
            <textarea name="description" value={form.description} onChange={handleChange} rows={2}
              style={{ width: '100%', padding: '10px', border: '2px solid var(--border)', borderRadius: 'var(--radius)' }}
              placeholder="Optionale Beschreibung..." />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Max. Teilnehmer</label>
              <input type="number" name="max_participants" value={form.max_participants} onChange={handleChange} min="2" />
            </div>
            <div className="form-group">
              <label>Ort</label>
              <input type="text" name="location" value={form.location} onChange={handleChange} placeholder="Tennisclub..." />
            </div>
          </div>

          <h3 style={{ margin: '1.5rem 0 1rem', color: 'var(--primary)' }}>📅 Termine</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Meldefrist</label>
              <input type="date" name="registration_deadline" value={form.registration_deadline} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Auslosungsdatum</label>
              <input type="date" name="draw_date" value={form.draw_date} onChange={handleChange} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Turnier Start</label>
              <input type="date" name="tournament_start" value={form.tournament_start} onChange={handleChange} />
            </div>
            <div className="form-group">
              <label>Turnier Ende</label>
              <input type="date" name="tournament_end" value={form.tournament_end} onChange={handleChange} />
            </div>
          </div>

          <h3 style={{ margin: '1.5rem 0 1rem', color: 'var(--primary)' }}>🎾 Spielregeln</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Gewinnsätze</label>
              <select name="winning_sets" value={form.winning_sets} onChange={handleChange}>
                <option value="2">2 Gewinnsätze</option>
                <option value="3">3 Gewinnsätze</option>
              </select>
            </div>
            <div className="form-group">
              <label>Match-Tiebreak bei</label>
              <select name="match_tiebreak_at" value={form.match_tiebreak_at} onChange={handleChange}>
                <option value="1:1">1:1 (bei 2 Gewinnsätzen)</option>
                <option value="2:2">2:2 (bei 3 Gewinnsätzen)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="checkbox-group">
              <input type="checkbox" name="no_ad" id="no_ad" checked={form.no_ad} onChange={handleChange} />
              <label htmlFor="no_ad">No-Ad Scoring</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" name="match_tiebreak" id="match_tiebreak" checked={form.match_tiebreak} onChange={handleChange} />
              <label htmlFor="match_tiebreak">Match-Tiebreak</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" name="self_reporting" id="self_reporting" checked={form.self_reporting} onChange={handleChange} />
              <label htmlFor="self_reporting">Selbsteintragung</label>
            </div>
            <div className="checkbox-group">
              <input type="checkbox" name="dtb_id_required" id="dtb_id_required" checked={form.dtb_id_required} onChange={handleChange} />
              <label htmlFor="dtb_id_required">DTB-ID Pflicht</label>
            </div>
          </div>

          {form.type === 'league' && (
            <>
              <h3 style={{ margin: '1.5rem 0 1rem', color: 'var(--primary)' }}>📊 Liga-Einstellungen</h3>
              <div className="form-row">
                <div className="form-group">
                  <label>Punkte für Sieg</label>
                  <input type="number" name="points_win" value={form.points_win} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Punkte für Niederlage</label>
                  <input type="number" name="points_loss" value={form.points_loss} onChange={handleChange} />
                </div>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" name="lk_handicap_enabled" id="lk_hc" checked={form.lk_handicap_enabled} onChange={handleChange} />
                <label htmlFor="lk_hc">LK-Handicap aktivieren</label>
              </div>
              {form.lk_handicap_enabled && (
                <div className="form-group">
                  <label>Handicap-Faktor</label>
                  <input type="number" step="0.1" name="lk_handicap_factor" value={form.lk_handicap_factor} onChange={handleChange} />
                  <div className="hint">LK-Differenz × Faktor = Bonuspunkte für den schwächeren Spieler</div>
                </div>
              )}
            </>
          )}

          {form.type === 'doubles' && (
            <>
              <h3 style={{ margin: '1.5rem 0 1rem', color: 'var(--primary)' }}>👥 Doppel-Einstellungen</h3>
              <div className="form-group">
                <label>Anzahl Runden</label>
                <input type="number" name="doubles_rounds" value={form.doubles_rounds} onChange={handleChange} min="1" />
              </div>
              <div className="checkbox-group">
                <input type="checkbox" name="doubles_random_partners" id="dbl_rnd" checked={form.doubles_random_partners} onChange={handleChange} />
                <label htmlFor="dbl_rnd">Zufällige Partner pro Runde</label>
              </div>
            </>
          )}

          <div className="flex gap-1 mt-3" style={{ justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-outline" onClick={onClose}>Abbrechen</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Wird erstellt...' : 'Turnier erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
