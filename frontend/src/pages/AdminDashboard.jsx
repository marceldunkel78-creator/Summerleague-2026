import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function AdminDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    api.get('/admin/dashboard', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div></div>;
  if (!data) return <div className="page"><div className="alert alert-error">Fehler beim Laden.</div></div>;

  const { stats, recentUsers, recentTournaments } = data;

  const handleBackup = async () => {
    setBackupLoading(true);
    setBackupMsg('');
    try {
      const res = await api.get('/admin/backup', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
      a.download = `summerleague-backup-${timestamp}.db`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setBackupMsg('Backup erfolgreich heruntergeladen!');
    } catch {
      setBackupMsg('Backup fehlgeschlagen.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';
    if (!file.name.endsWith('.db')) {
      return setRestoreMsg('Nur .db Dateien sind erlaubt.');
    }
    if (!confirm('ACHTUNG: Die aktuelle Datenbank wird durch das Backup ersetzt!\n\nVor der Wiederherstellung wird automatisch ein Backup der aktuellen DB erstellt.\n\nFortfahren?')) {
      return;
    }
    setRestoreLoading(true);
    setRestoreMsg('');
    try {
      const formData = new FormData();
      formData.append('backup', file);
      const res = await api.post('/admin/restore', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRestoreMsg(res.data.message);
      setTimeout(() => window.location.reload(), 3000);
    } catch (err) {
      setRestoreMsg(err.response?.data?.error || 'Wiederherstellung fehlgeschlagen.');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <h1 style={{ marginBottom: '1.5rem' }}>📊 Dashboard</h1>

        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-value">{stats.totalUsers}</div>
            <div className="stat-label">Benutzer gesamt</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.activeUsers}</div>
            <div className="stat-label">Aktive Benutzer</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.totalTournaments}</div>
            <div className="stat-label">Turniere</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.activeTournaments}</div>
            <div className="stat-label">Aktive Turniere</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: stats.pendingRegistrations > 0 ? 'var(--warning)' : undefined }}>{stats.pendingRegistrations}</div>
            <div className="stat-label">Offene Anmeldungen</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: stats.disputedMatches > 0 ? 'var(--danger)' : undefined }}>{stats.disputedMatches}</div>
            <div className="stat-label">Streitfälle</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3>Neueste Benutzer</h3>
              <Link to="/admin/users" className="btn btn-sm btn-outline">Alle →</Link>
            </div>
            {recentUsers.map(u => (
              <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <strong>{u.name}</strong>
                  <div className="text-muted" style={{ fontSize: '0.8rem' }}>@{u.username}</div>
                </div>
                <div className="text-muted" style={{ fontSize: '0.8rem' }}>{new Date(u.created_at).toLocaleDateString('de')}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Neueste Turniere</h3>
              <Link to="/admin/tournaments" className="btn btn-sm btn-outline">Alle →</Link>
            </div>
            {recentTournaments.map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <Link to={`/admin/tournaments/${t.id}`}><strong>{t.name}</strong></Link>
                  <div><span className={`badge badge-${t.type}`} style={{ fontSize: '0.7rem' }}>{{ league: 'Liga', ko: 'KO', lk_day: 'LK-Tag', doubles: 'Doppel' }[t.type]}</span></div>
                </div>
                <span className="badge badge-neutral">{t.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3>🗄️ Datenbank</h3>
          </div>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Erstelle ein Backup der kompletten Datenbank (Benutzer, Turniere, Ergebnisse).
          </p>
          <button className="btn btn-primary" onClick={handleBackup} disabled={backupLoading}>
            {backupLoading ? 'Backup wird erstellt...' : '💾 Backup herunterladen'}
          </button>
          {backupMsg && <div className={`alert ${backupMsg.includes('erfolgreich') ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '0.5rem' }}>{backupMsg}</div>}

          <hr style={{ margin: '1.5rem 0' }} />

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Stelle eine zuvor gesicherte Datenbank wieder her. Die aktuelle DB wird vorher automatisch gesichert.
          </p>
          <label className={`btn btn-danger ${restoreLoading ? 'disabled' : ''}`} style={{ cursor: restoreLoading ? 'not-allowed' : 'pointer' }}>
            {restoreLoading ? 'Wird wiederhergestellt...' : '⚠️ Backup wiederherstellen'}
            <input type="file" accept=".db" onChange={handleRestore} disabled={restoreLoading} style={{ display: 'none' }} />
          </label>
          {restoreMsg && <div className={`alert ${restoreMsg.includes('wiederhergestellt') ? 'alert-success' : 'alert-error'}`} style={{ marginTop: '0.5rem' }}>{restoreMsg}</div>}
        </div>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const path = window.location.pathname;
  return (
    <div className="admin-sidebar">
      <Link to="/admin" className={path === '/admin' ? 'active' : ''}>📊 Dashboard</Link>
      <Link to="/admin/users" className={path === '/admin/users' ? 'active' : ''}>👥 Benutzer</Link>
      <Link to="/admin/tournaments" className={path.includes('/admin/tournaments') ? 'active' : ''}>🏆 Turniere</Link>
    </div>
  );
}
