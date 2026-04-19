import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';

export default function Register() {
  const [form, setForm] = useState({
    username: '', email: '', password: '', passwordConfirm: '',
    name: '', dtb_id: '', lk: '25', phone: '', data_consent: false
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password !== form.passwordConfirm) {
      return setError('Passwörter stimmen nicht überein.');
    }

    if (form.password.length < 8) {
      return setError('Passwort muss mindestens 8 Zeichen haben.');
    }

    if (!form.lk || parseFloat(form.lk) < 1 || parseFloat(form.lk) > 25) {
      return setError('Leistungsklasse (LK) muss zwischen 1 und 25 liegen.');
    }

    if (!form.data_consent) {
      return setError('Du musst der Datenverarbeitung zustimmen.');
    }

    if (!form.phone.trim()) {
      return setError('Telefonnummer ist erforderlich.');
    }

    setLoading(true);
    try {
      await api.post('/auth/register', {
        username: form.username,
        email: form.email,
        password: form.password,
        name: form.name,
        dtb_id: form.dtb_id || undefined,
        lk: parseFloat(form.lk),
        phone: form.phone,
        data_consent: true
      });
      navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Registrierung fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="logo">🎾</div>
        <h1>Registrieren</h1>
        <p className="subtitle">Werde Teil der Summerleague!</p>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Vollständiger Name *</label>
            <input type="text" name="name" value={form.name} onChange={handleChange} required placeholder="Max Mustermann" />
          </div>

          <div className="form-group">
            <label>E-Mail-Adresse *</label>
            <input type="email" name="email" value={form.email} onChange={handleChange} required placeholder="max@beispiel.de" />
          </div>

          <div className="form-group">
            <label>Telefonnummer *</label>
            <input type="tel" name="phone" value={form.phone} onChange={handleChange} required placeholder="0171 1234567" />
            <div className="hint">Wird für die Spielabsprache benötigt</div>
          </div>

          <div className="form-group">
            <label>Benutzername *</label>
            <input type="text" name="username" value={form.username} onChange={handleChange} required placeholder="maxmuster" />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>DTB-ID (Lizenznummer)</label>
              <input type="text" name="dtb_id" value={form.dtb_id} onChange={handleChange} placeholder="17852782" />
              <div className="hint">Optional – 7-10 Ziffern</div>
            </div>
            <div className="form-group">
              <label>Leistungsklasse (LK) *</label>
              <input type="number" name="lk" step="0.1" min="1" max="25" value={form.lk} onChange={handleChange} required />
              <div className="hint">1 (beste) bis 25</div>
            </div>
          </div>

          <div className="form-group">
            <label>Passwort *</label>
            <input type="password" name="password" value={form.password} onChange={handleChange} required placeholder="Mindestens 8 Zeichen" />
          </div>

          <div className="form-group">
            <label>Passwort bestätigen *</label>
            <input type="password" name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange} required placeholder="Passwort wiederholen" />
          </div>

          <div className="checkbox-group" style={{ background: '#f0f7f0', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
            <input type="checkbox" id="consent" name="data_consent" checked={form.data_consent} onChange={handleChange} />
            <label htmlFor="consent" style={{ fontSize: '0.85rem' }}>
              Ich stimme der Verarbeitung meiner personenbezogenen Daten (Name, E-Mail, ggf. DTB-ID) 
              zum Zweck der Durchführung und Verwaltung der Tennisturniere zu. 
              Meine Daten werden nicht an Dritte weitergegeben und können jederzeit gelöscht werden.
            </label>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? 'Wird registriert...' : 'Registrieren'}
          </button>
        </form>

        <div className="auth-links">
          Bereits registriert? <Link to="/login">Anmelden</Link>
        </div>
      </div>
    </div>
  );
}
