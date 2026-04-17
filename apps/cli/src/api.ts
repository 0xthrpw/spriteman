import type {
  Project,
  ProjectSummary,
  PublicUser,
  UpdateProjectRequest,
  CreateProjectRequest,
  Palette,
  CreatePaletteRequest,
} from '@spriteman/shared';
import { ConflictError, createClient, type Client } from './client.js';

export type { Client };
export { createClient };

// ---- Auth ----
export const me = async (c: Client): Promise<PublicUser> => (await c.get<PublicUser>('/auth/me')).data;
export const logout = async (c: Client): Promise<void> => {
  await c.post<void>('/auth/logout');
};

// ---- Projects ----
export const listProjects = async (c: Client): Promise<ProjectSummary[]> =>
  (await c.get<ProjectSummary[]>('/projects/')).data;

export const getProject = async (c: Client, id: string): Promise<Project> =>
  (await c.get<Project>(`/projects/${id}`)).data;

export const createProject = async (c: Client, body: CreateProjectRequest): Promise<Project> =>
  (await c.post<Project>('/projects/', body)).data;

export const deleteProject = async (c: Client, id: string): Promise<void> => {
  await c.del<void>(`/projects/${id}`);
};

export const updateProject = async (
  c: Client,
  id: string,
  body: UpdateProjectRequest,
  version: number,
): Promise<Project> => (await c.put<Project>(`/projects/${id}`, body, version)).data;

/**
 * GET → mutate → PUT pattern with automatic 409 retry: refetches the project
 * and replays the mutator. `mutate` MUST be idempotent in this sense.
 */
export const mutateProject = async (
  c: Client,
  id: string,
  mutate: (p: Project) => UpdateProjectRequest,
  attempts = 3,
): Promise<Project> => {
  for (let i = 0; i < attempts; i++) {
    const current = await getProject(c, id);
    const next = mutate(current);
    try {
      return await updateProject(c, id, next, current.version);
    } catch (err) {
      if (err instanceof ConflictError && i < attempts - 1) continue;
      throw err;
    }
  }
  throw new Error('mutateProject exhausted retries');
};

// ---- Palettes ----
export const listPalettes = async (c: Client): Promise<Palette[]> =>
  (await c.get<Palette[]>('/palettes/')).data;

export const createPalette = async (c: Client, body: CreatePaletteRequest): Promise<Palette> =>
  (await c.post<Palette>('/palettes/', body)).data;
