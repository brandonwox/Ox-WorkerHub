import { useEffect } from 'react';

import { useAppStore } from '@/store/useAppStore';
import { Worker } from '@/types';

import { fetchCurrentWorker, onAuthChange } from './auth';
import { isSupabaseConfigured } from './config';

/**
 * Syncs the Supabase auth session into the store. When signed in, the resolved
 * worker becomes the base identity AND the store is hydrated with live Supabase
 * data; when signed out, every collection is emptied so the app sits at the
 * login gate. Mount once at the app root.
 *
 * Marks `authResolved` once the first lookup completes so the layouts can wait
 * before deciding whether to show the app or the login screen.
 */
export function useSupabaseSession(): void {
  const setAuthWorker = useAppStore((s) => s.setAuthWorker);
  const setAuthResolved = useAppStore((s) => s.setAuthResolved);
  const loadBackendData = useAppStore((s) => s.loadBackendData);
  const clearData = useAppStore((s) => s.clearData);

  useEffect(() => {
    // No backend configured: nothing to resolve, but unblock the gate so local
    // dev mode is still reachable from the login screen.
    if (!isSupabaseConfigured()) {
      setAuthResolved(true);
      return;
    }
    let active = true;

    const apply = async (worker: Worker | null) => {
      if (!active) return;
      setAuthWorker(worker);
      if (worker) {
        try {
          await loadBackendData();
        } catch (e) {
          // Tables/migration may not be in place yet — keep the app usable.
          console.warn('Supabase hydrate failed; no data loaded.', e);
        }
      } else if (!useAppStore.getState().devMode) {
        // Empty everything on a real signed-out session — but never clobber a
        // locally-entered dev session (which has no Supabase session of its own).
        clearData();
      }
      setAuthResolved(true);
    };

    // Resolve any persisted session on launch.
    fetchCurrentWorker().then((worker) => apply(worker));

    // React only to actual sign-in / sign-out. We deliberately ignore
    // USER_UPDATED and TOKEN_REFRESHED: re-fetching the worker on those would
    // (a) clobber the optimistic 'active' flip right after a worker sets their
    // password (USER_UPDATED reads the row before the status write commits), and
    // (b) needlessly reload all backend data on every hourly token refresh.
    const unsubscribe = onAuthChange(async (event, session) => {
      if (event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') return;
      const worker = session ? await fetchCurrentWorker() : null;
      apply(worker);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [setAuthWorker, setAuthResolved, loadBackendData, clearData]);
}
