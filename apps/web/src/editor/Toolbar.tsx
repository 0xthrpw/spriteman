import { useEditor, type EditorState } from './store.js';
import * as history from './history.js';
import { useSyncExternalStore } from 'react';

const TOOLS: Array<{ id: EditorState['tool']; key: string; label: string }> = [
  { id: 'pencil', key: 'B', label: 'Pencil' },
  { id: 'eraser', key: 'E', label: 'Eraser' },
  { id: 'fill', key: 'G', label: 'Fill' },
  { id: 'line', key: 'L', label: 'Line' },
  { id: 'rect', key: 'U', label: 'Rect' },
  { id: 'eyedropper', key: 'I', label: 'Pick' },
];

function useHistoryState() {
  return useSyncExternalStore(
    (cb) => history.subscribe(cb),
    () => `${history.canUndo()}-${history.canRedo()}`,
    () => 'false-false',
  );
}

export function Toolbar() {
  const tool = useEditor((s) => s.tool);
  const brushSize = useEditor((s) => s.brushSize);
  const setTool = useEditor((s) => s.setTool);
  const setBrush = useEditor((s) => s.setBrushSize);
  const undo = useEditor((s) => s.undo);
  const redo = useEditor((s) => s.redo);
  const onionSkin = useEditor((s) => s.onionSkin);
  const showGrid = useEditor((s) => s.showGrid);
  const toggleOnion = useEditor((s) => s.toggleOnion);
  const toggleGrid = useEditor((s) => s.toggleGrid);
  const zoom = useEditor((s) => s.zoom);
  const setZoom = useEditor((s) => s.setZoom);

  useHistoryState();
  const canUndo = history.canUndo();
  const canRedo = history.canRedo();

  return (
    <div className="toolbar">
      <div className="tool-group">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={tool === t.id ? 'tool active' : 'tool'}
            onClick={() => setTool(t.id)}
            title={`${t.label} (${t.key})`}
          >
            {t.label}
            <span className="kbd">{t.key}</span>
          </button>
        ))}
      </div>
      <div className="tool-group">
        <span className="group-label">Brush</span>
        {[1, 2, 3, 4].map((n) => (
          <button
            key={n}
            className={brushSize === n ? 'tool active' : 'tool'}
            onClick={() => setBrush(n as 1 | 2 | 3 | 4)}
            title={`Brush size ${n}`}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="tool-group">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl/Cmd+Z)">Undo</button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl/Cmd+Shift+Z)">Redo</button>
      </div>
      <div className="tool-group">
        <button className={onionSkin ? 'tool active' : 'tool'} onClick={toggleOnion} title="Onion skin">Onion</button>
        <button className={showGrid ? 'tool active' : 'tool'} onClick={toggleGrid} title="Grid overlay">Grid</button>
      </div>
      <div className="tool-group">
        <button onClick={() => setZoom(zoom - 1)} title="Zoom out (-)">-</button>
        <span style={{ minWidth: 36, textAlign: 'center' }}>{zoom}×</span>
        <button onClick={() => setZoom(zoom + 1)} title="Zoom in (+)">+</button>
      </div>
    </div>
  );
}
