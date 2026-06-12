import { useEffect, useState } from 'react';
import api from '../../api';
import { getSocket } from '../../socket';

const TABS = [
  { key: 'preliminary', label: 'Preliminary', url: '/rankings/preliminary' },
  { key: 'top5', label: 'Top 5 Q&A', url: '/rankings/top5-round' },
  { key: 'final', label: 'Final Q&A', url: '/rankings/final-round' },
];

export default function Rankings() {
  const [tab, setTab] = useState('preliminary');
  const [data, setData] = useState(null);

  const load = async (key = tab) => {
    const t = TABS.find((x) => x.key === key);
    setData((await api.get(t.url)).data);
  };

  useEffect(() => { load(tab); }, [tab]);

  useEffect(() => {
    const s = getSocket();
    const refresh = () => load();
    s.on('rankings:update', refresh);
    s.on('stage:advanced', refresh);
    return () => { s.off('rankings:update', refresh); s.off('stage:advanced', refresh); };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Live Rankings</h2>
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? 'btn-gold !py-1.5' : 'btn-outline !py-1.5'} onClick={() => setTab(t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {data && (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr>
              <th className="table-th">Rank</th>
              <th className="table-th">#</th>
              <th className="table-th">Candidate</th>
              {data.categories.map((c) => <th key={c.category_id} className="table-th">{c.category_name} ({c.weight}%)</th>)}
              <th className="table-th">Overall</th>
            </tr></thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.candidate_id} className={r.rank <= 3 ? 'bg-gold-50 dark:bg-gold-900/20' : ''}>
                  <td className="table-td font-black text-gold-600 dark:text-gold-300">{r.rank}</td>
                  <td className="table-td">{r.candidate_number}</td>
                  <td className="table-td font-semibold">{r.candidate_name}</td>
                  {data.categories.map((c) => (
                    <td key={c.category_id} className="table-td">
                      {r.breakdown[c.category_name].average.toFixed(3)}
                      <span className="ml-1 text-[10px] text-gray-400">({r.breakdown[c.category_name].judges}j)</span>
                    </td>
                  ))}
                  <td className="table-td font-black">{r.overall.toFixed(3)}</td>
                </tr>
              ))}
              {!data.results.length && <tr><td className="table-td text-gray-500" colSpan={4 + data.categories.length}>No candidates in this round yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Updates in real time as judges submit. “(Nj)” = number of judges who have submitted.</p>
    </div>
  );
}
