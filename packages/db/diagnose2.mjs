/* eslint-disable */
import pg from 'pg';
import fs from 'fs';
const c = new pg.Client(process.env.DATABASE_URL);
await c.connect();

// Does 0053 column exist? (client_approval_status on copywriting)
const col = await c.query(
  "SELECT column_name FROM information_schema.columns WHERE table_name='copywriting' AND column_name='client_approval_status'",
);
console.log('0053 applied (copywriting.client_approval_status):', col.rowCount > 0);

// What hashes are in the journal, newest first
const rows = await c.query(
  'SELECT id, hash FROM drizzle.__drizzle_migrations ORDER BY id DESC LIMIT 10',
);
const journalFile = JSON.parse(fs.readFileSync('drizzle/meta/_journal.json', 'utf8'));
console.log('\nJournal file entries (last 5):');
console.table(journalFile.entries.slice(-5));
console.log('\nDB journal rows (last 10):');
console.table(rows.rows);
await c.end();
