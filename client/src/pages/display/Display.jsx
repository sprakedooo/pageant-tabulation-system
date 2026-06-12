import { useEffect, useState } from 'react';
import api from '../../api';
import { getSocket } from '../../socket';

// Public projection screen — names and photos only, never scores.
export default function Display() {
  const [state, setState] = useState(null);

  const load = async () => setState((await api.get('/display/state')).data);

  useEffect(() => {
    load();
    const s = getSocket();
    const refresh = () => load();
    ['display:update', 'stage:advanced', 'candidates:changed'].forEach((e) => s.on(e, refresh));
    return () => ['display:update', 'stage:advanced', 'candidates:changed'].forEach((e) => s.off(e, refresh));
  }, []);

  const goFullscreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
    else document.exitFullscreen();
  };

  if (!state) return <div className="min-h-screen bg-royal" />;

  const Photo = ({ c, size = 'h-44 w-44' }) => (
    <div className={`${size} mx-auto rounded-full overflow-hidden border-4 border-gold-400 shadow-[0_0_40px_rgba(212,154,31,0.5)] bg-gold-900/40 flex items-center justify-center text-6xl`}>
      {c.photo ? <img src={c.photo} alt={c.candidate_name} className="h-full w-full object-cover" /> : '👑'}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-royal via-[#5a1216] to-black text-white cursor-pointer select-none" onDoubleClick={goFullscreen}>
      <header className="pt-10 pb-6 text-center">
        <div className="text-4xl">👑</div>
        <h1 className="font-display text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gold-200 via-gold-400 to-gold-200">
          {state.eventName}
        </h1>
        <p className="mt-2 text-gold-100/50 tracking-[0.5em] text-sm">BEAUTY · PRIDE · PURPOSE</p>
      </header>

      <main className="px-8 pb-16">
        {state.phase === 'candidates' && (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-8 max-w-7xl mx-auto">
            {state.candidates.map((c) => (
              <div key={c.candidate_id} className="text-center">
                <Photo c={c} size="h-40 w-40" />
                <div className="mt-3 font-display text-xl font-bold text-gold-200">#{c.candidate_number}</div>
                <div className="font-semibold">{c.candidate_name}</div>
                <div className="text-sm text-gray-400">{c.municipality} · {c.age}</div>
              </div>
            ))}
          </div>
        )}

        {state.phase === 'top5' && (
          <Announce title="TOP 5 FINALISTS" people={state.top5} cols="md:grid-cols-5" />
        )}

        {state.phase === 'top3' && (
          <Announce title="TOP 3 FINALISTS" people={state.top3} cols="md:grid-cols-3" />
        )}

        {state.phase === 'winner' && state.winner && (
          <div className="text-center max-w-5xl mx-auto">
            <h2 className="font-display text-4xl font-black text-gold-300 mb-10 animate-pulse">MISS DUMALINAO 2026</h2>
            <div className="flex flex-col md:flex-row items-end justify-center gap-12">
              {[state.winner[1], state.winner[0], state.winner[2]].filter(Boolean).map((c) => (
                <div key={c.candidate_id} className={`text-center ${c.rank_no === 1 ? 'order-first md:order-none scale-125 mb-6' : ''}`}>
                  <div className="text-5xl mb-2">{c.rank_no === 1 ? '👑' : c.rank_no === 2 ? '🥈' : '🥉'}</div>
                  <Photo c={c} size={c.rank_no === 1 ? 'h-56 w-56' : 'h-40 w-40'} />
                  <div className="mt-4 font-display text-2xl font-black text-gold-200">
                    {c.rank_no === 1 ? 'WINNER' : c.rank_no === 2 ? '1st Runner-Up' : '2nd Runner-Up'}
                  </div>
                  <div className="text-xl font-semibold">#{c.candidate_number} {c.candidate_name}</div>
                  <div className="text-gray-400">{c.municipality}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-3 inset-x-0 text-center text-xs text-white/30">
        Double-click for fullscreen
      </footer>
    </div>
  );
}

function Announce({ title, people, cols }) {
  return (
    <div className="text-center max-w-7xl mx-auto">
      <h2 className="font-display text-4xl font-black text-gold-300 mb-12">{title}</h2>
      {!people.length ? (
        <p className="text-gray-400 text-xl">To be announced…</p>
      ) : (
        <div className={`grid grid-cols-1 ${cols} gap-10`}>
          {people.map((c) => (
            <div key={c.candidate_id} className="text-center animate-[fadeIn_1s_ease]">
              <div className="h-44 w-44 mx-auto rounded-full overflow-hidden border-4 border-gold-400 shadow-[0_0_40px_rgba(212,154,31,0.5)] bg-gold-900/40 flex items-center justify-center text-6xl">
                {c.photo ? <img src={c.photo} alt="" className="h-full w-full object-cover" /> : '👑'}
              </div>
              <div className="mt-4 font-display text-2xl font-bold text-gold-200">#{c.candidate_number}</div>
              <div className="text-xl font-semibold">{c.candidate_name}</div>
              <div className="text-gray-400">{c.municipality}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
