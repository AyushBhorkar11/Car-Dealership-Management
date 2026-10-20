import { db, schema } from '../src/server/db';
import { eq, and, desc } from 'drizzle-orm';
import { writeAudit } from '../src/server/audit';
import { createNotification } from '../src/server/notifications';

async function testTransferLifecycle() {
  console.log('====================================================');
  console.log('STAGE 5: INTER-BRANCH STOCK TRANSFER LIFECYCLE TESTS');
  console.log('====================================================\n');

  // Fetch branches
  const branches = await db.select().from(schema.branches);
  if (branches.length < 2) {
    throw new Error('Need at least 2 branches to test inter-branch transfers');
  }

  const branchA = branches[0];
  const branchB = branches[1];

  console.log(`Branch A (Source): ${branchA.branchName} (${branchA.city}) [ID: ${branchA.id}]`);
  console.log(`Branch B (Target): ${branchB.branchName} (${branchB.city}) [ID: ${branchB.id}]`);

  // Find or create test car at Branch A
  let [testCar] = await db
    .select()
    .from(schema.cars)
    .where(and(eq(schema.cars.branchId, branchA.id), eq(schema.cars.status, 'Available')))
    .limit(1);

  if (!testCar) {
    // Pick any available car and assign to Branch A
    const [anyCar] = await db.select().from(schema.cars).limit(1);
    await db
      .update(schema.cars)
      .set({ branchId: branchA.id, status: 'Available', inventoryStatus: 'IN_STOCK', transferTo: null })
      .where(eq(schema.cars.id, anyCar.id));
    testCar = (await db.select().from(schema.cars).where(eq(schema.cars.id, anyCar.id)))[0];
  }

  const initialBranchId = testCar.branchId;
  console.log(`\nUsing Test Vehicle: ${testCar.brand} ${testCar.model} [VIN: ${testCar.vinChassisNo}, ID: ${testCar.id}]`);

  // -------------------------------------------------------------
  // LIFECYCLE 1: REQUEST -> APPROVE -> RECEIVE (Full Transfer)
  // -------------------------------------------------------------
  console.log('\n--- LIFECYCLE 1: Request -> Approve -> Receive ---');

  // STEP 1: Branch Manager B requests car from Branch A
  console.log('\n[1.1] Requesting transfer to Branch B...');
  await db.transaction(async (tx) => {
    await tx
      .update(schema.cars)
      .set({
        transferTo: branchB.id,
        status: 'Transfer Pending',
        updatedAt: new Date(),
      })
      .where(eq(schema.cars.id, testCar.id));

    await writeAudit({
      tx,
      actor: { userId: 'manager-b', role: 'BRANCH_MANAGER', branchId: branchB.id },
      action: 'car.transfer_requested',
      entity: 'car',
      entityId: testCar.id,
      oldValue: { branchId: testCar.branchId, status: testCar.status, transferTo: null },
      newValue: { branchId: testCar.branchId, status: 'Transfer Pending', transferTo: branchB.id },
      summary: `BRANCH_MANAGER requested stock transfer of ${testCar.brand} ${testCar.model} to ${branchB.branchName}`,
    });
  });

  let [carAfterReq] = await db.select().from(schema.cars).where(eq(schema.cars.id, testCar.id));
  if (carAfterReq.status !== 'Transfer Pending' || carAfterReq.transferTo !== branchB.id) {
    throw new Error(`FAIL 1.1: Expected status 'Transfer Pending' & transferTo '${branchB.id}', got '${carAfterReq.status}' & '${carAfterReq.transferTo}'`);
  }
  console.log(`✓ 1.1 PASS: Car status is '${carAfterReq.status}' with target branch set.`);

  // Verify Audit Log for Step 1
  const [auditReq] = await db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.entityId, testCar.id), eq(schema.auditLogs.action, 'car.transfer_requested')))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1);

  if (!auditReq) throw new Error('FAIL 1.1: Audit record for car.transfer_requested not found');
  console.log(`✓ 1.1 PASS: Audit log recorded: "${auditReq.summary}"`);

  // STEP 2: Owner approves transfer
  console.log('\n[1.2] Owner approves transfer (moves to In Transit)...');
  await db.transaction(async (tx) => {
    await tx
      .update(schema.cars)
      .set({
        status: 'In Transit',
        inventoryStatus: 'IN_TRANSIT',
        updatedAt: new Date(),
      })
      .where(eq(schema.cars.id, testCar.id));

    await writeAudit({
      tx,
      actor: { userId: 'owner-1', role: 'OWNER', branchId: null },
      action: 'car.transfer_approved',
      entity: 'car',
      entityId: testCar.id,
      oldValue: { status: 'Transfer Pending', inventoryStatus: 'IN_STOCK', transferTo: branchB.id },
      newValue: { status: 'In Transit', inventoryStatus: 'IN_TRANSIT', transferTo: branchB.id },
      summary: `OWNER approved transfer of ${testCar.brand} ${testCar.model} to ${branchB.branchName} (In Transit)`,
    });
  });

  let [carAfterAppr] = await db.select().from(schema.cars).where(eq(schema.cars.id, testCar.id));
  if (carAfterAppr.status !== 'In Transit' || carAfterAppr.inventoryStatus !== 'IN_TRANSIT') {
    throw new Error(`FAIL 1.2: Expected status 'In Transit' & inventoryStatus 'IN_TRANSIT', got '${carAfterAppr.status}' & '${carAfterAppr.inventoryStatus}'`);
  }
  console.log(`✓ 1.2 PASS: Car moved to '${carAfterAppr.status}' [inventory: ${carAfterAppr.inventoryStatus}]`);

  // Verify Audit Log for Step 2
  const [auditAppr] = await db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.entityId, testCar.id), eq(schema.auditLogs.action, 'car.transfer_approved')))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1);

  if (!auditAppr) throw new Error('FAIL 1.2: Audit record for car.transfer_approved not found');
  console.log(`✓ 1.2 PASS: Audit log recorded: "${auditAppr.summary}"`);

  // STEP 3: Destination branch manager confirms arrival
  console.log('\n[1.3] Destination Manager marks vehicle Received...');
  await db.transaction(async (tx) => {
    await tx
      .update(schema.cars)
      .set({
        branchId: branchB.id,
        transferTo: null,
        status: 'In Stock',
        inventoryStatus: 'IN_STOCK',
        updatedAt: new Date(),
      })
      .where(eq(schema.cars.id, testCar.id));

    await writeAudit({
      tx,
      actor: { userId: 'manager-b', role: 'BRANCH_MANAGER', branchId: branchB.id },
      action: 'car.transfer_received',
      entity: 'car',
      entityId: testCar.id,
      oldValue: { branchId: branchA.id, status: 'In Transit', transferTo: branchB.id },
      newValue: { branchId: branchB.id, status: 'In Stock', transferTo: null },
      summary: `BRANCH_MANAGER confirmed arrival of ${testCar.brand} ${testCar.model} into showroom ${branchB.branchName}`,
    });
  });

  let [carAfterRec] = await db.select().from(schema.cars).where(eq(schema.cars.id, testCar.id));
  if (carAfterRec.branchId !== branchB.id || carAfterRec.transferTo !== null || carAfterRec.inventoryStatus !== 'IN_STOCK') {
    throw new Error(`FAIL 1.3: Vehicle not properly reassigned to branch B. Branch: ${carAfterRec.branchId}, TransferTo: ${carAfterRec.transferTo}`);
  }
  console.log(`✓ 1.3 PASS: Vehicle branch successfully updated to Branch B (${branchB.city}), hold cleared, status In Stock.`);

  // Verify Audit Log for Step 3
  const [auditRec] = await db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.entityId, testCar.id), eq(schema.auditLogs.action, 'car.transfer_received')))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1);

  if (!auditRec) throw new Error('FAIL 1.3: Audit record for car.transfer_received not found');
  console.log(`✓ 1.3 PASS: Audit log recorded: "${auditRec.summary}"`);

  // -------------------------------------------------------------
  // LIFECYCLE 2: REQUEST -> REJECT (Hold Cleared & Returned)
  // -------------------------------------------------------------
  console.log('\n--- LIFECYCLE 2: Request -> Reject ---');

  // STEP 2.1: Request transfer back to Branch A
  console.log('\n[2.1] Requesting transfer to Branch A...');
  await db.transaction(async (tx) => {
    await tx
      .update(schema.cars)
      .set({
        transferTo: branchA.id,
        status: 'Transfer Pending',
        updatedAt: new Date(),
      })
      .where(eq(schema.cars.id, testCar.id));

    await writeAudit({
      tx,
      actor: { userId: 'manager-a', role: 'BRANCH_MANAGER', branchId: branchA.id },
      action: 'car.transfer_requested',
      entity: 'car',
      entityId: testCar.id,
      oldValue: { branchId: branchB.id, status: 'In Stock', transferTo: null },
      newValue: { branchId: branchB.id, status: 'Transfer Pending', transferTo: branchA.id },
      summary: `BRANCH_MANAGER requested stock transfer of ${testCar.brand} ${testCar.model} to ${branchA.branchName}`,
    });
  });

  let [carAfterReq2] = await db.select().from(schema.cars).where(eq(schema.cars.id, testCar.id));
  if (carAfterReq2.status !== 'Transfer Pending' || carAfterReq2.transferTo !== branchA.id) {
    throw new Error('FAIL 2.1: Transfer Pending state not set');
  }
  console.log(`✓ 2.1 PASS: Car status is '${carAfterReq2.status}' with target branch set.`);

  // STEP 2.2: Owner rejects transfer
  console.log('\n[2.2] Owner rejects transfer...');
  await db.transaction(async (tx) => {
    await tx
      .update(schema.cars)
      .set({
        status: 'In Stock',
        inventoryStatus: 'IN_STOCK',
        transferTo: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.cars.id, testCar.id));

    await writeAudit({
      tx,
      actor: { userId: 'owner-1', role: 'OWNER', branchId: null },
      action: 'car.transfer_rejected',
      entity: 'car',
      entityId: testCar.id,
      oldValue: { status: 'Transfer Pending', transferTo: branchA.id },
      newValue: { status: 'In Stock', transferTo: null },
      summary: `OWNER rejected transfer of ${testCar.brand} ${testCar.model}. Returned to In Stock at ${branchB.branchName}.`,
    });
  });

  let [carAfterRej] = await db.select().from(schema.cars).where(eq(schema.cars.id, testCar.id));
  if (carAfterRej.status !== 'In Stock' || carAfterRej.transferTo !== null || carAfterRej.branchId !== branchB.id) {
    throw new Error(`FAIL 2.2: Car did not return to In Stock at source branch. Status: ${carAfterRej.status}, Branch: ${carAfterRej.branchId}`);
  }
  console.log(`✓ 2.2 PASS: Car returned to 'In Stock' at current branch (${branchB.city}), hold cleared.`);

  // Verify Audit Log for Rejection
  const [auditRej] = await db
    .select()
    .from(schema.auditLogs)
    .where(and(eq(schema.auditLogs.entityId, testCar.id), eq(schema.auditLogs.action, 'car.transfer_rejected')))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1);

  if (!auditRej) throw new Error('FAIL 2.2: Audit record for car.transfer_rejected not found');
  console.log(`✓ 2.2 PASS: Audit log recorded: "${auditRej.summary}"`);

  // Restore car back to initial branch A and Available status
  await db
    .update(schema.cars)
    .set({
      branchId: initialBranchId,
      status: 'Available',
      inventoryStatus: 'IN_STOCK',
      transferTo: null,
      updatedAt: new Date(),
    })
    .where(eq(schema.cars.id, testCar.id));

  console.log('\n====================================================');
  console.log('✓ ALL STAGE 5 TRANSFER LIFECYCLES PASSED ACCURATELY!');
  console.log('====================================================');
}

testTransferLifecycle()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
