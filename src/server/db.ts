import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from '../../drizzle/schema';

const connectionUri = process.env.DATABASE_URL || 'mysql://root:Ayush@localhost:3306/cdms';

export const pool = mysql.createPool({
  uri: connectionUri,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export const db = drizzle(pool, { schema, mode: 'default' });
export { schema };
