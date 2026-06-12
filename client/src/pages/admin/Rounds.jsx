import { useEffect, useState } from 'react';
import api, { errMsg } from '../../api';
import ConfirmDialog from '../../components/ConfirmDialog';
import { getSocket } from '../../socket';
import printJudgeSheets from '../../printJudgeSheets';

export default function Rounds() {
  const [categories, setCategories] = useState([]);
  const [confirm, setConfirm] = useState(null); // { type, categoryId?, label }
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = async () => setCategories((await api.get('/categories')).data);
  useEffect(() => {
    load();
    const s = getSocket();
    const refresh = () => load();
    s.on('category:status', refresh);
    s.on('stage:advanced', refresh);
    return () => { s.off('category:status', refresh); s.off('stage:advanced', refresh); };
  }, []);

  const setStatus = async (categoryId, status) => {
    setError('');
    try { await api.patch(`/categories/${categoryId}/status`, { status }); load(); }
    catch (err) { setError(errMsg(err)); }
  };

  const runGeneration = async () => {
    const { type } = confirm;
    setConfirm(null);
    setError(''); setNotice('');
    try {
      if (type === 'top5') {
        const { data } = await api.post('/rankings/generate-top5', { confirm: true });
        setNotice(`TOP 5 GENERATED: ${data.top5.map((c) => `#${c.candidate_number} ${c.candidate_name}`).join(' · ')}`);
      } else if (type === 'top3') {
        const { data } = await api.post('/rankings/generate-top3', { confirm: true });
        setNotice(`TOP 3 GENERATED: ${data.top3.map((c) => `#${c.candidate_number} ${c.candidate_name}`).join(' · ')}`);
      } else if (type === 'final') {
        const { data } = await api.post('/rankings/generate-final', { confirm: true });
        setNotice(`WINNER: #${data.final[0].candidate_number} ${data.final[0].candidate_name} 👑`);
      }
      load();
    } catch (err) { setError(errMsg(err)); }
  };

  const rounds = [...new Map(categories.map((c) => [c.round_code, { code: c.round_code, name: c.round_name, status: c.round_status }])).values()];

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Rounds & Scoring Control</h2>
      {error && <div className="rounded-lg bg-red-100 text-red-700 text-sm px-3 py-2">{error}</div>}
      {notice && <div className="rounded-lg bg-gold-100 dark:bg-gold-900/40 text-gold-800 dark:text-gold-200 text-sm font-semibold px-3 py-2">{notice}</div>}

      {rounds.map((round) => (
        <div key={round.code} className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-lg font-bold">{round.name}</h3>
            <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-bold uppercase">{round.status}</span>
          </div>
          <div className="space-y-2">
            {categories.filter((c) => c.round_code === round.code).map((cat) => (
              <div key={cat.category_id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 dark:border-white/10 px-3 py-2">
                <div>
                  <span className="font-semibold">{cat.category_name}</span>
                  <span className="ml-2 text-xs text-gray-500">{cat.weight}%</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                    cat.status === 'active' ? 'bg-green-100 text-green-700' : cat.status === 'locked' ? 'bg-red-100 text-red-700' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'
                  }`}>{cat.status}</span>
                </div>
                <div className="flex gap-2">
                  {cat.status !== 'active' && <button className="btn-gold !py-1 !px-3 !text-xs" onClick={() => setStatus(cat.category_id, 'active')}>Open Scoring</button>}
                  {cat.status === 'active' && <button className="btn-danger !py-1 !px-3 !text-xs" onClick={() => setStatus(cat.category_id, 'locked')}>Lock Scoring</button>}
                  {cat.status === 'locked' && (
                    <button className="btn-outline !py-1 !px-3 !text-xs" onClick={() => printJudgeSheets(cat.category_id).catch(() => setError('Could not generate judge sheets'))}>
                      🖨 Judge Sheets
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {round.code === 'PRELIM' && (
            <button className="btn-gold mt-4" onClick={() => setConfirm({ type: 'top5', label: 'Generate the official TOP 5 from preliminary scores? Preliminary scoring will be locked.' })}>
              ⭐ GENERATE TOP 5
            </button>
          )}
          {round.code === 'TOP5' && (
            <button className="btn-gold mt-4" onClick={() => setConfirm({ type: 'top3', label: 'Generate the official TOP 3? Earlier scores stay on record; the winner will be decided only by the Final Q&A.' })}>
              ⭐ GENERATE TOP 3
            </button>
          )}
          {round.code === 'FINAL' && (
            <button className="btn-gold mt-4" onClick={() => setConfirm({ type: 'final', label: 'Generate the FINAL RANKING and declare the winner from Final Q&A scores?' })}>
              👑 GENERATE FINAL RANKING
            </button>
          )}
        </div>
      ))}

      <ConfirmDialog
        open={!!confirm}
        title="Admin Confirmation Required"
        message={confirm ? confirm.label : ''}
        confirmLabel="Yes, Generate"
        onConfirm={runGeneration}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
