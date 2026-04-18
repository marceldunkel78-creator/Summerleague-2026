import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, admin }) {
  const { user, admin: adminUser, loading } = useAuth();

  if (loading) return <div className="loading"><div className="spinner"></div></div>;

  if (admin) {
    if (!adminUser) return <Navigate to="/admin/login" replace />;
    return children;
  }

  if (!user) return <Navigate to="/login" replace />;
  return children;
}
