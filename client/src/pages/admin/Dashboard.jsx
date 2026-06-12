import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api';
import { getSocket } from '../../socket';

export default function Dashboard() {
  const [candidates, setCandidates] = useState([]);
  const [judges, setJudges] = useState([]);
  const [categories, setCategories] = useState([]);
  const [phase, setPhase] = useState('candidates');

  const load = async () => {
    const [c, j, cat, d] = await Promise.all([
      api.get('/candidates'), api.get('/judges'), api.get('/categories'), api.get('/display/state'),
    ]);
    setCandidates(c.data);
    setJudges(j.data);
    setCategories(cat.data);
    setPhase(d.data.phase);
  };

  useEffect(() => {
    load();
    const s = getSocket();
    const refresh = () => load();
    ['candidates:changed', 'judges:changed', 'category:status', 'stage:advanced', 'display:update'].forEach((e) => s.on(e, refresh));
    return () => ['candidates:changed', 'judges:changed', 'category:status', 'stage:advanced', 'display:update'].forEach((e) => s.off(e, refresh));
  }, []);

  const active = categories.find((c) => c.status === 'active');
  const setDisplayPhase = async (p) => {
    await api.patch('/display/phase', { phase: p });
    setPhase(p);
  };

  const stats = [
    { label: 'Candidates', value: candidates.length, to: '/admin/candidates' },
    { label: 'Active Judges', value: judges.filter((j) => j.status === 'active').length, to: '/admin/judges' },
    { label: 'Top 5 Selected', value: candidates.filter((c) => c.is_top5).length, to: '/admin/rankings' },
    { label: 'Top 3 Selected', value: candidates.filter((c) => c.is_top3).length, to: '/admin/rankings' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Admin Dashboard</h2>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="card hover:border-gold-400 transition">
            <div className="text-3xl font-black text-gold-600 dark:text-gold-300">{s.value}</div>
            <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mt-1">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-2">Now Scoring</h3>
        {active ? (
          <p className="text-sm">
            <span className="font-bold text-gold-600 dark:text-gold-300">{active.category_name}</span>
            <span className="text-gray-500 dark:text-gray-400"> — {active.round_name} ({active.weight}%)</span>
          </p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400">No category is open. Open one in <Link className="text-gold-600 underline" to="/admin/rounds">Rounds & Scoring</Link>.</p>
        )}
      </div>

      <div className="card">
        <h3 className="font-semibold mb-3">Projection Screen Control</h3>
        <div className="flex flex-wrap gap-2">
          {[
            ['candidates', 'Candidate Profiles'],
            ['top5', 'Announce Top 5'],
            ['top3', 'Announce Top 3'],
            ['winner', 'Announce Winner'],
          ].map(([p, label]) => (
            <button key={p} onClick={() => setDisplayPhase(p)} className={phase === p ? 'btn-gold' : 'btn-outline'}>
              {label}
            </button>
          ))}
          <a href="/display" target="_blank" rel="noreferrer" className="btn-outline">Open Display ↗</a>
        </div>
      </div>
    </div>
  );
}
