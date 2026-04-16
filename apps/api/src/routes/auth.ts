import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { db, schema } from '../db/client.js';
import { RegisterRequest, LoginRequest, PublicUser, ApiError } from '@spriteman/shared';

const authRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/register',
    {
      schema: {
        body: RegisterRequest,
        response: {
          200: PublicUser,
          409: ApiError,
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as z.infer<typeof RegisterRequest>;
      const existing = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (existing) {
        return reply.code(409).send({ error: 'email_in_use' });
      }
      const passwordHash = await argon2.hash(password);
      const [row] = await db
        .insert(schema.users)
        .values({ email, passwordHash })
        .returning();
      if (!row) throw new Error('failed to create user');
      req.session.userId = row.id;
      return { id: row.id, email: row.email, createdAt: row.createdAt.toISOString() };
    },
  );

  app.post(
    '/login',
    {
      schema: {
        body: LoginRequest,
        response: {
          200: PublicUser,
          401: ApiError,
        },
      },
    },
    async (req, reply) => {
      const { email, password } = req.body as z.infer<typeof LoginRequest>;
      const user = await db.query.users.findFirst({ where: eq(schema.users.email, email) });
      if (!user || !(await argon2.verify(user.passwordHash, password))) {
        return reply.code(401).send({ error: 'invalid_credentials' });
      }
      req.session.userId = user.id;
      return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
    },
  );

  app.post('/logout', async (req, reply) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
    return reply.code(204).send();
  });

  app.get(
    '/me',
    {
      schema: {
        response: {
          200: PublicUser,
          401: ApiError,
        },
      },
    },
    async (req, reply) => {
      const userId = req.session.userId;
      if (!userId) return reply.code(401).send({ error: 'unauthorized' });
      const user = await db.query.users.findFirst({ where: eq(schema.users.id, userId) });
      if (!user) return reply.code(401).send({ error: 'unauthorized' });
      return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
    },
  );
};

export default authRoutes;
