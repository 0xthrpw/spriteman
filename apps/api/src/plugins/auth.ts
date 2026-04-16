import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import session from '@fastify/session';
import { env } from '../config.js';

declare module 'fastify' {
  interface Session {
    userId?: string;
  }
  interface FastifyRequest {
    requireUser: () => string;
  }
}

const plugin: FastifyPluginAsync = async (app) => {
  await app.register(cookie);
  await app.register(session, {
    secret: env.SESSION_SECRET,
    cookieName: 'spriteman_sid',
    cookie: {
      httpOnly: true,
      secure: env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
      path: '/',
    },
    saveUninitialized: false,
  });

  app.decorateRequest('requireUser', function () {
    const id = (this as any).session?.userId as string | undefined;
    if (!id) {
      const err = new Error('unauthorized');
      (err as any).statusCode = 401;
      throw err;
    }
    return id;
  });
};

export default fp(plugin, { name: 'auth' });
