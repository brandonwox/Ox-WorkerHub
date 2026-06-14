import { useEffect } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { Worker } from '@/types';

import { fetchCurrentWorker, onAuthChange } from './auth';
import { isSupabaseConfigured } from './config';

/**
 * Syncs the Supabase auth session into the store. When signed in, the resolved
 * worker becomes the base identity AND the store is hydrated with live Supabase
 * data; when signed out, it reverts to the Developer dev base on mock data.
 * Mount once at the app root.
 *
 * Safe before the backend is set up: if the worker or tables aren't there yet,
 * the worker resolves to null and the app stays in dev mode on mock data.
 */
export function useSupabaseSession(): void {
  const setAuthWorker = useAppStore((s) => s.setAuthWorker);
  const loadBackendData = useAppStore((s) => s.loadBackendData);
  const resetToMockData = useAppStore((s) => s.resetToMockData);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let active = true;

    const apply = async (worker: Worker | null) => {
      if (!active) return;
      setAuthWorker(worker);
      if (worker) {
        try {
          await loadBackendData();
        } catch (e) {
          // Tables/migration may not be in place yet — keep the app usable.
          console.warn('Supabase hydrate failed; staying on local data.', e);
        }
      } else {
        resetToMockData();
      }
    };

    // Resolve any persisted session on launch.
    fetchCurrentWorker().then((worker) => apply(worker));

    // React to sign-in / sign-out / token refresh.
    const unsubscribe = onAuthChange(async (session) => {
      const worker = session ? await fetchCurrentWorker() : null;
      apply(worker);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setAuthWorker, loadBackendData, resetToMockData]);
}
