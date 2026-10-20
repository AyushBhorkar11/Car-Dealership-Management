import {
  mysqlTable,
  varchar,
  char,
  text,
  datetime,
  decimal,
  boolean,
  int,
  date,
  json,
  mysqlEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const appRoleEnum = mysqlEnum('app_role', [
  'customer',
  'employee',
  'branch_manager',
  'owner',
]);

export const userRoleEnum = mysqlEnum('role', [
  'OWNER',
  'BRANCH_MANAGER',
  'EMPLOYEE',
  'CUSTOMER',
]);

export const userApprovalStatusEnum = mysqlEnum('approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const inventoryStatusEnum = mysqlEnum('inventory_status', [
  'IN_TRANSIT',
  'IN_STOCK',
  'RESERVED',
  'SOLD',
  'DELIVERED',
]);

export const enquiryStageEnum = mysqlEnum('enquiry_stage', [
  'NEW',
  'CONTACTED',
  'TEST_DRIVE',
  'QUOTED',
  'BOOKED',
  'CLOSED_WON',
  'CLOSED_LOST',
]);

export const procurementStageEnum = mysqlEnum('procurement_stage', [
  'REQUESTED',
  'MANAGER_APPROVED',
  'OWNER_APPROVED',
  'ORDERED',
  'IN_TRANSIT',
  'RECEIVED',
  'ALLOCATED',
]);

export const paymentStatusEnum = mysqlEnum('payment_status', [
  'PENDING',
  'PARTIAL',
  'PAID',
  'REFUNDED',
]);

// 1. Branches
export const branches = mysqlTable(
  'branches',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    branchName: varchar('branch_name', { length: 255 }).notNull(),
    address: text('address').notNull(),
    city: varchar('city', { length: 100 }).notNull(),
    phone: varchar('phone', { length: 50 }).default('').notNull(),
    demandThreshold: int('demand_threshold').default(3).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    cityIdx: index('branches_city_idx').on(table.city),
    createdAtIdx: index('branches_created_at_idx').on(table.createdAt),
  })
);

// 2. Users (Local Authentication and Role Assignment)
export const users = mysqlTable(
  'users',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: userRoleEnum.default('EMPLOYEE').notNull(),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'set null' }),
    isActive: boolean('is_active').default(true).notNull(),
    approvalStatus: userApprovalStatusEnum.default('APPROVED').notNull(),
    resetToken: varchar('reset_token', { length: 255 }),
    resetTokenExpiry: datetime('reset_token_expiry'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    lastLoginAt: datetime('last_login_at'),
  },
  (table) => ({
    emailUnique: uniqueIndex('users_email_unique').on(table.email),
    branchIdx: index('users_branch_idx').on(table.branchId),
    roleIdx: index('users_role_idx').on(table.role),
    approvalStatusIdx: index('users_approval_status_idx').on(table.approvalStatus),
  })
);

// 3. User Roles (Compatible role mappings)
export const userRoles = mysqlTable(
  'user_roles',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: char('user_id', { length: 36 }).notNull(),
    role: appRoleEnum.default('customer').notNull(),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'set null' }),
  },
  (table) => ({
    userIdx: index('user_roles_user_idx').on(table.userId),
    branchIdx: index('user_roles_branch_idx').on(table.branchId),
  })
);

// 4. Customers
export const customers = mysqlTable(
  'customers',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).default('').notNull(),
    email: varchar('email', { length: 255 }).default('').notNull(),
    address: text('address').notNull(),
    city: varchar('city', { length: 100 }).default('').notNull(),
    idProofType: varchar('id_proof_type', { length: 50 }).default('').notNull(),
    idProofNumber: varchar('id_proof_number', { length: 100 }).default('').notNull(),
    userId: char('user_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    authUserId: varchar('auth_user_id', { length: 255 }),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    cityIdx: index('customers_city_idx').on(table.city),
    phoneIdx: index('customers_phone_idx').on(table.phone),
    userIdx: index('customers_user_idx').on(table.userId),
    createdAtIdx: index('customers_created_at_idx').on(table.createdAt),
  })
);

// 5. Employees (Staff Profiles)
export const employees = mysqlTable(
  'employees',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 50 }).default('').notNull(),
    email: varchar('email', { length: 255 }).default('').notNull(),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'cascade' }),
    userId: char('user_id', { length: 36 }).references(() => users.id, { onDelete: 'set null' }),
    authUserId: varchar('auth_user_id', { length: 255 }),
    monthlyTarget: int('monthly_target').default(5).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    branchIdx: index('employees_branch_idx').on(table.branchId),
    userIdx: index('employees_user_idx').on(table.userId),
    statusIdx: index('employees_status_idx').on(table.isActive),
  })
);

// 6. Cars (Individual VIN stock)
export const cars = mysqlTable(
  'cars',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    brand: varchar('brand', { length: 100 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    variant: varchar('variant', { length: 100 }).default('').notNull(),
    fuelType: varchar('fuel_type', { length: 50 }).default('Petrol').notNull(),
    transmission: varchar('transmission', { length: 50 }).default('Automatic').notNull(),
    color: varchar('color', { length: 50 }).default('').notNull(),
    manufacturingYear: int('manufacturing_year').default(2026).notNull(),
    price: decimal('price', { precision: 14, scale: 2 }).notNull(),
    vinChassisNo: varchar('vin_chassis_no', { length: 100 }).notNull(),
    status: varchar('status', { length: 50 }).default('Available').notNull(),
    inventoryStatus: inventoryStatusEnum.default('IN_STOCK').notNull(),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'set null' }),
    transferTo: char('transfer_to', { length: 36 }).references(() => branches.id, { onDelete: 'set null' }),
    imageKey: varchar('image_key', { length: 100 }).default('sedan').notNull(),
    allocatedEnquiryId: char('allocated_enquiry_id', { length: 36 }),
    stockArrivalDate: date('stock_arrival_date'),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    vinUnique: uniqueIndex('cars_vin_unique').on(table.vinChassisNo),
    branchIdx: index('cars_branch_idx').on(table.branchId),
    statusIdx: index('cars_status_idx').on(table.status),
    inventoryStatusIdx: index('cars_inventory_status_idx').on(table.inventoryStatus),
    createdAtIdx: index('cars_created_at_idx').on(table.createdAt),
  })
);

// 7. Suppliers (Manufacturers / OEMs)
export const suppliers = mysqlTable(
  'suppliers',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    supplierName: varchar('supplier_name', { length: 255 }).notNull(),
    contactPerson: varchar('contact_person', { length: 255 }).default('').notNull(),
    phone: varchar('phone', { length: 50 }).default('').notNull(),
    email: varchar('email', { length: 255 }).default('').notNull(),
    address: text('address').notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    createdAtIdx: index('suppliers_created_at_idx').on(table.createdAt),
  })
);

// 8. Enquiries (Customer demand & Test drives)
export const enquiries = mysqlTable(
  'enquiries',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: char('customer_id', { length: 36 }).notNull().references(() => customers.id, { onDelete: 'cascade' }),
    employeeId: char('employee_id', { length: 36 }).references(() => employees.id, { onDelete: 'set null' }),
    carId: char('car_id', { length: 36 }).references(() => cars.id, { onDelete: 'set null' }),
    branchId: char('branch_id', { length: 36 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
    enquiryType: varchar('enquiry_type', { length: 100 }).default('Car Enquiry').notNull(),
    enquiryDate: datetime('enquiry_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
    appointmentDate: datetime('appointment_date'),
    status: varchar('status', { length: 50 }).default('New').notNull(),
    stage: enquiryStageEnum.default('NEW').notNull(),
    remarks: text('remarks'),
    requestedBrand: varchar('requested_brand', { length: 100 }).default('').notNull(),
    requestedModel: varchar('requested_model', { length: 100 }).default('').notNull(),
    requestedVariant: varchar('requested_variant', { length: 100 }).default('').notNull(),
    preferredColor: varchar('preferred_color', { length: 50 }).default('').notNull(),
    preferredBudget: decimal('preferred_budget', { precision: 14, scale: 2 }),
    expectedTimeline: varchar('expected_timeline', { length: 100 }).default('').notNull(),
    followUpDate: datetime('follow_up_date'),
    testDriveFeedback: text('test_drive_feedback'),
    testDriveCarId: char('test_drive_car_id', { length: 36 }).references(() => cars.id, { onDelete: 'set null' }),
    testDriveSlot: varchar('test_drive_slot', { length: 100 }).default('').notNull(),
    quotationId: char('quotation_id', { length: 36 }),
    bookingAmount: decimal('booking_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    procurementDecision: varchar('procurement_decision', { length: 50 }).default('Pending').notNull(),
    decisionBy: char('decision_by', { length: 36 }).references(() => employees.id, { onDelete: 'set null' }),
    decisionAt: datetime('decision_at'),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    customerIdx: index('enquiries_customer_idx').on(table.customerId),
    branchIdx: index('enquiries_branch_idx').on(table.branchId),
    employeeIdx: index('enquiries_employee_idx').on(table.employeeId),
    stageIdx: index('enquiries_stage_idx').on(table.stage),
    createdAtIdx: index('enquiries_created_at_idx').on(table.createdAt),
  })
);

// 9. Quotations (Pricing breakdowns)
export const quotations = mysqlTable(
  'quotations',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    quotationNumber: varchar('quotation_number', { length: 100 }).notNull(),
    customerId: char('customer_id', { length: 36 }).notNull().references(() => customers.id, { onDelete: 'cascade' }),
    employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
    branchId: char('branch_id', { length: 36 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
    carId: char('car_id', { length: 36 }).references(() => cars.id, { onDelete: 'set null' }),
    brand: varchar('brand', { length: 100 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    variant: varchar('variant', { length: 100 }).notNull(),
    color: varchar('color', { length: 50 }).default('').notNull(),
    exShowroomPrice: decimal('ex_showroom_price', { precision: 14, scale: 2 }).notNull(),
    gstRate: decimal('gst_rate', { precision: 5, scale: 2 }).default('28.00').notNull(),
    gstAmount: decimal('gst_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    insuranceAmount: decimal('insurance_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    rtoTax: decimal('rto_tax', { precision: 14, scale: 2 }).default('0').notNull(),
    accessoriesAmount: decimal('accessories_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    discountAmount: decimal('discount_amount', { precision: 14, scale: 2 }).default('0').notNull(),
    maxAllowedDiscount: decimal('max_allowed_discount', { precision: 14, scale: 2 }).default('25000').notNull(),
    discountApprovalStatus: varchar('discount_approval_status', { length: 50 }).default('APPROVED').notNull(),
    discountApprovedBy: char('discount_approved_by', { length: 36 }).references(() => employees.id, { onDelete: 'set null' }),
    discountRemarks: text('discount_remarks'),
    onRoadPrice: decimal('on_road_price', { precision: 14, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('DRAFT').notNull(),
    validUntil: date('valid_until').notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    quotationNumberUnique: uniqueIndex('quotations_number_unique').on(table.quotationNumber),
    customerIdx: index('quotations_customer_idx').on(table.customerId),
    branchIdx: index('quotations_branch_idx').on(table.branchId),
    employeeIdx: index('quotations_employee_idx').on(table.employeeId),
    createdAtIdx: index('quotations_created_at_idx').on(table.createdAt),
  })
);

// 10. Sales (Bookings & Invoices)
export const sales = mysqlTable(
  'sales',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    customerId: char('customer_id', { length: 36 }).notNull().references(() => customers.id, { onDelete: 'cascade' }),
    carId: char('car_id', { length: 36 }).notNull().references(() => cars.id, { onDelete: 'cascade' }),
    employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
    branchId: char('branch_id', { length: 36 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
    bookingEnquiryId: char('booking_enquiry_id', { length: 36 }).references(() => enquiries.id, { onDelete: 'set null' }),
    saleDate: date('sale_date').notNull(),
    saleAmount: decimal('sale_amount', { precision: 14, scale: 2 }).notNull(),
    saleType: varchar('sale_type', { length: 50 }).default('Enquiry-based').notNull(),
    status: varchar('status', { length: 50 }).default('Pending').notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }),
    amountPaid: decimal('amount_paid', { precision: 14, scale: 2 }).default('0').notNull(),
    paymentStatus: varchar('payment_status', { length: 50 }),
    registrationStatus: varchar('registration_status', { length: 50 }).default('PENDING').notNull(),
    rtoNumber: varchar('rto_number', { length: 100 }).default('').notNull(),
    insurancePolicyNumber: varchar('insurance_policy_number', { length: 100 }).default('').notNull(),
    documentsVerified: boolean('documents_verified').default(false).notNull(),
    handoverDate: date('handover_date'),
    deliveryStatus: varchar('delivery_status', { length: 50 }).default('SCHEDULED').notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    customerIdx: index('sales_customer_idx').on(table.customerId),
    branchIdx: index('sales_branch_idx').on(table.branchId),
    employeeIdx: index('sales_employee_idx').on(table.employeeId),
    carIdx: index('sales_car_idx').on(table.carId),
    statusIdx: index('sales_status_idx').on(table.status),
    createdAtIdx: index('sales_created_at_idx').on(table.createdAt),
  })
);

// 11. Payments (Payment ledger)
export const payments = mysqlTable(
  'payments',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    receiptNo: varchar('receipt_no', { length: 100 }).notNull(),
    saleId: char('sale_id', { length: 36 }).references(() => sales.id, { onDelete: 'cascade' }),
    enquiryId: char('enquiry_id', { length: 36 }).references(() => enquiries.id, { onDelete: 'set null' }),
    customerId: char('customer_id', { length: 36 }).notNull().references(() => customers.id, { onDelete: 'cascade' }),
    branchId: char('branch_id', { length: 36 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
    recordedBy: char('recorded_by', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
    amount: decimal('amount', { precision: 14, scale: 2 }).notNull(),
    paymentType: varchar('payment_type', { length: 50 }).notNull(),
    paymentMethod: varchar('payment_method', { length: 50 }).notNull(),
    paymentStatus: paymentStatusEnum.default('PAID').notNull(),
    transactionReference: varchar('transaction_reference', { length: 100 }).default('').notNull(),
    remarks: text('remarks'),
    paymentDate: datetime('payment_date').default(sql`CURRENT_TIMESTAMP`).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    receiptNoUnique: uniqueIndex('payments_receipt_no_unique').on(table.receiptNo),
    saleIdx: index('payments_sale_idx').on(table.saleId),
    enquiryIdx: index('payments_enquiry_idx').on(table.enquiryId),
    customerIdx: index('payments_customer_idx').on(table.customerId),
    branchIdx: index('payments_branch_idx').on(table.branchId),
    statusIdx: index('payments_status_idx').on(table.paymentStatus),
    createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
  })
);

// 12. Services (After-sales)
export const services = mysqlTable(
  'services',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    carId: char('car_id', { length: 36 }).notNull().references(() => cars.id, { onDelete: 'cascade' }),
    customerId: char('customer_id', { length: 36 }).notNull().references(() => customers.id, { onDelete: 'cascade' }),
    employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
    branchId: char('branch_id', { length: 36 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
    serviceDate: date('service_date').notNull(),
    serviceType: varchar('service_type', { length: 100 }).notNull(),
    description: text('description'),
    cost: decimal('cost', { precision: 14, scale: 2 }).default('0').notNull(),
    status: varchar('status', { length: 50 }).default('Scheduled').notNull(),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: datetime('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    carIdx: index('services_car_idx').on(table.carId),
    customerIdx: index('services_customer_idx').on(table.customerId),
    branchIdx: index('services_branch_idx').on(table.branchId),
    statusIdx: index('services_status_idx').on(table.status),
  })
);

// 13. Purchases (Procurement Purchase Orders)
export const purchases = mysqlTable(
  'purchases',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    supplierId: char('supplier_id', { length: 36 }).notNull().references(() => suppliers.id, { onDelete: 'cascade' }),
    carId: char('car_id', { length: 36 }).notNull().references(() => cars.id, { onDelete: 'cascade' }),
    employeeId: char('employee_id', { length: 36 }).notNull().references(() => employees.id, { onDelete: 'cascade' }),
    branchId: char('branch_id', { length: 36 }).notNull().references(() => branches.id, { onDelete: 'cascade' }),
    enquiryId: char('enquiry_id', { length: 36 }).references(() => enquiries.id, { onDelete: 'set null' }),
    purchaseDate: date('purchase_date').notNull(),
    purchaseCost: decimal('purchase_cost', { precision: 14, scale: 2 }).notNull(),
    status: varchar('status', { length: 50 }).default('Pending Approval').notNull(),
    procurementStage: procurementStageEnum.default('REQUESTED').notNull(),
    expectedDeliveryDate: date('expected_delivery_date'),
    managerApprovedBy: char('manager_approved_by', { length: 36 }).references(() => employees.id, { onDelete: 'set null' }),
    managerApprovedAt: datetime('manager_approved_at'),
    ownerApprovedBy: char('owner_approved_by', { length: 36 }),
    ownerApprovedAt: datetime('owner_approved_at'),
    rejectionReason: text('rejection_reason'),
    isDemo: boolean('is_demo').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    supplierIdx: index('purchases_supplier_idx').on(table.supplierId),
    branchIdx: index('purchases_branch_idx').on(table.branchId),
    enquiryIdx: index('purchases_enquiry_idx').on(table.enquiryId),
    carIdx: index('purchases_car_idx').on(table.carId),
    stageIdx: index('purchases_stage_idx').on(table.procurementStage),
    createdAtIdx: index('purchases_created_at_idx').on(table.createdAt),
  })
);

// 14. Accessories Catalogue
export const accessoriesCatalogue = mysqlTable(
  'accessories_catalogue',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    itemName: varchar('item_name', { length: 255 }).notNull(),
    brand: varchar('brand', { length: 100 }).default('').notNull(),
    price: decimal('price', { precision: 14, scale: 2 }).notNull(),
    category: varchar('category', { length: 100 }).default('General').notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    categoryIdx: index('accessories_category_idx').on(table.category),
    statusIdx: index('accessories_status_idx').on(table.isActive),
  })
);

// 15. Audit Logs
export const auditLogs = mysqlTable(
  'audit_logs',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: char('user_id', { length: 36 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entity: varchar('entity', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }).notNull(),
    oldValue: json('old_value'),
    newValue: json('new_value'),
    summary: text('summary'),
    ip: varchar('ip', { length: 100 }).default('').notNull(),
    userAgent: text('user_agent'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    userIdx: index('audit_logs_user_idx').on(table.userId),
    branchIdx: index('audit_logs_branch_idx').on(table.branchId),
    entityIdx: index('audit_logs_entity_idx').on(table.entity),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  })
);

// 16. Login Events
export const loginEvents = mysqlTable(
  'login_events',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: char('user_id', { length: 36 }).notNull(),
    role: varchar('role', { length: 50 }).notNull(),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'set null' }),
    eventType: varchar('event_type', { length: 50 }).notNull(),
    ip: varchar('ip', { length: 100 }).default('').notNull(),
    userAgent: text('user_agent'),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    userIdx: index('login_events_user_idx').on(table.userId),
    branchIdx: index('login_events_branch_idx').on(table.branchId),
    createdAtIdx: index('login_events_created_at_idx').on(table.createdAt),
  })
);

// 17. Notifications
export const notifications = mysqlTable(
  'notifications',
  {
    id: char('id', { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID()),
    userId: char('user_id', { length: 36 }).references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 50 }),
    branchId: char('branch_id', { length: 36 }).references(() => branches.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 255 }).notNull(),
    message: text('message').notNull(),
    link: varchar('link', { length: 255 }),
    type: varchar('type', { length: 50 }).default('INFO').notNull(),
    isRead: boolean('is_read').default(false).notNull(),
    createdAt: datetime('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  },
  (table) => ({
    userIdx: index('notifications_user_idx').on(table.userId),
    roleBranchIdx: index('notifications_role_branch_idx').on(table.role, table.branchId),
    readIdx: index('notifications_read_idx').on(table.isRead),
    createdAtIdx: index('notifications_created_at_idx').on(table.createdAt),
  })
);

