import { pool, schema, db } from '../src/server/db';
import { createNotification, markNotificationAsRead, markAllNotificationsAsRead } from '../src/server/notifications';

async function testNotifications() {
  console.log('Testing notification creation and lifecycle...');

  const [branches]: any = await pool.query('SELECT id FROM branches LIMIT 1');
  const branchId = branches[0]?.id;

  const notifId = await createNotification({
    role: 'BRANCH_MANAGER',
    branchId,
    title: 'Test Drive Scheduled',
    message: 'Test drive scheduled for Creta SX on Tomorrow 11:00 AM',
    link: '?tab=leads',
    type: 'TEST_DRIVE',
  });

  console.log('✓ Created notification with ID:', notifId);

  const [rows]: any = await pool.query('SELECT * FROM notifications WHERE id = ?', [notifId]);
  if (!rows[0] || rows[0].is_read !== 0) {
    throw new Error('Notification record mismatch or already read');
  }
  console.log('✓ Verified unread notification in DB:', rows[0].title);

  await markNotificationAsRead(notifId);
  const [updated]: any = await pool.query('SELECT * FROM notifications WHERE id = ?', [notifId]);
  if (updated[0].is_read !== 1) {
    throw new Error('Notification was not marked as read');
  }
  console.log('✓ Verified marked as read!');

  // Cleanup test notification
  await pool.query('DELETE FROM notifications WHERE id = ?', [notifId]);
  console.log('✓ Cleanup done.');
  console.log('\n✓ ALL NOTIFICATION CHECKS PASSED!');
  process.exit(0);
}

testNotifications().catch((err) => {
  console.error('Notification test failed:', err);
  process.exit(1);
});
