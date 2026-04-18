import type { FastifyPluginAsync } from 'fastify';
import { and, eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/client.js';
import {
  CreateLayoutRequest,
  UpdateLayoutRequest,
  Layout,
  LayoutSummary,
  ApiError,
} from '@spriteman/shared';

const IdParam = z.object({ id: z.string().uuid() });

function toLayoutDto(l: typeof schema.layouts.$inferSelect): z.infer<typeof Layout> {
  return {
    id: l.id,
    name: l.name,
    canvasWidth: l.canvasWidth,
    canvasHeight: l.canvasHeight,
    snapGrid: l.snapGrid as z.infer<typeof Layout>['snapGrid'],
    placements: l.placements,
    version: l.version,
    createdAt: l.createdAt.toISOString(),
    updatedAt: l.updatedAt.toISOString(),
  };
}

const layoutsRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req) => {
    req.requireUser();
  });

  app.get(
    '/',
    {
      schema: {
        response: {
          200: z.array(LayoutSummary),
        },
      },
    },
    async (req) => {
      const userId = req.requireUser();
      const rows = await db
        .select({
          id: schema.layouts.id,
          name: schema.layouts.name,
          canvasWidth: schema.layouts.canvasWidth,
          canvasHeight: schema.layouts.canvasHeight,
          snapGrid: schema.layouts.snapGrid,
          version: schema.layouts.version,
          createdAt: schema.layouts.createdAt,
          updatedAt: schema.layouts.updatedAt,
          placements: schema.layouts.placements,
        })
        .from(schema.layouts)
        .where(eq(schema.layouts.userId, userId))
        .orderBy(desc(schema.layouts.updatedAt));
      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        canvasWidth: r.canvasWidth,
        canvasHeight: r.canvasHeight,
        snapGrid: r.snapGrid as z.infer<typeof LayoutSummary>['snapGrid'],
        version: r.version,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        placementCount: r.placements.length,
      }));
    },
  );

  app.post(
    '/',
    {
      schema: {
        body: CreateLayoutRequest,
        response: { 200: Layout },
      },
    },
    async (req) => {
      const userId = req.requireUser();
      const body = req.body as z.infer<typeof CreateLayoutRequest>;
      const [row] = await db
        .insert(schema.layouts)
        .values({
          userId,
          name: body.name,
          canvasWidth: body.canvasWidth,
          canvasHeight: body.canvasHeight,
          snapGrid: body.snapGrid,
          placements: [],
          version: 0,
        })
        .returning();
      if (!row) throw new Error('failed to create layout');
      return toLayoutDto(row);
    },
  );

  app.get(
    '/:id',
    {
      schema: {
        params: IdParam,
        response: { 200: Layout, 404: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const row = await db.query.layouts.findFirst({
        where: and(eq(schema.layouts.id, id), eq(schema.layouts.userId, userId)),
      });
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return toLayoutDto(row);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: IdParam,
        body: UpdateLayoutRequest,
        response: { 200: Layout, 404: ApiError, 409: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const body = req.body as z.infer<typeof UpdateLayoutRequest>;
      const ifMatch = req.headers['if-match'];
      const existing = await db.query.layouts.findFirst({
        where: and(eq(schema.layouts.id, id), eq(schema.layouts.userId, userId)),
      });
      if (!existing) return reply.code(404).send({ error: 'not_found' });
      if (ifMatch !== undefined && String(existing.version) !== String(ifMatch)) {
        return reply
          .code(409)
          .header('ETag', String(existing.version))
          .send({ error: 'version_mismatch', message: `server has version ${existing.version}` });
      }
      const [row] = await db
        .update(schema.layouts)
        .set({
          name: body.name,
          canvasWidth: body.canvasWidth,
          canvasHeight: body.canvasHeight,
          snapGrid: body.snapGrid,
          placements: body.placements,
          version: existing.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(schema.layouts.id, id))
        .returning();
      if (!row) throw new Error('failed to update layout');
      return reply.header('ETag', String(row.version)).send(toLayoutDto(row));
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
        .delete(schema.layouts)
        .where(and(eq(schema.layouts.id, id), eq(schema.layouts.userId, userId)))
        .returning({ id: schema.layouts.id });
      if (result.length === 0) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
};

export default layoutsRoutes;
