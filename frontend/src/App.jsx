import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Profile from './pages/Profile';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import ConfirmResult from './pages/ConfirmResult';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import AdminTournaments from './pages/AdminTournaments';
import AdminTournamentEdit from './pages/AdminTournamentEdit';
import AdminMatches from './pages/AdminMatches';
import Impressum from './pages/Impressum';
import Datenschutz from './pages/Datenschutz';

function App() {
  return (
    <div className="app-wrapper">
      <Navbar />
      <main className="app-main">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/tournaments" element={<Tournaments />} />
        <Route path="/tournaments/:id" element={<TournamentDetail />} />
        <Route path="/confirm-result" element={<ConfirmResult />} />
        <Route path="/dispute-result" element={<ConfirmResult dispute />} />
        
        {/* Geschützte User-Routen */}
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
        
        {/* Admin-Routen */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute admin><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/users" element={<ProtectedRoute admin><AdminUsers /></ProtectedRoute>} />
        <Route path="/admin/tournaments" element={<ProtectedRoute admin><AdminTournaments /></ProtectedRoute>} />
        <Route path="/admin/tournaments/:id" element={<ProtectedRoute admin><AdminTournamentEdit /></ProtectedRoute>} />
        <Route path="/admin/matches/:tournamentId" element={<ProtectedRoute admin><AdminMatches /></ProtectedRoute>} />
        <Route path="/impressum" element={<Impressum />} />
        <Route path="/datenschutz" element={<Datenschutz />} />
      </Routes>
      </main>
      <footer className="app-footer">
        <div className="footer-content">
          <span>© {new Date().getFullYear()} Summerleague Tennis</span>
          <nav className="footer-links">
            <a href="/impressum">Impressum</a>
            <a href="/datenschutz">Datenschutz</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

export default App;
