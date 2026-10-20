import { db } from '../src/server/db';
import { sql } from 'drizzle-orm';

async function clearDemo() {
  console.log('\n======================================================');
  console.log('       CDMS: CLEARING DEMO DATA FROM MYSQL            ');
  console.log('======================================================\n');

  try {
    console.log('-> Clearing demo payments...');
    await db.execute(sql`DELETE FROM payments WHERE transaction_reference LIKE 'DEMO%'`);

    console.log('-> Clearing demo purchases (procurement)...');
    await db.execute(sql`DELETE FROM purchases WHERE is_demo = true`);

    console.log('-> Clearing demo sales...');
    await db.execute(sql`DELETE FROM sales WHERE is_demo = true`);

    console.log('-> Clearing demo quotations...');
    await db.execute(sql`DELETE FROM quotations WHERE quotation_number LIKE 'QUO-2026-%'`);

    console.log('-> Clearing demo enquiries...');
    await db.execute(sql`DELETE FROM enquiries WHERE is_demo = true`);

    console.log('-> Clearing demo inventory cars...');
    await db.execute(sql`DELETE FROM cars WHERE is_demo = true`);

    console.log('-> Clearing demo customers...');
    await db.execute(sql`DELETE FROM customers WHERE is_demo = true OR email LIKE '%@example.com'`);

    console.log('-> Clearing demo employees (excluding primary owner)...');
    await db.execute(sql`DELETE FROM employees WHERE is_demo = true AND email != 'owner@cdms.local'`);

    console.log('-> Clearing demo users (excluding permanent owner)...');
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%@cdms.local' AND role != 'OWNER'`);
    await db.execute(sql`DELETE FROM users WHERE email LIKE '%@example.com'`);

    console.log('\n✓ Demo data cleared successfully. Permanent accounts preserved.\n');
  } catch (err: any) {
    console.error('Clear demo error:', err.message || err);
  } finally {
    process.exit(0);
  }
}

clearDemo();
