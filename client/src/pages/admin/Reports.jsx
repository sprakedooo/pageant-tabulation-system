const REPORTS = [
  { label: 'Preliminary Scores (PDF)', url: '/api/reports/preliminary.pdf', icon: '📄' },
  { label: 'Top 5 Scores (PDF)', url: '/api/reports/top5.pdf', icon: '📄' },
  { label: 'Top 3 Scores (PDF)', url: '/api/reports/top3.pdf', icon: '📄' },
  { label: 'Final Ranking (PDF)', url: '/api/reports/final.pdf', icon: '👑' },
  { label: 'Judge Scoring Sheets (PDF)', url: '/api/reports/judge-sheets.pdf', icon: '📝' },
  { label: 'Audit Logs (PDF)', url: '/api/reports/audit.pdf', icon: '🔒' },
  { label: 'Preliminary Scores (CSV)', url: '/api/reports/preliminary.csv', icon: '📊' },
  { label: 'All Results (Excel)', url: '/api/reports/results.xlsx', icon: '📈' },
];

export default function Reports() {
  const download = async (url, label) => {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
    if (!res.ok) { alert('Failed to generate report'); return; }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = url.split('/').pop();
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl font-bold">Reports & Exports</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {REPORTS.map((r) => (
          <button key={r.url} onClick={() => download(r.url, r.label)} className="card text-left hover:border-gold-400 transition">
            <div className="text-3xl">{r.icon}</div>
            <div className="mt-2 font-semibold text-sm">{r.label}</div>
            <div className="mt-1 text-xs text-gold-600">Download →</div>
          </button>
        ))}
      </div>
    </div>
  );
}
