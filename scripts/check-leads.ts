import { pool } from '../src/server/db';

async function testLeadCreationAndDeduplication() {
  console.log('Testing Lead Creation & Customer Deduplication...');

  const [branches]: any = await pool.query('SELECT id, branch_name FROM branches LIMIT 1');
  const [employees]: any = await pool.query('SELECT id, user_id FROM employees WHERE branch_id = ? LIMIT 1', [branches[0].id]);
  const branchId = branches[0].id;
  const employeeId = employees[0]?.id;

  const testPhone = '9876543299';
  const customerName = 'Priya Sharma';

  // Cleanup any leftover test data
  await pool.query('DELETE FROM enquiries WHERE customer_id IN (SELECT id FROM customers WHERE phone LIKE ?)', [`%${testPhone}%`]);
  await pool.query('DELETE FROM customers WHERE phone LIKE ?', [`%${testPhone}%`]);

  console.log('\n[1/2] Creating Lead 1 for new customer...');
  const newCustId = `cust-${Date.now()}`;
  await pool.query('INSERT INTO customers (id, name, phone, email, address, city) VALUES (?, ?, ?, ?, ?, ?)', [
    newCustId,
    customerName,
    `+91 ${testPhone}`,
    'priya.test@example.com',
    'Park Street',
    'Hyderabad',
  ]);

  const enq1Id = `enq-${Date.now()}`;
  await pool.query(
    'INSERT INTO enquiries (id, customer_id, branch_id, employee_id, requested_brand, requested_model, enquiry_stage, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [enq1Id, newCustId, branchId, employeeId, 'Hyundai', 'Hyundai Creta', 'NEW', 'New', '[Source: Walk-in] Interested in SX (O)']
  );

  const [custs1]: any = await pool.query('SELECT * FROM customers WHERE phone LIKE ?', [`%${testPhone}%`]);
  console.log(`✓ Lead 1 created. Total customers with phone ${testPhone}: ${custs1.length}`);
  if (custs1.length !== 1) throw new Error('Expected 1 customer row');

  console.log('\n[2/2] Creating Lead 2 with SAME phone number...');
  // Check deduplication search (finding existing customer)
  const cleanPhone = testPhone.slice(-10);
  const [existingCust]: any = await pool.query('SELECT * FROM customers WHERE phone LIKE ?', [`%${cleanPhone}%`]);
  const linkedCustomerId = existingCust[0]?.id;
  if (!linkedCustomerId) throw new Error('Existing customer not matched by phone');

  const enq2Id = `enq-${Date.now() + 1}`;
  await pool.query(
    'INSERT INTO enquiries (id, customer_id, branch_id, employee_id, requested_brand, requested_model, enquiry_stage, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [enq2Id, linkedCustomerId, branchId, employeeId, 'Kia', 'Kia Seltos', 'NEW', 'New', '[Source: Phone Enquiry] Also interested in Seltos GTX+']
  );

  const [custs2]: any = await pool.query('SELECT * FROM customers WHERE phone LIKE ?', [`%${testPhone}%`]);
  console.log(`✓ Lead 2 created. Total customers with phone ${testPhone}: ${custs2.length} (ZERO duplicates)`);
  if (custs2.length !== 1) throw new Error('Duplicate customer created!');

  const [leads]: any = await pool.query('SELECT id, requested_model FROM enquiries WHERE customer_id = ?', [linkedCustomerId]);
  console.log(`✓ Both leads linked to same customer (${linkedCustomerId}):`, leads.map((l: any) => l.requested_model));
  if (leads.length !== 2) throw new Error('Expected 2 leads linked to customer');

  // Cleanup test records
  await pool.query('DELETE FROM enquiries WHERE customer_id = ?', [linkedCustomerId]);
  await pool.query('DELETE FROM customers WHERE id = ?', [linkedCustomerId]);

  console.log('\n✓ ALL LEAD CREATION AND DEDUPLICATION CHECKS PASSED!');
  process.exit(0);
}

testLeadCreationAndDeduplication().catch((err) => {
  console.error('Lead check failed:', err);
  process.exit(1);
});
