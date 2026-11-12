import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';

/** Loads a GET endpoint (re-runs when the path changes) and exposes reload(). */
export default function useFetch(path, { skip = false } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(!skip);

  const load = useCallback(async () => {
    if (skip || !path) return;
    setLoading(true);
    try { setData(await api.get(path)); setError(''); } catch (e) { setError(e.message); } finally { setLoading(false); }
  }, [path, skip]);

  useEffect(() => { load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}
