import { z } from 'zod';

// Hex color like #RRGGBB or #RRGGBBAA
export const HexColor = z.string().regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
export type HexColor = z.infer<typeof HexColor>;

// Base64-encoded deflated RGBA Uint8ClampedArray buffer.
// Decoded length MUST equal width*height*4. Validation of that happens at the
// call site once width/height are known (zod can't see them here).
export const CompressedPixels = z.string().min(1);
export type CompressedPixels = z.infer<typeof CompressedPixels>;

export const Layer = z.object({
  pixels: CompressedPixels,
});
export type Layer = z.infer<typeof Layer>;

export const Frame = z.object({
  id: z.string().uuid(),
  durationMs: z.number().int().positive().nullable(),
  layers: z.array(Layer).min(1),
});
export type Frame = z.infer<typeof Frame>;

export const ProjectPalette = z.object({
  name: z.string().max(64),
  colors: z.array(HexColor).max(256),
  recents: z.array(HexColor).max(32),
});
export type ProjectPalette = z.infer<typeof ProjectPalette>;

export const MIN_GRID = 1;
export const MAX_GRID = 256;

export const Project = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  width: z.number().int().min(MIN_GRID).max(MAX_GRID),
  height: z.number().int().min(MIN_GRID).max(MAX_GRID),
  fps: z.number().int().min(1).max(60),
  frames: z.array(Frame).min(1),
  palette: ProjectPalette,
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Project = z.infer<typeof Project>;

export const ProjectSummary = Project.pick({
  id: true,
  name: true,
  width: true,
  height: true,
  fps: true,
  version: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  frameCount: z.number().int().nonnegative(),
});
export type ProjectSummary = z.infer<typeof ProjectSummary>;

export const CreateProjectRequest = z.object({
  name: z.string().min(1).max(120),
  width: z.number().int().min(MIN_GRID).max(MAX_GRID),
  height: z.number().int().min(MIN_GRID).max(MAX_GRID),
  fps: z.number().int().min(1).max(60).default(12),
});
export type CreateProjectRequest = z.infer<typeof CreateProjectRequest>;

export const UpdateProjectRequest = Project.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  version: true,
});
export type UpdateProjectRequest = z.infer<typeof UpdateProjectRequest>;

export const RenameProjectRequest = Project.pick({ name: true });
export type RenameProjectRequest = z.infer<typeof RenameProjectRequest>;

export const Palette = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  name: z.string().min(1).max(64),
  colors: z.array(HexColor).min(1).max(256),
  createdAt: z.string().datetime(),
});
export type Palette = z.infer<typeof Palette>;

export const CreatePaletteRequest = Palette.pick({ name: true, colors: true });
export type CreatePaletteRequest = z.infer<typeof CreatePaletteRequest>;

export const UpdatePaletteRequest = CreatePaletteRequest;
export type UpdatePaletteRequest = z.infer<typeof UpdatePaletteRequest>;

export const RegisterRequest = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8).max(256),
});
export type RegisterRequest = z.infer<typeof RegisterRequest>;

export const LoginRequest = RegisterRequest;
export type LoginRequest = z.infer<typeof LoginRequest>;

export const PublicUser = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  createdAt: z.string().datetime(),
});
export type PublicUser = z.infer<typeof PublicUser>;

export const ApiError = z.object({
  error: z.string(),
  message: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiError>;

// Layout composition: dragging frames from any project onto a shared canvas.
export const LAYOUT_CANVAS_MIN = 16;
export const LAYOUT_CANVAS_MAX = 2048;
export const LAYOUT_SNAP_GRID_VALUES = [8, 16, 24, 32] as const;

export const LayoutRotation = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
export type LayoutRotation = z.infer<typeof LayoutRotation>;

export const LayoutSnapGrid = z.union([z.literal(8), z.literal(16), z.literal(24), z.literal(32)]);
export type LayoutSnapGrid = z.infer<typeof LayoutSnapGrid>;

export const LayoutPlacement = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  frameId: z.string().uuid(),
  x: z.number().int(),
  y: z.number().int(),
  rotation: LayoutRotation,
  flipX: z.boolean(),
  flipY: z.boolean(),
});
export type LayoutPlacement = z.infer<typeof LayoutPlacement>;

export const Layout = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(120),
  canvasWidth: z.number().int().min(LAYOUT_CANVAS_MIN).max(LAYOUT_CANVAS_MAX),
  canvasHeight: z.number().int().min(LAYOUT_CANVAS_MIN).max(LAYOUT_CANVAS_MAX),
  snapGrid: LayoutSnapGrid,
  // Array order is z-order: index 0 = back, last = front.
  placements: z.array(LayoutPlacement),
  version: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Layout = z.infer<typeof Layout>;

export const LayoutSummary = Layout.pick({
  id: true,
  name: true,
  canvasWidth: true,
  canvasHeight: true,
  snapGrid: true,
  version: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  placementCount: z.number().int().nonnegative(),
});
export type LayoutSummary = z.infer<typeof LayoutSummary>;

export const CreateLayoutRequest = z.object({
  name: z.string().min(1).max(120),
  canvasWidth: z.number().int().min(LAYOUT_CANVAS_MIN).max(LAYOUT_CANVAS_MAX),
  canvasHeight: z.number().int().min(LAYOUT_CANVAS_MIN).max(LAYOUT_CANVAS_MAX),
  snapGrid: LayoutSnapGrid,
});
export type CreateLayoutRequest = z.infer<typeof CreateLayoutRequest>;

export const UpdateLayoutRequest = Layout.pick({
  name: true,
  canvasWidth: true,
  canvasHeight: true,
  snapGrid: true,
  placements: true,
});
export type UpdateLayoutRequest = z.infer<typeof UpdateLayoutRequest>;

// Built-in palette presets (curated pixel-art friendly)
export const BUILT_IN_PALETTES: Array<{ name: string; colors: HexColor[] }> = [
  {
    name: 'PICO-8',
    colors: [
      '#000000ff', '#1D2B53ff', '#7E2553ff', '#008751ff',
      '#AB5236ff', '#5F574Fff', '#C2C3C7ff', '#FFF1E8ff',
      '#FF004Dff', '#FFA300ff', '#FFEC27ff', '#00E436ff',
      '#29ADFFff', '#83769Cff', '#FF77A8ff', '#FFCCAAff',
    ],
  },
  {
    name: 'Sweetie 16',
    colors: [
      '#1a1c2cff', '#5d275dff', '#b13e53ff', '#ef7d57ff',
      '#ffcd75ff', '#a7f070ff', '#38b764ff', '#257179ff',
      '#29366fff', '#3b5dc9ff', '#41a6f6ff', '#73eff7ff',
      '#f4f4f4ff', '#94b0c2ff', '#566c86ff', '#333c57ff',
    ],
  },
  {
    name: 'Grayscale',
    colors: [
      '#000000ff', '#111111ff', '#222222ff', '#333333ff',
      '#444444ff', '#555555ff', '#666666ff', '#777777ff',
      '#888888ff', '#999999ff', '#aaaaaaff', '#bbbbbbff',
      '#ccccccff', '#ddddddff', '#eeeeeeff', '#ffffffff',
    ],
  },
];
