import { describe, it, expect } from 'vitest';
import {
  hasPermission,
  assertPermission,
  assertBranchScope,
  validateEnquiryTransition,
  assertEnquiryTransition,
  validateProcurementTransition,
  assertProcurementTransition,
  validateCarInventoryTransition,
  assertCarInventoryTransition,
  validatePaymentTransition,
  assertPaymentTransition,
  isDiscountApprovalRequired,
  STANDARD_MAX_DISCOUNT_INR,
  type UserContext,
} from '../lib/permissions';

describe('Role-Based Access Control Permission Matrix', () => {
  it('owner has full global permissions', () => {
    expect(hasPermission('owner', 'view_all_branches')).toBe(true);
    expect(hasPermission('owner', 'manage_branches')).toBe(true);
    expect(hasPermission('owner', 'manage_all_staff')).toBe(true);
    expect(hasPermission('owner', 'approve_procurement_owner')).toBe(true);
    expect(hasPermission('owner', 'view_company_financials')).toBe(true);
    expect(hasPermission('owner', 'view_audit_logs')).toBe(true);
    expect(hasPermission('owner', 'view_login_events')).toBe(true);
  });

  it('branch manager has branch-scoped permissions but cannot access owner global actions', () => {
    expect(hasPermission('branch_manager', 'manage_branch_staff')).toBe(true);
    expect(hasPermission('branch_manager', 'approve_procurement')).toBe(true);
    expect(hasPermission('branch_manager', 'approve_discount')).toBe(true);
    expect(hasPermission('branch_manager', 'view_branch_financials')).toBe(true);
    expect(hasPermission('branch_manager', 'view_all_branch_leads')).toBe(true);

    // Forbidden for branch manager:
    expect(hasPermission('branch_manager', 'view_all_branches')).toBe(false);
    expect(hasPermission('branch_manager', 'manage_branches')).toBe(false);
    expect(hasPermission('branch_manager', 'manage_all_staff')).toBe(false);
    expect(hasPermission('branch_manager', 'approve_procurement_owner')).toBe(false);
    expect(hasPermission('branch_manager', 'view_company_financials')).toBe(false);
    expect(hasPermission('branch_manager', 'view_audit_logs')).toBe(false);
  });

  it('employee can create quotations and leads but cannot approve discounts or manage staff', () => {
    expect(hasPermission('employee', 'create_quotation')).toBe(true);
    expect(hasPermission('employee', 'create_lead')).toBe(true);
    expect(hasPermission('employee', 'view_assigned_leads')).toBe(true);
    expect(hasPermission('employee', 'manage_test_drives')).toBe(true);
    expect(hasPermission('employee', 'record_payment')).toBe(true);

    // Forbidden for employee:
    expect(hasPermission('employee', 'approve_discount')).toBe(false);
    expect(hasPermission('employee', 'approve_procurement')).toBe(false);
    expect(hasPermission('employee', 'manage_branch_staff')).toBe(false);
    expect(hasPermission('employee', 'view_branch_financials')).toBe(false);
    expect(hasPermission('employee', 'view_all_branch_leads')).toBe(false);
  });

  it('assertPermission throws when permission is not granted', () => {
    expect(() => assertPermission('employee', 'approve_discount')).toThrowError(/Forbidden/);
    expect(() => assertPermission('branch_manager', 'manage_branches')).toThrowError(/Forbidden/);
    expect(() => assertPermission('owner', 'manage_branches')).not.toThrow();
  });
});

describe('Branch Scope and Data Isolation Enforcement', () => {
  const branchA = '10000000-0000-0000-0000-000000000001';
  const branchB = '10000000-0000-0000-0000-000000000002';
  const empA = '30000000-0000-0000-0000-000000000001';
  const empB = '30000000-0000-0000-0000-000000000002';

  const managerA: UserContext = {
    userId: 'user-manager-a',
    role: 'branch_manager',
    branchId: branchA,
  };

  const employeeA: UserContext = {
    userId: 'user-emp-a',
    role: 'employee',
    branchId: branchA,
    employeeId: empA,
  };

  const owner: UserContext = {
    userId: 'user-owner',
    role: 'owner',
    branchId: null,
  };

  it('owner can access data across any branch', () => {
    expect(() => assertBranchScope(owner, branchA)).not.toThrow();
    expect(() => assertBranchScope(owner, branchB)).not.toThrow();
  });

  it('manager cannot read or write another branch data', () => {
    expect(() => assertBranchScope(managerA, branchA)).not.toThrow();
    expect(() => assertBranchScope(managerA, branchB)).toThrowError(/Cross-branch access denied/);
  });

  it('employee cannot access another branch data', () => {
    expect(() => assertBranchScope(employeeA, branchB)).toThrowError(/Cross-branch access denied/);
  });

  it('employee cannot read or access another employee assigned leads', () => {
    expect(() => assertBranchScope(employeeA, branchA, empA)).not.toThrow();
    expect(() => assertBranchScope(employeeA, branchA, empB)).toThrowError(/Employees may only access records assigned to themselves/);
  });
});

describe('Status Workflows and Allowed Transitions', () => {
  describe('Demand / Enquiry Status Workflow', () => {
    it('allows valid lifecycle progression: NEW -> CONTACTED -> TEST_DRIVE -> QUOTED -> BOOKED -> CLOSED_WON', () => {
      expect(validateEnquiryTransition('NEW', 'CONTACTED')).toBe(true);
      expect(validateEnquiryTransition('CONTACTED', 'TEST_DRIVE')).toBe(true);
      expect(validateEnquiryTransition('TEST_DRIVE', 'QUOTED')).toBe(true);
      expect(validateEnquiryTransition('QUOTED', 'BOOKED')).toBe(true);
      expect(validateEnquiryTransition('BOOKED', 'CLOSED_WON')).toBe(true);
    });

    it('rejects invalid jumps or transitions', () => {
      expect(validateEnquiryTransition('NEW', 'BOOKED')).toBe(false);
      expect(validateEnquiryTransition('CONTACTED', 'CLOSED_WON')).toBe(false);
      expect(() => assertEnquiryTransition('NEW', 'CLOSED_WON')).toThrowError(/Invalid Enquiry transition/);
    });

    it('allows drop-off to CLOSED_LOST from active stages', () => {
      expect(validateEnquiryTransition('NEW', 'CLOSED_LOST')).toBe(true);
      expect(validateEnquiryTransition('CONTACTED', 'CLOSED_LOST')).toBe(true);
      expect(validateEnquiryTransition('TEST_DRIVE', 'CLOSED_LOST')).toBe(true);
      expect(validateEnquiryTransition('QUOTED', 'CLOSED_LOST')).toBe(true);
    });
  });

  describe('Procurement Workflow', () => {
    it('allows sequential demand-driven steps: REQUESTED -> MANAGER_APPROVED -> OWNER_APPROVED -> ORDERED -> IN_TRANSIT -> RECEIVED -> ALLOCATED', () => {
      expect(validateProcurementTransition('REQUESTED', 'MANAGER_APPROVED')).toBe(true);
      expect(validateProcurementTransition('MANAGER_APPROVED', 'OWNER_APPROVED')).toBe(true);
      expect(validateProcurementTransition('OWNER_APPROVED', 'ORDERED')).toBe(true);
      expect(validateProcurementTransition('ORDERED', 'IN_TRANSIT')).toBe(true);
      expect(validateProcurementTransition('IN_TRANSIT', 'RECEIVED')).toBe(true);
      expect(validateProcurementTransition('RECEIVED', 'ALLOCATED')).toBe(true);
    });

    it('rejects unapproved jumping straight to ORDERED or ALLOCATED', () => {
      expect(validateProcurementTransition('REQUESTED', 'ORDERED')).toBe(false);
      expect(validateProcurementTransition('REQUESTED', 'ALLOCATED')).toBe(false);
      expect(() => assertProcurementTransition('REQUESTED', 'ALLOCATED')).toThrowError(/Invalid Procurement transition/);
    });
  });

  describe('Car Inventory Workflow', () => {
    it('allows IN_TRANSIT -> IN_STOCK -> RESERVED -> SOLD -> DELIVERED', () => {
      expect(validateCarInventoryTransition('IN_TRANSIT', 'IN_STOCK')).toBe(true);
      expect(validateCarInventoryTransition('IN_STOCK', 'RESERVED')).toBe(true);
      expect(validateCarInventoryTransition('RESERVED', 'SOLD')).toBe(true);
      expect(validateCarInventoryTransition('SOLD', 'DELIVERED')).toBe(true);
    });

    it('rejects jumping from IN_TRANSIT directly to SOLD or DELIVERED', () => {
      expect(validateCarInventoryTransition('IN_TRANSIT', 'SOLD')).toBe(false);
      expect(() => assertCarInventoryTransition('IN_TRANSIT', 'DELIVERED')).toThrowError(/Invalid Car Inventory transition/);
    });
  });

  describe('Payment Workflow', () => {
    it('allows PENDING -> PARTIAL -> PAID -> REFUNDED', () => {
      expect(validatePaymentTransition('PENDING', 'PARTIAL')).toBe(true);
      expect(validatePaymentTransition('PENDING', 'PAID')).toBe(true);
      expect(validatePaymentTransition('PARTIAL', 'PAID')).toBe(true);
      expect(validatePaymentTransition('PAID', 'REFUNDED')).toBe(true);
    });

    it('rejects invalid payment backwards movement like REFUNDED -> PAID', () => {
      expect(validatePaymentTransition('REFUNDED', 'PAID')).toBe(false);
      expect(() => assertPaymentTransition('REFUNDED', 'PAID')).toThrowError(/Invalid Payment transition/);
    });
  });
});

describe('Discount Approval Enforcement', () => {
  it('does not require manager approval for discounts up to the limit', () => {
    expect(isDiscountApprovalRequired(10000)).toBe(false);
    expect(isDiscountApprovalRequired(25000)).toBe(false);
  });

  it('requires manager approval when discount exceeds the standard limit', () => {
    expect(isDiscountApprovalRequired(25001)).toBe(true);
    expect(isDiscountApprovalRequired(50000)).toBe(true);
    expect(isDiscountApprovalRequired(STANDARD_MAX_DISCOUNT_INR + 1)).toBe(true);
  });
});
