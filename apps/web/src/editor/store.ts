import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { randomUUID } from '../lib/uuid.js';
import type { Project, Frame, ProjectPalette, HexColor } from '@spriteman/shared';
import { BUILT_IN_PALETTES } from '@spriteman/shared';
import { PixelBuffer, hexToRgba, rgbaToHex, rgbaEqual, type RGBA } from '@spriteman/pixel';
import * as history from './history.js';

export type ToolId = 'pencil' | 'eraser' | 'fill' | 'line' | 'rect' | 'eyedropper';

type FrameBuffers = Map<string, PixelBuffer>; // frameId -> decoded buffer

export type EditorState = {
  // identity / persistence
  projectId: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  version: number;
  dirty: boolean;

  // frames
  frameOrder: string[]; // frame ids in order
  frameMeta: Record<string, { durationMs: number | null }>;
  activeFrameId: string;

  // session-only: frame ids excluded from the animation preview loop.
  // Not persisted; resets on project load.
  previewExcluded: Set<string>;

  // pixel data — not stored in reactive state to avoid huge diffs
  buffers: FrameBuffers; // keep as a stable ref; bump bufferRev to signal change
  bufferRev: number;

  // palette / colors
  palette: ProjectPalette;
  activeColor: HexColor;

  // tools
  tool: ToolId;
  brushSize: 1 | 2 | 3 | 4;

  // view options
  onionSkin: boolean;
  showGrid: boolean;
  zoom: number;

  // actions
  setTool: (t: ToolId) => void;
  setBrushSize: (n: 1 | 2 | 3 | 4) => void;
  setActiveColor: (c: HexColor) => void;
  pushRecent: (c: HexColor) => void;
  swapFgBg: () => void;
  setActiveFrame: (id: string) => void;
  toggleOnion: () => void;
  toggleGrid: () => void;
  setZoom: (z: number) => void;

  // frame ops
  addFrame: () => void;
  duplicateFrame: (id: string) => void;
  deleteFrame: (id: string) => void;
  moveFrame: (id: string, toIndex: number) => void;
  flipActiveFrame: (axis: 'x' | 'y') => void;
  toggleFramePreview: (id: string) => void;

  // pixel commits (called by tools at pointer-up)
  commitPixelStroke: (frameId: string, diffs: history.PixelDiff[]) => void;

  // undo / redo
  undo: () => void;
  redo: () => void;

  // loading / initialization
  loadProject: (p: Project) => void;
  markClean: (version: number) => void;
  serialize: () => { frames: Frame[]; palette: ProjectPalette };
};

function activeBuffer(s: EditorState): PixelBuffer {
  const b = s.buffers.get(s.activeFrameId);
  if (!b) throw new Error('no active buffer');
  return b;
}

function bumpRev(set: (fn: (s: EditorState) => Partial<EditorState>) => void) {
  set((s) => ({ bufferRev: s.bufferRev + 1, dirty: true }));
}

function applyDiffs(buf: PixelBuffer, diffs: history.PixelDiff[], forward: boolean) {
  for (const d of diffs) {
    const c = forward ? d.after : d.before;
    buf.data[d.i] = c[0]!;
    buf.data[d.i + 1] = c[1]!;
    buf.data[d.i + 2] = c[2]!;
    buf.data[d.i + 3] = c[3]!;
  }
}

function flipBufferInPlace(buf: PixelBuffer, axis: 'x' | 'y') {
  const { width, height, data } = buf;
  if (axis === 'x') {
    const halfW = Math.floor(width / 2);
    for (let y = 0; y < height; y++) {
      const rowStart = y * width * 4;
      for (let x = 0; x < halfW; x++) {
        const iL = rowStart + x * 4;
        const iR = rowStart + (width - 1 - x) * 4;
        for (let k = 0; k < 4; k++) {
          const tmp = data[iL + k]!;
          data[iL + k] = data[iR + k]!;
          data[iR + k] = tmp;
        }
      }
    }
    return;
  }
  const rowBytes = width * 4;
  const halfH = Math.floor(height / 2);
  for (let y = 0; y < halfH; y++) {
    const iTop = y * rowBytes;
    const iBot = (height - 1 - y) * rowBytes;
    for (let k = 0; k < rowBytes; k++) {
      const tmp = data[iTop + k]!;
      data[iTop + k] = data[iBot + k]!;
      data[iBot + k] = tmp;
    }
  }
}

export const useEditor = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
    projectId: '',
    name: '',
    width: 0,
    height: 0,
    fps: 12,
    version: 0,
    dirty: false,

    frameOrder: [],
    frameMeta: {},
    activeFrameId: '',
    previewExcluded: new Set<string>(),
    buffers: new Map(),
    bufferRev: 0,

    palette: {
      name: BUILT_IN_PALETTES[0]!.name,
      colors: BUILT_IN_PALETTES[0]!.colors,
      recents: [],
    },
    activeColor: '#000000ff',

    tool: 'pencil',
    brushSize: 1,

    onionSkin: false,
    showGrid: true,
    zoom: 12,

    setTool: (t) => set({ tool: t }),
    setBrushSize: (n) => set({ brushSize: n }),
    setActiveColor: (c) => set({ activeColor: c }),
    pushRecent: (c) =>
      set((s) => {
        const next = [c, ...s.palette.recents.filter((x) => x !== c)].slice(0, 16);
        return { palette: { ...s.palette, recents: next }, dirty: true };
      }),
    swapFgBg: () =>
      set((s) => ({
        activeColor: s.palette.recents[1] ?? '#ffffffff',
        palette: s.activeColor ? { ...s.palette, recents: [s.activeColor, ...s.palette.recents.filter((x) => x !== s.activeColor)].slice(0, 16) } : s.palette,
      })),
    setActiveFrame: (id) => set({ activeFrameId: id }),
    toggleOnion: () => set((s) => ({ onionSkin: !s.onionSkin })),
    toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
    setZoom: (z) => set({ zoom: Math.max(1, Math.min(48, Math.round(z))) }),

    addFrame: () => {
      const { width, height, frameOrder, activeFrameId, buffers, frameMeta } = get();
      const id = randomUUID();
      buffers.set(id, new PixelBuffer(width, height));
      const idx = frameOrder.indexOf(activeFrameId);
      const nextOrder = [...frameOrder];
      nextOrder.splice(idx + 1, 0, id);
      set({
        frameOrder: nextOrder,
        frameMeta: { ...frameMeta, [id]: { durationMs: null } },
        activeFrameId: id,
        dirty: true,
      });
      bumpRev(set);
    },
    duplicateFrame: (id) => {
      const { width, height, frameOrder, buffers, frameMeta } = get();
      const src = buffers.get(id);
      if (!src) return;
      const newId = randomUUID();
      buffers.set(newId, new PixelBuffer(width, height, new Uint8ClampedArray(src.data)));
      const idx = frameOrder.indexOf(id);
      const nextOrder = [...frameOrder];
      nextOrder.splice(idx + 1, 0, newId);
      set({
        frameOrder: nextOrder,
        frameMeta: { ...frameMeta, [newId]: { durationMs: frameMeta[id]?.durationMs ?? null } },
        activeFrameId: newId,
        dirty: true,
      });
      bumpRev(set);
    },
    deleteFrame: (id) => {
      const { frameOrder, buffers, frameMeta, activeFrameId, previewExcluded } = get();
      if (frameOrder.length <= 1) return; // keep at least one
      const idx = frameOrder.indexOf(id);
      const nextOrder = frameOrder.filter((f) => f !== id);
      buffers.delete(id);
      const { [id]: _, ...restMeta } = frameMeta;
      const nextActive =
        activeFrameId === id
          ? nextOrder[Math.max(0, Math.min(idx, nextOrder.length - 1))]!
          : activeFrameId;
      const nextExcluded = previewExcluded.has(id)
        ? new Set([...previewExcluded].filter((f) => f !== id))
        : previewExcluded;
      set({
        frameOrder: nextOrder,
        frameMeta: restMeta,
        activeFrameId: nextActive,
        previewExcluded: nextExcluded,
        dirty: true,
      });
      bumpRev(set);
    },
    moveFrame: (id, toIndex) => {
      const { frameOrder } = get();
      const from = frameOrder.indexOf(id);
      if (from < 0) return;
      const next = [...frameOrder];
      next.splice(from, 1);
      next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, id);
      set({ frameOrder: next, dirty: true });
    },
    flipActiveFrame: (axis) => {
      const { activeFrameId, buffers } = get();
      const buf = buffers.get(activeFrameId);
      if (!buf) return;
      flipBufferInPlace(buf, axis);
      history.push({ kind: 'flip', frameId: activeFrameId, axis });
      bumpRev(set);
    },
    toggleFramePreview: (id) => {
      const next = new Set(get().previewExcluded);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      set({ previewExcluded: next });
    },

    commitPixelStroke: (frameId, diffs) => {
      if (diffs.length === 0) return;
      history.push({ kind: 'pixels', frameId, diffs });
      set({ dirty: true });
      bumpRev(set);
    },

    undo: () => {
      const cmd = history.popUndo();
      if (!cmd) return;
      if (cmd.kind === 'pixels') {
        const { buffers, activeFrameId } = get();
        const buf = buffers.get(cmd.frameId);
        if (!buf) return;
        applyDiffs(buf, cmd.diffs, false);
        if (activeFrameId !== cmd.frameId) set({ activeFrameId: cmd.frameId });
        bumpRev(set);
      } else if (cmd.kind === 'flip') {
        const { buffers, activeFrameId } = get();
        const buf = buffers.get(cmd.frameId);
        if (!buf) return;
        flipBufferInPlace(buf, cmd.axis);
        if (activeFrameId !== cmd.frameId) set({ activeFrameId: cmd.frameId });
        bumpRev(set);
      }
    },
    redo: () => {
      const cmd = history.popRedo();
      if (!cmd) return;
      if (cmd.kind === 'pixels') {
        const { buffers, activeFrameId } = get();
        const buf = buffers.get(cmd.frameId);
        if (!buf) return;
        applyDiffs(buf, cmd.diffs, true);
        if (activeFrameId !== cmd.frameId) set({ activeFrameId: cmd.frameId });
        bumpRev(set);
      } else if (cmd.kind === 'flip') {
        const { buffers, activeFrameId } = get();
        const buf = buffers.get(cmd.frameId);
        if (!buf) return;
        flipBufferInPlace(buf, cmd.axis);
        if (activeFrameId !== cmd.frameId) set({ activeFrameId: cmd.frameId });
        bumpRev(set);
      }
    },

    loadProject: (p) => {
      history.clear();
      const buffers: FrameBuffers = new Map();
      const frameMeta: Record<string, { durationMs: number | null }> = {};
      for (const f of p.frames) {
        const layer0 = f.layers[0];
        if (!layer0) throw new Error(`frame ${f.id} has no layers`);
        buffers.set(f.id, PixelBuffer.decode(p.width, p.height, layer0.pixels));
        frameMeta[f.id] = { durationMs: f.durationMs };
      }
      set({
        projectId: p.id,
        name: p.name,
        width: p.width,
        height: p.height,
        fps: p.fps,
        version: p.version,
        dirty: false,
        frameOrder: p.frames.map((f) => f.id),
        frameMeta,
        activeFrameId: p.frames[0]!.id,
        previewExcluded: new Set<string>(),
        buffers,
        palette: p.palette,
        bufferRev: 0,
      });
    },

    markClean: (version) => set({ dirty: false, version }),

    serialize: () => {
      const { frameOrder, frameMeta, buffers, palette } = get();
      const frames: Frame[] = frameOrder.map((id) => ({
        id,
        durationMs: frameMeta[id]?.durationMs ?? null,
        layers: [{ pixels: buffers.get(id)!.encode() }],
      }));
      return { frames, palette };
    },
  })),
);

// Helpers exported for tools
export function getActiveBuffer(): PixelBuffer {
  return activeBuffer(useEditor.getState());
}

export function activeColorRgba(): RGBA {
  return hexToRgba(useEditor.getState().activeColor);
}

export { hexToRgba, rgbaToHex, rgbaEqual };
