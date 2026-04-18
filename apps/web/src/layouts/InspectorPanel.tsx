import type { LayoutSnapGrid } from '@spriteman/shared';
import { LAYOUT_SNAP_GRID_VALUES } from '@spriteman/shared';
import { useLayout } from './store.js';

export function InspectorPanel() {
  const name = useLayout((s) => s.name);
  const canvasWidth = useLayout((s) => s.canvasWidth);
  const canvasHeight = useLayout((s) => s.canvasHeight);
  const snapGrid = useLayout((s) => s.snapGrid);
  const placements = useLayout((s) => s.placements);
  const selectedId = useLayout((s) => s.selectedPlacementId);
  const setName = useLayout((s) => s.setName);
  const setCanvasSize = useLayout((s) => s.setCanvasSize);
  const setSnapGrid = useLayout((s) => s.setSnapGrid);
  const rotatePlacement = useLayout((s) => s.rotatePlacement);
  const flipPlacement = useLayout((s) => s.flipPlacement);
  const deletePlacement = useLayout((s) => s.deletePlacement);
  const sendForward = useLayout((s) => s.sendForward);
  const sendBackward = useLayout((s) => s.sendBackward);
  const sendToFront = useLayout((s) => s.sendToFront);
  const sendToBack = useLayout((s) => s.sendToBack);

  const selected = selectedId ? placements.find((p) => p.id === selectedId) ?? null : null;

  return (
    <aside className="layouts-inspector">
      <div className="layouts-inspector-section">
        <label className="layouts-inspector-label">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="layouts-inspector-section">
        <label className="layouts-inspector-label">Canvas size</label>
        <div className="row" style={{ gap: 6 }}>
          <input
            type="number"
            min={16}
            max={2048}
            value={canvasWidth}
            onChange={(e) => setCanvasSize(Number(e.target.value) || canvasWidth, canvasHeight)}
          />
          <span style={{ color: 'var(--fg-dim)' }}>×</span>
          <input
            type="number"
            min={16}
            max={2048}
            value={canvasHeight}
            onChange={(e) => setCanvasSize(canvasWidth, Number(e.target.value) || canvasHeight)}
          />
        </div>
      </div>
      <div className="layouts-inspector-section">
        <label className="layouts-inspector-label">Snap grid</label>
        <select
          value={snapGrid}
          onChange={(e) => setSnapGrid(Number(e.target.value) as LayoutSnapGrid)}
        >
          {LAYOUT_SNAP_GRID_VALUES.map((n) => (
            <option key={n} value={n}>
              {n}×{n}
            </option>
          ))}
        </select>
      </div>

      <div className="layouts-inspector-section">
        <label className="layouts-inspector-label">Selection</label>
        {!selected ? (
          <div style={{ color: 'var(--fg-dim)', fontSize: 12 }}>
            Click a placement on the canvas to select it.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--fg-dim)', marginBottom: 6 }}>
              ({selected.x}, {selected.y}) · rotation {selected.rotation}°
              {selected.flipX ? ' · flipped H' : ''}
              {selected.flipY ? ' · flipped V' : ''}
            </div>
            <div className="layouts-inspector-btn-row">
              <button onClick={() => rotatePlacement(selected.id)} title="Rotate 90° (R)">
                ↻
              </button>
              <button onClick={() => flipPlacement(selected.id, 'x')} title="Flip horizontal (H)">
                ⇔
              </button>
              <button onClick={() => flipPlacement(selected.id, 'y')} title="Flip vertical (V)">
                ⇕
              </button>
            </div>
            <div className="layouts-inspector-btn-row" style={{ marginTop: 6 }}>
              <button onClick={() => sendBackward(selected.id)} title="Send backward ([)">
                Back
              </button>
              <button onClick={() => sendForward(selected.id)} title="Bring forward (])">
                Fwd
              </button>
              <button onClick={() => sendToBack(selected.id)} title="Send to back (Shift+[)">
                ToBack
              </button>
              <button onClick={() => sendToFront(selected.id)} title="Bring to front (Shift+])">
                ToFront
              </button>
            </div>
            <div className="layouts-inspector-btn-row" style={{ marginTop: 6 }}>
              <button
                className="danger"
                onClick={() => deletePlacement(selected.id)}
                title="Delete (Delete)"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
