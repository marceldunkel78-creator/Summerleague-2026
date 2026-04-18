import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const { login: authLogin } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authLogin({ login, password });
      navigate('/tournaments');
    } catch (err) {
      const data = err.response?.data;
      if (data?.needsVerification) {
        setNeedsVerification(true);
        setVerifyEmail(data.email);
      }
      setError(data?.error || 'Anmeldung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">🎾</div>
        <h1>Anmelden</h1>
        <p className="subtitle">Willkommen zurück!</p>

        {error && <div className="alert alert-error">{error}</div>}

        {needsVerification && (
          <div className="alert alert-warning">
            <Link to={`/verify-email?email=${encodeURIComponent(verifyEmail)}`}>
              Klicke hier um deine E-Mail zu verifizieren →
            </Link>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Benutzername oder E-Mail</label>
            <input type="text" value={login} onChange={e => setLogin(e.target.value)} required placeholder="Benutzername oder E-Mail" />
          </div>
          <div className="form-group">
            <label>Passwort</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Passwort" />
          </div>
          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Wird angemeldet...' : 'Anmelden'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/forgot-password">Passwort vergessen?</Link>
        </div>
        <div className="auth-links">
          Noch kein Konto? <Link to="/register">Jetzt registrieren</Link>
        </div>
      </div>
    </div>
  );
}
