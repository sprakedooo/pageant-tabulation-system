import { useEffect, useState } from 'react';
import { getSocket } from '../socket';
import api from '../api';
import printJudgeSheets from '../printJudgeSheets';

// When a category's scoring is locked, automatically prompt the admin/
// tabulator to print the per-judge sign-off sheets for that round.
// (Browsers require a user gesture to open the print dialog, so this is a
// one-click prompt rather than a fully silent print.)
export default function PrintOnLock() {
  const [prompt, setPrompt] = useState(null); // { categoryId, name }
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const s = getSocket();
    const onStatus = async ({ categoryId, status }) => {
      if (status !== 'locked') return;
      try {
        const { data } = await api.get('/categories');
        const cat = data.find((c) => c.category_id === categoryId);
        setPrompt({ categoryId, name: cat ? cat.category_name : `Category #${categoryId}` });
      } catch {
        setPrompt({ categoryId, name: `Category #${categoryId}` });
      }
    };
    s.on('category:status', onStatus);
    return () => s.off('category:status', onStatus);
  }, []);

  if (!prompt) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card max-w-md w-full !bg-white dark:!bg-[#33151a]">
        <h3 className="font-display text-lg font-bold text-gold-700 dark:text-gold-300">🖨 Scoring Locked — Print Judge Sheets</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          <span className="font-semibold">{prompt.name}</span> has been locked.
          Print each judge's scoring sheet now so they can double-check and sign their scores.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setPrompt(null)}>Later</button>
          <button
            className="btn-gold"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try { await printJudgeSheets(prompt.categoryId); setPrompt(null); }
              catch { alert('Could not generate the judge sheets PDF.'); }
              finally { setBusy(false); }
            }}
          >
            {busy ? 'Preparing…' : 'Print Now'}
          </button>
        </div>
      </div>
    </div>
  );
}
