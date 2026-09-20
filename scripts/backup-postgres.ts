import { existsSync } from 'node:fs';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

type CommandResult = { stdout: string; stderr: string };

function run(command: string, args: string[], input?: string): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'pipe', windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => (stderr += chunk.toString()));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with ${code}: ${stderr || stdout}`));
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

function withDatabase(databaseUrl: string, name: string) {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

function readFlag(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function resolveTool(name: 'pg_dump' | 'psql') {
  const configured = process.env[name === 'pg_dump' ? 'PG_DUMP_BIN' : 'PSQL_BIN'];
  if (configured) return configured;
  if (process.platform === 'win32') {
    const roots = [process.env.ProgramW6432, process.env.ProgramFiles].filter(
      (value): value is string => Boolean(value),
    );
    const candidate = roots
      .flatMap((root) => [18, 17, 16, 15].map((version) => path.join(root, 'PostgreSQL', String(version), 'bin', `${name}.exe`)))
      .find((value) => existsSync(value));
    if (candidate) return candidate;
  }
  return process.platform === 'win32' ? `${name}.exe` : name;
}

async function main() {
  const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('Set TEST_DATABASE_URL or DATABASE_URL before creating a backup.');
  }

  const output =
    readFlag('--output') ??
    path.join('backups', `docxcraft-${new Date().toISOString().replace(/[:.]/g, '-')}.sql`);
  await mkdir(path.dirname(output), { recursive: true });

  await run(resolveTool('pg_dump'), ['--dbname', databaseUrl, '--no-owner', '--no-privileges', '--file', output]);
  console.log(`Backup written to ${path.resolve(output)}`);

  if (!process.argv.includes('--drill')) return;

  const drillName = `docxcraft_restore_drill_${process.pid}`;
  const maintenanceUrl = withDatabase(databaseUrl, 'postgres');
  const drillUrl = withDatabase(databaseUrl, drillName);

  try {
    await run(resolveTool('psql'), [
      '--dbname',
      maintenanceUrl,
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `CREATE DATABASE "${drillName}"`,
    ]);
    await run(resolveTool('psql'), [
      '--dbname',
      drillUrl,
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--file',
      output,
    ]);
    const result = await run(resolveTool('psql'), [
      '--dbname',
      drillUrl,
      '--tuples-only',
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \'public\'',
    ]);
    console.log(`Restore drill passed: ${result.stdout.trim()} public tables restored.`);
  } finally {
    await run(resolveTool('psql'), [
      '--dbname',
      maintenanceUrl,
      '--no-psqlrc',
      '--set',
      'ON_ERROR_STOP=1',
      '--command',
      `DROP DATABASE IF EXISTS "${drillName}"`,
    ]).catch((error) => console.error(`Could not remove drill database: ${error.message}`));
    await rm(output, { force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
