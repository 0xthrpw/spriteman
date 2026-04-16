import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { env } from '../config.js';

const migrationClient = postgres(env.DATABASE_URL, { max: 1 });

async function main() {
  await migrate(drizzle(migrationClient), { migrationsFolder: './src/db/migrations' });
  await migrationClient.end();
  console.log('migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
