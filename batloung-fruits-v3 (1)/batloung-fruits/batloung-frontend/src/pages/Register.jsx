import { useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AuthShell, Divider, LegalLinks, Notice, PasswordField, SocialButtons, TermsBox, useSignupOptions } from '../components/AuthParts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = [
  { id: 'sales', title: 'Sales', text: 'View products, register vendors, create and view orders.' },
  { id: 'administrator', title: 'Administrator', text: 'Everything in Sales, plus suppliers, stock, fruit, reports and users.' },
];

export default function Register() {
  const { user, register } = useAuth();
  const options = useSignupOptions(); // { enabled, adminEnabled }
  const termsRef = useRef(null);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '', role: 'sales', adminCode: '' });
  const [agreed, setAgreed] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  if (user) return <Navigate to="/" replace />;

  const needTerms = () => {
    if (agreed) return true;
    setTermsError(true);
    termsRef.current?.focus();
    return false;
  };
  const adminOff = options && !options.adminEnabled;

  const submit = async (e) => {
    e.preventDefault();
    setNotice(null);
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Enter your full name';
    if (!EMAIL_RE.test(form.email)) errs.email = 'Enter a valid email address';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) errs.password = 'Use at least 8 characters, with a letter and a number';
    if (form.confirm !== form.password) errs.confirm = 'The two passwords do not match';
    if (form.role === 'administrator' && !form.adminCode.trim()) errs.adminCode = 'Enter the administrator access code';
    setErrors(errs);
    const termsOk = needTerms();
    if (Object.keys(errs).length || !termsOk) return;
    setBusy(true);
    try {
      await register({ full_name: form.name.trim(), email: form.email.trim(), password: form.password, role: form.role, ...(form.role === 'administrator' ? { admin_code: form.adminCode.trim() } : {}) });
    } catch (err) {
      const d = err.details || {};
      if (d.code === 'EMAIL_TAKEN') setErrors({ email: err.message });
      else if (d.code === 'ADMIN_CODE_INVALID') setErrors({ adminCode: err.message });
      else if (d.code === 'TERMS_REQUIRED') setTermsError(true);
      else if (err.status === 400 && !d.code) setErrors({ name: d.full_name, email: d.email, password: d.password, adminCode: d.admin_code });
      else setNotice({ type: 'error', text: err.message });
      setBusy(false);
    }
  };

  const off = options?.enabled === false;
  return (
    <AuthShell>
      <h1 className="text-[1.75rem] font-extrabold tracking-tight text-primary">Create your account</h1>
      <p className="mt-1 text-sm text-on-surface-variant">Choose Sales or Administrator, then you are in.</p>
      <Notice notice={notice} />

      {off ? (
        <div className="mt-6 rounded-xl bg-tertiary-fixed p-4 text-sm text-tertiary" role="status">
          Creating accounts is switched off on this server. Ask an administrator to add you, then <Link to="/login" className="font-semibold underline">sign in</Link>.
        </div>
      ) : (
        <>
          <TermsBox agreed={agreed} error={termsError} inputRef={termsRef} onChange={(v) => { setAgreed(v); if (v) setTermsError(false); }} />
          <SocialButtons heading="Sign up with" needTerms={needTerms} setNotice={setNotice} />
          <p className="mt-2 text-xs text-outline">Signing up with Google, GitHub, Apple or Facebook creates a Sales account.</p>
          <Divider>or use your email</Divider>

          <form onSubmit={submit} noValidate className="space-y-4">
            <div>
              <label htmlFor="name" className="mb-1 block text-sm font-medium">Full name</label>
              <input id="name" autoComplete="name" value={form.name} onChange={(e) => set('name')(e.target.value)} maxLength={100}
                aria-invalid={!!errors.name} className={`input !py-2.5 ${errors.name ? 'input-error' : ''}`} />
              {errors.name && <p className="mt-1 text-xs font-medium text-error">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
              <input id="email" type="email" autoComplete="email" value={form.email} onChange={(e) => set('email')(e.target.value)}
                aria-invalid={!!errors.email} className={`input !py-2.5 ${errors.email ? 'input-error' : ''}`} placeholder="you@example.com" />
              {errors.email && <p className="mt-1 text-xs font-medium text-error">{errors.email}</p>}
            </div>
            <PasswordField id="password" label="Password" value={form.password} onChange={set('password')} error={errors.password} autoComplete="new-password" hint="At least 8 characters, with a letter and a number." />
            <PasswordField id="confirm" label="Confirm password" value={form.confirm} onChange={set('confirm')} error={errors.confirm} autoComplete="new-password" />

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium">Account type</legend>
              <div className="grid grid-cols-2 gap-2.5">
                {ROLES.map((r) => {
                  const disabled = r.id === 'administrator' && adminOff;
                  return (
                    <label key={r.id} className={`flex cursor-pointer flex-col rounded-lg border p-3 transition-colors has-[:checked]:border-primary-container has-[:checked]:bg-primary-fixed/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-surface-tint ${disabled ? 'cursor-not-allowed opacity-50' : 'hover:bg-surface-container-low'} border-outline-variant`}>
                      <input type="radio" name="role" value={r.id} checked={form.role === r.id} disabled={disabled} onChange={() => set('role')(r.id)} className="sr-only" />
                      <span className="text-sm font-semibold">{r.title}</span>
                      <span className="mt-0.5 text-xs leading-snug text-on-surface-variant">{r.text}</span>
                    </label>
                  );
                })}
              </div>
              {adminOff && <p className="mt-2 text-xs text-outline">Administrator sign-up is switched off on this server. Create a Sales account and ask an administrator to promote you.</p>}
            </fieldset>

            {form.role === 'administrator' && !adminOff && (
              <PasswordField id="admin-code" label="Administrator access code" value={form.adminCode} onChange={set('adminCode')} error={errors.adminCode} autoComplete="off" hint="Ask whoever runs this system for the code." />
            )}

            <button className="btn-primary w-full !py-2.5 text-[0.95rem]" disabled={busy}>{busy ? 'Creating account...' : 'Create account'}</button>
          </form>
        </>
      )}

      <p className="mt-5 text-center text-sm text-on-surface-variant">Already have an account? <Link to="/login" className="font-semibold text-surface-tint hover:underline">Sign in</Link></p>
      <LegalLinks />
    </AuthShell>
  );
}
