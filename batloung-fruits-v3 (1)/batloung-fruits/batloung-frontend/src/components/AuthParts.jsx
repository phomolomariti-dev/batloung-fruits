import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { API_BASE, api } from '../api/client';
import { COMPANY, TERMS_VERSION } from '../legal/company';
import { PROVIDERS } from './SocialIcons';

// Pieces shared by the Sign in and Create account pages.

// What the API sends back as ?error=<code> after a social sign-in attempt
export const MESSAGES = {
  terms_required: 'Please agree to the Terms and Conditions first, then try again.',
  provider_not_configured: (p) => `${p || 'That'} sign-in is not set up on this server yet. Use your email below, or ask an administrator.`,
  access_denied: 'You cancelled the sign-in. Nothing was changed.',
  invalid_state: 'That sign-in attempt expired or could not be verified. Please try again.',
  oauth_failed: 'We could not complete the sign-in with that provider. Please try again.',
  email_unverified: 'That account has no verified email address, so we cannot match it to a Batloung account.',
  no_account: 'No Batloung Fruits account uses that email. Ask an administrator to add you.',
  account_disabled: 'This account has been switched off. Please contact an administrator.',
  unknown_provider: 'That sign-in method is not available.',
};

// Three crates, one for each box size (Small, Medium, Large) with a different fruit in each
export function Crates() {
  const slats = (x, y, w, h) => [0.34, 0.68].map((f) => <line key={f} x1={x + 4} x2={x + w - 4} y1={y + h * f} y2={y + h * f} stroke="#8a5a14" strokeWidth="2" />);
  const crate = (x, w, h, label, delay) => (
    <g className="crate-rise" style={{ animationDelay: `${delay}ms` }}>
      <rect x={x} y={280 - h} width={w} height={h} rx="5" fill="#d99a3a" stroke="#8a5a14" strokeWidth="2.5" />
      {slats(x, 280 - h, w, h)}
      <rect x={x + w / 2 - 17} y={280 - h / 2 - 14} width="34" height="28" rx="4" fill="#fff4dc" stroke="#8a5a14" strokeWidth="1.5" />
      <text x={x + w / 2} y={280 - h / 2 + 7} textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontWeight="700" fontSize="18" fill="#472a00">{label}</text>
    </g>
  );
  return (
    <svg viewBox="0 0 580 300" className="w-full" role="img" aria-label="Three fruit crates in Small, Medium and Large sizes">
      <line x1="0" x2="580" y1="282" y2="282" stroke="#84c39b" strokeOpacity="0.35" strokeWidth="2" />
      {/* Small: oranges */}
      <g className="crate-rise" style={{ animationDelay: '0ms' }}>
        {[46, 80, 114].map((cx, i) => <g key={cx}><circle cx={cx} cy={i === 1 ? 196 : 202} r="19" fill="#f28c1e" /><circle cx={cx - 6} cy={(i === 1 ? 196 : 202) - 6} r="5" fill="#ffc46b" opacity="0.8" /></g>)}
      </g>
      {crate(18, 140, 70, 'S', 0)}
      {/* Medium: apples */}
      <g className="crate-rise" style={{ animationDelay: '140ms' }}>
        {[200, 238, 276, 314].map((cx, i) => (
          <g key={cx}><circle cx={cx} cy={i % 2 ? 168 : 174} r="22" fill="#c8362d" /><circle cx={cx - 7} cy={(i % 2 ? 168 : 174) - 8} r="5" fill="#ee7a6c" opacity="0.8" />
            {i === 1 && <path d={`M${cx} ${150} q9 -12 18 -6 q-8 10 -18 6z`} fill="#4ea06b" />}</g>
        ))}
      </g>
      {crate(180, 170, 95, 'M', 140)}
      {/* Large: mangoes, grapes, bananas */}
      <g className="crate-rise" style={{ animationDelay: '280ms' }}>
        <ellipse cx="400" cy="146" rx="26" ry="20" fill="#f2a42a" /><ellipse cx="408" cy="141" rx="12" ry="9" fill="#e4572e" opacity="0.7" />
        <ellipse cx="458" cy="142" rx="26" ry="20" fill="#f2a42a" transform="rotate(-12 458 142)" /><ellipse cx="450" cy="138" rx="11" ry="8" fill="#e4572e" opacity="0.65" />
        {[[500, 128], [514, 128], [528, 128], [507, 141], [521, 141], [514, 154], [535, 141]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="8" fill="#6b3fa0" />)}
        <path d="M500 112 q10 -10 18 0" stroke="#4ea06b" strokeWidth="4" fill="none" strokeLinecap="round" />
      </g>
      {crate(366, 196, 120, 'L', 280)}
    </svg>
  );
}

const Eye = ({ off }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />{off && <path d="M4 4l16 16" />}
  </svg>
);

// Brand panel on the left, the form on the right (stacked on a phone)
export function AuthShell({ children }) {
  return (
    <div className="grid min-h-screen bg-surface lg:grid-cols-[1.02fr_1fr]">
      <aside className="relative flex flex-col justify-between overflow-hidden bg-primary px-6 py-8 text-on-primary sm:px-10 lg:px-14 lg:py-12">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'repeating-linear-gradient(0deg, #fff 0 1px, transparent 1px 44px), repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 44px)' }} />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-fixed text-xl font-extrabold text-primary">B</span>
          <div>
            <div className="text-lg font-bold leading-tight tracking-tight">{COMPANY.name}</div>
            <div className="mono text-[11px] tracking-widest text-primary-fixed-dim">DISTRIBUTION HUB, MASERU</div>
          </div>
        </div>
        <div className="relative my-8 lg:my-0">
          <h2 className="max-w-md text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-[2.9rem]">Fresh fruit, counted by the box.</h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-primary-fixed-dim">
            Stock in from the farms of South Africa, orders out to the street vendors of Maseru. Manage stock, vendors and orders in one place.
          </p>
          <ul className="mt-5 flex flex-wrap gap-2" aria-label="The five fruits we distribute">
            {[['Apples', '#c8362d'], ['Bananas', '#f6d44a'], ['Oranges', '#f28c1e'], ['Mangoes', '#f2a42a'], ['Grapes', '#8a5fc4']].map(([n, c]) => (
              <li key={n} className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{n}</li>
            ))}
          </ul>
        </div>
        <div className="relative hidden lg:block"><Crates /></div>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[25rem]">{children}</div>
      </main>
    </div>
  );
}

export const Notice = ({ notice }) => notice ? (
  <div role={notice.type === 'error' ? 'alert' : 'status'}
    className={`mt-5 rounded-lg px-3.5 py-2.5 text-sm font-medium ${notice.type === 'error' ? 'bg-error-container text-on-error-container' : 'bg-tertiary-fixed text-tertiary'}`}>
    {notice.text}
  </div>
) : null;

// The Terms come first: nothing else on the page works until this is ticked
export function TermsBox({ agreed, error, onChange, inputRef }) {
  const link = 'font-semibold text-surface-tint underline-offset-2 hover:underline';
  return (
    <div className={`mt-6 rounded-xl border p-3.5 transition-colors ${error ? 'border-error bg-error-container/40' : 'border-outline-variant bg-surface-container-low'}`}>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
        <input ref={inputRef} id="terms" type="checkbox" checked={agreed} aria-invalid={error} aria-describedby={error ? 'terms-error' : undefined}
          onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-primary-container" />
        <span>
          I have read and agree to the{' '}
          <Link to="/legal/terms" target="_blank" rel="noopener" className={link}>Terms &amp; Conditions</Link>,{' '}
          <Link to="/legal/privacy" target="_blank" rel="noopener" className={link}>Privacy Policy</Link>{' '}and{' '}
          <Link to="/legal/refunds" target="_blank" rel="noopener" className={link}>Refund &amp; Cancellation Policy</Link>.
        </span>
      </label>
      {error && <p id="terms-error" className="mt-2 pl-[30px] text-xs font-semibold text-error">Please tick the box to agree before you continue.</p>}
    </div>
  );
}

export function useProviders() {
  const [providers, setProviders] = useState(null); // which social buttons the server has switched on
  useEffect(() => { api.get('/auth/providers').then(setProviders).catch(() => setProviders(null)); }, []);
  return providers;
}

export function useSignupOptions() {
  const [options, setOptions] = useState(null); // { enabled, adminEnabled }
  useEffect(() => { api.get('/auth/signup-options').then(setOptions).catch(() => setOptions(null)); }, []);
  return options;
}

// Google, GitHub, Apple, Facebook. needTerms() must return true before anything leaves the page.
export function SocialButtons({ heading, needTerms, setNotice }) {
  const providers = useProviders();
  const [redirecting, setRedirecting] = useState('');
  const pick = (p) => {
    setNotice(null);
    if (!needTerms()) return;
    if (providers && providers[p.id] === false) { setNotice({ type: 'info', text: MESSAGES.provider_not_configured(p.label) }); return; }
    setRedirecting(p.id);
    window.location.assign(`${API_BASE}/auth/oauth/${p.id}/start?terms=1&v=${TERMS_VERSION}`);
  };
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-semibold text-on-surface-variant">{heading}</p>
      <div className="grid grid-cols-2 gap-2.5">
        {PROVIDERS.map((p) => (
          <button key={p.id} type="button" onClick={() => pick(p)} disabled={!!redirecting} aria-label={`${heading} ${p.label}`}
            className="flex h-11 items-center justify-center gap-2.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-sm font-semibold text-on-surface transition-colors hover:border-outline hover:bg-surface-container-low disabled:opacity-60">
            <p.Icon width="20" height="20" />
            {redirecting === p.id ? 'Opening...' : p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const Divider = ({ children }) => (
  <div className="my-5 flex items-center gap-3 text-xs text-outline" role="separator"><span className="h-px flex-1 bg-outline-variant" />{children}<span className="h-px flex-1 bg-outline-variant" /></div>
);

export function PasswordField({ id, label, value, onChange, error, autoComplete, hint }) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <div className="relative">
        <input id={id} type={show ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(e) => onChange(e.target.value)}
          aria-invalid={!!error} className={`input !py-2.5 !pr-11 ${error ? 'input-error' : ''}`} />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={`${show ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={show}
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-outline hover:bg-surface-container-high hover:text-on-surface"><Eye off={show} /></button>
      </div>
      {error ? <p className="mt-1 text-xs font-medium text-error">{error}</p> : hint && <p className="mt-1 text-xs text-outline">{hint}</p>}
    </div>
  );
}

export const LegalLinks = () => (
  <p className="mt-6 text-center text-xs leading-relaxed text-outline">
    {[['terms', 'Terms'], ['privacy', 'Privacy'], ['refunds', 'Refunds'], ['cookies', 'Cookies'], ['acceptable-use', 'Acceptable use']].map(([slug, label]) => (
      <Link key={slug} to={`/legal/${slug}`} target="_blank" className="mx-1.5 hover:text-on-surface hover:underline">{label}</Link>
    ))}
  </p>
);
