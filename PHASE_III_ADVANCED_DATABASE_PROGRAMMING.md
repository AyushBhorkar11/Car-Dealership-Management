# Exp9 Project — Phase III: Advanced Database Programming

## Car Dealership Management System

**Topic:** Stored procedures, triggers, and views for business-rule enforcement and improved database functionality  
**Database:** MySQL 8.0  
**Application data layer:** Drizzle ORM with the MySQL dialect

> **Implementation status:** This report describes a Phase III database enhancement for the current project. The active MySQL migrations do not currently create the procedure, triggers, or views shown here. Treat the SQL as a proposed implementation: review it against the target database, back up data, and test it before deployment.

## 1. Abstract

The Car Dealership Management System (CDMS) supports customer enquiries, vehicle sales, payments, procurement, and multiple dealership branches. As these workflows grow, rules enforced only by application code can be missed by another script, administrative tool, or future application feature.

This phase uses MySQL stored programming to centralize selected business operations. A stored procedure records customer payments as a transaction, triggers reject appointments scheduled in the past, and views provide branch inventory and sales summaries. Together, they improve consistency, reduce repetitive SQL in reports, and make selected rules apply regardless of which application path performs a database write.

## 2. Objectives

- Implement a transaction-safe stored procedure for recording a payment against a sale.
- Use triggers to reject invalid appointment dates at the database boundary.
- Create views that make branch inventory and sales information easier to query.
- Demonstrate positive and negative test cases for the database objects.
- Keep examples consistent with the project's MySQL schema and existing business workflow.

## 3. Project database context

The project's schema in `drizzle/schema.ts` includes the following relevant tables:

| Table | Use in this phase |
|---|---|
| `branches` | Identifies the dealership branch associated with inventory and sales. |
| `cars` | Stores vehicle identity, branch, model, and inventory status. |
| `enquiries` | Stores customer leads, appointment dates, and sales follow-up information. |
| `employees` | Identifies staff and their assigned branch. |
| `sales` | Stores sale amounts, payment totals, customer, employee, and branch. |
| `payments` | Stores individual receipts and payment details. |

Important schema details used below:

- IDs are 36-character UUID strings.
- `sales.sale_amount` and `sales.amount_paid` are decimal monetary values.
- `sales.payment_status` is a string column; the examples set it to `PARTIAL` or `PAID`.
- `payments.payment_status` is an enum that includes `PENDING`, `PARTIAL`, `PAID`, and `REFUNDED`.
- `enquiries.appointment_date` is nullable.
- `employees.branch_id` and `cars.branch_id` link staff and vehicles to branches.

## 4. Business rules

1. A recorded payment must be greater than zero.
2. A payment must reference an existing sale and an employee assigned to that sale's branch.
3. Payments recorded through the procedure must not make the paid total exceed the sale amount.
4. A payment receipt and the corresponding sale payment totals must be updated atomically.
5. An enquiry appointment must not be inserted or changed to a time in the past.
6. Branch-level reports should derive totals from the stored sales and inventory records rather than duplicating those totals in a separate reporting table.

## 5. Stored procedure: record a sale payment

The procedure below locks the sale row while it checks and updates payment totals. It creates a row in `payments` and updates `sales.amount_paid` and `sales.payment_status` in the same transaction. An error rolls back the operation and is returned to the caller.

```sql
DELIMITER //

CREATE PROCEDURE sp_record_sale_payment(
    IN p_sale_id CHAR(36),
    IN p_recorded_by CHAR(36),
    IN p_receipt_no VARCHAR(100),
    IN p_amount DECIMAL(14, 2),
    IN p_payment_type VARCHAR(50),
    IN p_payment_method VARCHAR(50),
    IN p_transaction_reference VARCHAR(100),
    IN p_remarks TEXT
)
BEGIN
    DECLARE v_customer_id CHAR(36) DEFAULT NULL;
    DECLARE v_branch_id CHAR(36) DEFAULT NULL;
    DECLARE v_sale_amount DECIMAL(14, 2) DEFAULT 0;
    DECLARE v_sale_status VARCHAR(50) DEFAULT NULL;
    DECLARE v_paid_amount DECIMAL(14, 2) DEFAULT 0;
    DECLARE v_transaction_started BOOLEAN DEFAULT FALSE;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        IF v_transaction_started THEN
            ROLLBACK;
        END IF;
        RESIGNAL;
    END;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment amount must be greater than zero';
    END IF;

    START TRANSACTION;
    SET v_transaction_started = TRUE;

    SELECT customer_id, branch_id, sale_amount, status
      INTO v_customer_id, v_branch_id, v_sale_amount, v_sale_status
      FROM sales
     WHERE id = p_sale_id
     FOR UPDATE;

    IF v_customer_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Sale does not exist';
    END IF;

    IF LOWER(v_sale_status) IN ('cancelled', 'refunded') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Cannot record a payment for a cancelled or refunded sale';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM employees
         WHERE id = p_recorded_by
           AND branch_id = v_branch_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Recording employee must belong to the sale branch';
    END IF;

    SELECT COALESCE(SUM(amount), 0)
      INTO v_paid_amount
      FROM payments
     WHERE sale_id = p_sale_id
       AND payment_status IN ('PAID', 'PARTIAL');

    IF v_paid_amount + p_amount > v_sale_amount THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Payment would exceed the sale amount';
    END IF;

    INSERT INTO payments (
        id,
        receipt_no,
        sale_id,
        customer_id,
        branch_id,
        recorded_by,
        amount,
        payment_type,
        payment_method,
        payment_status,
        transaction_reference,
        remarks,
        payment_date,
        created_at
    )
    VALUES (
        UUID(),
        p_receipt_no,
        p_sale_id,
        v_customer_id,
        v_branch_id,
        p_recorded_by,
        p_amount,
        p_payment_type,
        p_payment_method,
        'PAID',
        COALESCE(p_transaction_reference, ''),
        p_remarks,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    );

    SET v_paid_amount = v_paid_amount + p_amount;

    UPDATE sales
       SET amount_paid = v_paid_amount,
           payment_status = CASE
               WHEN v_paid_amount >= v_sale_amount THEN 'PAID'
               ELSE 'PARTIAL'
           END,
           updated_at = CURRENT_TIMESTAMP
     WHERE id = p_sale_id;

    COMMIT;
    SET v_transaction_started = FALSE;
END//

DELIMITER ;
```

### Example call

Replace the example IDs and receipt number with valid records from the local database.

```sql
CALL sp_record_sale_payment(
    'SALE_UUID',
    'EMPLOYEE_UUID',
    'CDMS-RECEIPT-0001',
    50000.00,
    'Down Payment',
    'UPI',
    'BANK-REFERENCE-123',
    'Customer down payment'
);
```

The procedure relies on the existing unique constraint on `payments.receipt_no` to prevent duplicate receipt numbers. The `sales` row lock serializes payment updates for the same sale; callers should still handle SQL errors such as duplicate receipts and invalid amounts.

## 6. Triggers: validate appointment dates

The following triggers reject an appointment date earlier than the current database time on both insert and update. Enquiries without an appointment date remain valid.

```sql
DELIMITER //

CREATE TRIGGER trg_enquiries_appointment_before_insert
BEFORE INSERT ON enquiries
FOR EACH ROW
BEGIN
    IF NEW.appointment_date IS NOT NULL
       AND NEW.appointment_date < CURRENT_TIMESTAMP THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Appointment date must be in the future';
    END IF;
END//

CREATE TRIGGER trg_enquiries_appointment_before_update
BEFORE UPDATE ON enquiries
FOR EACH ROW
BEGIN
    IF NEW.appointment_date IS NOT NULL
       AND NEW.appointment_date < CURRENT_TIMESTAMP THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Appointment date must be in the future';
    END IF;
END//

DELIMITER ;
```

The rule is deliberately enforced on every insert or update that leaves an appointment date in the past. If the business later needs to preserve historical appointment dates while editing unrelated enquiry fields, the update trigger should instead validate only when `appointment_date` changes.

## 7. Views: reporting and inventory

### 7.1 Branch sales summary

This view gives one row per branch, including branches that do not yet have sales. Amounts are aggregated from `sales`, so the view does not store a second copy of financial totals.

```sql
CREATE OR REPLACE VIEW vw_branch_sales_summary AS
SELECT
    b.id AS branch_id,
    b.branch_name,
    b.city,
    COUNT(s.id) AS sale_count,
    COALESCE(SUM(s.sale_amount), 0.00) AS total_sales_amount,
    COALESCE(SUM(s.amount_paid), 0.00) AS total_amount_paid,
    COALESCE(
        SUM(GREATEST(s.sale_amount - s.amount_paid, 0.00)),
        0.00
    ) AS total_outstanding
FROM branches AS b
LEFT JOIN sales AS s
       ON s.branch_id = b.id
GROUP BY b.id, b.branch_name, b.city;
```

Example:

```sql
SELECT branch_name, sale_count, total_sales_amount,
       total_amount_paid, total_outstanding
FROM vw_branch_sales_summary
ORDER BY branch_name;
```

### 7.2 Branch inventory summary

This view groups vehicles by branch and model. The project has both a human-readable `cars.status` and the `cars.inventory_status` enum; this report uses the enum defined in the current schema.

```sql
CREATE OR REPLACE VIEW vw_branch_inventory_summary AS
SELECT
    b.id AS branch_id,
    b.branch_name,
    c.brand,
    c.model,
    c.variant,
    COUNT(c.id) AS total_vehicles,
    SUM(CASE WHEN c.inventory_status = 'IN_STOCK' THEN 1 ELSE 0 END)
        AS in_stock_vehicles,
    SUM(CASE WHEN c.inventory_status = 'RESERVED' THEN 1 ELSE 0 END)
        AS reserved_vehicles,
    SUM(CASE WHEN c.inventory_status = 'IN_TRANSIT' THEN 1 ELSE 0 END)
        AS in_transit_vehicles
FROM branches AS b
JOIN cars AS c
  ON c.branch_id = b.id
WHERE c.inventory_status IN ('IN_STOCK', 'RESERVED', 'IN_TRANSIT')
GROUP BY b.id, b.branch_name, c.brand, c.model, c.variant;
```

Example:

```sql
SELECT branch_name, brand, model, variant,
       total_vehicles, in_stock_vehicles,
       reserved_vehicles, in_transit_vehicles
FROM vw_branch_inventory_summary
ORDER BY branch_name, brand, model;
```

## 8. Testing plan

Run these checks in a development database with valid test records. Do not test by altering production records.

| Test | Action | Expected result |
|---|---|---|
| Valid payment | Call the procedure with an existing sale, same-branch employee, unique receipt, and positive amount within the remaining balance. | One payment row is inserted, `amount_paid` increases, and payment status becomes `PARTIAL` or `PAID`. |
| Zero or negative payment | Call the procedure with `0` or a negative amount. | SQL error; neither table is changed. |
| Missing sale | Call the procedure with an unknown sale ID. | SQL error; no payment is inserted. |
| Employee from another branch | Use an employee whose branch differs from the sale branch. | SQL error; no payment is inserted. |
| Overpayment | Record an amount greater than the remaining balance. | SQL error; transaction is rolled back. |
| Duplicate receipt | Reuse an existing `receipt_no`. | Unique-key error; transaction is rolled back. |
| Past appointment on insert | Insert an enquiry with an appointment date before the current time. | Trigger raises an error and rejects the row. |
| Past appointment on update | Change an existing enquiry appointment to a past time. | Trigger raises an error and rejects the update. |
| View totals | Compare a branch's view totals with direct `sales` and `cars` queries. | Aggregates match the underlying records. |

## 9. Benefits and limitations

### Benefits

- Payment recording and sale totals are updated atomically.
- Row locking reduces the risk of concurrent payment requests overshooting the balance.
- Appointment validation applies to SQL writes from any client, not only the web application.
- Views provide reusable reporting queries and reduce repeated joins and aggregate expressions.
- The database returns explicit errors for rejected operations.

### Limitations and deployment considerations

- These objects are not included in the repository's active MySQL migration files. They must be added to a controlled migration or deployed through a reviewed database change before the application can call them.
- Drizzle Kit schema declarations do not automatically represent these stored procedures, triggers, and views; keep their SQL under version control and verify them during deployment.
- The application must call `sp_record_sale_payment` instead of independently inserting a payment and changing the sale total, or those writes could bypass the procedure's rules.
- Call the procedure outside an application-managed transaction because it owns its transaction. Before rollout, reconcile existing `sales.amount_paid` values against their payment ledger rows; this procedure treats paid, partial payment rows as the source of truth.
- The appointment trigger uses the database server's current time and time zone. Configure the MySQL server consistently with application expectations.
- The inventory view excludes sold and delivered vehicles; its counts depend on `inventory_status` being maintained consistently by the application workflows.
- Views are not a replacement for authorization. Grant access to underlying data and views according to the project's security model.

## 10. Conclusion

This Phase III design adds a database-level payment workflow, appointment-date validation, and reusable branch reporting for the CDMS. It extends the existing MySQL schema without changing the project's application behavior by itself. After review and controlled deployment, the procedure and triggers can strengthen data integrity while the views simplify operational and management reporting.

## References within the project

- Database schema: `drizzle/schema.ts`
- MySQL migration directory: `drizzle/migrations-mysql/`
- Database architecture notes: `docs/DATABASE.md`
