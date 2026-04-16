import { useEffect, useRef } from 'react';
import { useEditor } from './store.js';

export function Timeline() {
  const frameOrder = useEditor((s) => s.frameOrder);
  const activeFrameId = useEditor((s) => s.activeFrameId);
  const setActiveFrame = useEditor((s) => s.setActiveFrame);
  const addFrame = useEditor((s) => s.addFrame);
  const duplicateFrame = useEditor((s) => s.duplicateFrame);
  const deleteFrame = useEditor((s) => s.deleteFrame);

  return (
    <div className="timeline">
      <div className="timeline-row">
        {frameOrder.map((id, i) => (
          <FrameThumb
            key={id}
            id={id}
            index={i}
            active={id === activeFrameId}
            onClick={() => setActiveFrame(id)}
          />
        ))}
        <button className="frame-add" onClick={addFrame} title="Add frame">
          +
        </button>
      </div>
      <div className="timeline-actions">
        <button onClick={() => duplicateFrame(activeFrameId)}>Duplicate</button>
        <button onClick={() => deleteFrame(activeFrameId)} disabled={frameOrder.length <= 1} className="danger">
          Delete
        </button>
      </div>
    </div>
  );
}

function FrameThumb({ id, index, active, onClick }: { id: string; index: number; active: boolean; onClick: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const width = useEditor((s) => s.width);
  const height = useEditor((s) => s.height);
  const bufferRev = useEditor((s) => s.bufferRev);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = width;
    c.height = height;
    const buf = useEditor.getState().buffers.get(id);
    if (!buf) return;
    const ctx = c.getContext('2d')!;
    ctx.putImageData(buf.toImageData(), 0, 0);
  }, [bufferRev, width, height, id]);

  return (
    <button className={active ? 'frame-thumb active' : 'frame-thumb'} onClick={onClick} title={`Frame ${index + 1}`}>
      <canvas ref={ref} style={{ imageRendering: 'pixelated', width: 48, height: 48 }} />
      <span>{index + 1}</span>
    </button>
  );
}
