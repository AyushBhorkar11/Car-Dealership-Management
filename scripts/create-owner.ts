import readline from 'node:readline';
import crypto from 'node:crypto';
import { db, schema } from '../src/server/db';
import { hashPassword } from '../src/server/auth';
import { eq } from 'drizzle-orm';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function ask(question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function main() {
  console.log('\n========================================');
  console.log('   CDMS: CREATE REAL OWNER ACCOUNT      ');
  console.log('========================================\n');

  try {
    const name = await ask('Enter Full Name (e.g. Rajesh Sharma): ');
    if (!name) {
      console.error('Error: Name cannot be empty.');
      process.exit(1);
    }

    const email = await ask('Enter Email Address (e.g. owner@cdms.local): ');
    if (!email || !email.includes('@')) {
      console.error('Error: A valid email address is required.');
      process.exit(1);
    }

    const password = await ask('Enter Secure Password (min 8 chars): ');
    if (!password || password.length < 8) {
      console.error('Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existing = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    const hashed = await hashPassword(password);
    let userId = crypto.randomUUID();

    if (existing.length > 0) {
      console.log(`\nUser with email '${normalizedEmail}' already exists. Updating to OWNER role...`);
      userId = existing[0].id;
      await db
        .update(schema.users)
        .set({
          name,
          passwordHash: hashed,
          role: 'OWNER',
          isActive: true,
        })
        .where(eq(schema.users.id, userId));
    } else {
      await db.insert(schema.users).values({
        id: userId,
        name,
        email: normalizedEmail,
        passwordHash: hashed,
        role: 'OWNER',
        branchId: null,
        isActive: true,
        createdAt: new Date(),
      });
    }

    // Ensure corresponding employee profile exists
    const [emp] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.userId, userId))
      .limit(1);

    if (!emp) {
      await db.insert(schema.employees).values({
        id: crypto.randomUUID(),
        name,
        email: normalizedEmail,
        phone: '+91 98200 12345',
        userId,
        branchId: null,
        monthlyTarget: 0,
        isActive: true,
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    console.log('\n----------------------------------------');
    console.log('✓ Owner Account Created Successfully!');
    console.log(`  Name  : ${name}`);
    console.log(`  Email : ${normalizedEmail}`);
    console.log(`  Role  : OWNER (All Branches Unrestricted)`);
    console.log(`  ID    : ${userId}`);
    console.log('----------------------------------------');
    console.log('You can now log in at http://localhost:8080/auth (Owner tab or Email login).\n');
  } catch (err) {
    console.error('Failed to create owner account:', err);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
