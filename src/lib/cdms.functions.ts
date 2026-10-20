import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import {
  assertPermission,
  assertBranchScope,
  assertEnquiryTransition,
  assertProcurementTransition,
  assertCarInventoryTransition,
  assertPaymentTransition,
  isDiscountApprovalRequired,
  writeAuditLog,
  STANDARD_MAX_DISCOUNT_INR,
  type UserContext,
} from '../server/permissions';
import { writeAudit } from '../server/audit';
import { createNotification, markNotificationAsRead, markAllNotificationsAsRead } from '../server/notifications';
import { getSessionUser } from '../server/auth';
import { db, schema } from '../server/db';
import { eq, and, desc, ne, sql, like, or, gte, lte } from 'drizzle-orm';
import crypto from 'node:crypto';

async function requireAuthUser(): Promise<UserContext & { name: string; email: string }> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error('Unauthorized: Session expired or invalid. Please sign in.');
  }

  // Find linked employee ID if available
  let employeeId: string | null = null;
  const [emp] = await db
    .select({ id: schema.employees.id })
    .from(schema.employees)
    .where(eq(schema.employees.userId, user.id))
    .limit(1);

  if (emp) {
    employeeId = emp.id;
  }

  return {
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
    employeeId,
    name: user.name,
    email: user.email,
  };
}

// -------------------------------------------------------------
// WORKSPACE DATA LOADER (SCOPED BY ROLE & BRANCH)
// -------------------------------------------------------------
export const getWorkspaceDataServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await requireAuthUser();
  const role = user.role.toUpperCase();
  const branchId = user.branchId;

  // 1. Branches
  const allBranches = await db.select().from(schema.branches);

  // 2. Employees (Filtered for Manager/Employee, all for Owner, empty for Customer)
  let staffList = await db.select().from(schema.employees);
  if (role === 'BRANCH_MANAGER' || role === 'EMPLOYEE') {
    if (branchId) {
      staffList = staffList.filter((e) => e.branchId === branchId);
    }
  } else if (role === 'CUSTOMER') {
    staffList = [];
  }

  // 3. Customers (Strictly scoped: Customer only sees self; Branch staff only see customers of their branch)
  let customersList = await db.select().from(schema.customers);
  if (role === 'CUSTOMER') {
    let myCustomer = customersList.find(
      (c) => c.userId === user.userId || (c.email && c.email.toLowerCase() === user.email.toLowerCase())
    );
    if (!myCustomer) {
      const newCustId = crypto.randomUUID();
      await db.insert(schema.customers).values({
        id: newCustId,
        name: user.name,
        email: user.email,
        phone: '',
        address: '',
        city: '',
        idProofType: '',
        idProofNumber: '',
        userId: user.userId,
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      const [created] = await db.select().from(schema.customers).where(eq(schema.customers.id, newCustId)).limit(1);
      myCustomer = created;
    }
    customersList = myCustomer ? [myCustomer] : [];
  } else if (role === 'BRANCH_MANAGER' || role === 'EMPLOYEE') {
    if (branchId) {
      const currentBranch = allBranches.find((b) => b.id === branchId);
      const branchCity = currentBranch?.city?.toLowerCase() || '';

      // Find all customer IDs that have an enquiry, quotation, sale, or payment at this branch
      const branchEnquiries = await db
        .select({ customerId: schema.enquiries.customerId })
        .from(schema.enquiries)
        .where(eq(schema.enquiries.branchId, branchId));
      const branchQuotations = await db
        .select({ customerId: schema.quotations.customerId })
        .from(schema.quotations)
        .where(eq(schema.quotations.branchId, branchId));
      const branchSales = await db
        .select({ customerId: schema.sales.customerId })
        .from(schema.sales)
        .where(eq(schema.sales.branchId, branchId));
      const branchPayments = await db
        .select({ customerId: schema.payments.customerId })
        .from(schema.payments)
        .where(eq(schema.payments.branchId, branchId));

      const branchCustomerIds = new Set([
        ...branchEnquiries.map((e) => e.customerId),
        ...branchQuotations.map((q) => q.customerId),
        ...branchSales.map((s) => s.customerId),
        ...branchPayments.map((p) => p.customerId),
      ]);

      // A customer is visible to this branch if:
      // (1) Their registered city matches this branch's city, OR
      // (2) They have selected / interacted with this branch (enquiry, quotation, booking, sale)
      customersList = customersList.filter((c) => {
        if (c.city && branchCity && c.city.toLowerCase() === branchCity) return true;
        if (branchCustomerIds.has(c.id)) return true;
        return false;
      });
    }
  }

  // 4. Cars (Inventory)
  let carsList = await db.select().from(schema.cars).orderBy(desc(schema.cars.createdAt));
  if (role === 'BRANCH_MANAGER' || role === 'EMPLOYEE') {
    if (branchId) {
      carsList = carsList.filter((c) => c.branchId === branchId || c.transferTo === branchId);
    }
  }

  // 5. Enquiries (Leads & Test Drives: Customer only sees their own enquiries)
  let enquiriesList = await db.select().from(schema.enquiries).orderBy(desc(schema.enquiries.createdAt));
  if (role === 'BRANCH_MANAGER') {
    if (branchId) {
      enquiriesList = enquiriesList.filter((e) => e.branchId === branchId);
    }
  } else if (role === 'EMPLOYEE') {
    if (user.employeeId) {
      enquiriesList = enquiriesList.filter((e) => e.employeeId === user.employeeId);
    }
  } else if (role === 'CUSTOMER') {
    const myCustomerIds = new Set(customersList.map((c) => c.id));
    enquiriesList = enquiriesList.filter((e) => myCustomerIds.has(e.customerId));
  }

  // 6. Quotations (Customer only sees their own quotations)
  let quotationsList = await db.select().from(schema.quotations).orderBy(desc(schema.quotations.createdAt));
  if (role === 'BRANCH_MANAGER') {
    if (branchId) {
      quotationsList = quotationsList.filter((q) => q.branchId === branchId);
    }
  } else if (role === 'EMPLOYEE') {
    if (user.employeeId) {
      quotationsList = quotationsList.filter((q) => q.employeeId === user.employeeId);
    }
  } else if (role === 'CUSTOMER') {
    const myCustomerIds = new Set(customersList.map((c) => c.id));
    quotationsList = quotationsList.filter((q) => myCustomerIds.has(q.customerId));
  }

  // 7. Sales (Bookings & Invoices: Customer only sees their own sales)
  let salesList = await db.select().from(schema.sales).orderBy(desc(schema.sales.createdAt));
  if (role === 'BRANCH_MANAGER') {
    if (branchId) {
      salesList = salesList.filter((s) => s.branchId === branchId);
    }
  } else if (role === 'EMPLOYEE') {
    if (user.employeeId) {
      salesList = salesList.filter((s) => s.employeeId === user.employeeId);
    }
  } else if (role === 'CUSTOMER') {
    const myCustomerIds = new Set(customersList.map((c) => c.id));
    salesList = salesList.filter((s) => myCustomerIds.has(s.customerId));
  }

  // 8. Payments (Customer only sees their own payments)
  let paymentsList = await db.select().from(schema.payments).orderBy(desc(schema.payments.createdAt));
  if (role === 'BRANCH_MANAGER') {
    if (branchId) {
      paymentsList = paymentsList.filter((p) => p.branchId === branchId);
    }
  } else if (role === 'EMPLOYEE') {
    if (branchId) {
      paymentsList = paymentsList.filter((p) => p.branchId === branchId);
    }
  } else if (role === 'CUSTOMER') {
    const myCustomerIds = new Set(customersList.map((c) => c.id));
    paymentsList = paymentsList.filter((p) => myCustomerIds.has(p.customerId));
  }

  // 9. Purchases (Procurement)
  let purchasesList = await db.select().from(schema.purchases).orderBy(desc(schema.purchases.createdAt));
  if (role === 'BRANCH_MANAGER') {
    if (branchId) {
      purchasesList = purchasesList.filter((p) => p.branchId === branchId);
    }
  } else if (role === 'EMPLOYEE' || role === 'CUSTOMER') {
    purchasesList = []; // Employees and Customers cannot view procurement orders
  }

  // 10. Suppliers & Accessories
  const suppliersList = await db.select().from(schema.suppliers);
  const accessoriesList = await db.select().from(schema.accessoriesCatalogue);

  // 11. Audit logs, Login events & All Users (Owner only)
  let auditLogsList: any[] = [];
  let loginEventsList: any[] = [];
  let usersList: any[] = [];
  if (role === 'OWNER') {
    auditLogsList = await db.select().from(schema.auditLogs).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
    loginEventsList = await db.select().from(schema.loginEvents).orderBy(desc(schema.loginEvents.createdAt)).limit(100);
    const rawUsers = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        branchId: schema.users.branchId,
        isActive: schema.users.isActive,
        approvalStatus: schema.users.approvalStatus,
        createdAt: schema.users.createdAt,
        lastLoginAt: schema.users.lastLoginAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt));
    usersList = rawUsers;
  } else if (role === 'BRANCH_MANAGER' && branchId) {
    auditLogsList = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.branchId, branchId)).orderBy(desc(schema.auditLogs.createdAt)).limit(200);
  }

  // 12. Notifications (Role & Branch scoped)
  let notificationsList: any[] = [];
  try {
    const notifConditions = [eq(schema.notifications.userId, user.userId)];
    if (role === 'OWNER') {
      notifConditions.push(eq(schema.notifications.role, 'OWNER'));
    } else if (role === 'BRANCH_MANAGER') {
      if (branchId) {
        notifConditions.push(
          and(eq(schema.notifications.role, 'BRANCH_MANAGER'), eq(schema.notifications.branchId, branchId))
        );
      } else {
        notifConditions.push(eq(schema.notifications.role, 'BRANCH_MANAGER'));
      }
    } else if (role === 'EMPLOYEE') {
      if (branchId) {
        notifConditions.push(
          and(eq(schema.notifications.role, 'EMPLOYEE'), eq(schema.notifications.branchId, branchId))
        );
      } else {
        notifConditions.push(eq(schema.notifications.role, 'EMPLOYEE'));
      }
    } else if (role === 'CUSTOMER') {
      // Customers only receive notifications targeted specifically to their own user ID
    }

    notificationsList = await db
      .select()
      .from(schema.notifications)
      .where(or(...notifConditions))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50);
  } catch (err) {
    console.error('Error fetching notifications:', err);
  }

  // Shape compatibility for existing UI
  const formatRecord = (r: any) => {
    if (!r) return r;
    const formatted: any = { ...r };
    // Provide snake_case aliases for UI backwards compatibility
    for (const key of Object.keys(r)) {
      const snake = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      if (formatted[snake] === undefined) {
        formatted[snake] = r[key];
      }
    }
    return formatted;
  };

  return {
    user: {
      id: user.userId,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase(),
      branchId: user.branchId,
      employeeId: user.employeeId,
    },
    roles: [{ role: user.role.toLowerCase(), branch_id: user.branchId }],
    branches: allBranches.map(formatRecord),
    employees: staffList.map(formatRecord),
    customers: customersList.map(formatRecord),
    cars: carsList.map(formatRecord),
    enquiries: enquiriesList.map(formatRecord),
    quotations: quotationsList.map(formatRecord),
    sales: salesList.map(formatRecord),
    payments: paymentsList.map(formatRecord),
    purchases: purchasesList.map(formatRecord),
    suppliers: suppliersList.map(formatRecord),
    accessories: accessoriesList.map(formatRecord),
    audit_logs: auditLogsList.map(formatRecord),
    login_events: loginEventsList.map(formatRecord),
    users: usersList.map(formatRecord),
    notifications: notificationsList.map(formatRecord),
    services: [],
  };
});

// -------------------------------------------------------------
// CUSTOMER MUTATIONS
// -------------------------------------------------------------
export const saveCustomer = createServerFn({ method: 'POST' })
  .validator((d: {
    id?: string;
    name: string;
    phone: string;
    email: string;
    address: string;
    city: string;
    idProofType?: string;
    idProofNumber?: string;
  }) => {
    return z
      .object({
        id: z.string().optional(),
        name: z.string().min(2, 'Name is required'),
        phone: z.string().default(''),
        email: z.string().email('Invalid email').default(''),
        address: z.string().default(''),
        city: z.string().default(''),
        idProofType: z.string().default(''),
        idProofNumber: z.string().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'create_lead');

    const customerId = data.id || crypto.randomUUID();

    await db.transaction(async (tx) => {
      if (data.id) {
        const [oldCust] = await tx.select().from(schema.customers).where(eq(schema.customers.id, data.id));
        await tx
          .update(schema.customers)
          .set({
            name: data.name,
            phone: data.phone,
            email: data.email,
            address: data.address,
            city: data.city,
            idProofType: data.idProofType || '',
            idProofNumber: data.idProofNumber || '',
            updatedAt: new Date(),
          })
          .where(eq(schema.customers.id, data.id));

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: user.branchId },
          action: 'customer.updated',
          entity: 'customer',
          entityId: data.id,
          oldValue: oldCust,
          newValue: data,
          summary: `${user.role} updated profile for customer ${data.name} (${data.phone})`,
        });
      } else {
        await tx.insert(schema.customers).values({
          id: customerId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          city: data.city,
          idProofType: data.idProofType || '',
          idProofNumber: data.idProofNumber || '',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: user.branchId },
          action: 'customer.created',
          entity: 'customer',
          entityId: customerId,
          oldValue: null,
          newValue: data,
          summary: `${user.role} registered new customer ${data.name} (${data.phone})`,
        });
      }
    });

    return { success: true, customerId };
  });

// -------------------------------------------------------------
// LEAD / ENQUIRY MUTATIONS
// -------------------------------------------------------------
export const saveLead = createServerFn({ method: 'POST' })
  .validator((d: {
    id?: string;
    customerId: string;
    branchId?: string;
    preferredModel: string;
    preferredVariant?: string;
    preferredColor?: string;
    budgetMax?: number;
    expectedTimeline?: string;
    stage?: string;
    notes?: string;
    followUpDate?: string;
  }) => {
    return z
      .object({
        id: z.string().optional(),
        customerId: z.string(),
        branchId: z.string().optional(),
        preferredModel: z.string().min(1, 'Model preference required'),
        preferredVariant: z.string().optional().default(''),
        preferredColor: z.string().optional().default(''),
        budgetMax: z.number().optional(),
        expectedTimeline: z.string().optional().default(''),
        stage: z.string().optional().default('NEW'),
        notes: z.string().optional().default(''),
        followUpDate: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'create_lead');

    const effectiveBranchId = user.role.toUpperCase() === 'OWNER' ? (data.branchId || user.branchId) : user.branchId;
    if (!effectiveBranchId) {
      throw new Error('Branch assignment required for creating leads');
    }

    const enquiryId = data.id || crypto.randomUUID();

    await db.transaction(async (tx) => {
      if (data.id) {
        const [oldEnq] = await tx.select().from(schema.enquiries).where(eq(schema.enquiries.id, data.id));
        if (!oldEnq) throw new Error('Enquiry not found');

        assertBranchScope(user, oldEnq.branchId, oldEnq.employeeId);
        if (data.stage && data.stage !== oldEnq.stage) {
          assertEnquiryTransition(oldEnq.stage, data.stage);
        }

        await tx
          .update(schema.enquiries)
          .set({
            requestedModel: data.preferredModel,
            requestedVariant: data.preferredVariant || '',
            preferredColor: data.preferredColor || '',
            preferredBudget: data.budgetMax ? String(data.budgetMax) : null,
            expectedTimeline: data.expectedTimeline || '',
            stage: (data.stage as any) || oldEnq.stage,
            remarks: data.notes || oldEnq.remarks,
            followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
            updatedAt: new Date(),
          })
          .where(eq(schema.enquiries.id, data.id));

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: effectiveBranchId },
          action: 'lead.updated',
          entity: 'enquiry',
          entityId: data.id,
          oldValue: oldEnq,
          newValue: data,
          summary: `${user.role} updated lead enquiry for ${data.preferredModel} (stage: ${data.stage || oldEnq.stage})`,
        });
      } else {
        await tx.insert(schema.enquiries).values({
          id: enquiryId,
          customerId: data.customerId,
          branchId: effectiveBranchId,
          employeeId: user.employeeId || null,
          enquiryType: 'Car Enquiry',
          requestedModel: data.preferredModel,
          requestedVariant: data.preferredVariant || '',
          preferredColor: data.preferredColor || '',
          preferredBudget: data.budgetMax ? String(data.budgetMax) : null,
          expectedTimeline: data.expectedTimeline || '',
          stage: (data.stage as any) || 'NEW',
          remarks: data.notes || '',
          followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
          status: 'New',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: effectiveBranchId },
          action: 'lead.created',
          entity: 'enquiry',
          entityId: enquiryId,
          oldValue: null,
          newValue: data,
          summary: `${user.role} created new lead for ${data.preferredModel} at branch ${effectiveBranchId}`,
        });

        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: effectiveBranchId,
          title: 'New Lead Created',
          message: `${user.name} created a new lead for ${data.preferredModel}`,
          link: '?tab=leads',
          type: 'LEAD',
        });
      }
    });

    return { success: true, enquiryId };
  });

export const createEmployeeLeadServerFn = createServerFn({ method: 'POST' })
  .validator((d: {
    customerName: string;
    phone: string;
    email?: string;
    preferredModel: string;
    preferredVariant?: string;
    preferredColor?: string;
    maximumBudget?: number;
    expectedTimeline?: string;
    leadSource?: string;
    notes?: string;
    followUpDate?: string;
  }) => {
    return z
      .object({
        customerName: z.string().min(2, 'Customer name is required'),
        phone: z.string().min(10, 'Valid 10-digit phone number is required'),
        email: z.string().email().optional().or(z.literal('')),
        preferredModel: z.string().min(1, 'Model selection is required'),
        preferredVariant: z.string().optional().default(''),
        preferredColor: z.string().optional().default(''),
        maximumBudget: z.number().optional(),
        expectedTimeline: z.string().optional().default('Within 1 month'),
        leadSource: z.string().optional().default('Walk-in'),
        notes: z.string().optional().default(''),
        followUpDate: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'create_lead');

    const effectiveBranchId = user.branchId;
    if (!effectiveBranchId) {
      throw new Error('Branch assignment required for creating leads');
    }

    const cleanPhone = data.phone.replace(/\D/g, '').slice(-10);
    const cleanEmail = (data.email || '').trim().toLowerCase();

    let customerId: string = '';
    let isExisting = false;
    let finalCustomerName = data.customerName;

    const enquiryId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      // 1. Search for existing customer by phone (last 10 digits) or email
      const allCustomers = await tx.select().from(schema.customers);
      const match = allCustomers.find((c) => {
        if (cleanPhone && c.phone && c.phone.replace(/\D/g, '').slice(-10) === cleanPhone) return true;
        if (cleanEmail && c.email && c.email.toLowerCase().trim() === cleanEmail) return true;
        return false;
      });

      if (match) {
        customerId = match.id;
        isExisting = true;
        finalCustomerName = match.name;
      } else {
        customerId = crypto.randomUUID();
        await tx.insert(schema.customers).values({
          id: customerId,
          name: data.customerName.trim(),
          phone: data.phone.trim(),
          email: cleanEmail,
          address: 'Showroom Walk-in',
          city: '',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: effectiveBranchId },
          action: 'customer.created',
          entity: 'customer',
          entityId: customerId,
          oldValue: null,
          newValue: { name: data.customerName, phone: data.phone, email: cleanEmail },
          summary: `${user.role} created customer profile for ${data.customerName} (${data.phone})`,
        });
      }

      // 2. Insert Lead enquiry
      const fullRemarks = [
        data.leadSource ? `[Source: ${data.leadSource}]` : '',
        data.notes ? data.notes.trim() : '',
      ].filter(Boolean).join(' ');

      const brand = data.preferredModel.split(' ')[0] || 'CDMS';

      await tx.insert(schema.enquiries).values({
        id: enquiryId,
        customerId,
        branchId: effectiveBranchId,
        employeeId: user.employeeId || null,
        enquiryType: 'Car Enquiry',
        requestedBrand: brand,
        requestedModel: data.preferredModel,
        requestedVariant: data.preferredVariant || '',
        preferredColor: data.preferredColor || '',
        preferredBudget: data.maximumBudget ? String(data.maximumBudget) : null,
        expectedTimeline: data.expectedTimeline || 'Within 1 month',
        stage: 'NEW',
        status: 'New',
        remarks: fullRemarks,
        followUpDate: data.followUpDate ? new Date(data.followUpDate) : null,
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: effectiveBranchId },
        action: 'lead.created',
        entity: 'enquiry',
        entityId: enquiryId,
        oldValue: null,
        newValue: {
          customerId,
          model: data.preferredModel,
          timeline: data.expectedTimeline,
          isExistingCustomer: isExisting,
        },
        summary: `${user.role} created new lead for ${data.preferredModel} linked to ${isExisting ? 'existing' : 'new'} customer ${finalCustomerName}`,
      });

      await createNotification({
        tx,
        role: 'BRANCH_MANAGER',
        branchId: effectiveBranchId,
        title: 'New Lead Created',
        message: `${user.name} created a lead for ${finalCustomerName} (${data.preferredModel})`,
        link: '?tab=leads',
        type: 'LEAD',
      });
    });

    return {
      success: true,
      enquiryId,
      customerId,
      isExistingCustomer: isExisting,
      customerName: finalCustomerName,
    };
  });


// -------------------------------------------------------------
// PUBLIC CUSTOMER ENQUIRY & TEST DRIVE SUBMISSION
// -------------------------------------------------------------
export const submitPublicEnquiry = createServerFn({ method: 'POST' })
  .validator((d: {
    branchId: string;
    carId?: string | null;
    enquiryType: string;
    remarks?: string;
    requestedBrand?: string;
    requestedModel?: string;
    requestedVariant?: string;
    appointmentDate?: string | null;
  }) => {
    return z
      .object({
        branchId: z.string().min(1, 'Branch is required'),
        carId: z.string().nullable().optional(),
        enquiryType: z.string().default('Car Enquiry'),
        remarks: z.string().optional().default(''),
        requestedBrand: z.string().optional().default(''),
        requestedModel: z.string().optional().default(''),
        requestedVariant: z.string().optional().default(''),
        appointmentDate: z.string().nullable().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    let customerId: string | null = null;
    const enquiryId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      if (user) {
        const [existingCust] = await tx
          .select()
          .from(schema.customers)
          .where(eq(schema.customers.userId, user.id));
        if (existingCust) {
          customerId = existingCust.id;
        } else {
          customerId = crypto.randomUUID();
          await tx.insert(schema.customers).values({
            id: customerId,
            name: user.name || 'Customer',
            email: user.email,
            phone: '',
            address: 'Online Submission',
            city: '',
            userId: user.id,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
      } else {
        customerId = crypto.randomUUID();
        await tx.insert(schema.customers).values({
          id: customerId,
          name: 'Guest Customer',
          email: '',
          phone: '',
          address: 'Online Submission',
          city: '',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      const isTestDriveOrAppt = data.enquiryType === 'Test Drive' || data.enquiryType === 'Appointment';
      await tx.insert(schema.enquiries).values({
        id: enquiryId,
        customerId,
        branchId: data.branchId,
        carId: data.carId || null,
        enquiryType: data.enquiryType,
        stage: isTestDriveOrAppt ? 'TEST_DRIVE' : 'NEW',
        status: isTestDriveOrAppt ? 'Scheduled' : 'New',
        remarks: data.remarks || '',
        requestedBrand: data.requestedBrand || '',
        requestedModel: data.requestedModel || '',
        requestedVariant: data.requestedVariant || '',
        appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : null,
        testDriveCarId: isTestDriveOrAppt ? data.carId || null : null,
        testDriveSlot: isTestDriveOrAppt ? data.appointmentDate || null : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await writeAudit({
        tx,
        actor: {
          userId: user?.id || customerId,
          role: user?.role || 'CUSTOMER',
          branchId: data.branchId,
        },
        action: data.enquiryType === 'Test Drive' ? 'test_drive.requested' : 'lead.created',
        entity: 'enquiry',
        entityId: enquiryId,
        oldValue: null,
        newValue: { ...data, customerId },
        summary: `Public enquiry submitted: ${data.enquiryType} for ${data.requestedModel || 'Vehicle'} at branch ${data.branchId}`,
      });

      await createNotification({
        tx,
        role: 'BRANCH_MANAGER',
        branchId: data.branchId,
        title: data.enquiryType === 'Test Drive' ? 'Test Drive Requested' : 'New Online Enquiry',
        message: `${data.enquiryType} submitted for ${data.requestedModel || 'Vehicle'}`,
        link: '?tab=leads',
        type: data.enquiryType === 'Test Drive' ? 'TEST_DRIVE' : 'LEAD',
      });
    });

    return { success: true, enquiryId };
  });

// -------------------------------------------------------------
// TEST DRIVE MUTATIONS
// -------------------------------------------------------------
export const bookTestDrive = createServerFn({ method: 'POST' })
  .validator((d: {
    enquiryId?: string;
    customerId?: string;
    carId?: string;
    slot?: string;
    appointmentDate?: string;
    slotTime?: string;
    notes?: string;
    remarks?: string;
  }) => {
    return z
      .object({
        enquiryId: z.string().optional(),
        customerId: z.string().optional(),
        carId: z.string().optional(),
        slot: z.string().optional(),
        appointmentDate: z.string().optional(),
        slotTime: z.string().optional(),
        notes: z.string().optional().default(''),
        remarks: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    const role = user.role.toUpperCase();

    const slot =
      data.slot ||
      (data.appointmentDate && data.slotTime ? `${data.appointmentDate} ${data.slotTime}` : data.appointmentDate);
    if (!slot || slot.trim().length < 5) {
      throw new Error('Valid appointment date and slot are required');
    }
    const notes = data.notes || data.remarks || '';

    let targetEnquiry: any = null;
    let targetBranchId: string = user.branchId || '';

    if (role === 'CUSTOMER') {
      const [cust] = await db
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.userId, user.userId));

      if (data.enquiryId) {
        const [enq] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, data.enquiryId));
        if (!enq) throw new Error('Enquiry not found');
        if (cust && enq.customerId !== cust.id && enq.customerId !== user.userId) {
          throw new Error('Unauthorized: You can only book appointments for your own account');
        }
        targetEnquiry = enq;
        targetBranchId = enq.branchId;
      } else if (data.carId) {
        const [car] = await db.select().from(schema.cars).where(eq(schema.cars.id, data.carId));
        if (!car) throw new Error('Vehicle not found');
        targetBranchId = car.branchId || '';
      }
    } else {
      assertPermission(user.role, 'manage_test_drives');

      if (data.enquiryId) {
        const [enq] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, data.enquiryId));
        if (!enq) throw new Error('Enquiry not found');
        assertBranchScope(user, enq.branchId, enq.employeeId);
        targetEnquiry = enq;
        targetBranchId = enq.branchId;
      } else {
        if (!data.customerId || !data.carId) {
          throw new Error('Customer and vehicle are required to schedule a test drive');
        }
        const [car] = await db.select().from(schema.cars).where(eq(schema.cars.id, data.carId));
        if (!car) throw new Error('Vehicle not found');
        assertBranchScope(user, car.branchId);
        targetBranchId = car.branchId || user.branchId!;
      }
    }

    let enqId = targetEnquiry?.id || crypto.randomUUID();

    await db.transaction(async (tx) => {
      const effectiveCarId = data.carId || targetEnquiry?.testDriveCarId || targetEnquiry?.carId;

      // Collision avoidance: check if car already booked for this exact slot
      if (effectiveCarId) {
        const collisions = await tx
          .select()
          .from(schema.enquiries)
          .where(
            and(
              eq(schema.enquiries.testDriveCarId, effectiveCarId),
              eq(schema.enquiries.testDriveSlot, slot),
              targetEnquiry ? ne(schema.enquiries.id, targetEnquiry.id) : undefined,
              ne(schema.enquiries.status, 'Cancelled')
            )
          );

        if (collisions.length > 0) {
          throw new Error('Selected vehicle is already booked for this time slot. Please choose another slot.');
        }
      }

      if (targetEnquiry) {
        assertEnquiryTransition(targetEnquiry.stage, 'TEST_DRIVE');

        await tx
          .update(schema.enquiries)
          .set({
            enquiryType: 'Test Drive',
            stage: 'TEST_DRIVE',
            status: 'Scheduled',
            testDriveCarId: effectiveCarId || null,
            testDriveSlot: slot,
            appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : targetEnquiry.appointmentDate,
            remarks: notes ? `${targetEnquiry.remarks || ''}\nTestDrive Note: ${notes}` : targetEnquiry.remarks,
            updatedAt: new Date(),
          })
          .where(eq(schema.enquiries.id, targetEnquiry.id));
      } else {
        const [car] = await tx.select().from(schema.cars).where(eq(schema.cars.id, data.carId!));

        let custId = data.customerId!;
        if (!custId && role === 'CUSTOMER') {
          const [cust] = await tx.select().from(schema.customers).where(eq(schema.customers.userId, user.userId));
          custId = cust?.id || user.userId;
        }

        await tx.insert(schema.enquiries).values({
          id: enqId,
          customerId: custId,
          branchId: targetBranchId,
          employeeId: user.employeeId || null,
          carId: data.carId || null,
          enquiryType: 'Test Drive',
          stage: 'TEST_DRIVE',
          status: 'Scheduled',
          remarks: notes || 'Scheduled via test drive scheduler',
          requestedBrand: car?.brand || '',
          requestedModel: car?.model || '',
          requestedVariant: car?.variant || '',
          appointmentDate: data.appointmentDate ? new Date(data.appointmentDate) : new Date(),
          testDriveCarId: data.carId || null,
          testDriveSlot: slot,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: targetBranchId },
        action: 'test_drive.scheduled',
        entity: 'enquiry',
        entityId: enqId,
        oldValue: targetEnquiry
          ? { stage: targetEnquiry.stage, testDriveSlot: targetEnquiry.testDriveSlot, testDriveCarId: targetEnquiry.testDriveCarId }
          : null,
        newValue: { stage: 'TEST_DRIVE', slot, carId: effectiveCarId },
        summary: `${user.role} booked test drive slot '${slot}' for enquiry ${enqId}`,
      });

      await createNotification({
        tx,
        role: 'BRANCH_MANAGER',
        branchId: targetBranchId,
        title: 'Test Drive Scheduled',
        message: `Test drive scheduled on slot ${slot}`,
        link: '?tab=leads',
        type: 'TEST_DRIVE',
      });

      const assignedEmployeeId = targetEnquiry?.employeeId || user.employeeId;
      if (assignedEmployeeId) {
        const [emp] = await tx.select().from(schema.employees).where(eq(schema.employees.id, assignedEmployeeId)).limit(1);
        if (emp?.userId && emp.userId !== user.userId) {
          await createNotification({
            tx,
            userId: emp.userId,
            title: 'Test Drive Assigned to You',
            message: `Test drive scheduled on slot ${slot}`,
            link: '?tab=leads',
            type: 'TEST_DRIVE',
          });
        }
      }
    });

    return { success: true, enquiryId: enqId };
  });

export const recordTestDriveFeedback = createServerFn({ method: 'POST' })
  .validator((d: { enquiryId: string; feedback: string }) => {
    return z
      .object({
        enquiryId: z.string(),
        feedback: z.string().min(3, 'Feedback required'),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'manage_test_drives');

    const [enq] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, data.enquiryId));
    if (!enq) throw new Error('Enquiry not found');

    assertBranchScope(user, enq.branchId, enq.employeeId);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.enquiries)
        .set({
          testDriveFeedback: data.feedback,
          status: 'Completed',
          updatedAt: new Date(),
        })
        .where(eq(schema.enquiries.id, data.enquiryId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: enq.branchId },
        action: 'test_drive.completed',
        entity: 'enquiry',
        entityId: data.enquiryId,
        oldValue: { testDriveFeedback: enq.testDriveFeedback, status: enq.status },
        newValue: { feedback: data.feedback, status: 'Completed' },
        summary: `${user.role} recorded test drive feedback for enquiry ${data.enquiryId}`,
      });
    });

    return { success: true };
  });

// -------------------------------------------------------------
// QUOTATION GENERATION
// -------------------------------------------------------------
export const generateQuotation = createServerFn({ method: 'POST' })
  .validator((d: {
    enquiryId: string;
    model: string;
    variant: string;
    color?: string;
    exShowroomPrice: number;
    accessoriesAmount?: number;
    discountAmount?: number;
    discountRemarks?: string;
  }) => {
    return z
      .object({
        enquiryId: z.string(),
        model: z.string().min(1),
        variant: z.string().min(1),
        color: z.string().optional().default(''),
        exShowroomPrice: z.number().positive(),
        accessoriesAmount: z.number().nonnegative().optional().default(0),
        discountAmount: z.number().nonnegative().optional().default(0),
        discountRemarks: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'create_quotation');

    const [enq] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, data.enquiryId));
    if (!enq) throw new Error('Enquiry not found');

    assertBranchScope(user, enq.branchId, enq.employeeId);

    // Indian Automotive Tax Structure:
    // GST: 28% on Ex-showroom
    // RTO / Road Tax: ~10%
    // Comprehensive Insurance: ~3.5%
    const gstRate = 28;
    const gstAmount = Math.round((data.exShowroomPrice * gstRate) / 100);
    const rtoTax = Math.round(data.exShowroomPrice * 0.1);
    const insuranceAmount = Math.round(data.exShowroomPrice * 0.035);
    const accessoriesAmount = data.accessoriesAmount || 0;
    const discountAmount = data.discountAmount || 0;

    const onRoadPrice =
      data.exShowroomPrice + gstAmount + rtoTax + insuranceAmount + accessoriesAmount - discountAmount;

    const requiresApproval = isDiscountApprovalRequired(discountAmount, STANDARD_MAX_DISCOUNT_INR);
    const discountApprovalStatus = requiresApproval ? 'PENDING_APPROVAL' : 'APPROVED';

    const quotationId = crypto.randomUUID();
    const quotationNumber = `QT-${Date.now().toString().slice(-6)}`;
    const validUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    await db.transaction(async (tx) => {
      await tx.insert(schema.quotations).values({
        id: quotationId,
        quotationNumber,
        customerId: enq.customerId,
        employeeId: user.employeeId || enq.employeeId!,
        branchId: enq.branchId,
        brand: enq.requestedBrand || 'CDMS',
        model: data.model,
        variant: data.variant,
        color: data.color || '',
        exShowroomPrice: String(data.exShowroomPrice),
        gstRate: String(gstRate),
        gstAmount: String(gstAmount),
        insuranceAmount: String(insuranceAmount),
        rtoTax: String(rtoTax),
        accessoriesAmount: String(accessoriesAmount),
        discountAmount: String(discountAmount),
        maxAllowedDiscount: String(STANDARD_MAX_DISCOUNT_INR),
        discountApprovalStatus,
        discountRemarks: data.discountRemarks || '',
        onRoadPrice: String(onRoadPrice),
        status: 'DRAFT',
        validUntil,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Update enquiry stage to QUOTED
      if (enq.stage === 'NEW' || enq.stage === 'CONTACTED' || enq.stage === 'TEST_DRIVE') {
        await tx
          .update(schema.enquiries)
          .set({
            stage: 'QUOTED',
            quotationId,
            updatedAt: new Date(),
          })
          .where(eq(schema.enquiries.id, data.enquiryId));
      }

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: enq.branchId },
        action: 'quotation.created',
        entity: 'quotation',
        entityId: quotationId,
        oldValue: null,
        newValue: {
          quotationNumber,
          onRoadPrice,
          discountAmount,
          discountApprovalStatus,
        },
        summary: `${user.role} generated quotation ${quotationNumber} for ${data.model} ${data.variant} (On-Road: ₹${onRoadPrice.toLocaleString('en-IN')})`,
      });

      if (requiresApproval) {
        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: enq.branchId,
          title: 'Discount Approval Required',
          message: `Quotation ${quotationNumber} has ₹${discountAmount.toLocaleString('en-IN')} discount pending your review`,
          link: '?tab=approvals',
          type: 'APPROVAL',
        });
      }
    });

    return {
      success: true,
      quotationId,
      quotationNumber,
      onRoadPrice,
      discountApprovalStatus,
    };
  });

// -------------------------------------------------------------
// DISCOUNT APPROVAL (MANAGER / OWNER)
// -------------------------------------------------------------
export const handleDiscountApproval = createServerFn({ method: 'POST' })
  .validator((d: { quotationId: string; approved: boolean; comments?: string }) => {
    return z
      .object({
        quotationId: z.string(),
        approved: z.boolean(),
        comments: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'approve_discount');

    const [q] = await db.select().from(schema.quotations).where(eq(schema.quotations.id, data.quotationId));
    if (!q) throw new Error('Quotation not found');

    assertBranchScope(user, q.branchId);

    const status = data.approved ? 'APPROVED' : 'REJECTED';

    await db.transaction(async (tx) => {
      await tx
        .update(schema.quotations)
        .set({
          discountApprovalStatus: status,
          discountApprovedBy: user.employeeId || null,
          discountRemarks: data.comments ? `${q.discountRemarks || ''} [Decision]: ${data.comments}` : q.discountRemarks,
          updatedAt: new Date(),
        })
        .where(eq(schema.quotations.id, data.quotationId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: q.branchId },
        action: data.approved ? 'quotation.discount_approved' : 'quotation.discount_rejected',
        entity: 'quotation',
        entityId: data.quotationId,
        oldValue: { discountApprovalStatus: q.discountApprovalStatus },
        newValue: { discountApprovalStatus: status, comments: data.comments },
        summary: `${user.role} ${data.approved ? 'approved' : 'rejected'} discount of ₹${Number(q.discountAmount).toLocaleString('en-IN')} on quotation ${q.quotationNumber}`,
      });

      if (q.employeeId) {
        const [emp] = await tx.select().from(schema.employees).where(eq(schema.employees.id, q.employeeId)).limit(1);
        if (emp?.userId) {
          await createNotification({
            tx,
            userId: emp.userId,
            title: `Discount ${status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
            message: `Quotation ${q.quotationNumber} discount was ${status.toLowerCase()} by manager`,
            link: '?tab=leads',
            type: 'APPROVAL',
          });
        }
      }
    });

    return { success: true, status };
  });

// -------------------------------------------------------------
// DEMAND-DRIVEN BOOKING CONVERSION (MYSQL TRANSACTION)
// -------------------------------------------------------------
export const convertQuotationToBooking = createServerFn({ method: 'POST' })
  .validator((d: {
    quotationId: string;
    bookingAmount: number;
    paymentMode: string;
    transactionReference?: string;
  }) => {
    return z
      .object({
        quotationId: z.string(),
        bookingAmount: z.number().positive('Booking token amount must be positive'),
        paymentMode: z.string().min(2),
        transactionReference: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'create_booking');

    const [q] = await db.select().from(schema.quotations).where(eq(schema.quotations.id, data.quotationId));
    if (!q) throw new Error('Quotation not found');

    assertBranchScope(user, q.branchId, q.employeeId);

    if (q.discountApprovalStatus === 'PENDING_APPROVAL') {
      throw new Error('Cannot confirm booking: Discount approval is still pending from the Branch Manager.');
    }
    if (q.discountApprovalStatus === 'REJECTED') {
      throw new Error('Cannot confirm booking: Proposed discount was rejected by the Branch Manager.');
    }

    const saleId = crypto.randomUUID();
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
    const saleDate = new Date().toISOString().split('T')[0];

    let allocatedCarId: string | null = null;
    let procurementOrderId: string | null = null;

    // Use ACID Database Transaction in MySQL
    await db.transaction(async (tx) => {
      // 1. Check stock in branch matching model & variant with pessimistic lock
      const matchingCars = await tx
        .select()
        .from(schema.cars)
        .where(
          and(
            eq(schema.cars.model, q.model),
            eq(schema.cars.branchId, q.branchId),
            eq(schema.cars.inventoryStatus, 'IN_STOCK')
          )
        )
        .limit(1)
        .for('update');

      if (matchingCars.length > 0) {
        // Vehicle is in stock -> Reserve it!
        allocatedCarId = matchingCars[0].id;
        assertCarInventoryTransition(matchingCars[0].inventoryStatus, 'RESERVED');
        await tx
          .update(schema.cars)
          .set({
            status: 'Reserved',
            inventoryStatus: 'RESERVED',
            updatedAt: new Date(),
          })
          .where(eq(schema.cars.id, allocatedCarId));
      } else {
        // Demand-driven procurement trigger: automatically raise PO to manufacturer!
        const [defaultSupplier] = await tx.select().from(schema.suppliers).limit(1);
        const supplierId = defaultSupplier?.id || crypto.randomUUID();

        // Create virtual in-transit placeholder
        allocatedCarId = crypto.randomUUID();
        await tx.insert(schema.cars).values({
          id: allocatedCarId,
          brand: q.brand,
          model: q.model,
          variant: q.variant,
          color: q.color || 'Standard',
          price: q.exShowroomPrice,
          vinChassisNo: `PENDING-PO-${Date.now().toString().slice(-8)}`,
          status: 'In Transit',
          inventoryStatus: 'IN_TRANSIT',
          branchId: q.branchId,
          imageKey: 'suv',
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        procurementOrderId = crypto.randomUUID();
        const purchaseCost = String(Math.round(Number(q.exShowroomPrice) * 0.85)); // Cost is ~85% of ex-showroom
        await tx.insert(schema.purchases).values({
          id: procurementOrderId,
          supplierId,
          carId: allocatedCarId,
          employeeId: q.employeeId,
          branchId: q.branchId,
          purchaseDate: saleDate,
          purchaseCost,
          status: 'Pending Approval',
          procurementStage: 'REQUESTED',
          rejectionReason: '',
          isDemo: false,
          createdAt: new Date(),
        });
      }

      // 2. Create Confirmed Sale Record
      await tx.insert(schema.sales).values({
        id: saleId,
        customerId: q.customerId,
        carId: allocatedCarId,
        employeeId: q.employeeId,
        branchId: q.branchId,
        saleDate,
        saleAmount: q.onRoadPrice,
        amountPaid: String(data.bookingAmount),
        saleType: 'Quotation-based Booking',
        status: 'Confirmed',
        paymentMethod: data.paymentMode,
        paymentStatus: Number(data.bookingAmount) >= Number(q.onRoadPrice) ? 'Completed' : 'Partial',
        deliveryStatus: 'PENDING',
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 3. Record Initial Token Payment Receipt
      await tx.insert(schema.payments).values({
        id: crypto.randomUUID(),
        receiptNo,
        saleId,
        customerId: q.customerId,
        branchId: q.branchId,
        recordedBy: user.employeeId || q.employeeId,
        amount: String(data.bookingAmount),
        paymentType: 'Booking Advance',
        paymentMethod: data.paymentMode,
        paymentStatus: 'PAID',
        transactionReference: data.transactionReference || '',
        remarks: 'Advance token amount received for confirmed booking.',
        paymentDate: new Date(),
        createdAt: new Date(),
      });

      // 4. Update Quotation Status
      await tx
        .update(schema.quotations)
        .set({ status: 'ACCEPTED', updatedAt: new Date() })
        .where(eq(schema.quotations.id, data.quotationId));

      // 5. Update Enquiry Status to BOOKED
      await tx
        .update(schema.enquiries)
        .set({
          stage: 'BOOKED',
          status: procurementOrderId ? 'Procurement Raised' : 'Booked',
          bookingAmount: String(data.bookingAmount),
          updatedAt: new Date(),
        })
        .where(eq(schema.enquiries.quotationId, data.quotationId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: q.branchId },
        action: 'booking.confirmed',
        entity: 'sale',
        entityId: saleId,
        oldValue: null,
        newValue: {
          allocatedCarId,
          procurementRaised: Boolean(procurementOrderId),
          bookingAmount: data.bookingAmount,
        },
        summary: `${user.role} confirmed booking (Sale #${saleId.slice(0, 8)}) for quotation ${q.quotationNumber} (Token: ₹${data.bookingAmount.toLocaleString('en-IN')})`,
      });
    });

    return {
      success: true,
      saleId,
      invoiceNumber,
      receiptNo,
      procurementOrderId,
      allocatedCarId,
      stockReserved: !procurementOrderId,
    };
  });

// -------------------------------------------------------------
// PAYMENT COLLECTION MUTATION
// -------------------------------------------------------------
export const recordPaymentTransaction = createServerFn({ method: 'POST' })
  .validator((d: {
    saleId: string;
    amount: number;
    paymentType: string;
    paymentMode: string;
    transactionReference?: string;
    remarks?: string;
  }) => {
    return z
      .object({
        saleId: z.string(),
        amount: z.number().positive(),
        paymentType: z.string().min(1),
        paymentMode: z.string().min(1),
        transactionReference: z.string().optional().default(''),
        remarks: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'record_payment');

    const [s] = await db.select().from(schema.sales).where(eq(schema.sales.id, data.saleId));
    if (!s) throw new Error('Sale order not found');

    assertBranchScope(user, s.branchId);

    const paymentId = crypto.randomUUID();
    const receiptNo = `RCP-${Date.now().toString().slice(-6)}`;
    const newAmountPaid = Number(s.amountPaid) + data.amount;
    const paymentStatus = newAmountPaid >= Number(s.saleAmount) ? 'Completed' : 'Partial';

    await db.transaction(async (tx) => {
      await tx.insert(schema.payments).values({
        id: paymentId,
        receiptNo,
        saleId: data.saleId,
        customerId: s.customerId,
        branchId: s.branchId,
        recordedBy: user.employeeId || s.employeeId,
        amount: String(data.amount),
        paymentType: data.paymentType,
        paymentMethod: data.paymentMode,
        paymentStatus: 'PAID',
        transactionReference: data.transactionReference || '',
        remarks: data.remarks || '',
        paymentDate: new Date(),
        createdAt: new Date(),
      });

      await tx
        .update(schema.sales)
        .set({
          amountPaid: String(newAmountPaid),
          paymentStatus,
          updatedAt: new Date(),
        })
        .where(eq(schema.sales.id, data.saleId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: s.branchId },
        action: 'payment.recorded',
        entity: 'payment',
        entityId: paymentId,
        oldValue: { amountPaid: s.amountPaid, paymentStatus: s.paymentStatus },
        newValue: { receiptNo, amount: data.amount, newAmountPaid, paymentStatus },
        summary: `${user.role} recorded payment receipt ${receiptNo} for ₹${data.amount.toLocaleString('en-IN')} (${data.paymentMode}) on sale ${s.id.slice(0, 8)}`,
      });
    });

    return { success: true, receiptNo, newAmountPaid, paymentStatus };
  });

// -------------------------------------------------------------
// DELIVERY CHECKLIST MUTATION
// -------------------------------------------------------------
export const updateDelivery = createServerFn({ method: 'POST' })
  .validator((d: {
    saleId: string;
    deliveryStatus: string;
    rtoNumber?: string;
    insurancePolicyNumber?: string;
    documentsVerified?: boolean;
    handoverDate?: string;
  }) => {
    return z
      .object({
        saleId: z.string(),
        deliveryStatus: z.string(),
        rtoNumber: z.string().optional(),
        insurancePolicyNumber: z.string().optional(),
        documentsVerified: z.boolean().optional(),
        handoverDate: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'update_delivery_checklist');

    const [s] = await db.select().from(schema.sales).where(eq(schema.sales.id, data.saleId));
    if (!s) throw new Error('Sale record not found');

    assertBranchScope(user, s.branchId);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.sales)
        .set({
          deliveryStatus: data.deliveryStatus,
          rtoNumber: data.rtoNumber !== undefined ? data.rtoNumber : s.rtoNumber,
          insurancePolicyNumber: data.insurancePolicyNumber !== undefined ? data.insurancePolicyNumber : s.insurancePolicyNumber,
          documentsVerified: data.documentsVerified !== undefined ? data.documentsVerified : s.documentsVerified,
          handoverDate: data.handoverDate || s.handoverDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.sales.id, data.saleId));

      if (data.deliveryStatus === 'DELIVERED') {
        assertCarInventoryTransition('SOLD', 'DELIVERED');
        await tx
          .update(schema.cars)
          .set({ status: 'Delivered', inventoryStatus: 'DELIVERED', updatedAt: new Date() })
          .where(eq(schema.cars.id, s.carId));
      }

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: s.branchId },
        action: 'delivery.updated',
        entity: 'sale',
        entityId: data.saleId,
        oldValue: { deliveryStatus: s.deliveryStatus, handoverDate: s.handoverDate },
        newValue: { deliveryStatus: data.deliveryStatus, handoverDate: data.handoverDate },
        summary: `${user.role} updated delivery status to '${data.deliveryStatus}' on sale ${s.id.slice(0, 8)}`,
      });
    });

    return { success: true };
  });

// -------------------------------------------------------------
// PROCUREMENT APPROVALS (MANAGER & OWNER)
// -------------------------------------------------------------
export const handleManagerProcurementApproval = createServerFn({ method: 'POST' })
  .validator((d: { purchaseId: string; approved: boolean; rejectionReason?: string }) => {
    return z
      .object({
        purchaseId: z.string(),
        approved: z.boolean(),
        rejectionReason: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'approve_procurement');

    const [po] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, data.purchaseId));
    if (!po) throw new Error('Procurement purchase order not found');

    assertBranchScope(user, po.branchId);

    const targetStage = data.approved ? 'MANAGER_APPROVED' : 'REJECTED';
    assertProcurementTransition(po.procurementStage, targetStage);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.purchases)
        .set({
          procurementStage: targetStage,
          managerApprovedBy: user.employeeId || null,
          managerApprovedAt: new Date(),
          rejectionReason: data.rejectionReason || '',
        })
        .where(eq(schema.purchases.id, data.purchaseId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: po.branchId },
        action: data.approved ? 'procurement.manager_approved' : 'procurement.manager_rejected',
        entity: 'purchase',
        entityId: data.purchaseId,
        oldValue: { stage: po.procurementStage },
        newValue: { stage: targetStage, reason: data.rejectionReason },
        summary: `Branch Manager ${data.approved ? 'approved' : 'rejected'} procurement PO ${data.purchaseId.slice(0, 8)}`,
      });

      if (data.approved) {
        await createNotification({
          tx,
          role: 'OWNER',
          title: 'Procurement Order Pending Owner Step',
          message: `Branch Manager approved procurement PO #${data.purchaseId.slice(0, 8)}`,
          link: '?tab=procurement',
          type: 'APPROVAL',
        });
      }
    });

    return { success: true, targetStage };
  });

export const handleOwnerProcurementStep = createServerFn({ method: 'POST' })
  .validator((d: { purchaseId: string; targetStage: string; rejectionReason?: string }) => {
    return z
      .object({
        purchaseId: z.string(),
        targetStage: z.enum([
          'OWNER_APPROVED',
          'ORDERED',
          'IN_TRANSIT',
          'RECEIVED',
          'ALLOCATED',
          'REJECTED',
        ]),
        rejectionReason: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'approve_procurement_owner');

    const [po] = await db.select().from(schema.purchases).where(eq(schema.purchases.id, data.purchaseId));
    if (!po) throw new Error('Procurement purchase order not found');

    assertProcurementTransition(po.procurementStage, data.targetStage);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.purchases)
        .set({
          procurementStage: data.targetStage as any,
          ownerApprovedBy: user.userId,
          ownerApprovedAt: new Date(),
          rejectionReason: data.rejectionReason || po.rejectionReason,
        })
        .where(eq(schema.purchases.id, data.purchaseId));

      // Car inventory sync based on stage
      if (data.targetStage === 'RECEIVED') {
        assertCarInventoryTransition('IN_TRANSIT', 'IN_STOCK');
        await tx
          .update(schema.cars)
          .set({ status: 'In Stock', inventoryStatus: 'IN_STOCK', updatedAt: new Date() })
          .where(eq(schema.cars.id, po.carId));
      } else if (data.targetStage === 'ALLOCATED') {
        assertCarInventoryTransition('IN_STOCK', 'RESERVED');
        await tx
          .update(schema.cars)
          .set({ status: 'Reserved', inventoryStatus: 'RESERVED', updatedAt: new Date() })
          .where(eq(schema.cars.id, po.carId));
      }

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: po.branchId },
        action: 'procurement.step_updated',
        entity: 'purchase',
        entityId: data.purchaseId,
        oldValue: { stage: po.procurementStage },
        newValue: { stage: data.targetStage, reason: data.rejectionReason },
        summary: `Owner advanced procurement PO ${data.purchaseId.slice(0, 8)} to '${data.targetStage}'`,
      });
    });

    return { success: true, targetStage: data.targetStage };
  });

// -------------------------------------------------------------
// STOCK TRANSFER & STAFF ASSIGNMENTS
// -------------------------------------------------------------
export const transferCar = createServerFn({ method: 'POST' })
  .validator((d: { carId: string; toBranchId?: string; targetBranch?: string }) => {
    return z
      .object({
        carId: z.string(),
        toBranchId: z.string().optional(),
        targetBranch: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'request_stock_transfer');

    const [c] = await db.select().from(schema.cars).where(eq(schema.cars.id, data.carId));
    if (!c) throw new Error('Vehicle not found');

    const role = user.role.toUpperCase();
    let destinationBranchId = data.toBranchId || data.targetBranch;

    if (role === 'BRANCH_MANAGER') {
      if (!user.branchId) {
        throw new Error('Manager account is not assigned to a branch');
      }
      // If the vehicle is at another branch, the manager is requesting it into their own branch
      if (c.branchId !== user.branchId) {
        destinationBranchId = user.branchId;
      } else {
        // Vehicle is at manager's branch: must specify destination branch
        if (!destinationBranchId) {
          throw new Error('Target destination branch is required');
        }
      }
    } else {
      if (!destinationBranchId) {
        throw new Error('Target destination branch is required');
      }
    }

    if (c.branchId === destinationBranchId) {
      throw new Error('Source and destination branches cannot be the same');
    }

    if (c.status !== 'Available' && c.status !== 'In Stock') {
      throw new Error(`Vehicle cannot be transferred: current status is '${c.status}'. Only vehicles in stock and unallocated can be transferred.`);
    }

    if (c.inventoryStatus !== 'IN_STOCK') {
      throw new Error(`Vehicle inventory status must be IN_STOCK (currently: ${c.inventoryStatus})`);
    }

    if (c.transferTo) {
      throw new Error('Vehicle already has a pending transfer');
    }

    if (c.allocatedEnquiryId) {
      throw new Error('Vehicle is currently allocated to an active customer enquiry');
    }

    const [destBranch] = await db.select().from(schema.branches).where(eq(schema.branches.id, destinationBranchId!));
    if (!destBranch) {
      throw new Error('Destination branch does not exist');
    }

    await db.transaction(async (tx) => {
      await tx
        .update(schema.cars)
        .set({
          transferTo: destinationBranchId,
          status: 'Transfer Pending',
          updatedAt: new Date(),
        })
        .where(eq(schema.cars.id, data.carId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: user.branchId || c.branchId },
        action: 'car.transfer_requested',
        entity: 'car',
        entityId: data.carId,
        oldValue: { branchId: c.branchId, status: c.status, transferTo: c.transferTo },
        newValue: { branchId: c.branchId, status: 'Transfer Pending', transferTo: destinationBranchId },
        summary: `${user.role} requested stock transfer of ${c.brand} ${c.model} (${c.vinChassisNo}) from branch ${c.branchId} to ${destBranch.branchName}`,
      });

      // Notify Owner
      await createNotification({
        tx,
        role: 'OWNER',
        title: 'Stock Transfer Pending Approval',
        message: `${c.brand} ${c.model} (${c.vinChassisNo}) transfer requested to ${destBranch.branchName}`,
        link: '?tab=transfers',
        type: 'TRANSFER',
      });

      // Notify destination manager if requested by another
      if (destinationBranchId !== user.branchId) {
        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: destinationBranchId,
          title: 'Incoming Stock Transfer Requested',
          message: `Stock transfer initiated for ${c.brand} ${c.model} (${c.vinChassisNo})`,
          link: '?tab=inventory',
          type: 'TRANSFER',
        });
      }

      // Notify source manager if requested by destination
      if (c.branchId && c.branchId !== user.branchId) {
        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: c.branchId,
          title: 'Stock Transfer Requested from Your Branch',
          message: `${destBranch.branchName} requested transfer of ${c.brand} ${c.model} (${c.vinChassisNo})`,
          link: '?tab=inventory',
          type: 'TRANSFER',
        });
      }
    });

    return { success: true };
  });

export const approveStockTransfer = createServerFn({ method: 'POST' })
  .validator((d: { carId: string; decision?: string; reason?: string }) => {
    return z
      .object({
        carId: z.string(),
        decision: z.string().optional().default('APPROVE'),
        reason: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'approve_stock_transfer');

    const [c] = await db.select().from(schema.cars).where(eq(schema.cars.id, data.carId));
    if (!c || !c.transferTo) throw new Error('Vehicle transfer request not found');

    const decisionUpper = (data.decision || 'APPROVE').toUpperCase();
    const isApproved = decisionUpper === 'APPROVE' || decisionUpper === 'APPROVED';

    const [fromB] = c.branchId ? await db.select().from(schema.branches).where(eq(schema.branches.id, c.branchId)) : [null];
    const [toB] = await db.select().from(schema.branches).where(eq(schema.branches.id, c.transferTo));

    await db.transaction(async (tx) => {
      if (isApproved) {
        // Move to 'In Transit'
        await tx
          .update(schema.cars)
          .set({
            status: 'In Transit',
            inventoryStatus: 'IN_TRANSIT',
            updatedAt: new Date(),
          })
          .where(eq(schema.cars.id, data.carId));

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: c.transferTo },
          action: 'car.transfer_approved',
          entity: 'car',
          entityId: data.carId,
          oldValue: { status: c.status, inventoryStatus: c.inventoryStatus, transferTo: c.transferTo },
          newValue: { status: 'In Transit', inventoryStatus: 'IN_TRANSIT', transferTo: c.transferTo },
          summary: `${user.role} approved transfer of ${c.brand} ${c.model} (${c.vinChassisNo}) to ${toB?.branchName || 'destination branch'} (Now In Transit)`,
        });

        // Notify destination branch manager
        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: c.transferTo,
          title: 'Stock Transfer Approved',
          message: `Owner approved transfer of ${c.brand} ${c.model} (${c.vinChassisNo}). Vehicle is now In Transit.`,
          link: '?tab=inventory',
          type: 'TRANSFER',
        });

        // Notify origin branch manager
        if (c.branchId) {
          await createNotification({
            tx,
            role: 'BRANCH_MANAGER',
            branchId: c.branchId,
            title: 'Stock Transfer Approved & Dispatched',
            message: `Owner approved transfer of ${c.brand} ${c.model} (${c.vinChassisNo}) to ${toB?.branchName || 'destination'}. Vehicle marked In Transit.`,
            link: '?tab=inventory',
            type: 'TRANSFER',
          });
        }
      } else {
        // Rejection: return to In Stock at source branch, clear hold
        await tx
          .update(schema.cars)
          .set({
            status: 'In Stock',
            inventoryStatus: 'IN_STOCK',
            transferTo: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.cars.id, data.carId));

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: c.branchId },
          action: 'car.transfer_rejected',
          entity: 'car',
          entityId: data.carId,
          oldValue: { status: c.status, transferTo: c.transferTo },
          newValue: { status: 'In Stock', transferTo: null },
          summary: `${user.role} rejected transfer of ${c.brand} ${c.model} (${c.vinChassisNo}). Returned to In Stock at ${fromB?.branchName || 'origin branch'}.`,
        });

        // Notify requesting destination manager
        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: c.transferTo,
          title: 'Stock Transfer Rejected',
          message: `Owner rejected transfer request for ${c.brand} ${c.model} (${c.vinChassisNo}). ${data.reason ? `Reason: ${data.reason}` : ''}`,
          link: '?tab=inventory',
          type: 'TRANSFER',
        });

        // Notify source branch manager that hold is cleared
        if (c.branchId) {
          await createNotification({
            tx,
            role: 'BRANCH_MANAGER',
            branchId: c.branchId,
            title: 'Stock Transfer Cancelled',
            message: `Transfer hold on ${c.brand} ${c.model} (${c.vinChassisNo}) has been cleared. Car is back In Stock.`,
            link: '?tab=inventory',
            type: 'TRANSFER',
          });
        }
      }
    });

    return { success: true, approved: isApproved };
  });

export const receiveStockTransfer = createServerFn({ method: 'POST' })
  .validator((d: { carId: string }) => {
    return z.object({ carId: z.string() }).parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    const role = user.role.toUpperCase();

    const [c] = await db.select().from(schema.cars).where(eq(schema.cars.id, data.carId));
    if (!c || !c.transferTo) {
      throw new Error('Vehicle transfer record not found');
    }

    if (c.status !== 'In Transit' && c.inventoryStatus !== 'IN_TRANSIT') {
      throw new Error(`Vehicle is not currently in transit (status: ${c.status})`);
    }

    if (role === 'BRANCH_MANAGER') {
      if (user.branchId !== c.transferTo) {
        throw new Error('Unauthorized: Only the destination branch manager can accept this vehicle arrival');
      }
    } else if (role !== 'OWNER') {
      throw new Error('Unauthorized to confirm vehicle stock transfer arrival');
    }

    const previousBranchId = c.branchId;
    const newBranchId = c.transferTo;
    const arrivalDate = new Date().toISOString().split('T')[0];

    const [destBranch] = await db.select().from(schema.branches).where(eq(schema.branches.id, newBranchId));

    await db.transaction(async (tx) => {
      await tx
        .update(schema.cars)
        .set({
          branchId: newBranchId,
          transferTo: null,
          status: 'In Stock',
          inventoryStatus: 'IN_STOCK',
          stockArrivalDate: arrivalDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.cars.id, data.carId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: newBranchId },
        action: 'car.transfer_received',
        entity: 'car',
        entityId: data.carId,
        oldValue: { branchId: previousBranchId, status: c.status, transferTo: c.transferTo },
        newValue: { branchId: newBranchId, status: 'In Stock', transferTo: null },
        summary: `${user.role} confirmed arrival of ${c.brand} ${c.model} (${c.vinChassisNo}) into showroom ${destBranch?.branchName || newBranchId}`,
      });

      // Notify Owner
      await createNotification({
        tx,
        role: 'OWNER',
        title: 'Stock Transfer Completed',
        message: `${c.brand} ${c.model} (${c.vinChassisNo}) has arrived and is now In Stock at ${destBranch?.branchName}`,
        link: '?tab=transfers',
        type: 'TRANSFER',
      });

      // Notify source branch manager
      if (previousBranchId) {
        await createNotification({
          tx,
          role: 'BRANCH_MANAGER',
          branchId: previousBranchId,
          title: 'Stock Transfer Completed',
          message: `${c.brand} ${c.model} (${c.vinChassisNo}) was successfully received at destination showroom`,
          link: '?tab=inventory',
          type: 'TRANSFER',
        });
      }
    });

    return { success: true, branchId: newBranchId };
  });

export const reassignLead = createServerFn({ method: 'POST' })
  .validator((d: { enquiryId: string; employeeId: string }) => {
    return z.object({ enquiryId: z.string(), employeeId: z.string() }).parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'manage_branch_staff');

    const [enq] = await db.select().from(schema.enquiries).where(eq(schema.enquiries.id, data.enquiryId));
    if (!enq) throw new Error('Enquiry not found');

    assertBranchScope(user, enq.branchId);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.enquiries)
        .set({ employeeId: data.employeeId, updatedAt: new Date() })
        .where(eq(schema.enquiries.id, data.enquiryId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: enq.branchId },
        action: 'lead.reassigned',
        entity: 'enquiry',
        entityId: data.enquiryId,
        oldValue: { employeeId: enq.employeeId },
        newValue: { employeeId: data.employeeId },
        summary: `${user.role} reassigned lead enquiry ${data.enquiryId.slice(0, 8)} to employee ${data.employeeId}`,
      });

      const [targetEmp] = await tx.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId)).limit(1);
      if (targetEmp?.userId) {
        await createNotification({
          tx,
          userId: targetEmp.userId,
          title: 'Lead Reassigned to You',
          message: `Lead for ${enq.requestedModel || 'vehicle'} was reassigned to you by manager`,
          link: '?tab=leads',
          type: 'LEAD',
        });
      }
    });

    return { success: true };
  });

export const updateStaffProfile = createServerFn({ method: 'POST' })
  .validator((d: { employeeId: string; monthlyTarget?: number; isActive?: boolean }) => {
    return z
      .object({
        employeeId: z.string(),
        monthlyTarget: z.number().int().nonnegative().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'set_staff_targets');

    const [emp] = await db.select().from(schema.employees).where(eq(schema.employees.id, data.employeeId));
    if (!emp) throw new Error('Employee profile not found');

    assertBranchScope(user, emp.branchId);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.employees)
        .set({
          monthlyTarget: data.monthlyTarget !== undefined ? data.monthlyTarget : emp.monthlyTarget,
          isActive: data.isActive !== undefined ? data.isActive : emp.isActive,
          updatedAt: new Date(),
        })
        .where(eq(schema.employees.id, data.employeeId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: emp.branchId },
        action: 'staff.profile_updated',
        entity: 'employee',
        entityId: data.employeeId,
        oldValue: { monthlyTarget: emp.monthlyTarget, isActive: emp.isActive },
        newValue: data,
        summary: `${user.role} updated staff profile for employee ${emp.name} (${emp.email})`,
      });
    });

    return { success: true };
  });

export const assignRole = createServerFn({ method: 'POST' })
  .validator((d: { userId: string; role: string; branchId?: string | null }) => {
    return z
      .object({
        userId: z.string(),
        role: z.enum(['OWNER', 'BRANCH_MANAGER', 'EMPLOYEE', 'CUSTOMER', 'owner', 'branch_manager', 'employee', 'customer']),
        branchId: z.string().nullable().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'manage_all_staff');

    const normalizedRole = data.role.toUpperCase() as 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' | 'CUSTOMER';
    const effectiveBranchId = normalizedRole === 'OWNER' ? null : data.branchId || null;

    await db.transaction(async (tx) => {
      const [oldUser] = await tx.select().from(schema.users).where(eq(schema.users.id, data.userId));

      await tx
        .update(schema.users)
        .set({
          role: normalizedRole,
          branchId: effectiveBranchId,
        })
        .where(eq(schema.users.id, data.userId));

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: effectiveBranchId },
        action: 'user.role_changed',
        entity: 'user',
        entityId: data.userId,
        oldValue: { role: oldUser?.role, branchId: oldUser?.branchId },
        newValue: { role: normalizedRole, branchId: effectiveBranchId },
        summary: `${user.role} changed role of user ${oldUser?.name || data.userId} to '${normalizedRole}'`,
      });
    });

    return { success: true };
  });

// -------------------------------------------------------------
// OWNER DATABASE VISIBILITY AND INSPECTION
// -------------------------------------------------------------
export const getDatabaseTablesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const user = await getSessionUser();
  if (!user || user.role !== 'OWNER') {
    throw new Error('Forbidden: Only the Dealership Owner can inspect database tables');
  }

  const tables = [
    { name: 'branches', description: 'Showroom branches and locations' },
    { name: 'users', description: 'User credentials and roles' },
    { name: 'user_roles', description: 'Application role mappings' },
    { name: 'customers', description: 'Customer profiles and KYC' },
    { name: 'employees', description: 'Sales executives and managers' },
    { name: 'cars', description: 'Vehicle inventory with VIN and status' },
    { name: 'suppliers', description: 'OEM vehicle manufacturers' },
    { name: 'enquiries', description: 'Customer demands and test drive requests' },
    { name: 'test_drives', description: 'Test drive appointments and feedback' },
    { name: 'quotations', description: 'Price estimates with GST and road tax' },
    { name: 'bookings', description: 'Confirmed vehicle bookings and tokens' },
    { name: 'sales', description: 'Final sales invoices and receivables' },
    { name: 'purchases', description: 'Manufacturer procurement purchase orders' },
    { name: 'accessories_catalogue', description: 'Genuine parts and accessories' },
    { name: 'payments', description: 'Payment transactions and receipts' },
    { name: 'delivery_checklists', description: 'PDI checklists and delivery signoffs' },
    { name: 'audit_logs', description: 'System audit log of state changes' },
    { name: 'login_events', description: 'User login and security access events' },
  ];

  const results = [];
  for (const t of tables) {
    try {
      const [countRes] = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM \`${t.name}\``));
      const rowCount = Number((countRes as any)[0]?.count || 0);
      results.push({ ...t, rowCount });
    } catch {
      results.push({ ...t, rowCount: 0 });
    }
  }

  return results;
});

export const getTableRowsServerFn = createServerFn({ method: 'GET' })
  .validator((d: { tableName: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const user = await getSessionUser();
    if (!user || user.role !== 'OWNER') {
      throw new Error('Forbidden: Only the Dealership Owner can view table rows');
    }

    const allowedTables = [
      'branches',
      'users',
      'user_roles',
      'customers',
      'employees',
      'cars',
      'suppliers',
      'enquiries',
      'test_drives',
      'quotations',
      'bookings',
      'sales',
      'purchases',
      'accessories_catalogue',
      'payments',
      'delivery_checklists',
      'audit_logs',
      'login_events',
    ];

    if (!allowedTables.includes(data.tableName)) {
      throw new Error('Invalid table name');
    }

    const limit = Math.min(data.limit || 50, 100);
    const [rows] = await db.execute(sql.raw(`SELECT * FROM \`${data.tableName}\` LIMIT ${limit}`));
    const rowsArray = Array.isArray(rows) ? (rows as any[]) : [];

    // Sanitize sensitive columns like password_hash
    const sanitized = rowsArray.map((r) => {
      const copy = { ...r };
      if ('password_hash' in copy) {
        copy.password_hash = '•••••••••••••••• (Bcrypt Hashed)';
      }
      return copy;
    });

    return { tableName: data.tableName, rows: sanitized };
  });

// -------------------------------------------------------------
// OWNER USER APPROVAL & ACCOUNT MANAGEMENT
// -------------------------------------------------------------
export const approveUserServerFn = createServerFn({ method: 'POST' })
  .validator((d: { userId: string; approved: boolean; role?: string; branchId?: string | null }) => {
    return z
      .object({
        userId: z.string(),
        approved: z.boolean(),
        role: z.enum(['OWNER', 'BRANCH_MANAGER', 'EMPLOYEE', 'CUSTOMER']).optional(),
        branchId: z.string().nullable().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'manage_all_staff');

    const [target] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, data.userId))
      .limit(1);

    if (!target) {
      throw new Error('User not found.');
    }

    const effectiveRole = (data.role || target.role) as 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' | 'CUSTOMER';
    const effectiveBranchId = effectiveRole === 'OWNER' ? null : (data.branchId !== undefined ? data.branchId : target.branchId);

    await db.transaction(async (tx) => {
      if (data.approved) {
        await tx
          .update(schema.users)
          .set({
            approvalStatus: 'APPROVED',
            isActive: true,
            role: effectiveRole,
            branchId: effectiveBranchId,
          })
          .where(eq(schema.users.id, data.userId));

        if (effectiveRole === 'EMPLOYEE' || effectiveRole === 'BRANCH_MANAGER') {
          const [existingEmp] = await tx
            .select()
            .from(schema.employees)
            .where(eq(schema.employees.userId, target.id))
            .limit(1);

          if (existingEmp) {
            await tx
              .update(schema.employees)
              .set({
                branchId: effectiveBranchId,
                isActive: true,
                updatedAt: new Date(),
              })
              .where(eq(schema.employees.id, existingEmp.id));
          } else {
            await tx.insert(schema.employees).values({
              id: crypto.randomUUID(),
              name: target.name,
              email: target.email,
              phone: '',
              userId: target.id,
              branchId: effectiveBranchId,
              monthlyTarget: effectiveRole === 'BRANCH_MANAGER' ? 15 : 8,
              isActive: true,
              isDemo: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }
        }

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: effectiveBranchId },
          action: 'user.approved',
          entity: 'user',
          entityId: target.id,
          oldValue: { approvalStatus: target.approvalStatus, role: target.role, branchId: target.branchId },
          newValue: { approvalStatus: 'APPROVED', role: effectiveRole, branchId: effectiveBranchId },
          summary: `${user.role} approved user registration for ${target.name} (${target.email}) as '${effectiveRole}'`,
        });
      } else {
        await tx
          .update(schema.users)
          .set({
            approvalStatus: 'REJECTED',
            isActive: false,
          })
          .where(eq(schema.users.id, data.userId));

        await writeAudit({
          tx,
          actor: { userId: user.userId, role: user.role, branchId: target.branchId },
          action: 'user.rejected',
          entity: 'user',
          entityId: target.id,
          oldValue: { approvalStatus: target.approvalStatus, isActive: target.isActive },
          newValue: { approvalStatus: 'REJECTED', isActive: false },
          summary: `${user.role} rejected registration request for ${target.name} (${target.email})`,
        });
      }
    });

    return { success: true };
  });

export const updateUserServerFn = createServerFn({ method: 'POST' })
  .validator((d: { userId: string; role?: string; branchId?: string | null; isActive?: boolean }) => {
    return z
      .object({
        userId: z.string(),
        role: z.enum(['OWNER', 'BRANCH_MANAGER', 'EMPLOYEE', 'CUSTOMER']).optional(),
        branchId: z.string().nullable().optional(),
        isActive: z.boolean().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    assertPermission(user.role, 'manage_all_staff');

    const [target] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, data.userId))
      .limit(1);

    if (!target) {
      throw new Error('User not found.');
    }

    // 1. Prevent self-demotion and self-suspension
    if (user.userId === data.userId) {
      if (data.isActive === false) {
        throw new Error('You cannot deactivate or suspend your own account.');
      }
      if (data.role !== undefined && data.role !== 'OWNER') {
        throw new Error('You cannot demote your own account from Dealership Owner.');
      }
    }

    // 2. Prevent removing or demoting the last active owner
    if (target.role === 'OWNER' && ((data.role !== undefined && data.role !== 'OWNER') || data.isActive === false)) {
      const [ownerCount] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.users)
        .where(and(eq(schema.users.role, 'OWNER'), eq(schema.users.isActive, true)));
      if (Number(ownerCount?.count || 0) <= 1) {
        throw new Error('Cannot demote or deactivate the last remaining active Dealership Owner.');
      }
    }

    const updates: Record<string, any> = {};
    if (data.role !== undefined) {
      updates.role = data.role;
      if (data.role === 'OWNER') {
        updates.branchId = null;
      }
    }
    if (data.branchId !== undefined && (data.role || target.role) !== 'OWNER') {
      updates.branchId = data.branchId;
    }
    if (data.isActive !== undefined) {
      updates.isActive = data.isActive;
    }

    await db.transaction(async (tx) => {
      await tx.update(schema.users).set(updates).where(eq(schema.users.id, data.userId));

      // Update corresponding employee record if exists
      const [existingEmp] = await tx
        .select()
        .from(schema.employees)
        .where(eq(schema.employees.userId, target.id))
        .limit(1);

      if (existingEmp) {
        const empUpdates: Record<string, any> = { updatedAt: new Date() };
        if (updates.branchId !== undefined) empUpdates.branchId = updates.branchId;
        if (updates.isActive !== undefined) empUpdates.isActive = updates.isActive;
        await tx.update(schema.employees).set(empUpdates).where(eq(schema.employees.id, existingEmp.id));
      }

      await writeAudit({
        tx,
        actor: { userId: user.userId, role: user.role, branchId: updates.branchId !== undefined ? updates.branchId : target.branchId },
        action: 'user.updated',
        entity: 'user',
        entityId: target.id,
        oldValue: { role: target.role, branchId: target.branchId, isActive: target.isActive },
        newValue: updates,
        summary: `${user.role} updated user account settings for ${target.name} (${target.email})`,
      });
    });

    return { success: true };
  });

// -------------------------------------------------------------
// FILTERED AUDIT TRAIL SERVICE FUNCTION
// -------------------------------------------------------------
export const getAuditLogsServerFn = createServerFn({ method: 'GET' })
  .validator((d?: {
    search?: string;
    action?: string;
    actorRole?: string;
    branchId?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }) => {
    return z
      .object({
        search: z.string().optional().default(''),
        action: z.string().optional().default(''),
        actorRole: z.string().optional().default(''),
        branchId: z.string().optional().default(''),
        entity: z.string().optional().default(''),
        startDate: z.string().optional().default(''),
        endDate: z.string().optional().default(''),
        limit: z.number().int().min(1).max(500).optional().default(100),
        offset: z.number().int().min(0).optional().default(0),
      })
      .parse(d || {});
  })
  .handler(async ({ data }) => {
    const user = await requireAuthUser();
    const role = user.role.toUpperCase();
    if (role !== 'OWNER' && role !== 'BRANCH_MANAGER') {
      throw new Error('Unauthorized: Only Dealership Owners and Branch Managers can inspect the audit trail.');
    }

    // Branch managers are strictly scoped to their own branch
    const effectiveBranchId = role === 'BRANCH_MANAGER' ? user.branchId : (data.branchId || null);

    const conditions = [];

    if (effectiveBranchId) {
      conditions.push(eq(schema.auditLogs.branchId, effectiveBranchId));
    }

    if (data.action) {
      conditions.push(eq(schema.auditLogs.action, data.action));
    }

    if (data.actorRole) {
      conditions.push(eq(schema.auditLogs.role, data.actorRole.toUpperCase()));
    }

    if (data.entity) {
      conditions.push(eq(schema.auditLogs.entity, data.entity.toLowerCase()));
    }

    if (data.startDate) {
      conditions.push(gte(schema.auditLogs.createdAt, new Date(data.startDate)));
    }

    if (data.endDate) {
      const end = new Date(data.endDate);
      end.setHours(23, 59, 59, 999);
      conditions.push(lte(schema.auditLogs.createdAt, end));
    }

    if (data.search && data.search.trim()) {
      const q = `%${data.search.trim()}%`;
      conditions.push(
        or(
          like(schema.auditLogs.summary, q),
          like(schema.auditLogs.action, q),
          like(schema.auditLogs.entity, q),
          like(schema.auditLogs.entityId, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.auditLogs)
      .where(whereClause);

    const rawLogs = await db
      .select()
      .from(schema.auditLogs)
      .where(whereClause)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(data.limit)
      .offset(data.offset);

    return {
      logs: rawLogs,
      total: Number(countResult?.count || 0),
    };
  });

// -------------------------------------------------------------
// NOTIFICATION ACTIONS
// -------------------------------------------------------------
export const markNotificationAsReadServerFn = createServerFn({ method: 'POST' })
  .validator((d: { id: string }) => z.object({ id: z.string().min(1) }).parse(d))
  .handler(async ({ data }) => {
    await requireAuthUser();
    await markNotificationAsRead(data.id);
    return { success: true };
  });

export const markAllNotificationsAsReadServerFn = createServerFn({ method: 'POST' })
  .handler(async () => {
    const user = await requireAuthUser();
    await markAllNotificationsAsRead({
      userId: user.userId,
      role: user.role,
      branchId: user.branchId,
    });
    return { success: true };
  });



