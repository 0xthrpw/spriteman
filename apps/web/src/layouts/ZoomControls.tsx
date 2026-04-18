import { useLayout, clampZoom } from './store.js';

export function ZoomControls({ areaRef }: { areaRef: React.RefObject<HTMLElement | null> }) {
  const viewZoom = useLayout((s) => s.viewZoom);
  const canvasWidth = useLayout((s) => s.canvasWidth);
  const canvasHeight = useLayout((s) => s.canvasHeight);
  const zoomViewIn = useLayout((s) => s.zoomViewIn);
  const zoomViewOut = useLayout((s) => s.zoomViewOut);
  const setViewZoom = useLayout((s) => s.setViewZoom);

  function fit() {
    const el = areaRef.current;
    if (!el) return;
    // Subtract a bit of padding so the canvas isn't flush with the viewport edge.
    const pad = 40;
    const availW = Math.max(1, el.clientWidth - pad);
    const availH = Math.max(1, el.clientHeight - pad);
    const z = Math.min(availW / canvasWidth, availH / canvasHeight);
    setViewZoom(clampZoom(z));
  }

  return (
    <div className="layouts-zoom-controls">
      <button onClick={zoomViewOut} title="Zoom out (-)">
        −
      </button>
      <span className="layouts-zoom-display">{Math.round(viewZoom * 100)}%</span>
      <button onClick={zoomViewIn} title="Zoom in (+)">
        +
      </button>
      <button onClick={() => setViewZoom(1)} title="Reset zoom to 100% (0)">
        1:1
      </button>
      <button onClick={fit} title="Fit canvas to view (F)">
        Fit
      </button>
    </div>
  );
}
