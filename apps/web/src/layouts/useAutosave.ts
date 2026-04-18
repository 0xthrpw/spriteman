import { useEffect, useRef, useState } from 'react';
import { useLayout } from './store.js';
import type { Layout, UpdateLayoutRequest } from '@spriteman/shared';
import { api, ApiError } from '../api.js';

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline';

export function useLayoutAutosave(): Status {
  const layoutId = useLayout((s) => s.layoutId);
  const dirty = useLayout((s) => s.dirty);
  const placements = useLayout((s) => s.placements);
  const name = useLayout((s) => s.name);
  const canvasWidth = useLayout((s) => s.canvasWidth);
  const canvasHeight = useLayout((s) => s.canvasHeight);
  const snapGrid = useLayout((s) => s.snapGrid);

  const [status, setStatus] = useState<Status>('idle');
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    const s = useLayout.getState();
    if (!s.layoutId || !s.dirty) return;
    savingRef.current = true;
    setStatus('saving');
    try {
      const body: UpdateLayoutRequest = s.serialize();
      const result = await api<Layout>(`/layouts/${s.layoutId}`, {
        method: 'PUT',
        headers: { 'If-Match': String(s.version) },
        json: body,
      });
      useLayout.getState().markClean(result.version);
      setStatus('saved');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setStatus('conflict');
      } else if (e instanceof ApiError) {
        setStatus('error');
      } else {
        setStatus('offline');
      }
    } finally {
      savingRef.current = false;
    }
  }

  useEffect(() => {
    if (!layoutId || !dirty) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(save, 1500);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, layoutId, placements, name, canvasWidth, canvasHeight, snapGrid]);

  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'hidden') void save();
    }
    function onUnload() {
      const s = useLayout.getState();
      if (!s.layoutId || !s.dirty) return;
      const body: UpdateLayoutRequest = s.serialize();
      fetch(`/api/layouts/${s.layoutId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'If-Match': String(s.version),
        },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    }
    window.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return status;
}
