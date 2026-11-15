'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiErrorMessage, apiFetch } from '@/lib/api-client';
import { useAuth } from '@/context/AuthContext';

interface ApiDataState<T> {
  data: T | null;
  error: string;
  loading: boolean;
}

type Loaded = { ok: true; json: unknown } | { ok: false; error: string };

/**
 * GETs that are in flight right now, by path. Two components (or React's
 * development double render) asking for the same thing at the same moment
 * share one request; nothing is kept once it has answered.
 */
const inFlight = new Map<string, Promise<Loaded>>();

function load(path: string, errorMessage: string, shareKey: string | null): Promise<Loaded> {
  const running = shareKey ? inFlight.get(shareKey) : undefined;
  if (running) return running;
  const request: Promise<Loaded> = apiFetch(path)
    .then(async (res): Promise<Loaded> => (res.ok ? { ok: true, json: await res.json() } : { ok: false, error: await apiErrorMessage(res, errorMessage) }))
    .catch((): Loaded => ({ ok: false, error: 'Connection problem. Check your internet and try again.' }))
    .finally(() => {
      if (shareKey && inFlight.get(shareKey) === request) inFlight.delete(shareKey);
    });
  if (shareKey) inFlight.set(shareKey, request);
  return request;
}

/**
 * Loads JSON from a GET endpoint with loading and error state.
 * `reload()` refetches (e.g. after the user changes something).
 * A `null` path loads nothing. Requests wait until sign-in has been
 * checked, so a page does not load once per step of signing in.
 */
export function useApiData<T>(
  path: string | null,
  select: (json: unknown) => T,
  errorMessage: string,
  /** Refetch when this changes (e.g. the signed-in user) */
  cacheKey = ''
) {
  const { isLoading: authLoading } = useAuth();
  const effectivePath = authLoading ? null : path;
  const [state, setState] = useState<ApiDataState<T>>({ data: null, error: '', loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (effectivePath === null) return;
    let ignore = false;
    // First loads may share a request; a reload (after a change) always asks afresh
    void load(effectivePath, errorMessage, version === 0 ? `${cacheKey}|${effectivePath}` : null).then((result) => {
      if (ignore) return;
      setState(
        result.ok ? { data: select(result.json), error: '', loading: false } : { data: null, error: result.error, loading: false }
      );
    });
    return () => {
      ignore = true;
    };
    // `select` and `errorMessage` are treated as constants for a given path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectivePath, version, cacheKey]);

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: s.data === null }));
    setVersion((v) => v + 1);
  }, []);

  // Nothing to load (no path): not loading, no data
  if (path === null && !authLoading) return { data: null, error: '', loading: false, reload };
  return { ...state, reload };
}
