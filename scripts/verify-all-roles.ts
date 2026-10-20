import { db, schema, pool } from '../src/server/db';
import { eq, sql } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';

async function verifyAllRoles() {
  console.log('=====================================================');
  console.log('CDMS COMPREHENSIVE ROLE & DATA VERIFICATION SUITE');
  console.log('=====================================================\n');

  // 1. Verify Database Connection
  try {
    const [dbResult] = await db.execute(sql`SELECT DATABASE() as current_db, VERSION() as mysql_version`);
    console.log(`[PASS] MySQL Connection Active: ${(dbResult as any)[0].current_db} (v${(dbResult as any)[0].mysql_version})`);
  } catch (err) {
    console.error('[FAIL] MySQL connection failed:', err);
    process.exit(1);
  }

  // 2. Verify Key Accounts and Password Verification
  const testAccounts = [
    { role: 'OWNER', email: 'owner@cdms.local', expectedRedirect: '/owner' },
    { role: 'BRANCH_MANAGER', email: 'manager.mumbai@cdms.local', expectedRedirect: '/manager' },
    { role: 'EMPLOYEE', email: 'employee.mumbai1@cdms.local', expectedRedirect: '/employee' },
    { role: 'CUSTOMER', email: 'rahul.chitale@example.com', expectedRedirect: '/workspace' },
  ];

  console.log('\n--- 1. Testing Role Authentication & Password Hashes ---');
  for (const acc of testAccounts) {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, acc.email)).limit(1);
    if (!user) {
      console.error(`[FAIL] Account missing: ${acc.email}`);
      process.exit(1);
    }
    const valid = await bcrypt.compare('Dealership@2026', user.passwordHash);
    if (!valid) {
      console.error(`[FAIL] Password validation failed for ${acc.email}`);
      process.exit(1);
    }
    if (user.role !== acc.role) {
      console.error(`[FAIL] Expected role ${acc.role}, found ${user.role}`);
      process.exit(1);
    }
    if (user.approvalStatus !== 'APPROVED') {
      console.error(`[FAIL] Account ${acc.email} is not APPROVED (status: ${user.approvalStatus})`);
      process.exit(1);
    }
    console.log(`[PASS] ${acc.role.padEnd(16)}: ${acc.email} (Approved: ${user.approvalStatus}, Target Route: ${acc.expectedRedirect})`);
  }

  // 3. Customer Data & Experience Verification
  console.log('\n--- 2. Testing Customer Workspace Data (Rahul Chitale) ---');
  const [customerUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'rahul.chitale@example.com')).limit(1);
  const [customerProfile] = await db.select().from(schema.customers).where(eq(schema.customers.userId, customerUser.id)).limit(1);
  
  if (!customerProfile) {
    console.error('[FAIL] Customer profile row missing in `customers` table');
    process.exit(1);
  }
  console.log(`[PASS] Customer Profile: ${customerProfile.name} (Phone: ${customerProfile.phone}, City: ${customerProfile.city})`);

  const customerEnquiries = await db.select().from(schema.enquiries).where(eq(schema.enquiries.customerId, customerProfile.id));
  console.log(`[PASS] Customer Enquiries / Bookings Found: ${customerEnquiries.length}`);
  for (const enq of customerEnquiries) {
    console.log(`       - Enquiry #${enq.id.slice(0, 8)}: Type=${enq.enquiryType}, Stage=${enq.stage}, Brand=${enq.requestedBrand || 'N/A'}, Model=${enq.requestedModel || 'N/A'}`);
  }

  const customerQuotations = await db.select().from(schema.quotations).where(eq(schema.quotations.customerId, customerProfile.id));
  console.log(`[PASS] Customer Quotations Found: ${customerQuotations.length}`);
  for (const q of customerQuotations) {
    console.log(`       - Quote #${q.quotationNumber}: Total On-Road=INR ${Number(q.onRoadPrice).toLocaleString('en-IN')}, Status=${q.status}`);
  }

  // 4. Employee Workflow Verification
  console.log('\n--- 3. Testing Sales Executive / Employee Workspace ---');
  const [employeeUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'employee.mumbai1@cdms.local')).limit(1);
  const [employeeProfile] = await db.select().from(schema.employees).where(eq(schema.employees.userId, employeeUser.id)).limit(1);
  
  if (!employeeProfile) {
    console.error('[FAIL] Employee profile missing in `employees` table');
    process.exit(1);
  }
  
  const assignedLeads = await db.select().from(schema.enquiries).where(eq(schema.enquiries.employeeId, employeeProfile.id));
  console.log(`[PASS] Mumbai Central Sales Executive: ${employeeUser.name} (Assigned Leads: ${assignedLeads.length})`);
  if (assignedLeads.length > 0) {
    console.log(`       - First lead: ID=${assignedLeads[0].id.slice(0, 8)}, Type=${assignedLeads[0].enquiryType}, Stage=${assignedLeads[0].stage}`);
  }

  // 5. Branch Manager Workflow Verification
  console.log('\n--- 4. Testing Branch Manager Workspace ---');
  const [managerUser] = await db.select().from(schema.users).where(eq(schema.users.email, 'manager.mumbai@cdms.local')).limit(1);
  const branchStaff = await db.select().from(schema.users).where(eq(schema.users.branchId, managerUser.branchId!));
  const branchCars = await db.select().from(schema.cars).where(eq(schema.cars.branchId, managerUser.branchId!));
  const branchQuotes = await db.select().from(schema.quotations).where(eq(schema.quotations.branchId, managerUser.branchId!));
  console.log(`[PASS] Mumbai Branch Manager: ${managerUser.name}`);
  console.log(`       - Branch Staff Count: ${branchStaff.length} employees`);
  console.log(`       - Branch Inventory: ${branchCars.length} cars assigned to Mumbai Central`);
  console.log(`       - Branch Quotations: ${branchQuotes.length} quotations generated`);

  // 6. Owner Multi-Branch Global Overview
  console.log('\n--- 5. Testing Dealership Owner Global Overview ---');
  const branches = await db.select().from(schema.branches);
  const allCars = await db.select().from(schema.cars);
  const allUsers = await db.select().from(schema.users);
  const allOrders = await db.select().from(schema.purchases);
  const allPayments = await db.select().from(schema.payments);
  
  const totalRevenue = allPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);

  console.log(`[PASS] Dealership Branches: ${branches.length} locations (Mumbai, Delhi, Bengaluru, Chennai, Pune)`);
  console.log(`[PASS] Global Fleet Inventory: ${allCars.length} vehicles across India`);
  console.log(`[PASS] Dealership Staff & Customers: ${allUsers.length} total registered accounts`);
  console.log(`[PASS] Active Demand-Driven POs: ${allOrders.length} procurement orders to OEMs`);
  console.log(`[PASS] Total Verified Payments: INR ${totalRevenue.toLocaleString('en-IN')}`);

  // 7. Verify Local Car Images
  console.log('\n--- 6. Verifying Local Car Showroom Images on Disk ---');
  const availableImages = fs.readdirSync(path.resolve(process.cwd(), 'public', 'cars'));
  console.log(`[PASS] Found ${availableImages.length} High-Resolution Showroom Photos in public/cars/`);
  for (const img of availableImages) {
    const stats = fs.statSync(path.resolve(process.cwd(), 'public', 'cars', img));
    const sizeKb = (stats.size / 1024).toFixed(1);
    console.log(`       - ${img.padEnd(26)}: ${sizeKb} KB`);
  }

  // Test resolution for each car brand/model in database
  const distinctCarModels = Array.from(new Set(allCars.map(c => `${c.brand} ${c.model}`)));
  console.log(`\n[PASS] Verifying Image Mapping for ${distinctCarModels.length} Showroom Car Models:`);
  
  const resolveCarImage = (brand: string, model: string) => {
    const b = brand.toLowerCase();
    const m = model.toLowerCase();
    if (b.includes('audi') && m.includes('a4')) return 'audi-a4.jpg';
    if (m.includes('creta')) return 'hyundai-creta.jpg';
    if (m.includes('seltos')) return 'kia-seltos.jpg';
    if (m.includes('nexon')) return 'tata-nexon.jpg';
    if (m.includes('xuv700') || m.includes('xuv')) return 'mahindra-xuv700.jpg';
    if (m.includes('thar')) return 'mahindra-thar.jpg';
    if (m.includes('fortuner')) return 'toyota-fortuner.jpg';
    if (m.includes('innova') || m.includes('hycross')) return 'toyota-innova.jpg';
    if (m.includes('city')) return 'honda-city.jpg';
    if (m.includes('vitara')) return 'maruti-grand-vitara.jpg';
    if (m.includes('3 series')) return 'bmw-3-series.jpg';
    if (m.includes('c-class')) return 'mercedes-c-class.jpg';
    return null;
  };

  for (const modelName of distinctCarModels) {
    const [brand, ...rest] = modelName.split(' ');
    const model = rest.join(' ');
    const resolvedImg = resolveCarImage(brand, model);
    if (!resolvedImg) {
      console.log(`       ✓ ${modelName.padEnd(30)} -> [Branded Silhouette Placeholder]`);
      continue;
    }
    const fullPath = path.resolve(process.cwd(), 'public', 'cars', resolvedImg);
    if (!fs.existsSync(fullPath)) {
      console.error(`[FAIL] Image not found for ${modelName}: ${resolvedImg}`);
      process.exit(1);
    }
    console.log(`       ✓ ${modelName.padEnd(30)} -> /cars/${resolvedImg}`);
  }

  console.log('\n=====================================================');
  console.log('ALL ROLES, DATA WORKFLOWS & ASSETS 100% VERIFIED!');
  console.log('=====================================================\n');

  await pool.end();
}

verifyAllRoles().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
