/* eslint-disable */
import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const r = await c.query(
  "SELECT table_name, column_name FROM information_schema.columns WHERE column_name LIKE 'client_approval%' ORDER BY table_name, column_name",
);
console.table(r.rows);
await c.end();
