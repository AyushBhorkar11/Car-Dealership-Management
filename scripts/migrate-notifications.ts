import { pool } from '../src/server/db';

async function migrateNotifications() {
  console.log('Creating notifications table...');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS \`notifications\` (
      \`id\` CHAR(36) PRIMARY KEY,
      \`user_id\` CHAR(36) NULL,
      \`role\` VARCHAR(50) NULL,
      \`branch_id\` CHAR(36) NULL,
      \`title\` VARCHAR(255) NOT NULL,
      \`message\` TEXT NOT NULL,
      \`link\` VARCHAR(255) NULL,
      \`type\` VARCHAR(50) NOT NULL DEFAULT 'INFO',
      \`is_read\` BOOLEAN NOT NULL DEFAULT FALSE,
      \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX \`notifications_user_idx\` (\`user_id\`),
      INDEX \`notifications_role_branch_idx\` (\`role\`, \`branch_id\`),
      INDEX \`notifications_read_idx\` (\`is_read\`),
      INDEX \`notifications_created_at_idx\` (\`created_at\`)
    )
  `);

  console.log('Notifications table created successfully!');
  const [cols]: any = await pool.query('DESCRIBE notifications');
  console.log('Columns:', cols.map((c: any) => c.Field));
  process.exit(0);
}

migrateNotifications().catch((err) => {
  console.error('Failed to create notifications table:', err);
  process.exit(1);
});
