import { useEffect, useRef, useState } from 'react';
import { useEditor } from './store.js';
import type { Project, UpdateProjectRequest } from '@spriteman/shared';
import { api, ApiError } from '../api.js';

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'conflict' | 'offline';

// Debounced autosave. Returns the current status so the UI can show a badge.
export function useAutosave(): Status {
  const projectId = useEditor((s) => s.projectId);
  const dirty = useEditor((s) => s.dirty);
  const bufferRev = useEditor((s) => s.bufferRev);
  const name = useEditor((s) => s.name);

  const [status, setStatus] = useState<Status>('idle');
  const timerRef = useRef<number | null>(null);
  const savingRef = useRef(false);

  async function save() {
    if (savingRef.current) return;
    const s = useEditor.getState();
    if (!s.projectId || !s.dirty) return;
    savingRef.current = true;
    setStatus('saving');
    try {
      const { frames, palette } = s.serialize();
      const body: UpdateProjectRequest = {
        name: s.name,
        width: s.width,
        height: s.height,
        fps: s.fps,
        frames,
        palette,
      };
      const result = await api<Project>(`/projects/${s.projectId}`, {
        method: 'PUT',
        headers: { 'If-Match': String(s.version) },
        json: body,
      });
      useEditor.getState().markClean(result.version);
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
    if (!projectId || !dirty) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(save, 1500);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [bufferRev, dirty, projectId, name]);

  // Flush on tab hide / unload
  useEffect(() => {
    function onVis() {
      if (document.visibilityState === 'hidden') void save();
    }
    function onUnload() {
      const s = useEditor.getState();
      if (!s.projectId || !s.dirty) return;
      // Fire a keepalive fetch — browsers will complete the request even after unload.
      const { frames, palette } = s.serialize();
      const body: UpdateProjectRequest = {
        name: s.name,
        width: s.width,
        height: s.height,
        fps: s.fps,
        frames,
        palette,
      };
      fetch(`/api/projects/${s.projectId}`, {
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
