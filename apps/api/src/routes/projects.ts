import type { FastifyPluginAsync } from 'fastify';
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { db, schema } from '../db/client.js';
import {
  CreateProjectRequest,
  UpdateProjectRequest,
  Project,
  ProjectSummary,
  ApiError,
  BUILT_IN_PALETTES,
} from '@spriteman/shared';
import { makeBlankFrame } from '../lib/blankFrame.js';

const IdParam = z.object({ id: z.string().uuid() });

function toProjectDto(p: typeof schema.projects.$inferSelect): z.infer<typeof Project> {
  return {
    id: p.id,
    name: p.name,
    width: p.width,
    height: p.height,
    fps: p.fps,
    frames: p.frames,
    palette: p.palette,
    version: p.version,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

const projectsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req) => {
    req.requireUser();
  });

  app.get(
    '/',
    {
      schema: {
        response: {
          200: z.array(ProjectSummary),
        },
      },
    },
    async (req) => {
      const userId = req.requireUser();
      const rows = await db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          width: schema.projects.width,
          height: schema.projects.height,
          fps: schema.projects.fps,
          version: schema.projects.version,
          createdAt: schema.projects.createdAt,
          updatedAt: schema.projects.updatedAt,
          frames: schema.projects.frames,
        })
        .from(schema.projects)
        .where(eq(schema.projects.userId, userId))
        .orderBy(desc(schema.projects.updatedAt));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        width: r.width,
        height: r.height,
        fps: r.fps,
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        frameCount: r.frames.length,
      }));
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateProjectRequest,
        response: { 200: Project },
      },
    },
    async (req) => {
      const userId = req.requireUser();
      const body = req.body as z.infer<typeof CreateProjectRequest>;
      const firstFrame = await makeBlankFrame(body.width, body.height);
      const palette = BUILT_IN_PALETTES[0]!;
      const [row] = await db
        .insert(schema.projects)
        .values({
          userId,
          name: body.name,
          width: body.width,
          height: body.height,
          fps: body.fps,
          frames: [{ id: randomUUID(), durationMs: null, layers: [{ pixels: firstFrame }] }],
          palette: { name: palette.name, colors: palette.colors, recents: [] },
          version: 0,
        })
        .returning();
      if (!row) throw new Error('failed to create project');
      return toProjectDto(row);
    },
  );

  app.post(
    '/:id/duplicate',
    {
      schema: {
        params: IdParam,
        response: { 200: Project, 404: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const src = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)),
      });
      if (!src) return reply.code(404).send({ error: 'not_found' });
      const [row] = await db
        .insert(schema.projects)
        .values({
          userId,
          name: `${src.name} (copy)`.slice(0, 120),
          width: src.width,
          height: src.height,
          fps: src.fps,
          frames: src.frames.map((f) => ({ ...f, id: randomUUID() })),
          palette: src.palette,
          version: 0,
        })
        .returning();
      if (!row) throw new Error('failed to duplicate project');
      return toProjectDto(row);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: IdParam,
        response: { 200: Project, 404: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const row = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)),
      });
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return toProjectDto(row);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: IdParam,
        body: UpdateProjectRequest,
        response: { 200: Project, 404: ApiError, 409: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const body = req.body as z.infer<typeof UpdateProjectRequest>;
      const ifMatch = req.headers['if-match'];
      const existing = await db.query.projects.findFirst({
        where: and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)),
      });
      if (!existing) return reply.code(404).send({ error: 'not_found' });
      if (ifMatch !== undefined && String(existing.version) !== String(ifMatch)) {
        return reply
          .code(409)
          .header('ETag', String(existing.version))
          .send({ error: 'version_mismatch', message: `server has version ${existing.version}` });
      }
      const [row] = await db
        .update(schema.projects)
        .set({
          name: body.name,
          width: body.width,
          height: body.height,
          fps: body.fps,
          frames: body.frames,
          palette: body.palette,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, id))
        .returning();
      if (!row) throw new Error('failed to update project');
      return reply.header('ETag', String(row.version)).send(toProjectDto(row));
    },
  );

  app.delete(
    '/:id',
    {
      schema: {
        params: IdParam,
        response: { 204: z.null(), 404: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const result = await db
        .delete(schema.projects)
        .where(and(eq(schema.projects.id, id), eq(schema.projects.userId, userId)))
        .returning({ id: schema.projects.id });
      if (result.length === 0) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
};

export default projectsRoutes;
