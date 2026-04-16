import { useQuery } from '@tanstack/react-query';
import type { Palette } from '@spriteman/shared';
import { useEditor } from './store.js';
import { BUILT_IN_PALETTES } from '@spriteman/shared';
import { api } from '../api.js';

export function PalettePanel() {
  const palette = useEditor((s) => s.palette);
  const active = useEditor((s) => s.activeColor);
  const setActive = useEditor((s) => s.setActiveColor);
  const setState = useEditor.setState;
  const userPalettes = useQuery({ queryKey: ['palettes'], queryFn: () => api<Palette[]>('/palettes') });

  function selectPreset(name: string) {
    const builtIn = BUILT_IN_PALETTES.find((b) => b.name === name);
    if (builtIn) {
      setState((s) => ({ palette: { ...s.palette, name: builtIn.name, colors: builtIn.colors }, dirty: true }));
      return;
    }
    const user = userPalettes.data?.find((p) => p.userId && p.name === name);
    if (user) {
      setState((s) => ({ palette: { ...s.palette, name: user.name, colors: user.colors }, dirty: true }));
    }
  }

  return (
    <div className="palette-panel">
      <div className="current-color" style={{ background: active }} title={active}>
        <input
          type="color"
          value={active.slice(0, 7)}
          onChange={(e) => setActive(e.target.value + 'ff')}
          style={{
            opacity: 0,
            width: '100%',
            height: '100%',
            cursor: 'pointer',
            border: 0,
          }}
        />
      </div>

      <div className="section-label">Palette</div>
      <select value={palette.name} onChange={(e) => selectPreset(e.target.value)}>
        <optgroup label="Built-in">
          {BUILT_IN_PALETTES.map((p) => (
            <option key={p.name} value={p.name}>
              {p.name}
            </option>
          ))}
        </optgroup>
        {userPalettes.data && userPalettes.data.filter((p) => p.userId).length > 0 && (
          <optgroup label="Your palettes">
            {userPalettes.data.filter((p) => p.userId).map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>

      <div className="swatches">
        {palette.colors.map((c) => (
          <button
            key={c}
            className={c === active ? 'swatch active' : 'swatch'}
            style={{ background: c }}
            onClick={() => setActive(c)}
            title={c}
          />
        ))}
      </div>

      {palette.recents.length > 0 && (
        <>
          <div className="section-label">Recent</div>
          <div className="swatches">
            {palette.recents.map((c) => (
              <button
                key={c}
                className={c === active ? 'swatch active' : 'swatch'}
                style={{ background: c }}
                onClick={() => setActive(c)}
                title={c}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
