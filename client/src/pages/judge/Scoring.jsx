import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errMsg } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { getSocket } from '../../socket';
import ConfirmDialog from '../../components/ConfirmDialog';
import DarkModeToggle from '../../components/DarkModeToggle';

export default function JudgeScoring() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [category, setCategory] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [scores, setScores] = useState({});        // { candidateId: { status, details: { criterionId: value } } }
  const [selected, setSelected] = useState(null);  // candidateId being scored
  const [confirming, setConfirming] = useState(false);
  const [saveState, setSaveState] = useState('');  // '', 'saving', 'saved', 'error'
  const [error, setError] = useState('');
  const saveTimer = useRef(null);

  const loadAll = useCallback(async () => {
    const { data: cat } = await api.get('/categories/active');
    setCategory(cat);
    if (cat) {
      const { data } = await api.get(`/scores/mine/${cat.category_id}`);
      setCandidates(data.candidates);
      setScores(data.scores);
    } else {
      setCandidates([]);
      setScores({});
      setSelected(null);
    }
  }, []);

  useEffect(() => {
    loadAll();
    const s = getSocket();
    const refresh = () => loadAll();
    s.on('category:status', refresh);
    s.on('score:unlocked', refresh);
    s.on('stage:advanced', refresh);
    return () => { s.off('category:status', refresh); s.off('score:unlocked', refresh); s.off('stage:advanced', refresh); };
  }, [loadAll]);

  const current = candidates.find((c) => c.candidate_id === selected);
  const myScore = scores[selected] || { status: 'none', details: {} };
  const isSubmitted = myScore.status === 'submitted';

  const setValue = (criterionId, raw) => {
    if (isSubmitted) return;
    const value = raw === '' ? '' : Math.max(1, Math.min(100, Number(raw)));
    const next = { ...scores, [selected]: { ...myScore, status: myScore.status === 'none' ? 'draft' : myScore.status, details: { ...myScore.details, [criterionId]: value } } };
    setScores(next);
    // Debounced autosave
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autosave(next[selected].details), 700);
  };

  const autosave = async (details) => {
    const filled = Object.entries(details).filter(([, v]) => v !== '' && v != null);
    if (filled.length !== category.criteria.length) return; // save only complete sets
    setSaveState('saving');
    try {
      await api.put('/scores/draft', {
        candidateId: selected,
        categoryId: category.category_id,
        details: filled.map(([criterion_id, value]) => ({ criterion_id: Number(criterion_id), value })),
      });
      setSaveState('saved');
    } catch (err) {
      setSaveState('error');
      setError(errMsg(err));
    }
  };

  const submit = async () => {
    setConfirming(false);
    setError('');
    try {
      clearTimeout(saveTimer.current);
      await autosave(myScore.details);
      await api.post('/scores/submit', { candidateId: selected, categoryId: category.category_id });
      await loadAll();
    } catch (err) { setError(errMsg(err)); }
  };

  const allFilled = category && category.criteria.every((cr) => {
    const v = myScore.details[cr.criterion_id];
    return v !== '' && v != null;
  });
  const liveTotal = category
    ? category.criteria.reduce((sum, cr) => sum + (Number(myScore.details[cr.criterion_id]) || 0) * Number(cr.weight), 0) / 100
    : 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 bg-royal text-white px-4 py-3 shadow">
        <div>
          <h1 className="font-display font-bold text-gold-300">Miss Dumalinao 2026 — Judge Panel</h1>
          <p className="text-xs text-gray-300">{user.fullName}</p>
        </div>
        <div className="flex items-center gap-2">
          <DarkModeToggle />
          <button className="btn-outline !text-gold-200 !border-gold-400" onClick={async () => { await logout(); navigate('/login'); }}>Logout</button>
        </div>
      </header>

      {!category ? (
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="text-6xl mb-4">⏳</div>
          <h2 className="font-display text-2xl font-bold">Waiting for the next category…</h2>
          <p className="text-sm text-gray-500 mt-2">The administrator has not opened a category for scoring. This screen updates automatically.</p>
        </div>
      ) : (
        <div className="md:flex">
          {/* Candidate list */}
          <aside className="md:w-72 shrink-0 border-r border-gray-200 dark:border-white/10 p-3">
            <div className="card !p-3 mb-3 bg-gold-50 dark:!bg-gold-900/20">
              <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Now Scoring</div>
              <div className="font-display font-bold text-gold-700 dark:text-gold-300">{category.category_name}</div>
            </div>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {candidates.map((c) => {
                const st = (scores[c.candidate_id] || {}).status || 'none';
                return (
                  <button
                    key={c.candidate_id}
                    onClick={() => { setSelected(c.candidate_id); setSaveState(''); setError(''); }}
                    className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left transition ${
                      selected === c.candidate_id ? 'border-gold-500 bg-gold-50 dark:bg-gold-900/30' : 'border-gray-200 dark:border-white/10 hover:border-gold-300'
                    }`}
                  >
                    <div className="h-12 w-12 shrink-0 rounded-lg overflow-hidden bg-gold-100 dark:bg-gold-900/40 flex items-center justify-center">
                      {c.photo ? <img src={c.photo} alt="" className="h-full w-full object-cover" /> : '👑'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-sm truncate">#{c.candidate_number} {c.candidate_name}</div>
                      <div className="text-xs text-gray-500">{c.municipality}</div>
                    </div>
                    {st === 'submitted' && <span className="text-green-600 text-lg" title="Submitted">✔</span>}
                    {st === 'draft' && <span className="text-gold-500 text-lg" title="Draft">●</span>}
                  </button>
                );
              })}
            </div>
          </aside>

          {/* Scoring panel */}
          <main className="flex-1 p-4 md:p-6">
            {!current ? (
              <p className="text-gray-500 text-sm">Select a candidate to begin scoring.</p>
            ) : (
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-24 w-24 rounded-xl overflow-hidden bg-gold-100 dark:bg-gold-900/40 flex items-center justify-center text-4xl">
                    {current.photo ? <img src={current.photo} alt="" className="h-full w-full object-cover" /> : '👑'}
                  </div>
                  <div>
                    <h2 className="font-display text-2xl font-bold">#{current.candidate_number} {current.candidate_name}</h2>
                    <p className="text-sm text-gray-500">{current.municipality} · {current.age} yrs</p>
                    {isSubmitted && <span className="mt-1 inline-block rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-bold">SUBMITTED — locked</span>}
                  </div>
                </div>

                {error && <div className="rounded-lg bg-red-100 text-red-700 text-sm px-3 py-2">{error}</div>}

                <div className="card space-y-4">
                  {category.criteria.map((cr) => (
                    <div key={cr.criterion_id}>
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <label className="text-sm font-semibold">{cr.criterion_name} <span className="text-gold-600">({Number(cr.weight)}%)</span></label>
                        <input
                          type="number" min="1" max="100" inputMode="numeric"
                          disabled={isSubmitted}
                          className="input !w-24 text-center text-lg font-bold"
                          value={myScore.details[cr.criterion_id] ?? ''}
                          onChange={(e) => setValue(cr.criterion_id, e.target.value)}
                        />
                      </div>
                      <input
                        type="range" min="1" max="100"
                        disabled={isSubmitted}
                        className="w-full accent-gold-500"
                        value={myScore.details[cr.criterion_id] || 50}
                        onChange={(e) => setValue(cr.criterion_id, e.target.value)}
                      />
                    </div>
                  ))}

                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-white/10 pt-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">Weighted Total</div>
                      <div className="text-3xl font-black text-gold-600 dark:text-gold-300">{liveTotal.toFixed(2)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs h-4 text-gray-400">
                        {saveState === 'saving' && 'Saving…'}
                        {saveState === 'saved' && '✔ Auto-saved'}
                        {saveState === 'error' && '⚠ Save failed'}
                      </div>
                      <button className="btn-gold !px-8 !py-3 !text-base" disabled={isSubmitted || !allFilled} onClick={() => setConfirming(true)}>
                        {isSubmitted ? 'Submitted ✔' : 'Submit Score'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>
      )}

      <ConfirmDialog
        open={confirming}
        title="Submit Final Score"
        message={current ? `Submit your score of ${liveTotal.toFixed(2)} for #${current.candidate_number} ${current.candidate_name}? You cannot edit after submitting unless the admin unlocks it.` : ''}
        confirmLabel="Submit"
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
