import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConsent, REMEMBER_KEY } from '../utils/consent';
import { PROVIDERS } from '../components/SocialIcons';
import { AuthShell, Divider, LegalLinks, MESSAGES, Notice, PasswordField, SocialButtons, TermsBox, useSignupOptions } from '../components/AuthParts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHOW_DEMO = import.meta.env.VITE_SHOW_DEMO !== 'false';
const read = (k) => { try { return localStorage.getItem(k); } catch { return null; } };

export default function Login() {
  const { user, login } = useAuth();
  const { allowPreferences } = useConsent();
  const [params] = useSearchParams();
  const options = useSignupOptions();
  const termsRef = useRef(null);

  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [email, setEmail] = useState(() => (allowPreferences && read(REMEMBER_KEY)) || '');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(() => allowPreferences && !!read(REMEMBER_KEY));
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  // Turn ?error=<code> (sent back by the API after a social sign-in) into a message
  useEffect(() => {
    const code = params.get('error');
    if (!code) return;
    const label = PROVIDERS.find((p) => p.id === params.get('provider'))?.label;
    const m = MESSAGES[code] || MESSAGES.oauth_failed;
    setNotice({ type: code === 'access_denied' ? 'info' : 'error', text: typeof m === 'function' ? m(label) : m });
    window.history.replaceState(null, '', '/login');
  }, [params]);

  if (user) return <Navigate to="/" replace />;

  const needTerms = () => {
    if (agreed) return true;
    setTermsError(true);
    termsRef.current?.focus();
    return false;
  };

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    const errs = {};
    if (!EMAIL_RE.test(email)) errs.email = 'Enter a valid email address';
    if (!password) errs.password = 'Enter your password';
    setErrors(errs);
    const termsOk = needTerms();
    if (Object.keys(errs).length || !termsOk) return;
    setBusy(true);
    try {
      await login(email, password);
      try { if (allowPreferences && remember) localStorage.setItem(REMEMBER_KEY, email); else localStorage.removeItem(REMEMBER_KEY); } catch { /* storage blocked */ }
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
      setBusy(false);
    }
  };

  const fill = (who) => { setEmail(`${who}@batloung.co.ls`); setPassword(who === 'admin' ? 'Admin@123' : 'Sales@123'); setErrors({}); };

  return (
    <AuthShell>
      <h1 className="text-[1.75rem] font-extrabold tracking-tight text-primary">Welcome back</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Sign in to continue to the Maseru hub.</p>
      <Notice notice={notice} />
      <TermsBox agreed={agreed} error={termsError} inputRef={termsRef} onChange={(v) => { setAgreed(v); if (v) setTermsError(false); }} />
      <SocialButtons heading="Continue with" needTerms={needTerms} setNotice={setNotice} />
      <Divider>or use your email</Divider>

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!errors.email} className={`input !py-2.5 ${errors.email ? 'input-error' : ''}`} placeholder="you@example.com" />
          {errors.email && <p className="mt-1 text-xs font-medium text-error">{errors.email}</p>}
        </div>
        <PasswordField id="password" label="Password" value={password} onChange={setPassword} error={errors.password} autoComplete="current-password" />
        {allowPreferences && (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm text-on-surface-variant">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-primary-container" /> Remember my email on this device
          </label>
        )}
        <button className="btn-primary w-full !py-2.5 text-[0.95rem]" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
      </form>

      {options?.enabled !== false && (
        <p className="mt-5 text-center text-sm text-on-surface-variant">New here? <Link to="/register" className="font-semibold text-surface-tint hover:underline">Create an account</Link></p>
      )}

      {SHOW_DEMO && (
        <details className="mt-5 rounded-lg border border-outline-variant/70 bg-surface-container-low px-3.5 py-2.5 text-sm">
          <summary className="cursor-pointer font-semibold text-on-surface-variant">Demo accounts</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className="btn-secondary !py-1" onClick={() => fill('admin')}>Fill administrator</button>
            <button type="button" className="btn-secondary !py-1" onClick={() => fill('sales')}>Fill sales</button>
          </div>
        </details>
      )}
      <LegalLinks />
    </AuthShell>
  );
}
