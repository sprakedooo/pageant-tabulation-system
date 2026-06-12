// Fetches the per-judge sign-off sheets PDF for a category and opens the
// browser print dialog (via a hidden iframe; falls back to a new tab).
export default async function printJudgeSheets(categoryId) {
  const res = await fetch(`/api/reports/judge-sheets-category/${categoryId}.pdf`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
  });
  if (!res.ok) throw new Error('Failed to generate judge sheets');
  const url = URL.createObjectURL(await res.blob());

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.src = url;
  document.body.appendChild(iframe);
  iframe.onload = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.open(url, '_blank'); // PDF viewer blocked iframe printing
    }
    // Keep the iframe alive while the print dialog is open
    setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 60000);
  };
}
