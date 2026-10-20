import crypto from 'node:crypto';
import { db, schema } from './db';

export type AppRole = 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' | 'CUSTOMER' | 'owner' | 'branch_manager' | 'employee' | 'customer';

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

export const ROLE_PERMISSIONS: Record<string, Set<Permission>> = {
  OWNER: new Set<Permission>([
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

  BRANCH_MANAGER: new Set<Permission>([
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

  EMPLOYEE: new Set<Permission>([
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

  CUSTOMER: new Set<Permission>([
    'create_lead',
  ]),
};

// Aliases for lower case
ROLE_PERMISSIONS['owner'] = ROLE_PERMISSIONS['OWNER'];
ROLE_PERMISSIONS['branch_manager'] = ROLE_PERMISSIONS['BRANCH_MANAGER'];
ROLE_PERMISSIONS['employee'] = ROLE_PERMISSIONS['EMPLOYEE'];
ROLE_PERMISSIONS['customer'] = ROLE_PERMISSIONS['CUSTOMER'];

export function normalizeRole(role: string): string {
  const upper = role.toUpperCase();
  if (upper === 'BRANCH_MANAGER' || upper === 'OWNER' || upper === 'EMPLOYEE' || upper === 'CUSTOMER') {
    return upper;
  }
  return role;
}

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[normalizeRole(role)] || ROLE_PERMISSIONS[role.toLowerCase()];
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
  role: string;
  branchId: string | null;
  employeeId?: string | null;
  email?: string;
  name?: string;
}

export function assertBranchScope(
  user: UserContext,
  resourceBranchId: string | null | undefined,
  resourceEmployeeId?: string | null | undefined
): void {
  const role = normalizeRole(user.role);
  if (role === 'OWNER') {
    return; // Owner has company-wide access across all branches
  }

  if (!user.branchId) {
    throw new Error('Unauthorized: User account is not assigned to a branch');
  }

  if (resourceBranchId && resourceBranchId !== user.branchId) {
    throw new Error(`Unauthorized: Cross-branch access denied. User belongs to branch '${user.branchId}'`);
  }

  if (role === 'EMPLOYEE' && resourceEmployeeId) {
    if (user.employeeId && resourceEmployeeId !== user.employeeId) {
      throw new Error('Unauthorized: Employees may only access records assigned to themselves');
    }
  }
}

// -------------------------------------------------------------
// STATUS WORKFLOW TRANSITIONS
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
  NEW: ['CONTACTED', 'TEST_DRIVE', 'QUOTED', 'CLOSED_LOST'],
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

// -------------------------------------------------------------
// AUDIT LOG RECORDER
// -------------------------------------------------------------
// CENTRAL AUDIT INTEGRATION
// -------------------------------------------------------------

export { writeAudit } from './audit';
export type { AuditActor, AuditEntryOptions } from './audit';

export async function writeAuditLog(opts: {
  userId: string;
  role: string;
  branchId?: string | null;
  action: string;
  entity: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
  summary?: string;
  tx?: any;
}): Promise<void> {
  const { writeAudit } = await import('./audit');
  await writeAudit({
    tx: opts.tx,
    actor: {
      userId: opts.userId,
      role: opts.role,
      branchId: opts.branchId || null,
    },
    action: opts.action,
    entity: opts.entity,
    entityId: opts.entityId,
    oldValue: (opts.oldValue as any) || null,
    newValue: (opts.newValue as any) || null,
    summary: opts.summary || `${opts.role} performed ${opts.action} on ${opts.entity} (${opts.entityId})`,
  });
}
