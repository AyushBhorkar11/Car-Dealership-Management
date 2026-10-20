import crypto from 'node:crypto';
import { db, schema } from './db';
import { eq, and, or } from 'drizzle-orm';

export interface CreateNotificationOptions {
  tx?: any;
  userId?: string | null;
  role?: 'EMPLOYEE' | 'BRANCH_MANAGER' | 'OWNER' | 'CUSTOMER' | string | null;
  branchId?: string | null;
  title: string;
  message: string;
  link?: string | null;
  type?: 'LEAD' | 'TEST_DRIVE' | 'APPROVAL' | 'TRANSFER' | 'BOOKING' | 'INFO';
}

/**
 * Creates a notification record. If `tx` is provided, runs inside the transaction.
 */
export async function createNotification(opts: CreateNotificationOptions): Promise<string> {
  const executor = opts.tx || db;
  const id = crypto.randomUUID();

  await executor.insert(schema.notifications).values({
    id,
    userId: opts.userId || null,
    role: opts.role ? opts.role.toUpperCase() : null,
    branchId: opts.branchId || null,
    title: opts.title,
    message: opts.message,
    link: opts.link || null,
    type: opts.type || 'INFO',
    isRead: false,
    createdAt: new Date(),
  });

  return id;
}

/**
 * Marks a specific notification as read.
 */
export async function markNotificationAsRead(notificationId: string): Promise<boolean> {
  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(eq(schema.notifications.id, notificationId));
  return true;
}

/**
 * Marks all notifications for a specific user and/or role/branch as read.
 */
export async function markAllNotificationsAsRead(params: {
  userId: string;
  role?: string;
  branchId?: string | null;
}): Promise<boolean> {
  const conditions = [eq(schema.notifications.userId, params.userId)];

  const role = params.role ? params.role.toUpperCase() : '';
  if (role === 'OWNER') {
    conditions.push(eq(schema.notifications.role, 'OWNER'));
  } else if (role === 'BRANCH_MANAGER' && params.branchId) {
    conditions.push(
      and(eq(schema.notifications.role, 'BRANCH_MANAGER'), eq(schema.notifications.branchId, params.branchId))
    );
  } else if (role === 'EMPLOYEE' && params.branchId) {
    conditions.push(
      and(eq(schema.notifications.role, 'EMPLOYEE'), eq(schema.notifications.branchId, params.branchId))
    );
  } else if (role === 'CUSTOMER') {
    conditions.push(eq(schema.notifications.role, 'CUSTOMER'));
  }

  await db
    .update(schema.notifications)
    .set({ isRead: true })
    .where(or(...conditions));

  return true;
}
