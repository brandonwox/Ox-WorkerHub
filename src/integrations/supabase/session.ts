import { useEffect } from 'react';

import { useAppStore } from '@/store/useAppStore';

import { fetchCurrentWorker, onAuthChange } from './auth';
import { isSupabaseConfigured } from './config';

/**
 * Syncs the Supabase auth session into the store as `authWorker`. When signed in,
 * the resolved worker becomes the base identity (overriding the Developer dev
 * base); when signed out, it reverts to the dev base. Mount once at the app root.
 *
 * Safe before the backend is fully set up: if the workers row or table isn't
 * there yet, the worker resolves to null and the app stays in dev mode.
 */
export function useSupabaseSession(): void {
  const setAuthWorker = useAppStore((s) => s.setAuthWorker);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;

    // Resolve any persisted session on launch.
    fetchCurrentWorker().then((worker) => {
      if (active) setAuthWorker(worker);
    });

    // React to sign-in / sign-out / token refresh.
    const unsubscribe = onAuthChange(async (session) => {
      const worker = session ? await fetchCurrentWorker() : null;
      if (active) setAuthWorker(worker);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setAuthWorker]);
}
