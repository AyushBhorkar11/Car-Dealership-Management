import crypto from 'node:crypto';
import { db, pool, schema } from '../src/server/db';
import { writeAudit, computeDiff } from '../src/server/audit';
import { eq } from 'drizzle-orm';

async function runAuditVerification() {
  console.log('====================================================');
  console.log('CDMS AUDIT TRAIL VERIFICATION SUITE');
  console.log('Testing 5 Transactional Changes + Trigger Immutability');
  console.log('====================================================\n');

  // Verify database connection
  await pool.query('SELECT 1');
  console.log('✓ MySQL database connection verified.');

  const [branches]: any = await pool.query('SELECT id, branch_name FROM branches LIMIT 1');
  if (!branches || branches.length === 0) {
    throw new Error('No branches present in database. Run db seed first.');
  }
  const testBranch = branches[0];
  console.log(`✓ Using branch for test scope: ${testBranch.branch_name} (${testBranch.id})`);

  const testActor = {
    userId: 'audit-test-admin-uuid',
    role: 'OWNER',
    branchId: testBranch.id,
  };

  const testCustomerId = `cust-test-${Date.now()}`;
  const testEnquiryId = `enq-test-${Date.now()}`;
  const auditRowIds: string[] = [];

  try {
    // -----------------------------------------------------------------
    // TEST 1: CREATE CUSTOMER (OldValue = null, NewValue = clean fields)
    // -----------------------------------------------------------------
    console.log('\n[1/5] Testing CREATE CUSTOMER transaction & audit...');
    const customerPayload = {
      id: testCustomerId,
      name: 'Audit Test Customer',
      email: `audit.tester.${Date.now()}@example.com`,
      phone: '+91 98765 00001',
      address: '123 Marine Drive',
      city: 'Mumbai',
      idProofType: 'Aadhaar',
      idProofNumber: '1234-5678-9012',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const audit1Id = await db.transaction(async (tx) => {
      await tx.insert(schema.customers).values(customerPayload);
      return await writeAudit({
        tx,
        actor: testActor,
        action: 'customer.created',
        entity: 'customer',
        entityId: testCustomerId,
        oldValue: null,
        newValue: customerPayload,
        summary: `Created customer profile for ${customerPayload.name} (${customerPayload.phone})`,
      });
    });
    auditRowIds.push(audit1Id);

    // Verify Audit Row 1
    const [row1]: any = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [audit1Id]);
    if (!row1[0]) throw new Error('Audit row 1 was not persisted!');
    const row1Data = row1[0];
    const row1New = typeof row1Data.new_value === 'string' ? JSON.parse(row1Data.new_value) : row1Data.new_value;
    if (row1Data.old_value !== null) throw new Error('Expected old_value to be null for CREATE');
    if (row1New.name !== customerPayload.name) throw new Error('New value does not match inserted customer');
    if (!row1Data.summary.includes(customerPayload.name)) throw new Error('Summary missing customer name');
    console.log(`✓ Change 1 PASS: Customer created, audit row recorded (${audit1Id})`);
    console.log(`  Diff: old_value=null, new_value keys=[${Object.keys(row1New).join(', ')}]`);

    // -----------------------------------------------------------------
    // TEST 2: UPDATE CUSTOMER (Only mutated fields in diff)
    // -----------------------------------------------------------------
    console.log('\n[2/5] Testing UPDATE CUSTOMER transaction & diff...');
    const updatedPhone = '+91 99999 88888';
    const updatedCity = 'Navi Mumbai';

    const audit2Id = await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(schema.customers)
        .where(eq(schema.customers.id, testCustomerId));

      await tx
        .update(schema.customers)
        .set({ phone: updatedPhone, city: updatedCity, updatedAt: new Date() })
        .where(eq(schema.customers.id, testCustomerId));

      return await writeAudit({
        tx,
        actor: testActor,
        action: 'customer.updated',
        entity: 'customer',
        entityId: testCustomerId,
        oldValue: { phone: existing.phone, city: existing.city },
        newValue: { phone: updatedPhone, city: updatedCity },
        summary: `Updated phone to ${updatedPhone} and city to ${updatedCity}`,
      });
    });
    auditRowIds.push(audit2Id);

    // Verify Audit Row 2
    const [row2]: any = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [audit2Id]);
    const row2Data = row2[0];
    const row2Old = typeof row2Data.old_value === 'string' ? JSON.parse(row2Data.old_value) : row2Data.old_value;
    const row2New = typeof row2Data.new_value === 'string' ? JSON.parse(row2Data.new_value) : row2Data.new_value;
    if (row2Old.phone !== customerPayload.phone || row2New.phone !== updatedPhone) {
      throw new Error('Phone diff did not record properly');
    }
    if (row2Old.name !== undefined || row2New.name !== undefined) {
      throw new Error('Unmodified fields leaked into update diff!');
    }
    console.log(`✓ Change 2 PASS: Customer updated, audit diff strictly records mutated keys (${audit2Id})`);
    console.log(`  Diff old: ${JSON.stringify(row2Old)} -> new: ${JSON.stringify(row2New)}`);

    // -----------------------------------------------------------------
    // TEST 3: CREATE ENQUIRY (Relational entity audit)
    // -----------------------------------------------------------------
    console.log('\n[3/5] Testing CREATE ENQUIRY transaction & audit...');
    const enquiryPayload = {
      id: testEnquiryId,
      customerId: testCustomerId,
      branchId: testBranch.id,
      enquiryType: 'Car Enquiry',
      requestedBrand: 'Hyundai',
      requestedModel: 'Creta',
      stage: 'NEW' as const,
      remarks: 'Walk-in customer interested in SX (O) variant',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const audit3Id = await db.transaction(async (tx) => {
      await tx.insert(schema.enquiries).values(enquiryPayload);
      return await writeAudit({
        tx,
        actor: testActor,
        action: 'enquiry.created',
        entity: 'enquiry',
        entityId: testEnquiryId,
        branchId: testBranch.id,
        oldValue: null,
        newValue: enquiryPayload,
        summary: `New walk-in enquiry for ${enquiryPayload.requestedModel} at ${testBranch.branch_name}`,
      });
    });
    auditRowIds.push(audit3Id);

    const [row3]: any = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [audit3Id]);
    const row3Data = row3[0];
    if (row3Data.action !== 'enquiry.created') throw new Error('Action mismatch for change 3');
    console.log(`✓ Change 3 PASS: Enquiry created, audit row recorded (${audit3Id})`);

    // -----------------------------------------------------------------
    // TEST 4: UPDATE ENQUIRY STAGE (Lifecycle stage transition)
    // -----------------------------------------------------------------
    console.log('\n[4/5] Testing ENQUIRY STAGE TRANSITION transaction & audit...');
    const audit4Id = await db.transaction(async (tx) => {
      await tx
        .update(schema.enquiries)
        .set({ stage: 'CONTACTED', updatedAt: new Date() })
        .where(eq(schema.enquiries.id, testEnquiryId));

      return await writeAudit({
        tx,
        actor: testActor,
        action: 'enquiry.stage_changed',
        entity: 'enquiry',
        entityId: testEnquiryId,
        branchId: testBranch.id,
        oldValue: { stage: 'NEW' },
        newValue: { stage: 'CONTACTED' },
        summary: `Lead stage progressed from NEW to CONTACTED`,
      });
    });
    auditRowIds.push(audit4Id);

    const [row4]: any = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [audit4Id]);
    const row4Data = row4[0];
    const row4Old = typeof row4Data.old_value === 'string' ? JSON.parse(row4Data.old_value) : row4Data.old_value;
    const row4New = typeof row4Data.new_value === 'string' ? JSON.parse(row4Data.new_value) : row4Data.new_value;
    if (row4Old.stage !== 'NEW' || row4New.stage !== 'CONTACTED') {
      throw new Error('Stage transition diff mismatch');
    }
    console.log(`✓ Change 4 PASS: Enquiry stage transition audited (${audit4Id})`);
    console.log(`  Diff: stage "${row4Old.stage}" -> "${row4New.stage}"`);

    // -----------------------------------------------------------------
    // TEST 5: DELETE ENQUIRY (OldValue = previous state, NewValue = null)
    // -----------------------------------------------------------------
    console.log('\n[5/5] Testing DELETE ENQUIRY transaction & audit...');
    const audit5Id = await db.transaction(async (tx) => {
      const [enq] = await tx
        .select()
        .from(schema.enquiries)
        .where(eq(schema.enquiries.id, testEnquiryId));

      await tx.delete(schema.enquiries).where(eq(schema.enquiries.id, testEnquiryId));

      return await writeAudit({
        tx,
        actor: testActor,
        action: 'enquiry.deleted',
        entity: 'enquiry',
        entityId: testEnquiryId,
        branchId: testBranch.id,
        oldValue: enq,
        newValue: null,
        summary: `Deleted test enquiry ${testEnquiryId}`,
      });
    });
    auditRowIds.push(audit5Id);

    const [row5]: any = await pool.query('SELECT * FROM audit_logs WHERE id = ?', [audit5Id]);
    const row5Data = row5[0];
    if (row5Data.new_value !== null) throw new Error('Expected new_value to be null for DELETE');
    if (!row5Data.old_value) throw new Error('Expected old_value to capture deleted state');
    console.log(`✓ Change 5 PASS: Entity deleted, audit row recorded with new_value=null (${audit5Id})`);

    // -----------------------------------------------------------------
    // IMMUTABILITY TEST 1: ATTEMPT TO UPDATE AN AUDIT ROW (MUST BE REJECTED)
    // -----------------------------------------------------------------
    console.log('\n[IMMUTABILITY 1] Testing trigger rejection on UPDATE audit_logs...');
    let updateBlocked = false;
    try {
      await pool.query('UPDATE audit_logs SET action = ? WHERE id = ?', ['TAMPERED_ACTION', audit1Id]);
    } catch (err: any) {
      updateBlocked = true;
      console.log(`✓ MySQL Trigger correctly rejected UPDATE attempt!`);
      console.log(`  Expected Error Caught: "${err.message}" (SQLSTATE: ${err.sqlState || err.code})`);
    }
    if (!updateBlocked) {
      throw new Error('SECURITY VIOLATION: An audit_logs record was modified! Trigger trg_audit_logs_no_update failed.');
    }

    // -----------------------------------------------------------------
    // IMMUTABILITY TEST 2: ATTEMPT TO DELETE AN AUDIT ROW (MUST BE REJECTED)
    // -----------------------------------------------------------------
    console.log('\n[IMMUTABILITY 2] Testing trigger rejection on DELETE audit_logs...');
    let deleteBlocked = false;
    try {
      await pool.query('DELETE FROM audit_logs WHERE id = ?', [audit1Id]);
    } catch (err: any) {
      deleteBlocked = true;
      console.log(`✓ MySQL Trigger correctly rejected DELETE attempt!`);
      console.log(`  Expected Error Caught: "${err.message}" (SQLSTATE: ${err.sqlState || err.code})`);
    }
    if (!deleteBlocked) {
      throw new Error('SECURITY VIOLATION: An audit_logs record was deleted! Trigger trg_audit_logs_no_delete failed.');
    }

    // Cleanup test customer from database (note: audit rows remain as immutable proof)
    await pool.query('DELETE FROM customers WHERE id = ?', [testCustomerId]);

    console.log('\n====================================================');
    console.log('✓ ALL 5 AUDIT MUTATIONS VERIFIED WITH ACCURATE DIFFS');
    console.log('✓ ENGINE-LEVEL IMMUTABILITY TRIGGERS FULLY OPERATIONAL');
    console.log('====================================================\n');
    process.exit(0);
  } catch (err: any) {
    console.error('\n✗ AUDIT VERIFICATION FAILED:', err);
    process.exit(1);
  }
}

runAuditVerification();
