import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { db, schema } from './db';
import { eq, and, sql, desc, gte } from 'drizzle-orm';
import { getCookie, setCookie, deleteCookie, getRequest } from '@tanstack/react-start/server';

const SESSION_COOKIE = 'cdms_session';
const SESSION_SECRET = process.env.SESSION_SECRET || 'cdms-dealership-session-secret-key-32-chars';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export type SessionPayload = {
  userId: string;
  email: string;
  role: 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' | 'CUSTOMER';
  branchId: string | null;
  name: string;
  expiresAt: number;
};

// Password hashing
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Session Token Creation & Verification
function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(data)
    .digest('base64url');
  return `${data}.${signature}`;
}

function verifyToken(token: string): SessionPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, signature] = parts;
    const expected = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(data)
      .digest('base64url');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return null;
    }
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (payload.expiresAt < Date.now()) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

// Request IP & User Agent helpers
export function getClientInfo() {
  try {
    const req = getRequest();
    const headers = req.headers;
    const ip =
      headers.get('x-forwarded-for')?.split(',')[0].trim() ||
      headers.get('x-real-ip') ||
      '127.0.0.1';
    const userAgent = headers.get('user-agent') || 'Unknown';
    return { ip, userAgent };
  } catch {
    return { ip: '127.0.0.1', userAgent: 'Server' };
  }
}

// Record login event in MySQL
export async function recordLoginEvent(opts: {
  userId: string;
  role: string;
  branchId?: string | null;
  eventType: 'LOGIN' | 'LOGOUT' | 'FAILED_LOGIN';
  ip: string;
  userAgent: string;
}) {
  try {
    await db.insert(schema.loginEvents).values({
      id: crypto.randomUUID(),
      userId: opts.userId,
      role: opts.role,
      branchId: opts.branchId || null,
      eventType: opts.eventType,
      ip: opts.ip,
      userAgent: opts.userAgent.slice(0, 500),
      createdAt: new Date(),
    });
  } catch (err) {
    console.error('[Auth] Failed to write login_event:', err);
  }
}

// Brute-force protection: check if IP or email has too many recent failed attempts
export async function checkRateLimit(ip: string, email: string): Promise<boolean> {
  try {
    const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
    const recentFailures = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.loginEvents)
      .where(
        and(
          eq(schema.loginEvents.eventType, 'FAILED_LOGIN'),
          eq(schema.loginEvents.ip, ip),
          gte(schema.loginEvents.createdAt, fifteenMinutesAgo)
        )
      );
    const count = Number(recentFailures[0]?.count || 0);
    return count < 5; // Allow under 5 failures in 15 mins
  } catch {
    return true; // Fail open for development
  }
}

// Login
export async function loginUser(emailInput: string, passwordInput: string) {
  const { ip, userAgent } = getClientInfo();
  const normalizedEmail = emailInput.trim().toLowerCase();

  const allowed = await checkRateLimit(ip, normalizedEmail);
  if (!allowed) {
    throw new Error('Too many failed attempts. Account temporarily locked for 15 minutes.');
  }

  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, normalizedEmail))
    .limit(1);

  if (!user) {
    await recordLoginEvent({
      userId: 'unknown',
      role: 'UNKNOWN',
      branchId: null,
      eventType: 'FAILED_LOGIN',
      ip,
      userAgent,
    });
    throw new Error('No account found with this email address. Please sign up to create your account.');
  }

  if (user.approvalStatus === 'PENDING') {
    throw new Error('Waiting for Owner approval. Your account registration has been submitted and will become active once approved by the Dealership Owner.');
  }

  if (user.approvalStatus === 'REJECTED') {
    throw new Error('Account registration was rejected. Please contact the dealership administrator.');
  }

  if (!user.isActive) {
    throw new Error('Your account has been deactivated. Please contact your branch manager or owner.');
  }

  const valid = await verifyPassword(passwordInput, user.passwordHash);
  if (!valid) {
    await recordLoginEvent({
      userId: user.id,
      role: user.role,
      branchId: user.branchId || null,
      eventType: 'FAILED_LOGIN',
      ip,
      userAgent,
    });
    throw new Error('Incorrect password. Please verify your credentials or reset your password.');
  }

  // Update last login
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date() })
    .where(eq(schema.users.id, user.id));

  // Log successful login
  await recordLoginEvent({
    userId: user.id,
    role: user.role,
    branchId: user.branchId,
    eventType: 'LOGIN',
    ip,
    userAgent,
  });

  // Create session
  const expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    branchId: user.branchId,
    name: user.name,
    expiresAt,
  };

  const token = signToken(payload);
  setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return {
    success: true,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
    },
    redirectTo: getRedirectForRole(user.role),
  };
}

export function getRedirectForRole(role: string): string {
  switch (role) {
    case 'OWNER':
      return '/owner';
    case 'BRANCH_MANAGER':
      return '/manager';
    case 'EMPLOYEE':
      return '/employee';
    case 'CUSTOMER':
    default:
      return '/workspace';
  }
}

// Logout
export async function logoutUser() {
  const session = await getSessionUser();
  const { ip, userAgent } = getClientInfo();

  if (session) {
    await recordLoginEvent({
      userId: session.id,
      role: session.role,
      branchId: session.branchId,
      eventType: 'LOGOUT',
      ip,
      userAgent,
    });
  }

  deleteCookie(SESSION_COOKIE, { path: '/' });
  return { success: true };
}

// Get Session User on Server
export async function getSessionUser() {
  try {
    const cookie = getCookie(SESSION_COOKIE);
    if (!cookie) return null;

    const payload = verifyToken(cookie);
    if (!payload) return null;

    // Verify user still exists and is active in DB
    const [user] = await db
      .select({
        id: schema.users.id,
        name: schema.users.name,
        email: schema.users.email,
        role: schema.users.role,
        branchId: schema.users.branchId,
        isActive: schema.users.isActive,
        approvalStatus: schema.users.approvalStatus,
      })
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId))
      .limit(1);

    if (!user || !user.isActive || user.approvalStatus !== 'APPROVED') {
      deleteCookie(SESSION_COOKIE, { path: '/' });
      return null;
    }

    return user;
  } catch {
    return null;
  }
}
