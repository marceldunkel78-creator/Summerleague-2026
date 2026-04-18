import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, admin, logout, adminLogout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  if (isAdminPage && admin) {
    return (
      <nav className="navbar" style={{ background: '#1a1a2e' }}>
        <Link to="/admin" className="navbar-brand">
          🎾 <span>Admin</span> Panel
        </Link>
        <div className={`navbar-links ${open ? 'open' : ''}`}>
          <Link to="/admin" className={location.pathname === '/admin' ? 'active' : ''}>Dashboard</Link>
          <Link to="/admin/users" className={location.pathname === '/admin/users' ? 'active' : ''}>Benutzer</Link>
          <Link to="/admin/tournaments" className={location.pathname.includes('/admin/tournaments') ? 'active' : ''}>Turniere</Link>
          <Link to="/">Zur Webseite</Link>
          <button className="btn btn-sm btn-danger" onClick={adminLogout}>Abmelden</button>
        </div>
        <button className="nav-toggle" onClick={() => setOpen(!open)}>☰</button>
      </nav>
    );
  }

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        🎾 <span>Summerleague</span> Tennis
      </Link>
      <div className={`navbar-links ${open ? 'open' : ''}`}>
        <Link to="/tournaments" className={location.pathname.startsWith('/tournaments') ? 'active' : ''}>Turniere</Link>
        {user ? (
          <>
            <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profil</Link>
            <div className="navbar-user">
              {user.profile_photo ? (
                <img src={`/uploads/profiles/${user.profile_photo}`} alt="" className="navbar-avatar" />
              ) : (
                <div className="navbar-avatar-placeholder">{user.name?.charAt(0).toUpperCase()}</div>
              )}
              <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.9rem' }}>{user.name}</span>
            </div>
            <button className="btn btn-sm btn-outline" style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'white' }} onClick={logout}>
              Abmelden
            </button>
          </>
        ) : (
          <>
            <Link to="/login">Anmelden</Link>
            <Link to="/register" className="btn btn-sm btn-accent">Registrieren</Link>
          </>
        )}
      </div>
      <button className="nav-toggle" onClick={() => setOpen(!open)}>☰</button>
    </nav>
  );
}
