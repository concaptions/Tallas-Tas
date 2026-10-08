/* eslint-disable */
import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const j = await c.query(
  'SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY created_at DESC LIMIT 5',
);
console.log('Last 5 journal rows:');
console.table(j.rows);
const r = await c.query(
  "SELECT to_regclass('public.creator_registry') AS creator_registry, to_regclass('public.client_access_tokens') AS client_access_tokens",
);
console.log('Tables:');
console.table(r.rows);
const cols = await c.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='creators' AND column_name='registry_creator_id'",
);
console.log('creators.registry_creator_id exists:', cols.rowCount > 0);
await c.end();
