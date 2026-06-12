import { createContext, useContext, useEffect, useRef, useState } from 'react';
import api from '../api';
import { resetSocket } from '../socket';

const AuthContext = createContext(null);
const IDLE_LIMIT_MS = 15 * 60 * 1000;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('user')); } catch { return null; }
  });
  const idleTimer = useRef(null);

  const login = async (username, password) => {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    resetSocket();
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch { /* token may already be expired */ }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    resetSocket();
    setUser(null);
  };

  // Client-side inactivity auto-logout (mirrors the server's 15-minute timeout)
  useEffect(() => {
    if (!user || user.role === 'display') return;
    const reset = () => {
      clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => logout(), IDLE_LIMIT_MS);
    };
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(idleTimer.current);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user]);

  return <AuthContext.Provider value={{ user, login, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
