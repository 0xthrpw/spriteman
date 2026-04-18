import { useEffect } from 'react';
import { useEditor, type EditorState } from './store.js';

const TOOL_KEYS: Record<string, EditorState['tool']> = {
  b: 'pencil',
  e: 'eraser',
  g: 'fill',
  l: 'line',
  u: 'rect',
  i: 'eyedropper',
};

export function useKeyboardShortcuts() {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      const mod = e.ctrlKey || e.metaKey;
      const s = useEditor.getState();

      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
        return;
      }
      if (mod && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault();
        s.redo();
        return;
      }
      if (mod) return;

      const key = e.key.toLowerCase();
      const toolId = TOOL_KEYS[key];
      if (toolId) {
        s.setTool(toolId);
        return;
      }
      if (key === '[') {
        s.setBrushSize(Math.max(1, s.brushSize - 1) as 1 | 2 | 3 | 4);
        return;
      }
      if (key === ']') {
        s.setBrushSize(Math.min(4, s.brushSize + 1) as 1 | 2 | 3 | 4);
        return;
      }
      if (key === '+' || key === '=') {
        s.setZoom(s.zoom + 1);
        return;
      }
      if (key === '-' || key === '_') {
        s.setZoom(s.zoom - 1);
        return;
      }
      if (key === 'x') {
        s.swapFgBg();
        return;
      }
      if (key === 'h') {
        s.flipActiveFrame('x');
        return;
      }
      if (key === 'v') {
        s.flipActiveFrame('y');
        return;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
