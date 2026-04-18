import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { randomUUID } from '../lib/uuid.js';
import type { Layout, LayoutPlacement, LayoutSnapGrid } from '@spriteman/shared';
import { PixelBuffer } from '@spriteman/pixel';

export type BufferKey = `${string}:${string}`; // `${projectId}:${frameId}`
export function bufferKey(projectId: string, frameId: string): BufferKey {
  return `${projectId}:${frameId}`;
}

type ProjectMeta = { width: number; height: number };

export type LayoutState = {
  // identity / persistence
  layoutId: string;
  name: string;
  canvasWidth: number;
  canvasHeight: number;
  snapGrid: LayoutSnapGrid;
  version: number;
  dirty: boolean;

  // composition (array order = z-order; last = front)
  placements: LayoutPlacement[];
  selectedPlacementId: string | null;

  // decoded pixel data and per-project dimensions for referenced frames
  buffers: Map<BufferKey, PixelBuffer>;
  projectMeta: Map<string, ProjectMeta>;
  bufferRev: number;

  // view state (ephemeral — not persisted to backend)
  viewZoom: number;
  activeStamp: { projectId: string; frameId: string } | null;

  // actions
  loadLayout: (l: Layout) => void;
  markClean: (version: number) => void;
  serialize: () => {
    name: string;
    canvasWidth: number;
    canvasHeight: number;
    snapGrid: LayoutSnapGrid;
    placements: LayoutPlacement[];
  };

  setName: (name: string) => void;
  setCanvasSize: (w: number, h: number) => void;
  setSnapGrid: (g: LayoutSnapGrid) => void;

  registerProject: (projectId: string, meta: ProjectMeta) => void;
  registerBuffer: (projectId: string, frameId: string, buf: PixelBuffer) => void;

  addPlacement: (args: { projectId: string; frameId: string; x: number; y: number }) => void;
  movePlacement: (id: string, x: number, y: number) => void;
  rotatePlacement: (id: string) => void;
  flipPlacement: (id: string, axis: 'x' | 'y') => void;
  deletePlacement: (id: string) => void;
  sendForward: (id: string) => void;
  sendBackward: (id: string) => void;
  sendToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  selectPlacement: (id: string | null) => void;

  setViewZoom: (z: number) => void;
  zoomViewIn: () => void;
  zoomViewOut: () => void;

  setActiveStamp: (stamp: { projectId: string; frameId: string } | null) => void;
  toggleActiveStamp: (stamp: { projectId: string; frameId: string }) => void;
};

export const ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 8;

export function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}
function nextZoomLevel(z: number, dir: 1 | -1): number {
  if (dir === 1) {
    const above = ZOOM_LEVELS.find((v) => v > z + 0.001);
    return above ?? ZOOM_MAX;
  }
  const below = [...ZOOM_LEVELS].reverse().find((v) => v < z - 0.001);
  return below ?? ZOOM_MIN;
}

function bump(set: (fn: (s: LayoutState) => Partial<LayoutState>) => void) {
  set((s) => ({ bufferRev: s.bufferRev + 1 }));
}

export const useLayout = create<LayoutState>()(
  subscribeWithSelector((set, get) => ({
    layoutId: '',
    name: '',
    canvasWidth: 0,
    canvasHeight: 0,
    snapGrid: 16,
    version: 0,
    dirty: false,

    placements: [],
    selectedPlacementId: null,

    buffers: new Map(),
    projectMeta: new Map(),
    bufferRev: 0,

    viewZoom: 1,
    activeStamp: null,

    loadLayout: (l) => {
      set({
        layoutId: l.id,
        name: l.name,
        canvasWidth: l.canvasWidth,
        canvasHeight: l.canvasHeight,
        snapGrid: l.snapGrid,
        version: l.version,
        dirty: false,
        placements: l.placements,
        selectedPlacementId: null,
        buffers: new Map(),
        projectMeta: new Map(),
        bufferRev: 0,
        viewZoom: 1,
        activeStamp: null,
      });
    },

    markClean: (version) => set({ dirty: false, version }),

    serialize: () => {
      const s = get();
      return {
        name: s.name,
        canvasWidth: s.canvasWidth,
        canvasHeight: s.canvasHeight,
        snapGrid: s.snapGrid,
        placements: s.placements,
      };
    },

    setName: (name) => set({ name, dirty: true }),
    setCanvasSize: (w, h) => set({ canvasWidth: w, canvasHeight: h, dirty: true }),
    setSnapGrid: (g) => set({ snapGrid: g, dirty: true }),

    registerProject: (projectId, meta) => {
      const { projectMeta } = get();
      if (projectMeta.get(projectId)?.width === meta.width && projectMeta.get(projectId)?.height === meta.height) {
        return;
      }
      projectMeta.set(projectId, meta);
      bump(set);
    },
    registerBuffer: (projectId, frameId, buf) => {
      const { buffers } = get();
      const key = bufferKey(projectId, frameId);
      if (buffers.get(key) === buf) return;
      buffers.set(key, buf);
      bump(set);
    },

    addPlacement: ({ projectId, frameId, x, y }) => {
      const id = randomUUID();
      const placement: LayoutPlacement = {
        id,
        projectId,
        frameId,
        x,
        y,
        rotation: 0,
        flipX: false,
        flipY: false,
      };
      set((s) => ({
        placements: [...s.placements, placement],
        selectedPlacementId: id,
        dirty: true,
      }));
    },

    movePlacement: (id, x, y) => {
      set((s) => ({
        placements: s.placements.map((p) => (p.id === id ? { ...p, x, y } : p)),
        dirty: true,
      }));
    },

    rotatePlacement: (id) => {
      set((s) => ({
        placements: s.placements.map((p) =>
          p.id === id ? { ...p, rotation: (((p.rotation + 90) % 360) as LayoutPlacement['rotation']) } : p,
        ),
        dirty: true,
      }));
    },

    flipPlacement: (id, axis) => {
      set((s) => ({
        placements: s.placements.map((p) =>
          p.id === id
            ? axis === 'x'
              ? { ...p, flipX: !p.flipX }
              : { ...p, flipY: !p.flipY }
            : p,
        ),
        dirty: true,
      }));
    },

    deletePlacement: (id) => {
      set((s) => ({
        placements: s.placements.filter((p) => p.id !== id),
        selectedPlacementId: s.selectedPlacementId === id ? null : s.selectedPlacementId,
        dirty: true,
      }));
    },

    sendForward: (id) => {
      set((s) => {
        const i = s.placements.findIndex((p) => p.id === id);
        if (i < 0 || i === s.placements.length - 1) return {};
        const next = [...s.placements];
        const [p] = next.splice(i, 1);
        next.splice(i + 1, 0, p!);
        return { placements: next, dirty: true };
      });
    },
    sendBackward: (id) => {
      set((s) => {
        const i = s.placements.findIndex((p) => p.id === id);
        if (i <= 0) return {};
        const next = [...s.placements];
        const [p] = next.splice(i, 1);
        next.splice(i - 1, 0, p!);
        return { placements: next, dirty: true };
      });
    },
    sendToFront: (id) => {
      set((s) => {
        const i = s.placements.findIndex((p) => p.id === id);
        if (i < 0 || i === s.placements.length - 1) return {};
        const next = [...s.placements];
        const [p] = next.splice(i, 1);
        next.push(p!);
        return { placements: next, dirty: true };
      });
    },
    sendToBack: (id) => {
      set((s) => {
        const i = s.placements.findIndex((p) => p.id === id);
        if (i <= 0) return {};
        const next = [...s.placements];
        const [p] = next.splice(i, 1);
        next.unshift(p!);
        return { placements: next, dirty: true };
      });
    },

    selectPlacement: (id) => set({ selectedPlacementId: id }),

    setViewZoom: (z) => set({ viewZoom: clampZoom(z) }),
    zoomViewIn: () => set((s) => ({ viewZoom: nextZoomLevel(s.viewZoom, 1) })),
    zoomViewOut: () => set((s) => ({ viewZoom: nextZoomLevel(s.viewZoom, -1) })),

    setActiveStamp: (stamp) => set({ activeStamp: stamp }),
    toggleActiveStamp: (stamp) =>
      set((s) => ({
        activeStamp:
          s.activeStamp?.projectId === stamp.projectId && s.activeStamp.frameId === stamp.frameId
            ? null
            : stamp,
      })),
  })),
);

// Compute the top-left placement position so that the sprite center lands at (px, py),
// with the top-left snapped to the layout's grid.
export function computeStampPosition(
  pointerX: number,
  pointerY: number,
  frameWidth: number,
  frameHeight: number,
  grid: number,
): { x: number; y: number } {
  const x = snapToGrid(pointerX - Math.floor(frameWidth / 2), grid);
  const y = snapToGrid(pointerY - Math.floor(frameHeight / 2), grid);
  return { x, y };
}

// Snap a canvas pixel coordinate to the current snap grid.
export function snapToGrid(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}
