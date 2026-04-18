import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';

const typeLabels = { league: 'Liga (Jeder gegen Jeden)', ko: 'KO-Turnier', lk_day: 'LK-Tagesturnier', doubles: 'Doppel-Turnier' };
const statusLabels = { draft: 'Entwurf', registration_open: 'Anmeldung offen', registration_closed: 'Anmeldung geschlossen', draw_complete: 'Auslosung fertig', in_progress: 'Läuft', completed: 'Beendet', cancelled: 'Abgesagt' };

export default function Tournaments() {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/tournaments').then(res => {
      setTournaments(res.data.tournaments || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner"></div>Turniere werden geladen...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>🏆 Turniere</h1>
        <p>Finde ein Turnier und melde dich an!</p>
      </div>

      {tournaments.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🎾</div>
          <p>Aktuell keine Turniere verfügbar.</p>
        </div>
      ) : (
        <div className="tournament-grid">
          {tournaments.map(t => (
            <Link to={`/tournaments/${t.id}`} key={t.id} className="tournament-card" style={{ textDecoration: 'none', color: 'inherit' }}>
              <div className="tournament-card-header">
                <h3>{t.name}</h3>
                <div className="type">{typeLabels[t.type] || t.type}</div>
              </div>
              <div className="tournament-card-body">
                <div className="info-row">
                  <span className="info-label">Status</span>
                  <span className="info-value">{statusLabels[t.status] || t.status}</span>
                </div>
                <div className="info-row">
                  <span className="info-label">Teilnehmer</span>
                  <span className="info-value">{t.participant_count} / {t.max_participants}</span>
                </div>
                {t.tournament_start && (
                  <div className="info-row">
                    <span className="info-label">Datum</span>
                    <span className="info-value">{new Date(t.tournament_start).toLocaleDateString('de')}</span>
                  </div>
                )}
                {t.location && (
                  <div className="info-row">
                    <span className="info-label">Ort</span>
                    <span className="info-value">{t.location}</span>
                  </div>
                )}
                {t.registration_deadline && (
                  <div className="info-row">
                    <span className="info-label">Meldefrist</span>
                    <span className="info-value">{new Date(t.registration_deadline).toLocaleDateString('de')}</span>
                  </div>
                )}
              </div>
              <div className="tournament-card-footer">
                {t.my_registration ? (
                  <span className={`badge ${t.my_registration === 'approved' ? 'badge-success' : t.my_registration === 'pending' ? 'badge-warning' : 'badge-neutral'}`}>
                    {t.my_registration === 'approved' ? '✅ Zugelassen' : t.my_registration === 'pending' ? '⏳ Ausstehend' : t.my_registration}
                  </span>
                ) : (
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>Nicht angemeldet</span>
                )}
                <span className="btn btn-sm btn-primary">Details →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
