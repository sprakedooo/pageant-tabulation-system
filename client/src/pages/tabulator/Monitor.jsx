import { useEffect, useState } from 'react';
import api from '../../api';
import { getSocket } from '../../socket';
import { useAuth } from '../../context/AuthContext';

export default function TabulatorMonitor() {
  const { user } = useAuth();
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [matrix, setMatrix] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await api.get('/categories');
      setCategories(data);
      const active = data.find((c) => c.status === 'active');
      setCategoryId(active ? active.category_id : data[0] && data[0].category_id);
    })();
  }, []);

  const load = async (id = categoryId) => {
    if (id) setMatrix((await api.get(`/scores/matrix/${id}`)).data);
  };
  useEffect(() => { load(categoryId); }, [categoryId]);

  useEffect(() => {
    const s = getSocket();
    const refresh = () => load();
    s.on('score:submitted', refresh);
    s.on('rankings:update', refresh);
    s.on('category:status', refresh);
    return () => { s.off('score:submitted', refresh); s.off('rankings:update', refresh); s.off('category:status', refresh); };
  });

  const isAdmin = user.role === 'admin';
  const unlock = async (judgeId, candidateId) => {
    if (!isAdmin) return;
    await api.post('/scores/unlock', { judgeId, candidateId, categoryId });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Score Monitor</h2>
        <select className="input max-w-xs" value={categoryId || ''} onChange={(e) => setCategoryId(Number(e.target.value))}>
          {categories.map((c) => (
            <option key={c.category_id} value={c.category_id}>
              {c.category_name}{c.status === 'active' ? ' ● LIVE' : ''}
            </option>
          ))}
        </select>
      </div>

      {matrix && (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full">
            <thead><tr>
              <th className="table-th">#</th>
              <th className="table-th">Candidate</th>
              {matrix.judges.map((j) => <th key={j.judge_id} className="table-th">{j.full_name}</th>)}
              <th className="table-th">Average</th>
            </tr></thead>
            <tbody>
              {matrix.matrix.map((row) => (
                <tr key={row.candidate_id}>
                  <td className="table-td">{row.candidate_number}</td>
                  <td className="table-td font-semibold">{row.candidate_name}</td>
                  {row.cells.map((cell) => (
                    <td key={cell.judgeId} className="table-td">
                      {cell.status === 'submitted' ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="font-bold">{cell.total.toFixed(2)}</span>
                          {isAdmin && (
                            <button className="text-[10px] text-blue-600 hover:underline" title="Unlock for editing"
                              onClick={() => unlock(cell.judgeId, row.candidate_id)}>unlock</button>
                          )}
                        </span>
                      ) : cell.status === 'draft' ? (
                        <span className="text-xs text-gold-600 font-semibold">typing…</span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  ))}
                  <td className="table-td font-black text-gold-600 dark:text-gold-300">{row.average ? row.average.toFixed(3) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-gray-500">Submitted scores show the judge's weighted total. Updates instantly via Socket.IO.</p>
    </div>
  );
}
