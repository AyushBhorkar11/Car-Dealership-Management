// Central Role-Based Access Control and Status Workflow Module for CDMS

export type AppRole = 'owner' | 'branch_manager' | 'employee' | 'customer';

export type Permission =
  | 'view_all_branches'
  | 'manage_branches'
  | 'manage_all_staff'
  | 'manage_branch_staff'
  | 'set_staff_targets'
  | 'view_branch_financials'
  | 'view_company_financials'
  | 'approve_procurement'
  | 'approve_procurement_owner'
  | 'approve_discount'
  | 'create_quotation'
  | 'apply_standard_discount'
  | 'create_booking'
  | 'record_payment'
  | 'view_branch_inventory'
  | 'manage_inventory'
  | 'request_stock_transfer'
  | 'approve_stock_transfer'
  | 'manage_catalogue'
  | 'view_all_branch_leads'
  | 'view_assigned_leads'
  | 'create_lead'
  | 'manage_test_drives'
  | 'update_delivery_checklist'
  | 'view_reports'
  | 'view_reports_company'
  | 'view_audit_logs'
  | 'view_login_events';

export const ROLE_PERMISSIONS: Record<AppRole, Set<Permission>> = {
  owner: new Set<Permission>([
    'view_all_branches',
    'manage_branches',
    'manage_all_staff',
    'manage_branch_staff',
    'set_staff_targets',
    'view_branch_financials',
    'view_company_financials',
    'approve_procurement',
    'approve_procurement_owner',
    'approve_discount',
    'create_quotation',
    'apply_standard_discount',
    'create_booking',
    'record_payment',
    'view_branch_inventory',
    'manage_inventory',
    'request_stock_transfer',
    'approve_stock_transfer',
    'manage_catalogue',
    'view_all_branch_leads',
    'view_assigned_leads',
    'create_lead',
    'manage_test_drives',
    'update_delivery_checklist',
    'view_reports',
    'view_reports_company',
    'view_audit_logs',
    'view_login_events',
  ]),

  branch_manager: new Set<Permission>([
    'manage_branch_staff',
    'set_staff_targets',
    'view_branch_financials',
    'approve_procurement',
    'approve_discount',
    'create_quotation',
    'apply_standard_discount',
    'create_booking',
    'record_payment',
    'view_branch_inventory',
    'manage_inventory',
    'request_stock_transfer',
    'view_all_branch_leads',
    'create_lead',
    'manage_test_drives',
    'update_delivery_checklist',
    'view_reports',
  ]),

  employee: new Set<Permission>([
    'create_quotation',
    'apply_standard_discount',
    'create_booking',
    'record_payment',
    'view_branch_inventory',
    'view_assigned_leads',
    'create_lead',
    'manage_test_drives',
    'update_delivery_checklist',
  ]),

  customer: new Set<Permission>([
    'create_lead',
  ]),
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as AppRole];
  if (!perms) return false;
  return perms.has(permission);
}

export function assertPermission(role: string, permission: Permission): void {
  if (!hasPermission(role, permission)) {
    throw new Error(`Forbidden: Role '${role}' lacks permission '${permission}'`);
  }
}

export interface UserContext {
  userId: string;
  role: AppRole;
  branchId: string | null;
  employeeId?: string | null;
  email?: string;
}

export function assertBranchScope(
  user: UserContext,
  resourceBranchId: string | null | undefined,
  resourceEmployeeId?: string | null | undefined
): void {
  if (user.role === 'owner') {
    return; // Owner has company-wide access
  }

  if (!user.branchId) {
    throw new Error('Unauthorized: User account is not assigned to a branch');
  }

  if (resourceBranchId && resourceBranchId !== user.branchId) {
    throw new Error(`Unauthorized: Cross-branch access denied. User belongs to branch '${user.branchId}'`);
  }

  if (user.role === 'employee' && resourceEmployeeId) {
    if (!user.employeeId || resourceEmployeeId !== user.employeeId) {
      throw new Error('Unauthorized: Employees may only access records assigned to themselves');
    }
  }
}

// -------------------------------------------------------------
// STATUS WORKFLOW TRANSITION ENFORCEMENT
// -------------------------------------------------------------

export const ENQUIRY_STAGES = [
  'NEW',
  'CONTACTED',
  'TEST_DRIVE',
  'QUOTED',
  'BOOKED',
  'CLOSED_WON',
  'CLOSED_LOST',
] as const;

export type EnquiryStage = typeof ENQUIRY_STAGES[number];

const ENQUIRY_ALLOWED_TRANSITIONS: Record<EnquiryStage, EnquiryStage[]> = {
  NEW: ['CONTACTED', 'CLOSED_LOST'],
  CONTACTED: ['TEST_DRIVE', 'QUOTED', 'CLOSED_LOST'],
  TEST_DRIVE: ['QUOTED', 'CLOSED_LOST'],
  QUOTED: ['BOOKED', 'CLOSED_LOST'],
  BOOKED: ['CLOSED_WON', 'CLOSED_LOST'],
  CLOSED_WON: [],
  CLOSED_LOST: ['NEW'],
};

export function validateEnquiryTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = ENQUIRY_ALLOWED_TRANSITIONS[from as EnquiryStage];
  return Boolean(allowed && allowed.includes(to as EnquiryStage));
}

export function assertEnquiryTransition(from: string, to: string): void {
  if (!validateEnquiryTransition(from, to)) {
    throw new Error(`Invalid Enquiry transition: cannot move from '${from}' to '${to}'`);
  }
}

export const PROCUREMENT_STAGES = [
  'REQUESTED',
  'MANAGER_APPROVED',
  'OWNER_APPROVED',
  'ORDERED',
  'IN_TRANSIT',
  'RECEIVED',
  'ALLOCATED',
  'REJECTED',
] as const;

export type ProcurementStage = typeof PROCUREMENT_STAGES[number];

const PROCUREMENT_ALLOWED_TRANSITIONS: Record<ProcurementStage, ProcurementStage[]> = {
  REQUESTED: ['MANAGER_APPROVED', 'REJECTED'],
  MANAGER_APPROVED: ['OWNER_APPROVED', 'REJECTED'],
  OWNER_APPROVED: ['ORDERED', 'REJECTED'],
  ORDERED: ['IN_TRANSIT', 'REJECTED'],
  IN_TRANSIT: ['RECEIVED'],
  RECEIVED: ['ALLOCATED'],
  ALLOCATED: [],
  REJECTED: ['REQUESTED'],
};

export function validateProcurementTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = PROCUREMENT_ALLOWED_TRANSITIONS[from as ProcurementStage];
  return Boolean(allowed && allowed.includes(to as ProcurementStage));
}

export function assertProcurementTransition(from: string, to: string): void {
  if (!validateProcurementTransition(from, to)) {
    throw new Error(`Invalid Procurement transition: cannot move from '${from}' to '${to}'`);
  }
}

export const CAR_INVENTORY_STAGES = [
  'IN_TRANSIT',
  'IN_STOCK',
  'RESERVED',
  'SOLD',
  'DELIVERED',
] as const;

export type CarInventoryStage = typeof CAR_INVENTORY_STAGES[number];

const CAR_ALLOWED_TRANSITIONS: Record<CarInventoryStage, CarInventoryStage[]> = {
  IN_TRANSIT: ['IN_STOCK'],
  IN_STOCK: ['RESERVED'],
  RESERVED: ['SOLD', 'IN_STOCK'],
  SOLD: ['DELIVERED'],
  DELIVERED: [],
};

export function validateCarInventoryTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = CAR_ALLOWED_TRANSITIONS[from as CarInventoryStage];
  return Boolean(allowed && allowed.includes(to as CarInventoryStage));
}

export function assertCarInventoryTransition(from: string, to: string): void {
  if (!validateCarInventoryTransition(from, to)) {
    throw new Error(`Invalid Car Inventory transition: cannot move from '${from}' to '${to}'`);
  }
}

export const PAYMENT_STAGES = [
  'PENDING',
  'PARTIAL',
  'PAID',
  'REFUNDED',
] as const;

export type PaymentStage = typeof PAYMENT_STAGES[number];

const PAYMENT_ALLOWED_TRANSITIONS: Record<PaymentStage, PaymentStage[]> = {
  PENDING: ['PARTIAL', 'PAID'],
  PARTIAL: ['PAID'],
  PAID: ['REFUNDED'],
  REFUNDED: [],
};

export function validatePaymentTransition(from: string, to: string): boolean {
  if (from === to) return true;
  const allowed = PAYMENT_ALLOWED_TRANSITIONS[from as PaymentStage];
  return Boolean(allowed && allowed.includes(to as PaymentStage));
}

export function assertPaymentTransition(from: string, to: string): void {
  if (!validatePaymentTransition(from, to)) {
    throw new Error(`Invalid Payment transition: cannot move from '${from}' to '${to}'`);
  }
}

export const STANDARD_MAX_DISCOUNT_INR = 25000;

export function isDiscountApprovalRequired(discountAmount: number, maxAllowed: number = STANDARD_MAX_DISCOUNT_INR): boolean {
  return discountAmount > maxAllowed;
}
