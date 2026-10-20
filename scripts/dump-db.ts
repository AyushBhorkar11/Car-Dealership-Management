import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Parse DATABASE_URL from .env
const dbUrl = process.env.DATABASE_URL || 'mysql://root@localhost:3306/cdms';
const match = dbUrl.match(/^mysql:\/\/([^:]+)(?::([^@]+))?@([^:]+):(\d+)\/(.+)$/);

if (!match) {
  console.error('Invalid DATABASE_URL');
  process.exit(1);
}

const [, user, pass, host, port, database] = match;
const dumpPath = 'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe';

const outputFile = path.join(process.cwd(), 'database.sql');
const passwordArg = pass ? `--password=${pass}` : '';

try {
  console.log(`Dumping database '${database}' from ${host}:${port} to database.sql...`);
  const cmd = `"${dumpPath}" -h ${host} -P ${port} -u ${user} ${passwordArg} --routines --triggers ${database} > "${outputFile}"`;
  execSync(cmd, { shell: 'cmd.exe', stdio: 'inherit' });
  console.log(`Database exported successfully to ${outputFile}`);
} catch (err: any) {
  console.error('Error executing mysqldump:', err.message);
  process.exit(1);
}
