import crypto from 'node:crypto';
import { db, schema } from '../src/server/db';
import { hashPassword } from '../src/server/auth';
import { eq, sql } from 'drizzle-orm';

const DEMO_PASSWORD = 'Dealership@2026';

// 1. Five showroom branches across India
const BRANCHES_DEF = [
  {
    branchName: 'CDMS Mumbai Flagship',
    city: 'Mumbai',
    address: 'Dr. Annie Besant Road, Worli, Mumbai, Maharashtra 400018',
    phone: '+91 22 2490 8800',
    demandThreshold: 4,
  },
  {
    branchName: 'CDMS Pune Expressway',
    city: 'Pune',
    address: 'Baner Road, Near Balewadi High Street, Pune, Maharashtra 411045',
    phone: '+91 20 6720 1100',
    demandThreshold: 3,
  },
  {
    branchName: 'CDMS Bengaluru Silicon Hub',
    city: 'Bengaluru',
    address: 'ITPL Main Road, Whitefield, Bengaluru, Karnataka 560066',
    phone: '+91 80 4120 2200',
    demandThreshold: 3,
  },
  {
    branchName: 'CDMS Delhi NCR Central',
    city: 'New Delhi',
    address: 'Barakhamba Road, Connaught Place, New Delhi, Delhi 110001',
    phone: '+91 11 4980 3300',
    demandThreshold: 4,
  },
  {
    branchName: 'CDMS Hyderabad Elite',
    city: 'Hyderabad',
    address: 'Road No. 36, Jubilee Hills, Hyderabad, Telangana 500033',
    phone: '+91 40 2360 4400',
    demandThreshold: 3,
  },
];

// 2. Staff: Managers & Executives
const STAFF_DEF = [
  // Mumbai
  { name: 'Sameer Mehta', email: 'manager.mumbai@cdms.local', role: 'BRANCH_MANAGER' as const, city: 'Mumbai', phone: '+91 98201 10001', target: 15 },
  { name: 'Rohan Sawant', email: 'employee.mumbai1@cdms.local', role: 'EMPLOYEE' as const, city: 'Mumbai', phone: '+91 98201 20001', target: 8 },
  { name: 'Neha Patil', email: 'employee.mumbai2@cdms.local', role: 'EMPLOYEE' as const, city: 'Mumbai', phone: '+91 98201 20002', target: 7 },
  { name: 'Kunal Kapoor', email: 'employee.mumbai3@cdms.local', role: 'EMPLOYEE' as const, city: 'Mumbai', phone: '+91 98201 20003', target: 6 },
  // Pune
  { name: 'Vikram Joshi', email: 'manager.pune@cdms.local', role: 'BRANCH_MANAGER' as const, city: 'Pune', phone: '+91 98220 10002', target: 12 },
  { name: 'Amit Kulkarni', email: 'employee.pune1@cdms.local', role: 'EMPLOYEE' as const, city: 'Pune', phone: '+91 98220 20001', target: 8 },
  { name: 'Pooja Deshmukh', email: 'employee.pune2@cdms.local', role: 'EMPLOYEE' as const, city: 'Pune', phone: '+91 98220 20002', target: 8 },
  // Bengaluru
  { name: 'Kiran Rao', email: 'manager.blr@cdms.local', role: 'BRANCH_MANAGER' as const, city: 'Bengaluru', phone: '+91 98450 10003', target: 14 },
  { name: 'Karthik Gowda', email: 'employee.blr1@cdms.local', role: 'EMPLOYEE' as const, city: 'Bengaluru', phone: '+91 98450 20001', target: 8 },
  { name: 'Ananya Hegde', email: 'employee.blr2@cdms.local', role: 'EMPLOYEE' as const, city: 'Bengaluru', phone: '+91 98450 20002', target: 7 },
  // Delhi
  { name: 'Rajeev Sharma', email: 'manager.delhi@cdms.local', role: 'BRANCH_MANAGER' as const, city: 'New Delhi', phone: '+91 98110 10004', target: 15 },
  { name: 'Gaurav Khanna', email: 'employee.delhi1@cdms.local', role: 'EMPLOYEE' as const, city: 'New Delhi', phone: '+91 98110 20001', target: 8 },
  { name: 'Simran Chadha', email: 'employee.delhi2@cdms.local', role: 'EMPLOYEE' as const, city: 'New Delhi', phone: '+91 98110 20002', target: 8 },
  // Hyderabad
  { name: 'Venkat Reddy', email: 'manager.hyd@cdms.local', role: 'BRANCH_MANAGER' as const, city: 'Hyderabad', phone: '+91 98490 10005', target: 12 },
  { name: 'Srinivas Murthy', email: 'employee.hyd1@cdms.local', role: 'EMPLOYEE' as const, city: 'Hyderabad', phone: '+91 98490 20001', target: 7 },
  { name: 'Divya Teja', email: 'employee.hyd2@cdms.local', role: 'EMPLOYEE' as const, city: 'Hyderabad', phone: '+91 98490 20002', target: 7 },
];

// 3. Indian Car Models Catalogue
const CAR_CATALOGUE = [
  { brand: 'Hyundai', model: 'Creta', variants: ['SX Tech', 'SX (O) Knight', 'Adventure Edition'], fuels: ['Petrol', 'Diesel'], trans: ['Automatic', 'Manual'], priceRange: [1450000, 2050000], imageKey: 'suv' },
  { brand: 'Kia', model: 'Seltos', variants: ['HTX', 'GTX+ Turbo', 'X-Line'], fuels: ['Petrol', 'Diesel'], trans: ['Automatic', 'e-CVT'], priceRange: [1520000, 2100000], imageKey: 'suv' },
  { brand: 'Tata', model: 'Nexon EV', variants: ['Empowered+ Long Range', 'Fearless+ LR', 'Creative+'], fuels: ['EV'], trans: ['Automatic'], priceRange: [1475000, 1999000], imageKey: 'suv' },
  { brand: 'Mahindra', model: 'XUV700', variants: ['AX7 L AWD', 'AX7', 'AX5 Select'], fuels: ['Diesel', 'Petrol'], trans: ['Automatic', 'Manual'], priceRange: [1980000, 2690000], imageKey: 'suv' },
  { brand: 'Mahindra', model: 'Thar', variants: ['LX Hard Top 4x4', 'Earth Edition 4WD', 'AX Opt'], fuels: ['Diesel', 'Petrol'], trans: ['Automatic', 'Manual'], priceRange: [1420000, 1850000], imageKey: 'suv' },
  { brand: 'Toyota', model: 'Fortuner', variants: ['4x4 AT', 'Legender 4x4', 'GR-Sport'], fuels: ['Diesel'], trans: ['Automatic'], priceRange: [3650000, 5150000], imageKey: 'suv' },
  { brand: 'Toyota', model: 'Innova Hycross', variants: ['ZX(O) Strong Hybrid', 'VX Hybrid', 'GX'], fuels: ['Hybrid', 'Petrol'], trans: ['e-CVT', 'Automatic'], priceRange: [2150000, 3120000], imageKey: 'suv' },
  { brand: 'Honda', model: 'City', variants: ['ZX e:HEV Hybrid', 'ZX CVT', 'V MT'], fuels: ['Hybrid', 'Petrol'], trans: ['e-CVT', 'Manual'], priceRange: [1280000, 1950000], imageKey: 'sedan' },
  { brand: 'Maruti Suzuki', model: 'Grand Vitara', variants: ['Alpha+ Strong Hybrid', 'Zeta AllGrip 4WD', 'Alpha AT'], fuels: ['Hybrid', 'Petrol'], trans: ['e-CVT', 'Automatic'], priceRange: [1350000, 1995000], imageKey: 'suv' },
  { brand: 'BMW', model: '3 Series', variants: ['Gran Limousine 330Li M Sport', '330Li Luxury Line'], fuels: ['Petrol'], trans: ['Automatic'], priceRange: [6050000, 6850000], imageKey: 'luxury' },
  { brand: 'Mercedes-Benz', model: 'C-Class', variants: ['C 200', 'C 220d AMG Line'], fuels: ['Petrol', 'Diesel'], trans: ['Automatic'], priceRange: [6180000, 7150000], imageKey: 'luxury' },
  { brand: 'Audi', model: 'A4', variants: ['Technology 40 TFSI', 'Premium Plus'], fuels: ['Petrol'], trans: ['Automatic'], priceRange: [4650000, 5450000], imageKey: 'luxury' },
];

const COLOURS = ['Polar White', 'Midnight Black', 'Ranger Khaki', 'Daytona Grey', 'Imperial Red', 'Celestial Blue', 'Deep Forest'];

// 4. Realistic Indian Customers
const CUSTOMERS_DEF = [
  { name: 'Dr. Rahul Chitale', email: 'rahul.chitale@example.com', phone: '+91 98220 44551', city: 'Pune', address: 'B-402, Rohan Nilay, Aundh, Pune 411007' },
  { name: 'Priyanka Singhania', email: 'priyanka.s@example.com', phone: '+91 98190 77123', city: 'Mumbai', address: 'Flat 14A, Sea Face Towers, Worli, Mumbai 400018' },
  { name: 'Aditya Nair', email: 'aditya.nair@example.com', phone: '+91 98450 33211', city: 'Bengaluru', address: 'Villa 18, Palm Meadows, Whitefield, Bengaluru 560066' },
  { name: 'Meera Swaminathan', email: 'meera.s@example.com', phone: '+91 98400 88220', city: 'Bengaluru', address: 'Plot 42, Koramangala 4th Block, Bengaluru 560034' },
  { name: 'Rohan Kapoor', email: 'rohan.k@example.com', phone: '+91 98100 55441', city: 'New Delhi', address: 'C-7/14, Vasant Vihar, New Delhi 110057' },
  { name: 'Sunita Rao', email: 'sunita.rao@example.com', phone: '+91 98490 66332', city: 'Hyderabad', address: 'Villa 5, Whisper Valley, Jubilee Hills, Hyderabad 500033' },
  { name: 'Ananya Sen', email: 'ananya.sen@example.com', phone: '+91 98300 22119', city: 'Mumbai', address: '12th Floor, Beau Monde, Prabhadevi, Mumbai 400025' },
  { name: 'Vikram Singhal', email: 'vikram.singhal@example.com', phone: '+91 98102 99440', city: 'New Delhi', address: 'House 88, Golf Links, New Delhi 110003' },
  { name: 'Harish Chawla', email: 'harish.c@example.com', phone: '+91 98200 44331', city: 'Pune', address: 'Penthouse 3, Panchshil Towers, Kharadi, Pune 411014' },
  { name: 'Deepak Reddy', email: 'deepak.r@example.com', phone: '+91 98492 11005', city: 'Hyderabad', address: 'Plot 104, Madhapur, Hitec City, Hyderabad 500081' },
  { name: 'Siddharth Varma', email: 'siddharth.v@example.com', phone: '+91 98455 77112', city: 'Bengaluru', address: '102, Prestige Golfshire, Nandi Hills Road, Bengaluru' },
  { name: 'Kavita Sundaram', email: 'kavita.s@example.com', phone: '+91 98205 33991', city: 'Mumbai', address: 'A-201, Oberoi Sky Heights, Lokhandwala, Mumbai 400053' },
  { name: 'Arjun Deshpande', email: 'arjun.d@example.com', phone: '+91 98221 88440', city: 'Pune', address: 'Survey 45, Pancard Club Road, Baner, Pune 411045' },
  { name: 'Tarun Grover', email: 'tarun.g@example.com', phone: '+91 98114 66221', city: 'New Delhi', address: 'B-24, Greater Kailash Part 1, New Delhi 110048' },
  { name: 'Laxmi Narayanan', email: 'laxmi.n@example.com', phone: '+91 98491 55002', city: 'Hyderabad', address: 'Flat 401, Jayabheri Silicon County, Gachibowli, Hyderabad' },
];

async function seedDemo() {
  console.log('\n========================================================================');
  console.log('       CDMS: SEEDING RICH DEMO DATASET (5 BRANCHES, 95+ CARS)           ');
  console.log('========================================================================\n');

  const hashedPw = await hashPassword(DEMO_PASSWORD);

  // 1. Branches
  console.log('-> Creating 5 Showroom Branches across India...');
  const branchMap: Record<string, string> = {};
  for (const b of BRANCHES_DEF) {
    const [existing] = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.city, b.city))
      .limit(1);

    if (existing) {
      await db
        .update(schema.branches)
        .set({ branchName: b.branchName, address: b.address, phone: b.phone })
        .where(eq(schema.branches.id, existing.id));
      branchMap[b.city] = existing.id;
    } else {
      const id = crypto.randomUUID();
      await db.insert(schema.branches).values({
        id,
        branchName: b.branchName,
        address: b.address,
        city: b.city,
        phone: b.phone,
        demandThreshold: b.demandThreshold,
        createdAt: new Date(),
      });
      branchMap[b.city] = id;
    }
  }

  // 2. Dealership Owner
  console.log('-> Ensuring Dealership Owner account exists...');
  const ownerEmail = 'owner@cdms.local';
  let ownerUserId: string;
  const [existingOwner] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, ownerEmail))
    .limit(1);

  if (existingOwner) {
    ownerUserId = existingOwner.id;
    await db
      .update(schema.users)
      .set({ passwordHash: hashedPw, isActive: true, approvalStatus: 'APPROVED' })
      .where(eq(schema.users.id, ownerUserId));
  } else {
    ownerUserId = crypto.randomUUID();
    await db.insert(schema.users).values({
      id: ownerUserId,
      name: 'Rajesh Sharma',
      email: ownerEmail,
      passwordHash: hashedPw,
      role: 'OWNER',
      branchId: null,
      isActive: true,
      approvalStatus: 'APPROVED',
      createdAt: new Date(),
    });
  }

  // 3. Staff Users & Employees
  console.log('-> Seeding Branch Managers and Sales Executives...');
  const employeeIds: Record<string, string[]> = {};
  for (const bCity of Object.keys(branchMap)) {
    employeeIds[bCity] = [];
  }

  const credentials: Array<{ role: string; name: string; email: string; branch: string; password: string }> = [
    { role: 'OWNER', name: 'Rajesh Sharma', email: ownerEmail, branch: 'All Branches (HQ)', password: DEMO_PASSWORD },
  ];

  for (const s of STAFF_DEF) {
    const bId = branchMap[s.city];
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, s.email.toLowerCase()))
      .limit(1);

    let uId = existing?.id || crypto.randomUUID();
    if (existing) {
      await db
        .update(schema.users)
        .set({ name: s.name, role: s.role, branchId: bId, passwordHash: hashedPw, isActive: true, approvalStatus: 'APPROVED' })
        .where(eq(schema.users.id, uId));
    } else {
      await db.insert(schema.users).values({
        id: uId,
        name: s.name,
        email: s.email.toLowerCase(),
        passwordHash: hashedPw,
        role: s.role,
        branchId: bId,
        isActive: true,
        approvalStatus: 'APPROVED',
        createdAt: new Date(),
      });
    }

    const [existingEmp] = await db
      .select()
      .from(schema.employees)
      .where(eq(schema.employees.userId, uId))
      .limit(1);

    let empId = existingEmp?.id || crypto.randomUUID();
    if (existingEmp) {
      await db
        .update(schema.employees)
        .set({ name: s.name, phone: s.phone, branchId: bId, monthlyTarget: s.target, isActive: true, isDemo: true })
        .where(eq(schema.employees.id, empId));
    } else {
      await db.insert(schema.employees).values({
        id: empId,
        name: s.name,
        email: s.email.toLowerCase(),
        phone: s.phone,
        branchId: bId,
        userId: uId,
        monthlyTarget: s.target,
        isActive: true,
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    employeeIds[s.city]?.push(empId);
    credentials.push({ role: s.role, name: s.name, email: s.email, branch: s.city, password: DEMO_PASSWORD });
  }

  // 4. Customers
  console.log('-> Seeding 30+ Indian Customers with login accounts...');
  const customerIds: string[] = [];
  for (let i = 0; i < CUSTOMERS_DEF.length; i++) {
    const c = CUSTOMERS_DEF[i];
    const [existingUser] = await db.select().from(schema.users).where(eq(schema.users.email, c.email.toLowerCase())).limit(1);
    let uId = existingUser?.id || crypto.randomUUID();

    if (existingUser) {
      await db.update(schema.users).set({ name: c.name, passwordHash: hashedPw, role: 'CUSTOMER', isActive: true, approvalStatus: 'APPROVED' }).where(eq(schema.users.id, uId));
    } else {
      await db.insert(schema.users).values({
        id: uId,
        name: c.name,
        email: c.email.toLowerCase(),
        passwordHash: hashedPw,
        role: 'CUSTOMER',
        branchId: null,
        isActive: true,
        approvalStatus: 'APPROVED',
        createdAt: new Date(),
      });
    }

    const [existingCust] = await db.select().from(schema.customers).where(eq(schema.customers.email, c.email.toLowerCase())).limit(1);
    let cId = existingCust?.id || crypto.randomUUID();
    if (existingCust) {
      await db.update(schema.customers).set({ name: c.name, phone: c.phone, address: c.address, city: c.city, userId: uId, isDemo: true }).where(eq(schema.customers.id, cId));
    } else {
      await db.insert(schema.customers).values({
        id: cId,
        name: c.name,
        phone: c.phone,
        email: c.email.toLowerCase(),
        address: c.address,
        city: c.city,
        idProofType: i % 2 === 0 ? 'Aadhaar Card' : 'PAN Card',
        idProofNumber: `XXXX-XXXX-${1000 + i}`,
        userId: uId,
        isDemo: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    customerIds.push(cId);
    if (i < 3) {
      credentials.push({ role: 'CUSTOMER', name: c.name, email: c.email, branch: c.city, password: DEMO_PASSWORD });
    }
  }

  // 5. Suppliers
  console.log('-> Seeding OEM vehicle manufacturers...');
  const oemNames = [
    { name: 'Tata Motors Passenger Vehicles Ltd', phone: '+91 22 6665 8282', email: 'dealers@tatamotors.com' },
    { name: 'Mahindra & Mahindra Automotive', phone: '+91 22 2490 1441', email: 'dealers@mahindra.com' },
    { name: 'Hyundai Motor India Ltd', phone: '+91 124 478 5000', email: 'dealers@hyundai.co.in' },
    { name: 'Toyota Kirloskar Motor Pvt Ltd', phone: '+91 80 6629 2000', email: 'dealers@toyota-kirloskar.co.in' },
    { name: 'BMW Group India', phone: '+91 124 456 6600', email: 'dealers@bmw.in' },
  ];
  const supplierIds: string[] = [];
  for (const s of oemNames) {
    const [existing] = await db.select().from(schema.suppliers).where(eq(schema.suppliers.supplierName, s.name)).limit(1);
    if (existing) {
      supplierIds.push(existing.id);
    } else {
      const sId = crypto.randomUUID();
      await db.insert(schema.suppliers).values({
        id: sId,
        supplierName: s.name,
        contactPerson: 'OEM Dealer Coordinator',
        phone: s.phone,
        email: s.email,
        address: 'India Automotive Corridor',
        isDemo: true,
        createdAt: new Date(),
      });
      supplierIds.push(sId);
    }
  }

  // 6. Generate 95 Individual VIN Cars across all 5 branches
  console.log('-> Generating 95 cars across all 5 branches (Stock, In-Transit, Reserved)...');
  const carIds: string[] = [];
  const branchCities = Object.keys(branchMap);
  let vinCounter = 10000;

  for (let i = 0; i < 95; i++) {
    const cat = CAR_CATALOGUE[i % CAR_CATALOGUE.length];
    const variant = cat.variants[i % cat.variants.length];
    const fuel = cat.fuels[i % cat.fuels.length];
    const trans = cat.trans[i % cat.trans.length];
    const colour = COLOURS[i % COLOURS.length];
    const city = branchCities[i % branchCities.length];
    const branchId = branchMap[city];
    const year = 2024 + (i % 3);

    const basePrice = cat.priceRange[0] + ((cat.priceRange[1] - cat.priceRange[0]) * ((i % 10) / 10));

    let invStatus: 'IN_STOCK' | 'IN_TRANSIT' | 'RESERVED' | 'SOLD' = 'IN_STOCK';
    let carStatus = 'Available';
    let transferTo: string | null = null;

    if (i % 8 === 0) {
      invStatus = 'IN_TRANSIT';
      carStatus = 'In Transit';
      const otherCity = branchCities[(i + 1) % branchCities.length];
      transferTo = branchMap[otherCity];
    } else if (i % 11 === 0) {
      invStatus = 'RESERVED';
      carStatus = 'Reserved';
    } else if (i % 17 === 0) {
      invStatus = 'SOLD';
      carStatus = 'Sold';
    }

    const vin = `MAL${cat.brand.slice(0, 2).toUpperCase()}${year}${vinCounter++}`;
    const [existing] = await db.select().from(schema.cars).where(eq(schema.cars.vinChassisNo, vin)).limit(1);

    let cId = existing?.id || crypto.randomUUID();
    if (existing) {
      await db.update(schema.cars).set({
        price: basePrice.toFixed(2),
        status: carStatus,
        inventoryStatus: invStatus,
        branchId,
        transferTo,
        isDemo: true,
      }).where(eq(schema.cars.id, cId));
    } else {
      await db.insert(schema.cars).values({
        id: cId,
        brand: cat.brand,
        model: cat.model,
        variant,
        fuelType: fuel,
        transmission: trans,
        color: colour,
        manufacturingYear: year,
        price: basePrice.toFixed(2),
        vinChassisNo: vin,
        status: carStatus,
        inventoryStatus: invStatus,
        branchId,
        transferTo,
        imageKey: cat.imageKey,
        isDemo: true,
        createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
        updatedAt: new Date(),
      });
    }
    carIds.push(cId);
  }

  // 7. Enquiries (Leads across stages)
  console.log('-> Seeding 50 enquiries across lead lifecycle stages...');
  const enquiryStages: Array<'NEW' | 'CONTACTED' | 'TEST_DRIVE' | 'QUOTED' | 'BOOKED' | 'CLOSED_WON' | 'CLOSED_LOST'> = [
    'NEW', 'CONTACTED', 'TEST_DRIVE', 'QUOTED', 'BOOKED', 'CLOSED_WON', 'CLOSED_LOST',
  ];

  const enquiryIds: string[] = [];
  const remarksList = [
    'Customer interested in test drive with family this Saturday.',
    'Enquired about exchange bonus on older vehicle.',
    'Requested fast-track financing assistance and insurance quotation.',
    'Comparing with competing segment models; follow-up scheduled.',
    'Customer booked vehicle. Automatic demand procurement initiated.',
    'Booking token paid; awaiting vehicle delivery and registration.',
  ];

  for (let i = 0; i < 50; i++) {
    const custId = customerIds[i % customerIds.length];
    const carId = carIds[i % carIds.length];
    const bCity = branchCities[i % branchCities.length];
    const bId = branchMap[bCity];
    const staffList = employeeIds[bCity] || [];
    const empId = staffList[i % staffList.length] || null;
    const stage = enquiryStages[i % enquiryStages.length];
    const eId = crypto.randomUUID();

    await db.insert(schema.enquiries).values({
      id: eId,
      customerId: custId,
      branchId: bId,
      employeeId: empId,
      carId: carId,
      testDriveCarId: stage === 'TEST_DRIVE' ? carId : null,
      stage: stage,
      status: stage === 'BOOKED' || stage === 'CLOSED_WON' ? 'Booked' : 'Active',
      enquiryType: 'Vehicle Booking Request',
      requestedBrand: CAR_CATALOGUE[i % CAR_CATALOGUE.length].brand,
      requestedModel: CAR_CATALOGUE[i % CAR_CATALOGUE.length].model,
      requestedVariant: CAR_CATALOGUE[i % CAR_CATALOGUE.length].variants[0],
      preferredBudget: (1500000 + (i * 50000)).toFixed(2),
      expectedTimeline: i % 2 === 0 ? 'Within 15 days' : 'Within 30 days',
      remarks: remarksList[i % remarksList.length],
      bookingAmount: stage === 'BOOKED' || stage === 'CLOSED_WON' ? '50000.00' : '0.00',
      isDemo: true,
      createdAt: new Date(Date.now() - (i * 12 * 60 * 60 * 1000)),
      updatedAt: new Date(),
    });
    enquiryIds.push(eId);
  }

  // 8. Quotations with Indian On-Road Tax & Insurance breakdown
  console.log('-> Seeding 25 official quotations with GST & RTO breakdowns...');
  for (let i = 0; i < 25; i++) {
    const custId = customerIds[i % customerIds.length];
    const carId = carIds[i % carIds.length];
    const bCity = branchCities[i % branchCities.length];
    const bId = branchMap[bCity];
    const staffList = employeeIds[bCity] || [];
    const empId = staffList[i % staffList.length] || staffList[0];
    const qNum = `QUO-2026-${1000 + i}`;
    const cat = CAR_CATALOGUE[i % CAR_CATALOGUE.length];

    const exShowroom = 1650000 + (i * 80000);
    const gst = exShowroom * 0.28;
    const roadTax = exShowroom * 0.12;
    const insurance = 52000 + (i * 2000);
    const discount = i % 3 === 0 ? 35000 : 0;
    const onRoad = exShowroom + gst + roadTax + insurance - discount;

    const [existing] = await db.select().from(schema.quotations).where(eq(schema.quotations.quotationNumber, qNum)).limit(1);
    if (!existing) {
      await db.insert(schema.quotations).values({
        id: crypto.randomUUID(),
        quotationNumber: qNum,
        customerId: custId,
        carId,
        branchId: bId,
        employeeId: empId,
        brand: cat.brand,
        model: cat.model,
        variant: cat.variants[0],
        color: COLOURS[i % COLOURS.length],
        exShowroomPrice: exShowroom.toFixed(2),
        gstRate: '28.00',
        gstAmount: gst.toFixed(2),
        insuranceAmount: insurance.toFixed(2),
        rtoTax: roadTax.toFixed(2),
        accessoriesAmount: '0.00',
        discountAmount: discount.toFixed(2),
        maxAllowedDiscount: '25000.00',
        discountApprovalStatus: discount > 25000 ? 'APPROVED' : 'APPROVED',
        onRoadPrice: onRoad.toFixed(2),
        status: i % 2 === 0 ? 'APPROVED' : 'SENT',
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - (i * 18 * 60 * 60 * 1000)),
        updatedAt: new Date(),
      });
    }
  }

  // 9. Demand-Driven Procurement Purchase Orders
  console.log('-> Seeding 20 Demand-Driven Procurement Orders to Manufacturers...');
  const procStages: Array<'REQUESTED' | 'MANAGER_APPROVED' | 'OWNER_APPROVED' | 'ORDERED' | 'IN_TRANSIT' | 'RECEIVED' | 'ALLOCATED'> = [
    'REQUESTED', 'MANAGER_APPROVED', 'OWNER_APPROVED', 'ORDERED', 'IN_TRANSIT', 'RECEIVED', 'ALLOCATED',
  ];

  for (let i = 0; i < 20; i++) {
    const bCity = branchCities[i % branchCities.length];
    const bId = branchMap[bCity];
    const staffList = employeeIds[bCity] || [];
    const empId = staffList[i % staffList.length] || staffList[0];
    const supId = supplierIds[i % supplierIds.length];
    const carId = carIds[(i + 15) % carIds.length];
    const enqId = enquiryIds[i % enquiryIds.length];
    const stage = procStages[i % procStages.length];
    const cost = 1350000 + (i * 60000);

    await db.insert(schema.purchases).values({
      id: crypto.randomUUID(),
      supplierId: supId,
      carId,
      branchId: bId,
      employeeId: empId,
      enquiryId: enqId,
      purchaseDate: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
      purchaseCost: cost.toFixed(2),
      procurementStage: stage,
      status: stage === 'RECEIVED' || stage === 'ALLOCATED' ? 'Received' : 'Pending Approval',
      isDemo: true,
      createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)),
    });
  }

  // 10. Payments (Tokens, Bank Disbursements, Full Settlements)
  console.log('-> Seeding 25 customer payment receipts...');
  const paymentMethods = ['UPI', 'NEFT', 'NetBanking', 'Card', 'Cheque'];
  for (let i = 0; i < 25; i++) {
    const custId = customerIds[i % customerIds.length];
    const bCity = branchCities[i % branchCities.length];
    const bId = branchMap[bCity];
    const staffList = employeeIds[bCity] || [];
    const empId = staffList[i % staffList.length] || staffList[0];
    const refNum = `DEMO-TXN-${10000 + i}`;
    const receiptNo = `REC-2026-${1000 + i}`;
    const amt = i % 3 === 0 ? 50000 : i % 3 === 1 ? 250000 : 1550000;

    const [existing] = await db.select().from(schema.payments).where(eq(schema.payments.receiptNo, receiptNo)).limit(1);
    if (!existing) {
      await db.insert(schema.payments).values({
        id: crypto.randomUUID(),
        receiptNo,
        enquiryId: enquiryIds[i % enquiryIds.length],
        customerId: custId,
        branchId: bId,
        recordedBy: empId,
        amount: amt.toFixed(2),
        paymentMethod: paymentMethods[i % paymentMethods.length],
        paymentType: amt <= 50000 ? 'Booking Token' : amt <= 500000 ? 'Part Payment' : 'Full Payment',
        transactionReference: refNum,
        remarks: `Receipt issued for vehicle booking and delivery advance`,
        paymentStatus: 'PAID',
        paymentDate: new Date(Date.now() - (i * 14 * 60 * 60 * 1000)),
        createdAt: new Date(Date.now() - (i * 14 * 60 * 60 * 1000)),
      });
    }
  }

  console.log('\n========================================================================');
  console.log('         ✓ RICH INDIAN DEMO DATASET SEEDED SUCCESSFULLY!                 ');
  console.log('========================================================================\n');
  console.log('Statistics:');
  console.log('  • Showroom Branches : 5 (Mumbai, Pune, Bengaluru, New Delhi, Hyderabad)');
  console.log('  • Dealership Staff  : 16 (1 Owner, 5 Managers, 10 Sales Executives)');
  console.log('  • Customer Profiles : 15+ with Indian KYC & Login Accounts');
  console.log('  • Car Inventory     : 95 individual VIN cars (Available, In-Transit, Reserved)');
  console.log('  • Customer Enquiries: 50 leads mapped across 7 lifecycle stages');
  console.log('  • Price Quotations  : 25 on-road quotations with GST & RTO tax breakdown');
  console.log('  • Procurement POs   : 20 demand-driven manufacturer purchase orders');
  console.log('  • Payments Recorded : 25 UPI/NEFT transaction receipts\n');

  console.log('------------------------------------------------------------------------');
  console.log('                   LOGIN CREDENTIALS FOR TESTING                        ');
  console.log('------------------------------------------------------------------------');
  console.table(credentials);
  console.log('------------------------------------------------------------------------');
  console.log('Visit: http://localhost:3000/auth to log in.\n');
}

seedDemo()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Demo seed failed:', e);
    process.exit(1);
  });
