// One-time, verified copy of SceneSignal account data between PostgreSQL
// databases (for example an expiring Render preview database to Neon).
//
// - The target schema is created by the application's own migration first;
//   this tool never creates or alters tables.
// - Source rows are read in one REPEATABLE READ, READ ONLY snapshot; target rows
//   are written in one transaction that commits only if every table's row count
//   matches. Values travel in PostgreSQL text form, so timestamps, numerics and
//   bytea are preserved exactly.
// - It refuses to write if any target table already has rows (idempotent restart).
// - Logs contain table names and row counts only, never values or credentials.
import pg from 'pg';

const MAX_ROWS = 1_000_000;
const BATCH = 200;
const quote = name => '"' + String(name).replaceAll('"', '""') + '"';

export async function listTables(client) {
  const { rows } = await client.query(`
    SELECT c.oid, c.relname AS name FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND NOT c.relispartition ORDER BY c.relname`);
  const { rows: edges } = await client.query(`
    SELECT conrelid::regclass::text AS child, confrelid::regclass::text AS parent FROM pg_constraint
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace AND conrelid <> confrelid`);
  const names = rows.map(row => row.name);
  const unquote = value => value.startsWith('"') ? value.slice(1, -1).replaceAll('""', '"') : value;
  const parents = new Map(names.map(name => [name, new Set()]));
  for (const edge of edges) parents.get(unquote(edge.child))?.add(unquote(edge.parent));
  const ordered = [], done = new Set();
  while (ordered.length < names.length) {
    const ready = names.filter(name => !done.has(name) && [...parents.get(name)].every(parent => done.has(parent) || !parents.has(parent)));
    if (!ready.length) throw Error('COPY_FOREIGN_KEY_CYCLE');
    for (const name of ready) { done.add(name); ordered.push(name); }
  }
  return ordered;
}

async function columns(client, table) {
  const { rows } = await client.query(`
    SELECT a.attname AS name FROM pg_attribute a
    WHERE a.attrelid = $1::regclass AND a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = ''
    ORDER BY a.attnum`, [quote(table)]);
  return rows.map(row => row.name);
}

export async function copyDatabase({ source, target, log = () => {} }) {
  await source.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  let targetOpen = false;
  try {
    const tables = await listTables(source);
    const targetTables = new Set(await listTables(target));
    const missing = tables.filter(table => !targetTables.has(table));
    if (missing.length) throw Error('COPY_TARGET_SCHEMA_MISSING_TABLES: ' + missing.join(','));
    for (const table of targetTables) {
      const { rows } = await target.query(`SELECT EXISTS (SELECT 1 FROM ${quote(table)}) AS present`);
      if (rows[0].present) { log({ status: 'skipped', reason: 'target-not-empty', table }); return { status: 'skipped', tables: {} }; }
    }
    await target.query('BEGIN'); targetOpen = true;
    const counts = {};
    for (const table of tables) {
      const sourceColumns = await columns(source, table);
      const targetColumns = new Set(await columns(target, table));
      const absent = sourceColumns.filter(column => !targetColumns.has(column));
      if (absent.length) throw Error('COPY_TARGET_SCHEMA_MISSING_COLUMNS: ' + table);
      const list = sourceColumns.map(quote).join(', ');
      const { rows } = await source.query({ text: `SELECT ${sourceColumns.map(column => quote(column) + '::text').join(', ')} FROM ${quote(table)}`, rowMode: 'array' });
      if (rows.length > MAX_ROWS) throw Error('COPY_TABLE_TOO_LARGE: ' + table);
      for (let start = 0; start < rows.length; start += BATCH) {
        const batch = rows.slice(start, start + BATCH);
        const values = batch.map((row, r) => '(' + row.map((_, c) => '$' + (r * row.length + c + 1)).join(', ') + ')').join(', ');
        await target.query(`INSERT INTO ${quote(table)} (${list}) OVERRIDING SYSTEM VALUE VALUES ${values}`, batch.flat());
      }
      const { rows: [{ count }] } = await target.query(`SELECT count(*)::int AS count FROM ${quote(table)}`);
      if (count !== rows.length) throw Error('COPY_ROW_COUNT_MISMATCH: ' + table);
      counts[table] = count;
      // Advance owned sequences past copied values so new rows cannot collide.
      for (const column of sourceColumns) {
        const { rows: [{ sequence }] } = await target.query('SELECT pg_get_serial_sequence($1, $2) AS sequence', [quote(table), column]);
        if (sequence) await target.query(`SELECT setval($1, COALESCE((SELECT max(${quote(column)}) FROM ${quote(table)}), 1), (SELECT count(*) > 0 FROM ${quote(table)}))`, [sequence]);
      }
    }
    await target.query('COMMIT'); targetOpen = false;
    log({ status: 'copied', tables: counts });
    return { status: 'copied', tables: counts };
  } catch (error) {
    if (targetOpen) { try { await target.query('ROLLBACK'); } catch { /* preserve copy failure */ } }
    throw error;
  } finally {
    try { await source.query('ROLLBACK'); } catch { /* read-only snapshot */ }
  }
}

/** Connect with the same certificate policy as the service: verify-full for
 * any non-local host. */
export function clientFor(connectionString) {
  const url = new URL(connectionString);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw Error('INVALID_DATABASE_URL');
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  url.searchParams.delete('sslmode'); url.searchParams.delete('channel_binding');
  return new pg.Client({ connectionString: url.href, connectionTimeoutMillis: 10000,
    ...(local ? {} : { ssl: { rejectUnauthorized: true } }) });
}

export async function copyFromUrls(sourceUrl, targetUrl, log) {
  const source = clientFor(sourceUrl), target = clientFor(targetUrl);
  await source.connect();
  try { await target.connect(); return await copyDatabase({ source, target, log }); }
  finally { await Promise.allSettled([source.end(), target.end()]); }
}
