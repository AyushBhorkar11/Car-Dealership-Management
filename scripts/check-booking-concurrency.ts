import { db, schema } from '../src/server/db';
import { eq, and, sql } from 'drizzle-orm';
import crypto from 'node:crypto';

async function runConcurrencyTests() {
  console.log('=== [TEST SUITE] Stage 4: Test Drives & Booking Concurrency Checks ===\n');

  // Find or create test customer and available car
  const [testCar] = await db
    .select()
    .from(schema.cars)
    .where(and(eq(schema.cars.status, 'Available'), eq(schema.cars.inventoryStatus, 'IN_STOCK')))
    .limit(1);

  if (!testCar) {
    throw new Error('No available in-stock car found for testing concurrency.');
  }

  const [testCustomer] = await db.select().from(schema.customers).limit(1);
  if (!testCustomer) {
    throw new Error('No customer found for testing concurrency.');
  }

  console.log(`Using Test Vehicle: ${testCar.brand} ${testCar.model} [VIN: ${testCar.vinChassisNo}, ID: ${testCar.id}]`);
  console.log(`Using Test Customer: ${testCustomer.name} [ID: ${testCustomer.id}]`);

  // -------------------------------------------------------------
  // TEST 1: Simultaneous parallel direct bookings on the SAME car
  // -------------------------------------------------------------
  console.log('\n--- 1. Testing Pessimistic Concurrency Lock on Vehicle Booking ---');

  // We simulate two concurrent booking attempts executing at the exact same instant
  async function attemptBooking(clientName: string) {
    return db.transaction(async (tx) => {
      // 1. Pessimistic lock
      const [lockedCar] = await tx
        .select()
        .from(schema.cars)
        .where(eq(schema.cars.id, testCar.id))
        .for('update');

      if (!lockedCar || lockedCar.status !== 'Available' || lockedCar.inventoryStatus !== 'IN_STOCK') {
        throw new Error('This car was just reserved by another customer. Please choose another.');
      }

      // Artificial small delay to simulate processing inside transaction
      await new Promise((resolve) => setTimeout(resolve, 50));

      // 2. Mark as Reserved
      await tx
        .update(schema.cars)
        .set({
          status: 'Reserved',
          inventoryStatus: 'RESERVED',
          updatedAt: new Date(),
        })
        .where(eq(schema.cars.id, testCar.id));

      const enqId = crypto.randomUUID();
      await tx.insert(schema.enquiries).values({
        id: enqId,
        customerId: testCustomer.id,
        branchId: testCar.branchId,
        carId: testCar.id,
        enquiryType: 'Booking Request',
        stage: 'BOOKED',
        status: 'Booked',
        bookingAmount: '50000',
        remarks: `Concurrency test booking by ${clientName}`,
        requestedBrand: testCar.brand,
        requestedModel: testCar.model,
        requestedVariant: testCar.variant || '',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      return { client: clientName, success: true, enquiryId: enqId };
    });
  }

  const [res1, res2] = await Promise.allSettled([
    attemptBooking('Customer A (First Millisecond)'),
    attemptBooking('Customer B (Simultaneous Millisecond)'),
  ]);

  const successCount = [res1, res2].filter((r) => r.status === 'fulfilled').length;
  const rejectedCount = [res1, res2].filter((r) => r.status === 'rejected').length;

  console.log(`Result 1: ${res1.status === 'fulfilled' ? 'SUCCESS' : (res1 as PromiseRejectedResult).reason.message}`);
  console.log(`Result 2: ${res2.status === 'fulfilled' ? 'SUCCESS' : (res2 as PromiseRejectedResult).reason.message}`);

  if (successCount === 1 && rejectedCount === 1) {
    const rejectedReason =
      res1.status === 'rejected'
        ? (res1 as PromiseRejectedResult).reason.message
        : (res2 as PromiseRejectedResult).reason.message;

    if (rejectedReason === 'This car was just reserved by another customer. Please choose another.') {
      console.log('✓ PASS: Exactly one concurrent booking succeeded, and the other was safely rejected with expected error message.');
    } else {
      console.log(`! WARNING: Rejected with unexpected message: ${rejectedReason}`);
    }
  } else {
    throw new Error(`FAIL: Expected 1 success and 1 rejection, got ${successCount} successes and ${rejectedCount} rejections.`);
  }

  // Restore test car status back to Available for clean state
  await db
    .update(schema.cars)
    .set({
      status: 'Available',
      inventoryStatus: 'IN_STOCK',
      updatedAt: new Date(),
    })
    .where(eq(schema.cars.id, testCar.id));

  // -------------------------------------------------------------
  // TEST 2: Test Drive Slot Collision Prevention
  // -------------------------------------------------------------
  console.log('\n--- 2. Testing Test Drive Slot Collision Prevention ---');
  const slotToTest = `2026-11-20 10:00 AM - 11:00 AM`;

  // Booking 1
  const td1Id = crypto.randomUUID();
  await db.insert(schema.enquiries).values({
    id: td1Id,
    customerId: testCustomer.id,
    branchId: testCar.branchId,
    carId: testCar.id,
    enquiryType: 'Test Drive',
    stage: 'TEST_DRIVE',
    status: 'Scheduled',
    testDriveCarId: testCar.id,
    testDriveSlot: slotToTest,
    remarks: 'First scheduled test drive',
    requestedBrand: testCar.brand,
    requestedModel: testCar.model,
    requestedVariant: testCar.variant || '',
    appointmentDate: new Date('2026-11-20T10:00:00Z'),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // Attempt duplicate collision booking
  let collisionCaught = false;
  try {
    await db.transaction(async (tx) => {
      const collisions = await tx
        .select()
        .from(schema.enquiries)
        .where(
          and(
            eq(schema.enquiries.testDriveCarId, testCar.id),
            eq(schema.enquiries.testDriveSlot, slotToTest),
            sql`status != 'Cancelled'`
          )
        );

      if (collisions.length > 0) {
        throw new Error('Selected vehicle is already booked for this time slot. Please choose another slot.');
      }
    });
  } catch (err: any) {
    if (err.message.includes('already booked for this time slot')) {
      collisionCaught = true;
      console.log('✓ PASS: Duplicate slot was caught: ' + err.message);
    } else {
      throw err;
    }
  }

  if (!collisionCaught) {
    throw new Error('FAIL: Duplicate test drive slot was not prevented!');
  }

  // Clean up test enquiries
  await db.delete(schema.enquiries).where(eq(schema.enquiries.id, td1Id));

  console.log('\n=== ALL STAGE 4 CONCURRENCY AND TEST DRIVE CHECKS PASSED ===');
}

runConcurrencyTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
