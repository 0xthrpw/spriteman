import { useEffect, useMemo, useState } from 'react';
import { rgbaToHex } from '@spriteman/pixel';
import type { HexColor } from '@spriteman/shared';
import { useEditor } from './store.js';

export function UsedColorsPanel() {
  const activeFrameId = useEditor((s) => s.activeFrameId);
  const bufferRev = useEditor((s) => s.bufferRev);
  const palette = useEditor((s) => s.palette);
  const replaceColor = useEditor((s) => s.replaceColor);

  const [from, setFrom] = useState<HexColor | null>(null);

  const usedColors = useMemo(() => {
    const buf = useEditor.getState().buffers.get(activeFrameId);
    if (!buf) return [] as Array<[HexColor, number]>;
    const counts = new Map<HexColor, number>();
    const data = buf.data;
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3]!;
      if (a === 0) continue; // skip fully transparent
      const hex = rgbaToHex([data[i]!, data[i + 1]!, data[i + 2]!, a]) as HexColor;
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [activeFrameId, bufferRev]);

  // Clear the selected "from" if it's no longer present in the frame.
  useEffect(() => {
    if (from && !usedColors.some(([c]) => c === from)) setFrom(null);
  }, [from, usedColors]);

  // Esc cancels the in-progress replacement.
  useEffect(() => {
    if (!from) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFrom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [from]);

  function pickFrom(c: HexColor) {
    setFrom((prev) => (prev === c ? null : c));
  }

  function applyReplace(to: HexColor) {
    if (!from) return;
    replaceColor(activeFrameId, from, to);
    setFrom(null);
  }

  return (
    <>
      <div className="section-label">Used in frame</div>
      {usedColors.length === 0 ? (
        <div className="used-empty">No colors yet.</div>
      ) : (
        <div className="swatches">
          {usedColors.map(([c, n]) => (
            <button
              key={c}
              className={c === from ? 'swatch active' : 'swatch'}
              style={{ background: c }}
              onClick={() => pickFrom(c)}
              title={`${c} · ${n} pixel${n === 1 ? '' : 's'}`}
            />
          ))}
        </div>
      )}

      {from && (
        <div className="replace-row">
          <div className="replace-header">
            <span>Replace</span>
            <span className="swatch tiny" style={{ background: from }} title={from} />
            <span>with…</span>
            <button className="replace-cancel" onClick={() => setFrom(null)}>
              Cancel
            </button>
          </div>
          <div className="swatches">
            {palette.colors.map((c) => (
              <button
                key={`p-${c}`}
                className="swatch"
                style={{ background: c }}
                onClick={() => applyReplace(c)}
                title={c}
                disabled={c === from}
              />
            ))}
          </div>
          {palette.recents.length > 0 && (
            <>
              <div className="section-label small">Recent</div>
              <div className="swatches">
                {palette.recents.map((c) => (
                  <button
                    key={`r-${c}`}
                    className="swatch"
                    style={{ background: c }}
                    onClick={() => applyReplace(c)}
                    title={c}
                    disabled={c === from}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
