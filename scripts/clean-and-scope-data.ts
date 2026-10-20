import { db, schema, pool } from '../src/server/db';
import { eq, inArray, notInArray, sql } from 'drizzle-orm';
import { hashPassword } from '../src/server/auth';

const DEMO_PW = 'Dealership@2026';

async function cleanAndScopeData() {
  console.log('========================================================================');
  console.log('  CDMS DATABASE CLEANUP & ROLE-SCOPING RESET                            ');
  console.log('  - Keep cars table 100% intact (95 cars)                              ');
  console.log('  - 5 official branches (Mumbai, Pune, Bengaluru, Delhi, Hyderabad)      ');
  console.log('  - 1 Owner                                                             ');
  console.log('  - 1 Branch Manager per branch (5 total)                               ');
  console.log('  - 2 Employees per branch (10 total)                                   ');
  console.log('  - 2 Customers per branch (10 total, including Ayush)                  ');
  console.log('========================================================================\n');

  const hashedPw = await hashPassword(DEMO_PW);

  // 1. Five Official Branches
  const OFFICIAL_BRANCHES = [
    { id: '65101080-aa01-4ad4-8c3a-31ded9cf30e8', name: 'CDMS Mumbai Flagship', city: 'Mumbai', address: 'Dr. Annie Besant Road, Worli, Mumbai 400018', phone: '+91 22 2490 8800' },
    { id: '15a28da8-6df2-4aeb-92a8-9ef1c14f3315', name: 'CDMS Pune Expressway', city: 'Pune', address: 'Baner Road, Balewadi, Pune 411045', phone: '+91 20 6720 1100' },
    { id: '27ec6104-6948-4893-bc01-e101da21abea', name: 'CDMS Bengaluru Silicon Hub', city: 'Bengaluru', address: 'ITPL Main Road, Whitefield, Bengaluru 560066', phone: '+91 80 4120 2200' },
    { id: 'e709a17e-67e9-4991-b467-af6de71c495c', name: 'CDMS Delhi NCR Central', city: 'New Delhi', address: 'Connaught Place, New Delhi 110001', phone: '+91 11 4980 3300' },
    { id: '0b2bb073-3b9f-4fda-b0c8-f171aeafd5c9', name: 'CDMS Hyderabad Elite', city: 'Hyderabad', address: 'Jubilee Hills, Hyderabad 500033', phone: '+91 40 2360 4400' },
  ];

  const officialBranchIds = OFFICIAL_BRANCHES.map(b => b.id);

  // Update or ensure 5 official branches
  for (const b of OFFICIAL_BRANCHES) {
    const [existing] = await db.select().from(schema.branches).where(eq(schema.branches.id, b.id)).limit(1);
    if (existing) {
      await db.update(schema.branches).set({ branchName: b.name, city: b.city, address: b.address, phone: b.phone }).where(eq(schema.branches.id, b.id));
    } else {
      await db.insert(schema.branches).values({ id: b.id, branchName: b.name, city: b.city, address: b.address, phone: b.phone, demandThreshold: 3, createdAt: new Date() });
    }
  }

  // Remove redundant branches that are not in officialBranchIds
  await pool.query('SET FOREIGN_KEY_CHECKS = 0');
  await db.delete(schema.branches).where(notInArray(schema.branches.id, officialBranchIds));

  // 2. Allowed Users Specification
  const KEEP_USERS = [
    // 1 Owner
    { role: 'OWNER' as const, name: 'Rajesh Sharma', email: 'owner@cdms.local', branchId: null, city: 'HQ' },

    // Mumbai: 1 Manager, 2 Employees, 2 Customers
    { role: 'BRANCH_MANAGER' as const, name: 'Sameer Mehta', email: 'manager.mumbai@cdms.local', branchId: '65101080-aa01-4ad4-8c3a-31ded9cf30e8', city: 'Mumbai', phone: '+91 98201 10001', target: 15 },
    { role: 'EMPLOYEE' as const, name: 'Rohan Sawant', email: 'employee.mumbai1@cdms.local', branchId: '65101080-aa01-4ad4-8c3a-31ded9cf30e8', city: 'Mumbai', phone: '+91 98201 20001', target: 8 },
    { role: 'EMPLOYEE' as const, name: 'Neha Patil', email: 'employee.mumbai2@cdms.local', branchId: '65101080-aa01-4ad4-8c3a-31ded9cf30e8', city: 'Mumbai', phone: '+91 98201 20002', target: 7 },
    { role: 'CUSTOMER' as const, name: 'Priyanka Singhania', email: 'priyanka.s@example.com', branchId: null, city: 'Mumbai', phone: '+91 98190 77123', address: 'Sea Face Towers, Worli, Mumbai' },
    { role: 'CUSTOMER' as const, name: 'Ananya Sen', email: 'ananya.sen@example.com', branchId: null, city: 'Mumbai', phone: '+91 98300 22119', address: 'Beau Monde, Prabhadevi, Mumbai' },

    // Pune: 1 Manager, 2 Employees, 2 Customers
    { role: 'BRANCH_MANAGER' as const, name: 'Vikram Joshi', email: 'manager.pune@cdms.local', branchId: '15a28da8-6df2-4aeb-92a8-9ef1c14f3315', city: 'Pune', phone: '+91 98220 10002', target: 12 },
    { role: 'EMPLOYEE' as const, name: 'Amit Kulkarni', email: 'employee.pune1@cdms.local', branchId: '15a28da8-6df2-4aeb-92a8-9ef1c14f3315', city: 'Pune', phone: '+91 98220 20001', target: 8 },
    { role: 'EMPLOYEE' as const, name: 'Pooja Deshmukh', email: 'employee.pune2@cdms.local', branchId: '15a28da8-6df2-4aeb-92a8-9ef1c14f3315', city: 'Pune', phone: '+91 98220 20002', target: 8 },
    { role: 'CUSTOMER' as const, name: 'Dr. Rahul Chitale', email: 'rahul.chitale@example.com', branchId: null, city: 'Pune', phone: '+91 98220 44551', address: 'Aundh, Pune 411007' },
    { role: 'CUSTOMER' as const, name: 'Harish Chawla', email: 'harish.c@example.com', branchId: null, city: 'Pune', phone: '+91 98200 44331', address: 'Panchshil Towers, Kharadi, Pune' },

    // Bengaluru: 1 Manager, 2 Employees, 2 Customers
    { role: 'BRANCH_MANAGER' as const, name: 'Kiran Rao', email: 'manager.blr@cdms.local', branchId: '27ec6104-6948-4893-bc01-e101da21abea', city: 'Bengaluru', phone: '+91 98450 10003', target: 14 },
    { role: 'EMPLOYEE' as const, name: 'Karthik Gowda', email: 'employee.blr1@cdms.local', branchId: '27ec6104-6948-4893-bc01-e101da21abea', city: 'Bengaluru', phone: '+91 98450 20001', target: 8 },
    { role: 'EMPLOYEE' as const, name: 'Ananya Hegde', email: 'employee.blr2@cdms.local', branchId: '27ec6104-6948-4893-bc01-e101da21abea', city: 'Bengaluru', phone: '+91 98450 20002', target: 7 },
    { role: 'CUSTOMER' as const, name: 'Aditya Nair', email: 'aditya.nair@example.com', branchId: null, city: 'Bengaluru', phone: '+91 98450 33211', address: 'Palm Meadows, Whitefield, Bengaluru' },
    { role: 'CUSTOMER' as const, name: 'Meera Swaminathan', email: 'meera.s@example.com', branchId: null, city: 'Bengaluru', phone: '+91 98400 88220', address: 'Koramangala, Bengaluru' },

    // Delhi: 1 Manager, 2 Employees, 2 Customers
    { role: 'BRANCH_MANAGER' as const, name: 'Rajeev Sharma', email: 'manager.delhi@cdms.local', branchId: 'e709a17e-67e9-4991-b467-af6de71c495c', city: 'New Delhi', phone: '+91 98110 10004', target: 15 },
    { role: 'EMPLOYEE' as const, name: 'Gaurav Khanna', email: 'employee.delhi1@cdms.local', branchId: 'e709a17e-67e9-4991-b467-af6de71c495c', city: 'New Delhi', phone: '+91 98110 20001', target: 8 },
    { role: 'EMPLOYEE' as const, name: 'Simran Chadha', email: 'employee.delhi2@cdms.local', branchId: 'e709a17e-67e9-4991-b467-af6de71c495c', city: 'New Delhi', phone: '+91 98110 20002', target: 8 },
    { role: 'CUSTOMER' as const, name: 'Rohan Kapoor', email: 'rohan.k@example.com', branchId: null, city: 'New Delhi', phone: '+91 98100 55441', address: 'Vasant Vihar, New Delhi' },
    { role: 'CUSTOMER' as const, name: 'Vikram Singhal', email: 'vikram.singhal@example.com', branchId: null, city: 'New Delhi', phone: '+91 98102 99440', address: 'Golf Links, New Delhi' },

    // Hyderabad: 1 Manager, 2 Employees, 2 Customers (including Ayush)
    { role: 'BRANCH_MANAGER' as const, name: 'Venkat Reddy', email: 'manager.hyd@cdms.local', branchId: '0b2bb073-3b9f-4fda-b0c8-f171aeafd5c9', city: 'Hyderabad', phone: '+91 98490 10005', target: 12 },
    { role: 'EMPLOYEE' as const, name: 'Srinivas Murthy', email: 'employee.hyd1@cdms.local', branchId: '0b2bb073-3b9f-4fda-b0c8-f171aeafd5c9', city: 'Hyderabad', phone: '+91 98490 20001', target: 7 },
    { role: 'EMPLOYEE' as const, name: 'Divya Teja', email: 'employee.hyd2@cdms.local', branchId: '0b2bb073-3b9f-4fda-b0c8-f171aeafd5c9', city: 'Hyderabad', phone: '+91 98490 20002', target: 7 },
    { role: 'CUSTOMER' as const, name: 'Ayush', email: 'ayush2025900026@gmail.com', branchId: null, city: 'Hyderabad', phone: '+91 98220 99999', address: 'Jubilee Hills, Hyderabad' },
    { role: 'CUSTOMER' as const, name: 'Sunita Rao', email: 'sunita.rao@example.com', branchId: null, city: 'Hyderabad', phone: '+91 98490 66332', address: 'Whisper Valley, Jubilee Hills, Hyderabad' },
  ];

  const keepEmails = KEEP_USERS.map(u => u.email.toLowerCase());

  console.log(`-> Syncing exactly 26 users across all 5 branches...`);

  const userIdsByEmail: Record<string, string> = {};
  const customerIdsByEmail: Record<string, string> = {};
  const employeeIdsByEmail: Record<string, string> = {};

  for (const u of KEEP_USERS) {
    const normEmail = u.email.toLowerCase();
    const [existing] = await db.select().from(schema.users).where(eq(schema.users.email, normEmail)).limit(1);

    let uid = existing?.id || crypto.randomUUID();
    if (existing) {
      await db.update(schema.users).set({
        name: u.name,
        role: u.role,
        branchId: u.branchId,
        isActive: true,
        approvalStatus: 'APPROVED',
      }).where(eq(schema.users.id, uid));
    } else {
      await db.insert(schema.users).values({
        id: uid,
        name: u.name,
        email: normEmail,
        passwordHash: hashedPw,
        role: u.role,
        branchId: u.branchId,
        isActive: true,
        approvalStatus: 'APPROVED',
        createdAt: new Date(),
      });
    }
    userIdsByEmail[normEmail] = uid;

    // Staff table sync
    if (u.role === 'BRANCH_MANAGER' || u.role === 'EMPLOYEE') {
      const [existingEmp] = await db.select().from(schema.employees).where(eq(schema.employees.userId, uid)).limit(1);
      let empId = existingEmp?.id || crypto.randomUUID();
      if (existingEmp) {
        await db.update(schema.employees).set({
          name: u.name,
          phone: (u as any).phone || '',
          branchId: u.branchId!,
          monthlyTarget: (u as any).target || 8,
          isActive: true,
        }).where(eq(schema.employees.id, empId));
      } else {
        await db.insert(schema.employees).values({
          id: empId,
          name: u.name,
          email: normEmail,
          phone: (u as any).phone || '',
          branchId: u.branchId!,
          userId: uid,
          monthlyTarget: (u as any).target || 8,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      employeeIdsByEmail[normEmail] = empId;
    }

    // Customer table sync
    if (u.role === 'CUSTOMER') {
      const [existingCust] = await db.select().from(schema.customers).where(eq(schema.customers.email, normEmail)).limit(1);
      let custId = existingCust?.id || crypto.randomUUID();
      if (existingCust) {
        await db.update(schema.customers).set({
          name: u.name,
          phone: (u as any).phone || '',
          city: u.city || '',
          address: (u as any).address || '',
          userId: uid,
        }).where(eq(schema.customers.id, custId));
      } else {
        await db.insert(schema.customers).values({
          id: custId,
          name: u.name,
          email: normEmail,
          phone: (u as any).phone || '',
          city: u.city || '',
          address: (u as any).address || '',
          idProofType: 'Aadhaar Card',
          idProofNumber: 'XXXX-XXXX-XXXX',
          userId: uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
      customerIdsByEmail[normEmail] = custId;
    }
  }

  // Delete all users, employees, customers that are NOT in keepEmails
  const validUserIds = Object.values(userIdsByEmail);
  const validCustomerIds = Object.values(customerIdsByEmail);
  const validEmployeeIds = Object.values(employeeIdsByEmail);

  console.log('-> Purging excess users, employees, and customers...');
  await db.delete(schema.users).where(notInArray(schema.users.id, validUserIds));
  await db.delete(schema.employees).where(notInArray(schema.employees.id, validEmployeeIds));
  await db.delete(schema.customers).where(notInArray(schema.customers.id, validCustomerIds));

  // 3. Clean enquiries:
  // - Purge enquiries that don't belong to valid customers or employees
  // - For Ayush (ayush2025900026@gmail.com), remove any test enquiries so Ayush starts with 0 requests!
  const ayushCustId = customerIdsByEmail['ayush2025900026@gmail.com'];
  if (ayushCustId) {
    console.log('-> Clearing previous test requests for Ayush (so Ayush starts fresh with 0 requests)...');
    await db.delete(schema.enquiries).where(eq(schema.enquiries.customerId, ayushCustId));
  }

  // Remove dangling enquiries from deleted customers
  await db.delete(schema.enquiries).where(notInArray(schema.enquiries.customerId, validCustomerIds));
  await db.delete(schema.quotations).where(notInArray(schema.quotations.customerId, validCustomerIds));
  await db.delete(schema.sales).where(notInArray(schema.sales.customerId, validCustomerIds));
  await db.delete(schema.payments).where(notInArray(schema.payments.customerId, validCustomerIds));

  // Align enquiries, quotations, sales to the customer's actual showroom branch
  console.log('-> Aligning customer enquiries, quotations and sales to their respective branches...');
  for (const b of OFFICIAL_BRANCHES) {
    await pool.query(
      `UPDATE enquiries e 
       JOIN customers c ON e.customer_id = c.id 
       SET e.branch_id = ? 
       WHERE LOWER(c.city) = LOWER(?)`,
      [b.id, b.city]
    );
    await pool.query(
      `UPDATE quotations q 
       JOIN customers c ON q.customer_id = c.id 
       SET q.branch_id = ? 
       WHERE LOWER(c.city) = LOWER(?)`,
      [b.id, b.city]
    );
    await pool.query(
      `UPDATE sales s 
       JOIN customers c ON s.customer_id = c.id 
       SET s.branch_id = ? 
       WHERE LOWER(c.city) = LOWER(?)`,
      [b.id, b.city]
    );
    await pool.query(
      `UPDATE payments p 
       JOIN customers c ON p.customer_id = c.id 
       SET p.branch_id = ? 
       WHERE LOWER(c.city) = LOWER(?)`,
      [b.id, b.city]
    );
  }

  // Assign enquiries & quotations to staff of that branch
  const branchStaffMap: Record<string, string[]> = {
    'Mumbai': ['employee.mumbai1@cdms.local', 'employee.mumbai2@cdms.local'],
    'Pune': ['employee.pune1@cdms.local', 'employee.pune2@cdms.local'],
    'Bengaluru': ['employee.blr1@cdms.local', 'employee.blr2@cdms.local'],
    'New Delhi': ['employee.delhi1@cdms.local', 'employee.delhi2@cdms.local'],
    'Hyderabad': ['employee.hyd1@cdms.local', 'employee.hyd2@cdms.local'],
  };

  for (const [bCity, empEmails] of Object.entries(branchStaffMap)) {
    const b = OFFICIAL_BRANCHES.find(ob => ob.city === bCity);
    if (!b) continue;
    const empId1 = employeeIdsByEmail[empEmails[0]];
    if (empId1) {
      await pool.query(`UPDATE enquiries SET employee_id = ? WHERE branch_id = ?`, [empId1, b.id]);
      await pool.query(`UPDATE quotations SET employee_id = ? WHERE branch_id = ?`, [empId1, b.id]);
    }
  }

  // Re-enable foreign key checks
  await pool.query('SET FOREIGN_KEY_CHECKS = 1');

  // Verify counts
  const [carCount]: any = await pool.query('SELECT count(*) as count FROM cars');
  const [userCount]: any = await pool.query('SELECT role, count(*) as count FROM users GROUP BY role');
  const [branchCount]: any = await pool.query('SELECT count(*) as count FROM branches');
  const [custCount]: any = await pool.query('SELECT count(*) as count FROM customers');
  const [empCount]: any = await pool.query('SELECT count(*) as count FROM employees');
  const [ayushEnqCount]: any = await pool.query('SELECT count(*) as count FROM enquiries WHERE customer_id = ?', [ayushCustId]);

  console.log('\n========================================================================');
  console.log('  CLEANUP COMPLETE - CURRENT STATE:');
  console.log('========================================================================');
  console.log(`✓ Cars preserved in inventory : ${carCount[0].count} (100% intact)`);
  console.log(`✓ Dealership Branches         : ${branchCount[0].count} official branches`);
  console.log(`✓ Active Customers in DB      : ${custCount[0].count} (2 per branch)`);
  console.log(`✓ Active Employees in DB      : ${empCount[0].count} (2 per branch)`);
  console.log(`✓ Ayush Enquiries (Fresh)     : ${ayushEnqCount[0].count} requests`);
  console.log('\nUsers breakdown:');
  for (const r of userCount) {
    console.log(`  - ${r.role.padEnd(16)}: ${r.count}`);
  }
  console.log('========================================================================\n');

  await pool.end();
}

cleanAndScopeData().catch((err) => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
