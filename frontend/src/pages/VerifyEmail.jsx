import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import api from '../api';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const inputs = useRef([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (inputs.current[0]) inputs.current[0].focus();
  }, []);

  const handleChange = (idx, value) => {
    if (!/^\d?$/.test(value)) return;
    const newCode = [...code];
    newCode[idx] = value;
    setCode(newCode);

    if (value && idx < 5) {
      inputs.current[idx + 1]?.focus();
    }

    // Auto-Submit wenn alle ausgefüllt
    if (newCode.every(d => d !== '')) {
      handleSubmit(newCode.join(''));
    }
  };

  const handleKeyDown = (idx, e) => {
    if (e.key === 'Backspace' && !code[idx] && idx > 0) {
      inputs.current[idx - 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    const paste = e.clipboardData.getData('text').trim();
    if (/^\d{6}$/.test(paste)) {
      setCode(paste.split(''));
      handleSubmit(paste);
    }
  };

  const handleSubmit = async (codeStr) => {
    if (!codeStr || codeStr.length !== 6) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { email, code: codeStr });
      setSuccess(res.data.message);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Verifizierung fehlgeschlagen.');
      setCode(['', '', '', '', '', '']);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await api.post('/auth/resend-verification', { email });
      setSuccess('Neuer Code gesendet!');
      setError('');
    } catch (err) {
      setError(err.response?.data?.error || 'Fehler beim Senden.');
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">📧</div>
        <h1>E-Mail bestätigen</h1>
        <p className="subtitle">
          Wir haben einen 6-stelligen Code an<br />
          <strong>{email}</strong> gesendet.
        </p>

        {error && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        <div className="code-input" onPaste={handlePaste}>
          {code.map((digit, idx) => (
            <input
              key={idx}
              ref={el => inputs.current[idx] = el}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={e => handleChange(idx, e.target.value)}
              onKeyDown={e => handleKeyDown(idx, e)}
              disabled={loading}
            />
          ))}
        </div>

        {loading && <div className="text-center text-muted">Wird überprüft...</div>}

        <div className="auth-links" style={{ marginTop: '2rem' }}>
          Keinen Code erhalten?{' '}
          <a href="#" onClick={(e) => { e.preventDefault(); resend(); }}>Erneut senden</a>
        </div>
        <div className="auth-links">
          <Link to="/login">Zurück zur Anmeldung</Link>
        </div>
      </div>
    </div>
  );
}
