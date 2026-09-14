import { Client } from 'pg';

// Arbitrary but stable key shared by every test file that mutates the database.
const LOCK_KEY = 48201937;

/**
 * Serializes database-mutating test files (they truncate shared tables) without
 * disabling file parallelism for the whole suite. Holds a session-level
 * Postgres advisory lock until the returned release function is called.
 */
export async function acquireDatabaseLock(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  await client.query('select pg_advisory_lock($1)', [LOCK_KEY]);

  return async () => {
    await client.query('select pg_advisory_unlock($1)', [LOCK_KEY]);
    await client.end();
  };
}
