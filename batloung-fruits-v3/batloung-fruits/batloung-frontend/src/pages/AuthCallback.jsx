import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// The API sends people back here after a social sign-in, with the token in the URL fragment (#token=...).
export default function AuthCallback() {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();
  const ran = useRef(false); // React StrictMode runs effects twice in development; the fragment can only be read once

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
    window.history.replaceState(null, '', window.location.pathname); // keep the token out of the address bar and history
    if (!token) { navigate('/login?error=oauth_failed', { replace: true }); return; }
    loginWithToken(token).then(() => navigate('/', { replace: true })).catch(() => navigate('/login?error=oauth_failed', { replace: true }));
  }, [loginWithToken, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface-variant" role="status">
      Signing you in...
    </div>
  );
}
