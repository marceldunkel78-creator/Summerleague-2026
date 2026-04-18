import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // User-Token prüfen
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch { /* ignore */ }
    }
    
    // Admin-Token prüfen
    const adminToken = localStorage.getItem('adminToken');
    const savedAdmin = localStorage.getItem('admin');
    if (adminToken && savedAdmin) {
      try {
        setAdmin(JSON.parse(savedAdmin));
      } catch { /* ignore */ }
    }

    setLoading(false);
  }, []);

  const login = async (loginData) => {
    const res = await api.post('/auth/login', loginData);
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const adminLogin = async (loginData) => {
    const res = await api.post('/admin/login', loginData);
    localStorage.setItem('adminToken', res.data.token);
    localStorage.setItem('admin', JSON.stringify(res.data.admin));
    setAdmin(res.data.admin);
    return res.data;
  };

  const adminLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('admin');
    setAdmin(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  return (
    <AuthContext.Provider value={{ user, admin, loading, login, logout, adminLogin, adminLogout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
