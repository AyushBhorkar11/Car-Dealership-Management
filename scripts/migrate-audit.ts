import { pool } from '../src/server/db';

async function migrate() {
  const [cols]: any = await pool.query('DESCRIBE audit_logs');
  const colNames = cols.map((c: any) => c.Field);

  if (!colNames.includes('summary')) {
    console.log('Adding summary column...');
    await pool.query('ALTER TABLE audit_logs ADD COLUMN summary TEXT NULL AFTER new_value');
  }
  if (!colNames.includes('ip')) {
    console.log('Adding ip column...');
    await pool.query("ALTER TABLE audit_logs ADD COLUMN ip VARCHAR(100) NOT NULL DEFAULT '' AFTER summary");
  }
  if (!colNames.includes('user_agent')) {
    console.log('Adding user_agent column...');
    await pool.query('ALTER TABLE audit_logs ADD COLUMN user_agent TEXT NULL AFTER ip');
  }

  // Create triggers for immutability
  console.log('Creating triggers for immutability...');
  await pool.query('DROP TRIGGER IF EXISTS trg_audit_logs_no_update');
  await pool.query(`
    CREATE TRIGGER trg_audit_logs_no_update
    BEFORE UPDATE ON audit_logs
    FOR EACH ROW
    BEGIN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Audit records are immutable and cannot be updated.';
    END
  `);

  await pool.query('DROP TRIGGER IF EXISTS trg_audit_logs_no_delete');
  await pool.query(`
    CREATE TRIGGER trg_audit_logs_no_delete
    BEFORE DELETE ON audit_logs
    FOR EACH ROW
    BEGIN
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Audit records are append-only and cannot be deleted.';
    END
  `);

  console.log('Migration completed successfully!');
  const [updatedCols]: any = await pool.query('DESCRIBE audit_logs');
  console.log('Updated columns:', updatedCols.map((c: any) => c.Field));
  process.exit(0);
}

migrate().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
