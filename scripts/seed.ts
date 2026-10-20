import crypto from 'node:crypto';
import { db, schema } from '../src/server/db';
import { hashPassword } from '../src/server/auth';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('\n======================================================');
  console.log('   CDMS: SEEDING LOCAL MYSQL DATABASE (cdms)           ');
  console.log('======================================================\n');

  const credentialsTable: Array<{
    role: string;
    name: string;
    email: string;
    branch: string;
    password: string;
  }> = [];

  const demoDefaultPassword = 'Dealership@2026';

  // Helper for upserting branch
  async function upsertBranch(name: string, city: string, address: string, phone: string) {
    const [existing] = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.city, city))
      .limit(1);

    if (existing) {
      await db
        .update(schema.branches)
        .set({ branchName: name, address, phone })
        .where(eq(schema.branches.id, existing.id));
      return existing.id;
    }

    const id = crypto.randomUUID();
    await db.insert(schema.branches).values({
      id,
      branchName: name,
      address,
      city,
      phone,
      demandThreshold: 3,
      createdAt: new Date(),
    });
    return id;
  }

  // Helper for upserting user
  async function upsertUser(
    name: string,
    email: string,
    role: 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' | 'CUSTOMER',
    branchId: string | null
  ) {
    const hashed = await hashPassword(demoDefaultPassword);
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      await db
        .update(schema.users)
        .set({ name, passwordHash: hashed, role, branchId, isActive: true })
        .where(eq(schema.users.id, existing.id));
      return existing.id;
    }

    const id = crypto.randomUUID();
    await db.insert(schema.users).values({
      id,
      name,
      email: email.toLowerCase(),
      passwordHash: hashed,
      role,
      branchId,
      isActive: true,
      createdAt: new Date(),
    });
    return id;
  }

  // Helper for upserting employee
  async function upsertEmployee(name: string, email: string, phone: string, branchId: string | null, userId: string, target = 8) {
    const [existing] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.email, email.toLowerCase()))
      .limit(1);

    if (existing) {
      await db
        .update(schema.employees)
        .set({ name, phone, branchId, userId, monthlyTarget: target, isActive: true })
        .where(eq(schema.employees.id, existing.id));
      return existing.id;
    }

    const id = crypto.randomUUID();
    await db.insert(schema.employees).values({
      id,
      name,
      email: email.toLowerCase(),
      phone,
      branchId,
      userId,
      monthlyTarget: target,
      isActive: true,
      isDemo: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  // 1. Branches
  console.log('-> Creating/updating branches...');
  const puneBranchId = await upsertBranch('Pune Central Auto Hub', 'Pune', 'Plot 45, Senapati Bapat Road, Shivajinagar', '+91 20 2567 8900');
  const mumbaiBranchId = await upsertBranch('Mumbai South Showroom', 'Mumbai', '12, Dr. Annie Besant Road, Worli', '+91 22 2493 5000');
  const blrBranchId = await upsertBranch('Bengaluru Tech Corridor Hub', 'Bengaluru', 'Outer Ring Road, Marathahalli', '+91 80 4123 7890');

  // 2. Owner
  console.log('-> Creating/updating owner...');
  const ownerUserId = await upsertUser('Rajesh Sharma', 'owner@cdms.local', 'OWNER', null);
  await upsertEmployee('Rajesh Sharma', 'owner@cdms.local', '+91 98200 11001', null, ownerUserId, 0);

  credentialsTable.push({
    role: 'OWNER',
    name: 'Rajesh Sharma',
    email: 'owner@cdms.local',
    branch: 'All Branches (Unrestricted)',
    password: demoDefaultPassword,
  });

  // 3. Branch Managers
  console.log('-> Creating/updating branch managers...');
  const managers = [
    { name: 'Vikram Joshi', email: 'manager.pune@cdms.local', branchId: puneBranchId, branchName: 'Pune' },
    { name: 'Sameer Mehta', email: 'manager.mumbai@cdms.local', branchId: mumbaiBranchId, branchName: 'Mumbai' },
    { name: 'Kiran Rao', email: 'manager.blr@cdms.local', branchId: blrBranchId, branchName: 'Bengaluru' },
  ];

  for (const m of managers) {
    const userId = await upsertUser(m.name, m.email, 'BRANCH_MANAGER', m.branchId);
    await upsertEmployee(m.name, m.email, '+91 98200 22001', m.branchId, userId, 20);
    credentialsTable.push({
      role: 'BRANCH_MANAGER',
      name: m.name,
      email: m.email,
      branch: m.branchName,
      password: demoDefaultPassword,
    });
  }

  // 4. Sales Executives / Employees
  console.log('-> Creating/updating sales executives...');
  const employeesData = [
    { name: 'Amit Kulkarni', email: 'employee.pune1@cdms.local', branchId: puneBranchId, branchName: 'Pune' },
    { name: 'Pooja Deshmukh', email: 'employee.pune2@cdms.local', branchId: puneBranchId, branchName: 'Pune' },
    { name: 'Rohan Sawant', email: 'employee.mumbai1@cdms.local', branchId: mumbaiBranchId, branchName: 'Mumbai' },
    { name: 'Neha Patil', email: 'employee.mumbai2@cdms.local', branchId: mumbaiBranchId, branchName: 'Mumbai' },
    { name: 'Karthik Gowda', email: 'employee.blr1@cdms.local', branchId: blrBranchId, branchName: 'Bengaluru' },
    { name: 'Ananya Hegde', email: 'employee.blr2@cdms.local', branchId: blrBranchId, branchName: 'Bengaluru' },
  ];

  const empIds: string[] = [];
  for (const emp of employeesData) {
    const userId = await upsertUser(emp.name, emp.email, 'EMPLOYEE', emp.branchId);
    const id = await upsertEmployee(emp.name, emp.email, '+91 98200 33001', emp.branchId, userId, 8);
    empIds.push(id);
    credentialsTable.push({
      role: 'EMPLOYEE',
      name: emp.name,
      email: emp.email,
      branch: emp.branchName,
      password: demoDefaultPassword,
    });
  }

  // 5. Suppliers
  console.log('-> Seeding suppliers...');
  const [existingSupplier] = await db.select().from(schema.suppliers).limit(1);
  let tataSupplierId = existingSupplier?.id;
  if (!tataSupplierId) {
    tataSupplierId = crypto.randomUUID();
    await db.insert(schema.suppliers).values({
      id: tataSupplierId,
      supplierName: 'Tata Motors Passenger Vehicles Ltd',
      contactPerson: 'Sanjay Verma',
      phone: '+91 22 6665 8282',
      email: 'dealers@tatamotors.com',
      address: 'Bombay House, 24 Homi Mody Street, Mumbai',
      isDemo: true,
      createdAt: new Date(),
    });
    await db.insert(schema.suppliers).values({
      id: crypto.randomUUID(),
      supplierName: 'Mahindra & Mahindra Auto Division',
      contactPerson: 'Devendra Shinde',
      phone: '+91 22 2490 1441',
      email: 'dealer.network@mahindra.com',
      address: 'Gateway Building, Apollo Bunder, Mumbai',
      isDemo: true,
      createdAt: new Date(),
    });
  }

  // 6. Customers
  console.log('-> Seeding customers...');
  const demoCustomers = [
    {
      name: 'Dr. Rahul Chitale',
      phone: '+91 98220 44551',
      email: 'rahul.chitale@example.com',
      address: 'B-402, Rohan Nilay, Aundh',
      city: 'Pune',
      idProofType: 'Aadhaar Card',
      idProofNumber: 'XXXX-XXXX-8921',
    },
    {
      name: 'Priyanka Singhania',
      phone: '+91 98190 77123',
      email: 'priyanka.s@example.com',
      address: 'Flat 14A, Sea Face Towers, Worli',
      city: 'Mumbai',
      idProofType: 'PAN Card',
      idProofNumber: 'ABCPS8921K',
    },
    {
      name: 'Aditya Nair',
      phone: '+91 98450 33211',
      email: 'aditya.nair@example.com',
      address: 'Villa 18, Palm Meadows, Whitefield',
      city: 'Bengaluru',
      idProofType: 'Driving Licence',
      idProofNumber: 'KA-03-2019-00912',
    },
  ];

  let customer1Id = '';
  for (let i = 0; i < demoCustomers.length; i++) {
    const cust = demoCustomers[i];
    const userId = await upsertUser(cust.name, cust.email, 'CUSTOMER', null);
    credentialsTable.push({
      role: 'CUSTOMER',
      name: cust.name,
      email: cust.email,
      branch: cust.city,
      password: demoDefaultPassword,
    });

    const [existing] = await db
      .select()
      .from(schema.customers)
      .where(eq(schema.customers.email, cust.email.toLowerCase()))
      .limit(1);

    if (existing) {
      await db
        .update(schema.customers)
        .set({ userId, name: cust.name, phone: cust.phone, address: cust.address, city: cust.city })
        .where(eq(schema.customers.id, existing.id));
      if (i === 0) customer1Id = existing.id;
    } else {
      const cId = crypto.randomUUID();
      if (i === 0) customer1Id = cId;
      await db.insert(schema.customers).values({
        id: cId,
        name: cust.name,
        phone: cust.phone,
        email: cust.email.toLowerCase(),
        address: cust.address,
        city: cust.city,
        idProofType: cust.idProofType,
        idProofNumber: cust.idProofNumber,
        userId,
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  // 7. Inventory Cars
  console.log('-> Seeding cars...');
  const [existingCar] = await db.select().from(schema.cars).limit(1);
  let car1Id = existingCar?.id;
  if (!car1Id) {
    car1Id = crypto.randomUUID();
    await db.insert(schema.cars).values([
      {
        id: car1Id,
        brand: 'Tata',
        model: 'Nexon EV',
        variant: 'Empowered Plus Long Range',
        fuelType: 'Electric',
        transmission: 'Automatic',
        color: 'Intensi-Teal',
        manufacturingYear: 2026,
        price: '1929000.00',
        vinChassisNo: 'MAT654129P0019281',
        status: 'Available',
        inventoryStatus: 'IN_STOCK',
        branchId: puneBranchId,
        imageKey: 'suv',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        brand: 'Mahindra',
        model: 'XUV700',
        variant: 'AX7 L AWD Diesel',
        fuelType: 'Diesel',
        transmission: 'Automatic',
        color: 'Midnight Black',
        manufacturingYear: 2026,
        price: '2699000.00',
        vinChassisNo: 'MA1789230P0045612',
        status: 'Reserved',
        inventoryStatus: 'RESERVED',
        branchId: puneBranchId,
        imageKey: 'suv',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        brand: 'Hyundai',
        model: 'Creta',
        variant: 'SX (O) 1.5 Turbo DCT',
        fuelType: 'Petrol',
        transmission: 'Automatic',
        color: 'Titan Grey Matte',
        manufacturingYear: 2026,
        price: '2015000.00',
        vinChassisNo: 'MAL543219P0088911',
        status: 'Available',
        inventoryStatus: 'IN_STOCK',
        branchId: mumbaiBranchId,
        imageKey: 'suv',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        brand: 'Toyota',
        model: 'Innova Hycross',
        variant: 'ZX(O) Hybrid',
        fuelType: 'Hybrid',
        transmission: 'Automatic',
        color: 'Blackish Ageha',
        manufacturingYear: 2026,
        price: '3098000.00',
        vinChassisNo: 'MB9112233P0055441',
        status: 'Sold',
        inventoryStatus: 'SOLD',
        branchId: mumbaiBranchId,
        imageKey: 'mpv',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  // 8. Accessories
  const [existingAcc] = await db.select().from(schema.accessoriesCatalogue).limit(1);
  if (!existingAcc) {
    console.log('-> Seeding accessories catalogue...');
    await db.insert(schema.accessoriesCatalogue).values([
      { id: crypto.randomUUID(), itemName: '7D All-Weather Floor Mats', brand: 'OEM Premium', price: '6500.00', category: 'Interior', isActive: true, createdAt: new Date() },
      { id: crypto.randomUUID(), itemName: 'Dual-Channel HD Dashcam with GPS', brand: 'SafeDrive', price: '14500.00', category: 'Electronics', isActive: true, createdAt: new Date() },
      { id: crypto.randomUUID(), itemName: 'Ceramic Coating Package (3 Years)', brand: 'GrapheneShield', price: '28000.00', category: 'Exterior', isActive: true, createdAt: new Date() },
      { id: crypto.randomUUID(), itemName: 'Aerodynamic Roof Rails & Crossbars', brand: 'AutoCross', price: '12000.00', category: 'Exterior', isActive: true, createdAt: new Date() },
    ]);
  }

  // 9. Enquiries (Demand Pipeline)
  const [existingEnq] = await db.select().from(schema.enquiries).limit(1);
  if (!existingEnq) {
    console.log('-> Seeding customer enquiries...');
    await db.insert(schema.enquiries).values([
      {
        id: crypto.randomUUID(),
        customerId: customer1Id,
        employeeId: empIds[0],
        carId: car1Id,
        branchId: puneBranchId,
        enquiryType: 'Test Drive',
        stage: 'TEST_DRIVE',
        status: 'Scheduled',
        requestedBrand: 'Tata',
        requestedModel: 'Nexon EV',
        requestedVariant: 'Empowered Plus Long Range',
        preferredColor: 'Intensi-Teal',
        preferredBudget: '2000000.00',
        expectedTimeline: 'Within 2 weeks',
        remarks: 'Customer interested in charging setup at residential parking.',
        testDriveSlot: '2026-10-18 11:00 AM',
        testDriveFeedback: 'Great driving feel. Requested quotation with insurance breakdown.',
        testDriveCarId: car1Id,
        bookingAmount: '0.00',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: crypto.randomUUID(),
        customerId: customer1Id,
        employeeId: empIds[0],
        carId: null,
        branchId: puneBranchId,
        enquiryType: 'Booking Request',
        stage: 'BOOKED',
        status: 'Procurement Raised',
        requestedBrand: 'Tata',
        requestedModel: 'Curvv EV',
        requestedVariant: 'Accomplished Plus 55',
        preferredColor: 'Virtual Sunrise',
        preferredBudget: '2200000.00',
        expectedTimeline: 'Within 30 days',
        remarks: 'Vehicle out of stock. Automatic demand procurement raised.',
        bookingAmount: '25000.00',
        procurementDecision: 'Manufacturer PO Placed',
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
  }

  console.log('\n✓ Seeding Completed Successfully!\n');
  console.log('========================================================================================');
  console.log('                     DEMO ACCOUNTS FOR LOCAL TESTING                                    ');
  console.log('========================================================================================');
  console.table(
    credentialsTable.map((c) => ({
      Role: c.role,
      Name: c.name,
      Email: c.email,
      Branch: c.branch,
      Password: c.password,
    }))
  );
  console.log('========================================================================================');
  console.log('Open http://localhost:8080/auth to log in!\n');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  });
