import { useEffect, useState } from 'react';
import api from '../../api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    const load = async () => setLogs((await api.get('/audit?limit=500')).data);
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const shown = logs.filter((l) =>
    !filter || `${l.user_name} ${l.action} ${l.details}`.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Audit Logs</h2>
        <input className="input max-w-xs" placeholder="Filter logs…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full">
          <thead><tr>
            <th className="table-th">Timestamp</th><th className="table-th">User</th>
            <th className="table-th">Action</th><th className="table-th">Details</th><th className="table-th">IP Address</th>
          </tr></thead>
          <tbody>
            {shown.map((l) => (
              <tr key={l.log_id}>
                <td className="table-td whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString()}</td>
                <td className="table-td font-semibold">{l.user_name}</td>
                <td className="table-td"><span className="rounded bg-gray-100 dark:bg-white/10 px-1.5 py-0.5 text-xs font-mono">{l.action}</span></td>
                <td className="table-td text-xs">{l.details}</td>
                <td className="table-td text-xs font-mono">{l.ip_address}</td>
              </tr>
            ))}
            {!shown.length && <tr><td className="table-td text-gray-500" colSpan="5">No log entries.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
