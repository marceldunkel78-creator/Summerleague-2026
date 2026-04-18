import { useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) return setError('Passwörter stimmen nicht überein.');
    if (password.length < 8) return setError('Mindestens 8 Zeichen.');

    setLoading(true);
    try {
      const res = await api.post('/auth/reset-password', { token, password });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <h1>Ungültiger Link</h1>
          <p>Der Reset-Link ist ungültig oder abgelaufen.</p>
          <Link to="/forgot-password" className="btn btn-primary mt-2">Neuen Link anfordern</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">🔐</div>
        <h1>Neues Passwort</h1>
        <p className="subtitle">Lege ein neues Passwort fest.</p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Neues Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Mindestens 8 Zeichen" />
          </div>
          <div className="form-group">
            <label>Passwort bestätigen</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Passwort wiederholen" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Wird gespeichert...' : 'Passwort speichern'}
          </button>
        </form>
      </div>
    </div>
  );
}
