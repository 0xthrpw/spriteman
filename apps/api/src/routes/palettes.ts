import type { FastifyPluginAsync } from 'fastify';
import { and, eq, isNull, or, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db, schema } from '../db/client.js';
import {
  Palette,
  CreatePaletteRequest,
  UpdatePaletteRequest,
  ApiError,
} from '@spriteman/shared';

const IdParam = z.object({ id: z.string().uuid() });

function toDto(p: typeof schema.palettes.$inferSelect): z.infer<typeof Palette> {
  return {
    id: p.id,
    userId: p.userId,
    name: p.name,
    colors: p.colors,
    createdAt: p.createdAt.toISOString(),
  };
}

const palettesRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', async (req) => {
    req.requireUser();
  });

  app.get(
    '/',
    { schema: { response: { 200: z.array(Palette) } } },
    async (req) => {
      const userId = req.requireUser();
      const rows = await db
        .select()
        .from(schema.palettes)
        .where(or(eq(schema.palettes.userId, userId), isNull(schema.palettes.userId)))
        .orderBy(asc(schema.palettes.name));
      return rows.map(toDto);
    },
  );

  app.post(
    '/',
    { schema: { body: CreatePaletteRequest, response: { 200: Palette } } },
    async (req) => {
      const userId = req.requireUser();
      const body = req.body as z.infer<typeof CreatePaletteRequest>;
      const [row] = await db
        .insert(schema.palettes)
        .values({ userId, name: body.name, colors: body.colors })
        .returning();
      if (!row) throw new Error('failed to create palette');
      return toDto(row);
    },
  );

  app.put(
    '/:id',
    {
      schema: {
        params: IdParam,
        body: UpdatePaletteRequest,
        response: { 200: Palette, 404: ApiError },
      },
    },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const body = req.body as z.infer<typeof UpdatePaletteRequest>;
      const [row] = await db
        .update(schema.palettes)
        .set({ name: body.name, colors: body.colors })
        .where(and(eq(schema.palettes.id, id), eq(schema.palettes.userId, userId)))
        .returning();
      if (!row) return reply.code(404).send({ error: 'not_found' });
      return toDto(row);
    },
  );

  app.delete(
    '/:id',
    { schema: { params: IdParam, response: { 204: z.null(), 404: ApiError } } },
    async (req, reply) => {
      const userId = req.requireUser();
      const { id } = req.params as z.infer<typeof IdParam>;
      const result = await db
        .delete(schema.palettes)
        .where(and(eq(schema.palettes.id, id), eq(schema.palettes.userId, userId)))
        .returning({ id: schema.palettes.id });
      if (result.length === 0) return reply.code(404).send({ error: 'not_found' });
      return reply.code(204).send();
    },
  );
};

export default palettesRoutes;
