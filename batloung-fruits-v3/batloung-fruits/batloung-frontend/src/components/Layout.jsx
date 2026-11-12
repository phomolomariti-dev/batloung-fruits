import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Icon } from './ui';
import CookieConsent from './CookieConsent';
import { useConsent } from '../utils/consent';
import { api } from '../api/client';

const NAV = [
  { section: '1. Overview', items: [{ to: '/', label: 'Dashboard', icon: 'space_dashboard', end: true }] },
  { section: '2. Inventory & Catalog', items: [
    { to: '/catalog', label: 'Fruits & Box Sizes', icon: 'nutrition' },
    { to: '/stock', label: 'Stock & Purchases', icon: 'inventory_2', admin: true },
  ] },
  { section: '3. Supply Chain & CRM', items: [
    { to: '/suppliers', label: 'Suppliers & SA Provinces', icon: 'local_shipping', admin: true },
    { to: '/vendors', label: 'Maseru Street Vendors', icon: 'storefront' },
  ] },
  { section: '4. Commerce & Fulfillment', items: [{ to: '/orders', label: 'Order Management', icon: 'receipt_long' }] },
  { section: '5. Analytics & System', items: [
    { to: '/reports', label: 'Business Reports', icon: 'monitoring', admin: true },
    { to: '/users', label: 'Users & Access', icon: 'manage_accounts', admin: true },
    { to: '/architecture', label: 'Architecture & ERD', icon: 'schema' },
  ] },
];

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const { openSettings } = useConsent();
  const [open, setOpen] = useState(false);
  const [databaseStatus, setDatabaseStatus] = useState('checking');
  const location = useLocation();
  const close = () => setOpen(false);

  useEffect(() => {
    let active = true;
    const checkDatabase = async () => {
      try {
        const result = await api.get('/health/database');
        if (active) setDatabaseStatus(result.database === 'connected' ? 'connected' : 'disconnected');
      } catch (error) {
        if (active) setDatabaseStatus(error.status === 503 ? 'disconnected' : 'unavailable');
      }
    };
    checkDatabase();
    const interval = setInterval(checkDatabase, 30000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen">
      {open && <div className="fixed inset-0 z-40 bg-inverse-surface/40 lg:hidden" onClick={close} />}
      <aside className={`fixed left-0 top-0 z-50 flex h-full w-72 flex-col bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.06)] transition-transform lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`} aria-label="Main navigation">
        <div className="flex h-16 items-center gap-3 bg-surface-container-low px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-container text-xl text-on-primary"><Icon name="nutrition" /></div>
          <div className="min-w-0">
            <div className="truncate font-semibold tracking-tight text-primary">Batloung Fruits</div>
            <div className="font-mono text-[11px] tracking-widest text-secondary">DIWA2110 - MASERU</div>
          </div>
        </div>
        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {NAV.map((g) => {
            const items = g.items.filter((i) => !i.admin || isAdmin);
            if (!items.length) return null;
            return (
              <div key={g.section}>
                <div className="px-2 pb-1 font-mono text-[11px] uppercase tracking-wider text-outline">{g.section}</div>
                <div className="space-y-0.5">
                  {items.map((i) => (
                    <NavLink key={i.to} to={i.to} end={i.end} onClick={close}
                      className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${isActive ? 'bg-primary-container font-semibold text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'}`}>
                      <span className="text-[18px]"><Icon name={i.icon} /></span>{i.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-outline-variant/60 p-3">
          <Link to="/architecture" className="mb-2 flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5 text-xs hover:bg-surface-container-high" title="Live connection status for the backend MySQL database">
            <span className={`h-2 w-2 shrink-0 rounded-full ${databaseStatus === 'connected' ? 'bg-secondary' : databaseStatus === 'checking' ? 'animate-pulse bg-tertiary-fixed-dim' : 'bg-error'}`} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-on-surface">{databaseStatus === 'connected' ? 'MySQL connected' : databaseStatus === 'checking' ? 'Checking MySQL…' : databaseStatus === 'disconnected' ? 'MySQL disconnected' : 'API unavailable'}</span>
              <span className="block text-outline">Live database · SQL Workbench</span>
            </span>
            <Icon name="arrow_outward" className="text-outline" />
          </Link>
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-sm font-bold text-primary-container">{user.name.charAt(0)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{user.name}</div>
              <div className="text-xs capitalize text-outline">{user.role}</div>
            </div>
            <button className="btn-ghost !p-1.5 text-xl" onClick={logout} aria-label="Sign out" title="Sign out"><Icon name="logout" /></button>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 px-2 text-xs text-outline">
            <Link to="/legal/terms" target="_blank" className="hover:text-on-surface hover:underline">Terms</Link>
            <Link to="/legal/privacy" target="_blank" className="hover:text-on-surface hover:underline">Privacy</Link>
            <Link to="/legal/refunds" target="_blank" className="hover:text-on-surface hover:underline">Refunds</Link>
            <button className="hover:text-on-surface hover:underline" onClick={openSettings}>Cookie settings</button>
          </div>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-outline-variant/60 bg-surface/90 px-4 backdrop-blur lg:hidden">
          <button className="btn-ghost !p-1.5 text-2xl" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <span className="font-semibold text-primary">Batloung Fruits</span>
        </header>
        <main key={location.pathname} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><Outlet /></main>
      </div>
      <CookieConsent />
    </div>
  );
}
