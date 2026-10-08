import pg from 'pg';
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();
const reg = await c.query(
  'SELECT COUNT(*) AS registry_total, COUNT(DISTINCT normalized_instagram) AS unique_ig FROM creator_registry',
);
const linked = await c.query(
  'SELECT COUNT(*) AS linked, COUNT(*) FILTER (WHERE registry_creator_id IS NULL) AS unlinked FROM creators WHERE deleted_at IS NULL',
);
console.log('Registry:');
console.table(reg.rows);
console.log('Creators link status:');
console.table(linked.rows);
await c.end();
