import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminLogin() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { adminLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await adminLogin({ username, password });
      navigate('/admin');
    } catch (err) {
      setError(err.response?.data?.error || 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ borderTop: '4px solid #1a1a2e' }}>
        <div className="logo">🔒</div>
        <h1>Admin Login</h1>
        <p className="subtitle">Zugang zur Verwaltung</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Benutzername</label>
            <input type="text" value={username} onChange={e => setUsername(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button type="submit" className="btn btn-block btn-lg" style={{ background: '#1a1a2e', color: 'white' }} disabled={loading}>
            {loading ? 'Wird angemeldet...' : 'Admin Login'}
          </button>
        </form>
      </div>
    </div>
  );
}
