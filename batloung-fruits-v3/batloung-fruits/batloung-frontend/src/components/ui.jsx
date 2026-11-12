import { useEffect } from 'react';
import { STATUS_STYLE } from '../utils/format';

export const Icon = ({ name, className = '' }) => (
  <span className={`material-symbols-outlined leading-none ${className}`} aria-hidden="true" style={{ fontSize: 'inherit' }}>{name}</span>
);

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-primary">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon, hint, tone = 'default' }) {
  const tones = { default: 'text-primary-container bg-primary-fixed', warn: 'text-tertiary bg-tertiary-fixed', money: 'text-on-primary bg-primary-container' };
  return (
    <div className="card p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium text-on-surface-variant">{label}</span>
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg text-[18px] ${tones[tone]}`}><Icon name={icon} /></span>
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-on-surface">{value}</div>
      {hint && <div className="mt-1 text-xs text-outline">{hint}</div>}
    </div>
  );
}

export const StatusBadge = ({ status }) => (
  <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[status] || 'bg-surface-container-high text-on-surface-variant'}`}>{status}</span>
);

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-inverse-surface/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`flex max-h-[92vh] w-full flex-col rounded-t-xl bg-surface-container-lowest shadow-2xl sm:rounded-xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-xl'}`}>
        <div className="flex items-center justify-between border-b border-outline-variant/60 px-5 py-4">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          <button className="btn-ghost !p-1 text-xl" onClick={onClose} aria-label="Close"><Icon name="close" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-outline-variant/60 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-on-surface">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-outline">{hint}</span>}
      {error && <span className="mt-1 block text-xs font-medium text-error">{error}</span>}
    </label>
  );
}

export const Table = ({ children }) => (
  <div className="card overflow-hidden">
    <div className="overflow-x-auto"><table className="min-w-full divide-y divide-outline-variant/50">{children}</table></div>
  </div>
);

export const Empty = ({ children = 'Nothing to show yet.' }) => <div className="px-4 py-10 text-center text-sm text-outline">{children}</div>;
export const Loading = () => <div className="px-4 py-10 text-center text-sm text-outline">Loading...</div>;
export const ErrorBox = ({ error }) => error ? <div className="mb-4 rounded-lg bg-error-container px-4 py-3 text-sm font-medium text-on-error-container" role="alert">{error}</div> : null;

export function SearchBox({ value, onChange, placeholder = 'Search...' }) {
  return (
    <div className="relative min-w-[200px] flex-1">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline"><Icon name="search" /></span>
      <input className="input !pl-9" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder} />
    </div>
  );
}

export const Select = ({ value, onChange, children, label, className = '' }) => (
  <select className={`input !w-auto ${className}`} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>{children}</select>
);

export const Tabs = ({ tabs, value, onChange }) => (
  <div className="mb-5 flex gap-1 overflow-x-auto border-b border-outline-variant/60" role="tablist">
    {tabs.map(([id, label]) => (
      <button key={id} role="tab" aria-selected={value === id} onClick={() => onChange(id)}
        className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${value === id ? 'border-primary-container text-primary-container' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>
        {label}
      </button>
    ))}
  </div>
);

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onClose, busy }) {
  return (
    <Modal title={title} onClose={onClose} footer={<>
      <button className="btn-secondary" onClick={onClose}>Cancel</button>
      <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
    </>}>
      <p className="text-sm text-on-surface-variant">{message}</p>
    </Modal>
  );
}
