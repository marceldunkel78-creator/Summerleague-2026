import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function Profile() {
  const { user, updateUser, logout } = useAuth();
  const [form, setForm] = useState({ name: '', lk: '', phone: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [tab, setTab] = useState('profile');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);

  useEffect(() => {
    if (user) {
      setForm({ name: user.name || '', lk: user.lk || 25, phone: user.phone || '' });
    }
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      const [tourRes, matchRes] = await Promise.all([
        api.get('/users/my-tournaments'),
        api.get('/users/my-matches')
      ]);
      setTournaments(tourRes.data.tournaments || []);
      setMatches(matchRes.data.matches || []);
    } catch { /* ignore */ }
  };

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    try {
      const res = await api.put('/auth/me', { name: form.name, lk: parseFloat(form.lk), phone: form.phone });
      updateUser(res.data.user);
      setMsg('Profil aktualisiert!');
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler.');
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setMsg(''); setError('');
    if (pwForm.newPassword !== pwForm.confirm) return setError('Passwörter stimmen nicht überein.');
    try {
      await api.put('/auth/change-password', { currentPassword: pwForm.currentPassword, newPassword: pwForm.newPassword });
      setMsg('Passwort geändert!');
      setPwForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler.');
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const res = await api.post('/users/profile-photo', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateUser({ ...user, profile_photo: res.data.filename });
      setMsg('Foto aktualisiert!');
    } catch (err) {
      setError(err.response?.data?.error || 'Upload fehlgeschlagen.');
    }
  };

  const handlePhotoDelete = async () => {
    try {
      await api.delete('/users/profile-photo');
      updateUser({ ...user, profile_photo: null });
      setMsg('Foto gelöscht.');
    } catch { setError('Fehler beim Löschen.'); }
  };

  const statusBadge = (status) => {
    const map = { pending: ['Ausstehend', 'badge-warning'], approved: ['Bestätigt', 'badge-success'], rejected: ['Abgelehnt', 'badge-danger'], withdrawn: ['Zurückgezogen', 'badge-neutral'] };
    const [label, cls] = map[status] || ['?', 'badge-neutral'];
    return <span className={`badge ${cls}`}>{label}</span>;
  };

  return (
    <div className="page page-medium">
      <div className="profile-header">
        <div style={{ position: 'relative' }}>
          {user?.profile_photo ? (
            <img src={`/uploads/profiles/${user.profile_photo}`} alt="" className="profile-avatar" />
          ) : (
            <div className="profile-avatar-placeholder">{user?.name?.charAt(0).toUpperCase()}</div>
          )}
          <label style={{ position: 'absolute', bottom: 0, right: 0, background: 'var(--primary)', color: 'white', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '1.1rem' }}>
            📷
            <input type="file" accept="image/*" onChange={handlePhotoUpload} style={{ display: 'none' }} />
          </label>
        </div>
        <div className="profile-info">
          <h2>{user?.name}</h2>
          <div className="lk">LK {user?.lk} · @{user?.username}</div>
          <div className="text-muted" style={{ fontSize: '0.85rem' }}>DTB-ID: {user?.dtb_id}</div>
          {user?.profile_photo && (
            <button className="btn btn-sm btn-outline mt-1" onClick={handlePhotoDelete}>Foto entfernen</button>
          )}
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'profile' ? 'active' : ''}`} onClick={() => setTab('profile')}>Profil</button>
        <button className={`tab ${tab === 'password' ? 'active' : ''}`} onClick={() => setTab('password')}>Passwort</button>
        <button className={`tab ${tab === 'tournaments' ? 'active' : ''}`} onClick={() => setTab('tournaments')}>Turniere</button>
        <button className={`tab ${tab === 'matches' ? 'active' : ''}`} onClick={() => setTab('matches')}>Spiele</button>
      </div>

      {msg && <div className="alert alert-success">{msg}</div>}
      {error && <div className="alert alert-error">{error}</div>}

      {tab === 'profile' && (
        <div className="card">
          <form onSubmit={handleProfileSave}>
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Leistungsklasse (LK)</label>
              <input type="number" step="0.1" min="1" max="25" value={form.lk} onChange={e => setForm(f => ({...f, lk: e.target.value}))} />
            </div>
            <div className="form-group">
              <label>Telefonnummer</label>
              <input type="tel" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="0171 1234567" />
              <div className="hint">Wird für die Spielabsprache benötigt</div>
            </div>
            <div className="form-group">
              <label>E-Mail</label>
              <input type="email" value={user?.email || ''} disabled />
              <div className="hint">E-Mail kann nicht geändert werden.</div>
            </div>
            <button type="submit" className="btn btn-primary">Speichern</button>
          </form>
        </div>
      )}

      {tab === 'password' && (
        <div className="card">
          <form onSubmit={handlePasswordChange}>
            <div className="form-group">
              <label>Aktuelles Passwort</label>
              <input type="password" value={pwForm.currentPassword} onChange={e => setPwForm(f => ({...f, currentPassword: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label>Neues Passwort</label>
              <input type="password" value={pwForm.newPassword} onChange={e => setPwForm(f => ({...f, newPassword: e.target.value}))} required />
            </div>
            <div className="form-group">
              <label>Neues Passwort bestätigen</label>
              <input type="password" value={pwForm.confirm} onChange={e => setPwForm(f => ({...f, confirm: e.target.value}))} required />
            </div>
            <button type="submit" className="btn btn-primary">Passwort ändern</button>
          </form>
        </div>
      )}

      {tab === 'tournaments' && (
        <div className="card">
          {tournaments.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🎾</div>
              <p>Du bist noch für kein Turnier angemeldet.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Turnier</th><th>Typ</th><th>Status</th><th>Zeitraum</th></tr>
                </thead>
                <tbody>
                  {tournaments.map(t => (
                    <tr key={t.id}>
                      <td><a href={`/tournaments/${t.id}`}>{t.name}</a></td>
                      <td><span className={`badge badge-${t.type}`}>{({league:'Liga',ko:'KO',lk_day:'LK-Tag',doubles:'Doppel'})[t.type]}</span></td>
                      <td>{statusBadge(t.registration_status)}</td>
                      <td style={{fontSize:'0.85rem'}}>{t.tournament_start ? new Date(t.tournament_start).toLocaleDateString('de') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'matches' && (
        <div className="card">
          {matches.length === 0 ? (
            <div className="empty-state">
              <div className="icon">🎯</div>
              <p>Noch keine Spiele.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>Turnier</th><th>Gegner</th><th>Ergebnis</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {matches.map(m => {
                    const isP1 = m.player1_id === user?.id;
                    const opponent = isP1 ? m.player2_name : m.player1_name;
                    return (
                      <tr key={m.id}>
                        <td>{m.tournament_name}</td>
                        <td>{opponent || 'TBD'}</td>
                        <td className="fw-bold">{m.score || '-'}</td>
                        <td>{m.winner_id === user?.id ? <span className="badge badge-success">Gewonnen</span> : m.winner_id ? <span className="badge badge-danger">Verloren</span> : <span className="badge badge-neutral">Offen</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
