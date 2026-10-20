import crypto from 'node:crypto';
import { db, schema } from './db';
import { getClientInfo } from './auth';

export interface AuditActor {
  userId: string;
  role: string;
  branchId?: string | null;
}

export interface AuditEntryOptions {
  tx?: any; // Drizzle transaction handle or defaults to db
  actor: AuditActor;
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  ip?: string;
  userAgent?: string;
}

// Filter out internal/sensitive properties like passwords or hash
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'password_hash',
  'resetToken',
  'reset_token',
  'token',
]);

function sanitize(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k)) continue;
    if (v instanceof Date) {
      clean[k] = v.toISOString();
    } else if (typeof v === 'object' && v !== null) {
      clean[k] = sanitize(v);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

/**
 * Computes the diff between old and new states.
 * - On create: oldValue is null, newValue contains clean created fields.
 * - On delete: oldValue contains previous state, newValue is null.
 * - On update: stores ONLY changed fields in both oldValue and newValue.
 */
export function computeDiff(
  oldVal?: Record<string, any> | null,
  newVal?: Record<string, any> | null
): { diffOld: Record<string, any> | null; diffNew: Record<string, any> | null } {
  const cleanOld = oldVal ? sanitize(oldVal) : null;
  const cleanNew = newVal ? sanitize(newVal) : null;

  if (!cleanOld && cleanNew) {
    return { diffOld: null, diffNew: cleanNew };
  }
  if (cleanOld && !cleanNew) {
    return { diffOld: cleanOld, diffNew: null };
  }
  if (!cleanOld && !cleanNew) {
    return { diffOld: null, diffNew: null };
  }

  const diffOld: Record<string, any> = {};
  const diffNew: Record<string, any> = {};
  const allKeys = new Set([...Object.keys(cleanOld), ...Object.keys(cleanNew)]);

  for (const key of allKeys) {
    const o = cleanOld[key];
    const n = cleanNew[key];
    if (JSON.stringify(o) !== JSON.stringify(n)) {
      if (o !== undefined) diffOld[key] = o;
      if (n !== undefined) diffNew[key] = n;
    }
  }

  return {
    diffOld: Object.keys(diffOld).length > 0 ? diffOld : null,
    diffNew: Object.keys(diffNew).length > 0 ? diffNew : null,
  };
}

/**
 * Central transaction-safe audit logging function.
 * If `tx` is provided, the audit insert executes inside the caller's transaction,
 * guaranteeing atomic success or rollback with the business operation.
 */
export async function writeAudit(options: AuditEntryOptions): Promise<string> {
  const clientInfo = getClientInfo();
  const ip = options.ip || clientInfo.ip || '127.0.0.1';
  const userAgent = (options.userAgent || clientInfo.userAgent || 'Server').slice(0, 500);

  const { diffOld, diffNew } = computeDiff(options.oldValue, options.newValue);

  const auditId = crypto.randomUUID();
  const executor = options.tx || db;

  await executor.insert(schema.auditLogs).values({
    id: auditId,
    userId: options.actor.userId,
    role: options.actor.role.toUpperCase(),
    branchId: options.actor.branchId || null,
    action: options.action,
    entity: options.entity.toLowerCase(),
    entityId: String(options.entityId),
    oldValue: diffOld,
    newValue: diffNew,
    summary: options.summary,
    ip,
    userAgent,
    createdAt: new Date(),
  });

  return auditId;
}

// Backward compatibility alias
export const logAudit = writeAudit;
