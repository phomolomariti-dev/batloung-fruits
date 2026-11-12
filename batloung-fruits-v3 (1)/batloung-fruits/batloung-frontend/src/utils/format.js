export const money = (n) => `R ${Number(n || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const num = (n) => Number(n || 0).toLocaleString('en-ZA');
export const orderRef = (id) => `ORD-${String(id).padStart(4, '0')}`;
export const today = () => new Date().toISOString().slice(0, 10);
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d.replace(' ', 'T')).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '-');

export const STATUSES = ['Pending', 'Confirmed', 'Processing', 'Ready for Collection/Delivery', 'Completed', 'Cancelled'];
export const STATUS_STYLE = {
  Pending: 'bg-tertiary-fixed text-tertiary',
  Confirmed: 'bg-surface-container-high text-primary-container',
  Processing: 'bg-secondary-fixed text-on-secondary-container',
  'Ready for Collection/Delivery': 'bg-primary-fixed text-primary-container',
  Completed: 'bg-primary-container text-on-primary',
  Cancelled: 'bg-error-container text-on-error-container',
};

export function downloadCsv(filename, rows) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
