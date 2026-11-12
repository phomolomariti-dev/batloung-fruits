import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useConsent } from '../utils/consent';

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} disabled={disabled} onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary-container' : 'bg-outline-variant'} ${disabled ? 'opacity-60' : ''}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

// Shown right after signing in until a choice is made, and again whenever "Cookie settings" is opened.
// "Reject" and "Accept" have the same weight: refusing is as easy as agreeing, and the system works the same either way.
export default function CookieConsent() {
  const { decided, consent, allowPreferences, acceptAll, rejectOptional, save, settingsOpen, closeSettings } = useConsent();
  const [manage, setManage] = useState(false);
  const [prefs, setPrefs] = useState(allowPreferences);
  const visible = !decided || settingsOpen;

  useEffect(() => { if (settingsOpen) { setManage(true); setPrefs(allowPreferences); } }, [settingsOpen, allowPreferences]);
  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[95] flex justify-center p-3 sm:justify-start sm:p-5 lg:pl-[19.5rem]" role="dialog" aria-modal="false" aria-labelledby="cookie-title">
      <div className="w-full max-w-md rounded-xl border border-outline-variant/70 bg-surface-container-lowest p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-tertiary-fixed text-xl text-tertiary"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 9 9 4 4 0 0 1-4-4 4 4 0 0 1-5-5z" /><circle cx="9" cy="10" r="1" fill="currentColor" /><circle cx="14" cy="15" r="1" fill="currentColor" /><circle cx="8.5" cy="15" r="1" fill="currentColor" /></svg></span>
          <div className="min-w-0 flex-1">
            <h2 id="cookie-title" className="font-semibold text-primary">Cookies on Batloung Fruits</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              We use a few strictly necessary cookies to keep you signed in. You can also let us remember your email on the sign-in page. We do not use advertising or analytics cookies.
              {' '}<Link to="/legal/cookies" target="_blank" className="font-semibold text-surface-tint hover:underline">Cookie Policy</Link>
            </p>
          </div>
          {consent && <button className="btn-ghost !p-1 text-xl" onClick={closeSettings} aria-label="Close cookie settings"><span aria-hidden="true">&times;</span></button>}
        </div>

        {manage && (
          <div className="mt-4 space-y-3 rounded-lg bg-surface-container-low p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <div><div className="font-semibold">Strictly necessary</div><div className="text-xs text-on-surface-variant">Sign-in and security. Always on.</div></div>
              <Toggle checked disabled label="Strictly necessary cookies, always on" onChange={() => {}} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <div><div className="font-semibold">Preferences</div><div className="text-xs text-on-surface-variant">Remember my email on the sign-in page.</div></div>
              <Toggle checked={prefs} onChange={setPrefs} label="Preference cookies" />
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary flex-1" onClick={rejectOptional}>Reject non-essential</button>
          <button className="btn-primary flex-1" onClick={acceptAll}>Accept all</button>
        </div>
        <div className="mt-2 text-center">
          {manage
            ? <button className="text-sm font-semibold text-surface-tint hover:underline" onClick={() => save({ preferences: prefs })}>Save my choices</button>
            : <button className="text-sm font-semibold text-surface-tint hover:underline" onClick={() => { setPrefs(false); setManage(true); }}>Manage choices</button>}
        </div>
      </div>
    </div>
  );
}
