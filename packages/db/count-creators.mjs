/* eslint-disable */
import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const r = await c.query(
  'SELECT COUNT(*) AS total, COUNT(DISTINCT brand_id) AS brands, COUNT(instagram_username) AS with_ig FROM creators WHERE deleted_at IS NULL',
);
console.table(r.rows);
await c.end();
