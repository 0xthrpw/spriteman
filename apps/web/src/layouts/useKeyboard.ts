import { useEffect } from 'react';
import { useLayout } from './store.js';

export function useLayoutKeyboard() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }
      const s = useLayout.getState();
      const sel = s.selectedPlacementId;

      if (e.key === 'Escape') {
        if (sel) {
          s.selectPlacement(null);
          e.preventDefault();
        }
        return;
      }

      // View zoom shortcuts — work regardless of selection.
      if (e.key === '+' || e.key === '=') {
        s.zoomViewIn();
        e.preventDefault();
        return;
      }
      if (e.key === '-' || e.key === '_') {
        s.zoomViewOut();
        e.preventDefault();
        return;
      }
      if (e.key === '0') {
        s.setViewZoom(1);
        e.preventDefault();
        return;
      }

      if (!sel) return;

      const key = e.key.toLowerCase();
      if (key === 'r') {
        s.rotatePlacement(sel);
        e.preventDefault();
        return;
      }
      if (key === 'h') {
        s.flipPlacement(sel, 'x');
        e.preventDefault();
        return;
      }
      if (key === 'v') {
        s.flipPlacement(sel, 'y');
        e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        s.deletePlacement(sel);
        e.preventDefault();
        return;
      }
      if (e.key === '[') {
        if (e.shiftKey) s.sendToBack(sel);
        else s.sendBackward(sel);
        e.preventDefault();
        return;
      }
      if (e.key === ']') {
        if (e.shiftKey) s.sendToFront(sel);
        else s.sendForward(sel);
        e.preventDefault();
        return;
      }

      // Arrow key nudging: 1 grid unit, Shift = 1 px
      const step = e.shiftKey ? 1 : s.snapGrid;
      const p = s.placements.find((x) => x.id === sel);
      if (!p) return;
      if (e.key === 'ArrowLeft') {
        s.movePlacement(sel, p.x - step, p.y);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        s.movePlacement(sel, p.x + step, p.y);
        e.preventDefault();
      } else if (e.key === 'ArrowUp') {
        s.movePlacement(sel, p.x, p.y - step);
        e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        s.movePlacement(sel, p.x, p.y + step);
        e.preventDefault();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
