import { useState } from 'react';
import { exportFramePng, exportSpritesheetPng } from './exports/png.js';
import { exportAnimatedGif } from './exports/gif.js';
import { exportProjectJson } from './exports/json.js';

export function ExportMenu() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<void> | void) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      console.error(e);
      alert(`Export failed: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      <button className="primary" onClick={() => setOpen((v) => !v)} disabled={busy}>
        {busy ? 'Exporting…' : 'Export ▾'}
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: 'var(--bg-elev)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 6,
            minWidth: 200,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            zIndex: 10,
          }}
        >
          <button onClick={() => run(() => exportFramePng(1))}>Current frame PNG (1×)</button>
          <button onClick={() => run(() => exportFramePng(4))}>Current frame PNG (4×)</button>
          <button onClick={() => run(() => exportSpritesheetPng({ cols: 8, padding: 0, scale: 1 }))}>
            Spritesheet PNG
          </button>
          <button onClick={() => run(() => exportAnimatedGif({ scale: 4 }))}>Animated GIF (4×)</button>
          <button onClick={() => run(() => exportProjectJson())}>Project JSON</button>
        </div>
      )}
    </div>
  );
}
