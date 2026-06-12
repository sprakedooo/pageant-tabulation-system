import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { homeFor } from '../App';
import { errMsg } from '../api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(params.get('expired') ? 'Session expired. Please log in again.' : '');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const user = await login(username.trim(), password);
      navigate(homeFor(user.role));
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-royal via-ruby to-royal p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Miss Dumalinao 2026" className="mx-auto mb-4 h-64 w-auto drop-shadow-[0_0_25px_rgba(212,154,31,0.45)]" />
          <p className="text-gray-400 text-xs">Official Pageant Tabulation System</p>
        </div>
        <form onSubmit={submit} className="card !bg-white/10 !border-white/10 backdrop-blur space-y-4">
          {error && <div className="rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-sm px-3 py-2">{error}</div>}
          <div>
            <label className="label !text-gold-200">Username</label>
            <input className="input !bg-white/10 !border-white/20 text-white" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="label !text-gold-200">Password</label>
            <input type="password" className="input !bg-white/10 !border-white/20 text-white" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn-gold w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
          <button type="button" className="w-full text-center text-xs text-gold-200/70 hover:text-gold-200" onClick={() => navigate('/display')}>
            Open Projection Display →
          </button>
        </form>
      </div>
    </div>
  );
}
