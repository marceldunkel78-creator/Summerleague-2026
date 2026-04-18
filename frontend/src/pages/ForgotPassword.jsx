import { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler aufgetreten.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <div className="logo">✉️</div>
          <h1>E-Mail gesendet</h1>
          <p className="subtitle">
            Falls ein Konto mit dieser E-Mail existiert, haben wir einen Link zum Zurücksetzen gesendet.
          </p>
          <Link to="/login" className="btn btn-primary">Zurück zur Anmeldung</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">🔑</div>
        <h1>Passwort vergessen</h1>
        <p className="subtitle">Gib deine E-Mail-Adresse ein und wir senden dir einen Reset-Link.</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>E-Mail-Adresse</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="deine@email.de" />
          </div>
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Wird gesendet...' : 'Reset-Link senden'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Zurück zur Anmeldung</Link>
        </div>
      </div>
    </div>
  );
}
