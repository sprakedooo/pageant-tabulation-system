import { useEffect, useState } from 'react';
import api from '../api';

// Pings /api/health every 10s and shows latency — simple LAN health monitor.
export default function LanHealth() {
  const [ms, setMs] = useState(null);

  useEffect(() => {
    let alive = true;
    const ping = async () => {
      const t0 = performance.now();
      try {
        await api.get('/health');
        if (alive) setMs(Math.round(performance.now() - t0));
      } catch {
        if (alive) setMs(-1);
      }
    };
    ping();
    const id = setInterval(ping, 10000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (ms === null) return null;
  const ok = ms >= 0;
  return (
    <span
      className={`hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300' : 'bg-red-100 text-red-700'
      }`}
      title="LAN health"
    >
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {ok ? `LAN ${ms} ms` : 'OFFLINE'}
    </span>
  );
}
