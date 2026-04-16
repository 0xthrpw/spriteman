import { useEditor } from '../store.js';
import { downloadBlob } from './download.js';
import { safeName } from './png.js';

export function exportProjectJson() {
  const s = useEditor.getState();
  const { frames, palette } = s.serialize();
  const doc = {
    $schema: 'spriteman-project/v1',
    name: s.name,
    width: s.width,
    height: s.height,
    fps: s.fps,
    frames,
    palette,
  };
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${safeName(s.name)}.spriteman.json`);
}
