import { useState, useEffect } from 'react';
import api from '../api';
import { AdminSidebar } from './AdminDashboard';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editUser, setEditUser] = useState(null);
  const [msg, setMsg] = useState('');

  const token = localStorage.getItem('adminToken');
  const headers = { Authorization: `Bearer ${token}` };

  const load = async () => {
    try {
      const res = await api.get(`/admin/users?search=${search}&page=${page}`, { headers });
      setUsers(res.data.users);
      setTotal(res.data.total);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, [search, page]);

  const handleSave = async () => {
    if (!editUser) return;
    try {
      await api.put(`/admin/users/${editUser.id}`, editUser, { headers });
      setMsg('Benutzer aktualisiert.');
      setEditUser(null);
      load();
    } catch { setMsg('Fehler beim Speichern.'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Benutzer wirklich löschen?')) return;
    try {
      await api.delete(`/admin/users/${id}`, { headers });
      setMsg('Benutzer gelöscht.');
      load();
    } catch { setMsg('Fehler beim Löschen.'); }
  };

  return (
    <div className="admin-layout">
      <AdminSidebar />
      <div className="admin-content">
        <div className="flex-between mb-2">
          <h1>👥 Benutzerverwaltung</h1>
          <span className="text-muted">{total} Benutzer</span>
        </div>

        {msg && <div className="alert alert-success">{msg}</div>}

        <div className="card mb-2">
          <input type="text" placeholder="Suche nach Name, E-Mail, DTB-ID..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.95rem' }} />
        </div>

        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>ID</th><th>Name</th><th>Username</th><th>E-Mail</th><th>DTB-ID</th><th>LK</th><th>Verifiziert</th><th>Aktiv</th><th>Aktionen</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>{u.id}</td>
                    <td className="fw-bold">{u.name}</td>
                    <td>@{u.username}</td>
                    <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                    <td>{u.dtb_id}</td>
                    <td>{u.lk}</td>
                    <td>{u.email_verified ? <span className="badge badge-success">✓</span> : <span className="badge badge-danger">✗</span>}</td>
                    <td>{u.is_active ? <span className="badge badge-success">Ja</span> : <span className="badge badge-danger">Nein</span>}</td>
                    <td>
                      <div className="flex gap-1">
                        <button className="btn btn-sm btn-outline" onClick={() => setEditUser({...u})}>✏️</button>
                        <button className="btn btn-sm btn-danger" onClick={() => handleDelete(u.id)}>🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Edit Modal */}
        {editUser && (
          <div className="modal-overlay" onClick={() => setEditUser(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Benutzer bearbeiten</h2>
                <button className="modal-close" onClick={() => setEditUser(null)}>✕</button>
              </div>
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={editUser.name} onChange={e => setEditUser(u => ({...u, name: e.target.value}))} />
              </div>
              <div className="form-group">
                <label>E-Mail</label>
                <input type="email" value={editUser.email} onChange={e => setEditUser(u => ({...u, email: e.target.value}))} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>DTB-ID</label>
                  <input type="text" value={editUser.dtb_id} onChange={e => setEditUser(u => ({...u, dtb_id: e.target.value}))} />
                </div>
                <div className="form-group">
                  <label>LK</label>
                  <input type="number" step="0.1" value={editUser.lk} onChange={e => setEditUser(u => ({...u, lk: parseFloat(e.target.value)}))} />
                </div>
              </div>
              <div className="checkbox-group">
                <input type="checkbox" id="active" checked={!!editUser.is_active} onChange={e => setEditUser(u => ({...u, is_active: e.target.checked ? 1 : 0}))} />
                <label htmlFor="active">Aktiv</label>
              </div>
              <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                <button className="btn btn-outline" onClick={() => setEditUser(null)}>Abbrechen</button>
                <button className="btn btn-primary" onClick={handleSave}>Speichern</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
