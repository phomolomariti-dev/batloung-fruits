import { createContext, useCallback, useContext, useMemo, useState } from 'react';

// Cookie choice, stored in a first-party cookie for 180 days.
// Strictly necessary storage is always on. "preferences" is the only optional category: it lets the
// sign-in page remember your email. There are no analytics or advertising cookies.
const NAME = 'bf_consent';
const VERSION = 1;
export const REMEMBER_KEY = 'bf_remember_email';

export function readConsent() {
  try {
    const hit = document.cookie.split('; ').find((c) => c.startsWith(`${NAME}=`));
    if (!hit) return null;
    const v = JSON.parse(decodeURIComponent(hit.slice(NAME.length + 1)));
    return v.v === VERSION ? v : null;
  } catch { return null; }
}

function writeConsent({ preferences }) {
  const value = { v: VERSION, preferences: !!preferences, at: new Date().toISOString() };
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${NAME}=${encodeURIComponent(JSON.stringify(value))}; Max-Age=${180 * 86400}; Path=/; SameSite=Lax${secure}`;
  return value;
}

const ConsentContext = createContext(null);
export const useConsent = () => useContext(ConsentContext);

export function ConsentProvider({ children }) {
  const [consent, setConsent] = useState(readConsent);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const save = useCallback(({ preferences }) => {
    setConsent(writeConsent({ preferences }));
    // Rejecting preference storage removes what it had saved
    if (!preferences) { try { localStorage.removeItem(REMEMBER_KEY); } catch { /* storage blocked */ } }
    setSettingsOpen(false);
  }, []);

  const value = useMemo(() => ({
    consent, decided: !!consent, allowPreferences: !!consent?.preferences,
    acceptAll: () => save({ preferences: true }), rejectOptional: () => save({ preferences: false }), save,
    settingsOpen, openSettings: () => setSettingsOpen(true), closeSettings: () => setSettingsOpen(false),
  }), [consent, save, settingsOpen]);

  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}
