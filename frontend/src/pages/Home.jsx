import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const typeLabels = { league: 'Liga', ko: 'KO-Turnier', lk_day: 'LK-Tagesturnier', doubles: 'Doppel' };

export default function Home() {
  const { user } = useAuth();

  return (
    <div>
      <div className="hero">
        <div className="page">
          <h1>🎾 Summerleague Tennis 2026</h1>
          <p>
            Willkommen bei der Tennis Summerleague! Melde dich an, registriere dich für Turniere 
            und spiele gegen andere Tennisbegeisterte in verschiedenen Turniermodi.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            {user ? (
              <Link to="/tournaments" className="btn btn-accent btn-lg">Turniere ansehen</Link>
            ) : (
              <>
                <Link to="/register" className="btn btn-accent btn-lg">Jetzt registrieren</Link>
                <Link to="/login" className="btn btn-outline btn-lg" style={{ borderColor: 'white', color: 'white' }}>Anmelden</Link>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="page">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🏆</div>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Liga-Modus</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
              Jeder gegen jeden mit Punktesystem und LK-Handicap. Die fairste Art, den besten Spieler zu ermitteln.
            </p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚡</div>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>KO-Turnier</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
              Klassischer Eliminierungsmodus mit Setzliste nach Leistungsklasse. Jedes Match zählt!
            </p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📊</div>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>LK-Tagesturnier</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
              Ein Match gegen einen LK-Besseren, eins gegen einen LK-Schwächeren. Faire Herausforderung für alle.
            </p>
          </div>
          <div className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>👥</div>
            <h3 style={{ color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Doppel-Turnier</h3>
            <p style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>
              Mehrere Runden mit festem oder zufälligen Partnern. Teamwork auf dem Platz!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
