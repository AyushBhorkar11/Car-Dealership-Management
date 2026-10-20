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
  console.log('\n======================================================');
  console.log('       CDMS: CREATE OR UPDATE DEALERSHIP USER         ');
  console.log('   (Works offline / direct database access for recovery) ');
  console.log('======================================================\n');

  try {
    const name = await ask('Enter Full Name (e.g. Anand Mahindra): ');
    if (!name) {
      console.error('Error: Full Name is required.');
      process.exit(1);
    }

    const email = await ask('Enter Email Address (e.g. anand@cdms.local): ');
    if (!email || !email.includes('@')) {
      console.error('Error: A valid email address is required.');
      process.exit(1);
    }

    console.log('\nSelect Role:');
    console.log('  1) OWNER          - Complete dealership management, unrestricted access across all branches');
    console.log('  2) BRANCH_MANAGER - Showroom branch head (inventory, discounts, team management)');
    console.log('  3) EMPLOYEE       - Sales executive (leads, test drives, quotations, bookings)');
    console.log('  4) CUSTOMER       - Car buyer workspace');
    const roleChoice = await ask('Enter role choice [1-4] (default 3): ');

    let role: 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' | 'CUSTOMER' = 'EMPLOYEE';
    if (roleChoice === '1') role = 'OWNER';
    else if (roleChoice === '2') role = 'BRANCH_MANAGER';
    else if (roleChoice === '4') role = 'CUSTOMER';
    else role = 'EMPLOYEE';

    let branchId: string | null = null;
    let selectedBranchName = 'All Branches (Unrestricted)';

    if (role === 'BRANCH_MANAGER' || role === 'EMPLOYEE') {
      const branches = await db.select().from(schema.branches);
      if (branches.length === 0) {
        console.error('Error: No branches found in database. Run "bun run seed" first.');
        process.exit(1);
      }

      console.log('\nSelect Showroom Branch:');
      branches.forEach((b, idx) => {
        console.log(`  ${idx + 1}) ${b.branchName} (${b.city})`);
      });

      const branchChoice = await ask(`Enter branch number [1-${branches.length}]: `);
      const bIdx = parseInt(branchChoice, 10) - 1;
      if (isNaN(bIdx) || bIdx < 0 || bIdx >= branches.length) {
        console.error('Invalid branch selection.');
        process.exit(1);
      }
      branchId = branches[bIdx].id;
      selectedBranchName = `${branches[bIdx].branchName} (${branches[bIdx].city})`;
    }

    const password = await ask('\nEnter Password (minimum 8 characters): ');
    if (!password || password.length < 8) {
      console.error('Error: Password must be at least 8 characters long.');
      process.exit(1);
    }

    const normalizedEmail = email.toLowerCase();
    const hashedPassword = await hashPassword(password);

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    let userId = existing?.id || crypto.randomUUID();

    if (existing) {
      console.log(`\nUser '${normalizedEmail}' already exists. Updating record...`);
      await db
        .update(schema.users)
        .set({
          name,
          passwordHash: hashedPassword,
          role,
          branchId,
          isActive: true,
          approvalStatus: 'APPROVED',
        })
        .where(eq(schema.users.id, userId));
    } else {
      await db.insert(schema.users).values({
        id: userId,
        name,
        email: normalizedEmail,
        passwordHash: hashedPassword,
        role,
        branchId,
        isActive: true,
        approvalStatus: 'APPROVED',
        createdAt: new Date(),
      });
    }

    // Link employee record if staff
    if (role === 'BRANCH_MANAGER' || role === 'EMPLOYEE') {
      const [existingEmp] = await db
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.userId, userId))
        .limit(1);

      if (existingEmp) {
        await db
          .update(schema.employees)
          .set({
            name,
            email: normalizedEmail,
            branchId,
            isActive: true,
            monthlyTarget: role === 'BRANCH_MANAGER' ? 15 : 8,
            updatedAt: new Date(),
          })
          .where(eq(schema.employees.id, existingEmp.id));
      } else {
        await db.insert(schema.employees).values({
          id: crypto.randomUUID(),
          name,
          email: normalizedEmail,
          phone: '+91 98000 00000',
          branchId,
          userId,
          monthlyTarget: role === 'BRANCH_MANAGER' ? 15 : 8,
          isActive: true,
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    // Link customer record if customer
    if (role === 'CUSTOMER') {
      const [existingCust] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.userId, userId))
        .limit(1);

      if (existingCust) {
        await db
          .update(schema.customers)
          .set({ name, email: normalizedEmail, updatedAt: new Date() })
          .where(eq(schema.customers.id, existingCust.id));
      } else {
        await db.insert(schema.customers).values({
          id: crypto.randomUUID(),
          name,
          email: normalizedEmail,
          phone: '+91 98000 00000',
          city: 'Pune',
          address: 'Customer Address',
          idProofType: 'Aadhaar Card',
          idProofNumber: 'XXXX-XXXX-1234',
          userId,
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    }

    console.log('\n======================================================');
    console.log('✓ Account Created / Updated Successfully!');
    console.log(`  Name   : ${name}`);
    console.log(`  Email  : ${normalizedEmail}`);
    console.log(`  Role   : ${role}`);
    console.log(`  Branch : ${selectedBranchName}`);
    console.log(`  Status : APPROVED (Active)`);
    console.log('======================================================');
    console.log('You can now log in at: http://localhost:3000/auth\n');
  } catch (err: any) {
    console.error('Failed to create user:', err.message || err);
  } finally {
    rl.close();
    process.exit(0);
  }
}

main();
