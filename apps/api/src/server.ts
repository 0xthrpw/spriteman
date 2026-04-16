import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { env } from './config.js';
import authPlugin from './plugins/auth.js';
import authRoutes from './routes/auth.js';
import projectsRoutes from './routes/projects.js';
import palettesRoutes from './routes/palettes.js';

async function build() {
  const app = Fastify({
    logger: { level: env.NODE_ENV === 'production' ? 'info' : 'debug' },
  }).withTypeProvider<ZodTypeProvider>();

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(cors, {
    origin: env.CORS_ORIGIN,
    credentials: true,
  });

  await app.register(authPlugin);

  app.setErrorHandler((err, _req, reply) => {
    const status = (err as any).statusCode ?? 500;
    app.log.error({ err }, 'request failed');
    if (status >= 500) {
      return reply.code(500).send({ error: 'internal_error' });
    }
    return reply.code(status).send({ error: err.message || 'error' });
  });

  app.get('/health', async () => ({ ok: true }));

  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(projectsRoutes, { prefix: '/projects' });
  await app.register(palettesRoutes, { prefix: '/palettes' });

  return app;
}

async function main() {
  const app = await build();
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
