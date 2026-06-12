import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import DarkModeToggle from './DarkModeToggle';
import LanHealth from './LanHealth';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/candidates', label: 'Candidates' },
  { to: '/admin/judges', label: 'Judges' },
  { to: '/admin/rounds', label: 'Rounds & Scoring' },
  { to: '/admin/rankings', label: 'Rankings' },
  { to: '/admin/reports', label: 'Reports' },
  { to: '/admin/audit', label: 'Audit Logs' },
];

const tabulatorLinks = [
  { to: '/tabulator', label: 'Score Monitor', end: true },
  { to: '/tabulator/rankings', label: 'Rankings' },
  { to: '/tabulator/reports', label: 'Reports' },
  { to: '/tabulator/audit', label: 'Audit Logs' },
];

export default function AdminLayout({ tabulator }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const links = tabulator ? tabulatorLinks : adminLinks;

  return (
    <div className="min-h-screen md:flex">
      <aside className="md:w-60 shrink-0 bg-royal text-white md:min-h-screen">
        <div className="p-5 border-b border-white/10 text-center">
          <img src="/logo.png" alt="Miss Dumalinao 2026" className="mx-auto h-32 w-auto object-contain drop-shadow-[0_0_15px_rgba(212,154,31,0.45)]" />
          <p className="mt-2 text-xs tracking-[0.3em] text-gold-100/70">TABULATION</p>
        </div>
        <nav className="flex md:block overflow-x-auto p-2 md:p-3 gap-1">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `block whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? 'bg-gold-500/20 text-gold-200' : 'text-gray-300 hover:bg-white/5'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="flex-1 min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
          <div className="text-sm">
            <span className="font-semibold">{user.fullName}</span>
            <span className="ml-2 rounded-full bg-gold-100 dark:bg-gold-900/40 px-2 py-0.5 text-xs font-bold uppercase text-gold-700 dark:text-gold-300">
              {user.role}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <LanHealth />
            <DarkModeToggle />
            <button className="btn-outline" onClick={async () => { await logout(); navigate('/login'); }}>Logout</button>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
