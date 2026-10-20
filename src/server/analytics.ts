import { db, schema } from './db';
import { eq, ne, and, sql, desc } from 'drizzle-orm';
import { getSessionUser } from './auth';

export interface BranchAnalytics {
  totalRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  unitsSold: number;
  activeLeads: number;
  conversionRate: number;
  averageSaleValue: number;
  staffPerformance: {
    employeeId: string;
    name: string;
    unitsSold: number;
    target: number;
    revenue: number;
  }[];
  modelWiseSales: {
    model: string;
    count: number;
    revenue: number;
  }[];
  inventoryAgeing: {
    under30: number;
    days30to60: number;
    days60to90: number;
    above90: number;
  };
}

export interface OwnerCompanyAnalytics extends BranchAnalytics {
  branchComparison: {
    branchId: string;
    branchName: string;
    city: string;
    revenue: number;
    unitsSold: number;
    inventoryCount: number;
  }[];
  fuelDistribution: {
    fuelType: string;
    count: number;
  }[];
  leadFunnel: {
    stage: string;
    count: number;
    conversionPct: number;
  }[];
  loginActivity: {
    date: string;
    logins: number;
    failedAttempts: number;
  }[];
  recentAuditLogs: {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    role: string;
    createdAt: string;
  }[];
}

/**
 * Fetch branch-scoped or all-branch analytics from local MySQL
 */
export async function fetchBranchAnalytics(
  targetBranchId?: string,
  period: 'today' | '7days' | '30days' | 'this_year' = '30days'
): Promise<BranchAnalytics> {
  const session = await getSessionUser();
  if (!session) {
    throw new Error('Unauthorized: Session required for analytics');
  }

  // Branch Manager can ONLY view their assigned branch
  let effectiveBranchId = targetBranchId;
  if (session.role === 'BRANCH_MANAGER') {
    if (!session.branchId) {
      throw new Error('Branch Manager must have an assigned branch');
    }
    effectiveBranchId = session.branchId;
  } else if (session.role === 'EMPLOYEE') {
    effectiveBranchId = session.branchId || undefined;
  }

  // 1. Fetch Sales
  let salesQuery = db
    .select()
    .from(schema.sales)
    .where(ne(schema.sales.status, 'Cancelled'));
  let allSales = await salesQuery;
  if (effectiveBranchId) {
    allSales = allSales.filter((s) => s.branchId === effectiveBranchId);
  }

  // 2. Fetch Leads / Enquiries
  let enquiriesQuery = db.select().from(schema.enquiries);
  let allEnquiries = await enquiriesQuery;
  if (effectiveBranchId) {
    allEnquiries = allEnquiries.filter((e) => e.branchId === effectiveBranchId);
  }

  // 3. Fetch Inventory Cars
  let carsQuery = db.select().from(schema.cars);
  let allCars = await carsQuery;
  if (effectiveBranchId) {
    allCars = allCars.filter((c) => c.branchId === effectiveBranchId);
  }

  // 4. Fetch Staff
  let staffQuery = db.select().from(schema.employees);
  let allStaff = await staffQuery;
  if (effectiveBranchId) {
    allStaff = allStaff.filter((e) => e.branchId === effectiveBranchId);
  }

  // Aggregations
  const totalRevenue = allSales.reduce((sum, s) => sum + Number(s.saleAmount || 0), 0);
  const totalCollected = allSales.reduce((sum, s) => sum + Number(s.amountPaid || 0), 0);
  const totalOutstanding = Math.max(0, totalRevenue - totalCollected);
  const unitsSold = allSales.filter((s) => s.status === 'Completed').length;
  const activeLeads = allEnquiries.filter((e) => !['CLOSED_WON', 'CLOSED_LOST'].includes(e.stage)).length;
  const conversionRate = allEnquiries.length > 0 ? Math.round((unitsSold / allEnquiries.length) * 100) : 0;
  const averageSaleValue = unitsSold > 0 ? Math.round(totalRevenue / unitsSold) : 0;

  // Staff Performance
  const staffPerformance = allStaff.map((emp) => {
    const empSales = allSales.filter((s) => s.employeeId === emp.id);
    const empSold = empSales.filter((s) => s.status === 'Completed').length;
    const empRev = empSales.reduce((sum, s) => sum + Number(s.saleAmount || 0), 0);
    return {
      employeeId: emp.id,
      name: emp.name,
      unitsSold: empSold,
      target: emp.monthlyTarget || 5,
      revenue: empRev,
    };
  });

  // Model-wise Sales
  const modelMap = new Map<string, { count: number; revenue: number }>();
  allSales.forEach((s) => {
    const car = allCars.find((c) => c.id === s.carId);
    const modelName = car?.model || 'General Inventory';
    const curr = modelMap.get(modelName) || { count: 0, revenue: 0 };
    curr.count += 1;
    curr.revenue += Number(s.saleAmount || 0);
    modelMap.set(modelName, curr);
  });

  const modelWiseSales = Array.from(modelMap.entries()).map(([model, stats]) => ({
    model,
    count: stats.count,
    revenue: stats.revenue,
  }));

  // Inventory Ageing
  const now = Date.now();
  const inventoryAgeing = {
    under30: 0,
    days30to60: 0,
    days60to90: 0,
    above90: 0,
  };

  allCars.forEach((c) => {
    if (c.status === 'Sold' || c.status === 'Delivered') return;
    const createdDate = c.createdAt ? new Date(c.createdAt).getTime() : now;
    const ageDays = Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24));
    if (ageDays <= 30) inventoryAgeing.under30++;
    else if (ageDays <= 60) inventoryAgeing.days30to60++;
    else if (ageDays <= 90) inventoryAgeing.days60to90++;
    else inventoryAgeing.above90++;
  });

  return {
    totalRevenue,
    totalCollected,
    totalOutstanding,
    unitsSold,
    activeLeads,
    conversionRate,
    averageSaleValue,
    staffPerformance,
    modelWiseSales,
    inventoryAgeing,
  };
}

/**
 * Fetch company-wide executive analytics for the OWNER role
 */
export async function fetchOwnerAnalytics(): Promise<OwnerCompanyAnalytics> {
  const session = await getSessionUser();
  if (!session || session.role !== 'OWNER') {
    throw new Error('Forbidden: Only the Dealership Owner can access company-wide analytics');
  }

  // Base branch analytics across all branches
  const baseStats = await fetchBranchAnalytics(undefined, '30days');

  // 1. All Branches
  const allBranches = await db.select().from(schema.branches);
  const allSales = await db
    .select()
    .from(schema.sales)
    .where(ne(schema.sales.status, 'Cancelled'));
  const allCars = await db.select().from(schema.cars);
  const allEnquiries = await db.select().from(schema.enquiries);

  // Branch Comparison
  const branchComparison = allBranches.map((b) => {
    const bSales = allSales.filter((s) => s.branchId === b.id);
    const bRevenue = bSales.reduce((acc, s) => acc + Number(s.saleAmount || 0), 0);
    const bUnits = bSales.filter((s) => s.status === 'Completed').length;
    const bInventory = allCars.filter((c) => c.branchId === b.id && c.status === 'Available').length;
    return {
      branchId: b.id,
      branchName: b.branchName,
      city: b.city,
      revenue: bRevenue,
      unitsSold: bUnits,
      inventoryCount: bInventory,
    };
  });

  // Fuel Type Distribution
  const fuelMap = new Map<string, number>();
  allCars.forEach((c) => {
    const fuel = c.fuelType || 'Petrol';
    fuelMap.set(fuel, (fuelMap.get(fuel) || 0) + 1);
  });
  const fuelDistribution = Array.from(fuelMap.entries()).map(([fuelType, count]) => ({
    fuelType,
    count,
  }));

  // Lead Funnel Progression & Conversion Drop-offs
  const stages: { stage: string; label: string }[] = [
    { stage: 'NEW', label: '1. New Enquiries' },
    { stage: 'CONTACTED', label: '2. Contacted' },
    { stage: 'TEST_DRIVE', label: '3. Test Drive' },
    { stage: 'QUOTED', label: '4. Quotation' },
    { stage: 'BOOKED', label: '5. Booking Confirmed' },
    { stage: 'CLOSED_WON', label: '6. Won / Delivered' },
  ];

  const totalLeads = allEnquiries.length || 1;
  const leadFunnel = stages.map((st) => {
    const stageCount = allEnquiries.filter((e) => e.stage === st.stage).length;
    return {
      stage: st.label,
      count: stageCount,
      conversionPct: Math.round((stageCount / totalLeads) * 100),
    };
  });

  // Login Activity from login_events table
  const recentLogins = await db
    .select()
    .from(schema.loginEvents)
    .orderBy(desc(schema.loginEvents.createdAt))
    .limit(100);

  // Group logins by date
  const loginDayMap = new Map<string, { logins: number; failed: number }>();
  recentLogins.forEach((ev) => {
    const day = ev.createdAt ? new Date(ev.createdAt).toLocaleDateString('en-IN') : 'Today';
    const curr = loginDayMap.get(day) || { logins: 0, failed: 0 };
    if (ev.eventType === 'login') curr.logins++;
    if (ev.eventType === 'failed_login') curr.failed++;
    loginDayMap.set(day, curr);
  });

  const loginActivity = Array.from(loginDayMap.entries()).map(([date, stats]) => ({
    date,
    logins: stats.logins,
    failedAttempts: stats.failed,
  }));

  // Recent System Audit Logs
  const recentAudits = await db
    .select()
    .from(schema.auditLogs)
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(10);

  const recentAuditLogs = recentAudits.map((a) => ({
    id: a.id,
    action: a.action,
    entity: a.entity,
    entityId: a.entityId,
    role: a.role,
    createdAt: a.createdAt ? new Date(a.createdAt).toLocaleString('en-IN') : '',
  }));

  return {
    ...baseStats,
    branchComparison,
    fuelDistribution,
    leadFunnel,
    loginActivity,
    recentAuditLogs,
  };
}
