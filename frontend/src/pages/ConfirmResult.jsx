import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

export default function ConfirmResult({ dispute }) {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user } = useAuth();
  const [status, setStatus] = useState('loading');
  const [msg, setMsg] = useState('');
  const [reason, setReason] = useState('');

  const confirm = async () => {
    try {
      const res = await api.post('/matches/confirm', { token });
      setMsg(res.data.message);
      setStatus('done');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Fehler.');
      setStatus('error');
    }
  };

  const submitDispute = async () => {
    try {
      const res = await api.post('/matches/dispute', { token, reason });
      setMsg(res.data.message);
      setStatus('done');
    } catch (err) {
      setMsg(err.response?.data?.error || 'Fehler.');
      setStatus('error');
    }
  };

  useEffect(() => {
    if (!token) setStatus('no-token');
    else if (!user) setStatus('need-login');
    else if (!dispute) setStatus('confirm');
    else setStatus('dispute');
  }, [token, user, dispute]);

  if (!token || status === 'no-token') {
    return <div className="page page-narrow text-center"><div className="alert alert-error">Ungültiger Link.</div></div>;
  }

  if (status === 'need-login') {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <p>Bitte melde dich an, um das Ergebnis zu bestätigen.</p>
          <Link to={`/login`} className="btn btn-primary mt-2">Anmelden</Link>
        </div>
      </div>
    );
  }

  if (status === 'done' || status === 'error') {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <div className="logo">{status === 'done' ? '✅' : '❌'}</div>
          <p>{msg}</p>
          <Link to="/tournaments" className="btn btn-primary mt-2">Zu den Turnieren</Link>
        </div>
      </div>
    );
  }

  if (status === 'confirm') {
    return (
      <div className="auth-container">
        <div className="auth-card text-center">
          <div className="logo">✅</div>
          <h1>Ergebnis bestätigen</h1>
          <p className="mb-2">Möchtest du das eingetragene Ergebnis bestätigen?</p>
          <div className="flex gap-1" style={{ justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={confirm}>Ja, bestätigen</button>
            <button className="btn btn-danger" onClick={() => setStatus('dispute')}>Nein, reklamieren</button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'dispute') {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="logo">⚠️</div>
          <h1>Ergebnis reklamieren</h1>
          <div className="form-group mt-2">
            <label>Grund der Reklamation (optional)</label>
            <textarea rows={3} value={reason} onChange={e => setReason(e.target.value)} placeholder="Beschreibe warum das Ergebnis nicht stimmt..." 
              style={{ width: '100%', padding: '10px', borderRadius: 'var(--radius)', border: '2px solid var(--border)' }} />
          </div>
          <div className="flex gap-1" style={{ justifyContent: 'center' }}>
            <button className="btn btn-danger" onClick={submitDispute}>Reklamieren</button>
            <button className="btn btn-outline" onClick={() => setStatus('confirm')}>Doch bestätigen</button>
          </div>
        </div>
      </div>
    );
  }

  return <div className="loading"><div className="spinner"></div></div>;
}
