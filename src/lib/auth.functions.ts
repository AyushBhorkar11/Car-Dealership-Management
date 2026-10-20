import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const loginServerFn = createServerFn({ method: 'POST' })
  .validator((d: { email: string; password: string }) => {
    return z
      .object({
        email: z.string().email(),
        password: z.string().min(1, 'Password is required'),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { loginUser } = await import('../server/auth');
    return loginUser(data.email, data.password);
  });

export const logoutServerFn = createServerFn({ method: 'POST' }).handler(async () => {
  const { logoutUser } = await import('../server/auth');
  return logoutUser();
});

export const getCurrentUserServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { getSessionUser } = await import('../server/auth');
  return getSessionUser();
});

export const quickLoginServerFn = createServerFn({ method: 'POST' })
  .validator((d: { role: 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE' }) => {
    return z
      .object({
        role: z.enum(['OWNER', 'BRANCH_MANAGER', 'EMPLOYEE']),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Quick login is disabled in production.');
    }

    const { db, schema } = await import('../server/db');
    const { eq } = await import('drizzle-orm');
    const { getClientInfo, recordLoginEvent, getRedirectForRole } = await import('../server/auth');
    const { setCookie } = await import('@tanstack/react-start/server');
    const crypto = await import('node:crypto');

    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.role, data.role))
      .limit(1);

    if (!user) {
      throw new Error(`No user with role ${data.role} found. Please run 'bun run seed' first.`);
    }

    const { ip, userAgent } = getClientInfo();
    await db
      .update(schema.users)
      .set({ lastLoginAt: new Date() })
      .where(eq(schema.users.id, user.id));
    await recordLoginEvent({
      userId: user.id,
      role: user.role,
      branchId: user.branchId,
      eventType: 'LOGIN',
      ip,
      userAgent: `[DEV QuickLogin] ${userAgent}`,
    });

    const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const sessionSecret = process.env.SESSION_SECRET || 'cdms-dealership-session-secret-key-32-chars';
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      branchId: user.branchId,
      name: user.name,
      expiresAt,
    };

    const tokenData = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto
      .createHmac('sha256', sessionSecret)
      .update(tokenData)
      .digest('base64url');
    const token = `${tokenData}.${sig}`;

    setCookie('cdms_session', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
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
  });

export const registerCustomerServerFn = createServerFn({ method: 'POST' })
  .validator((d: { name: string; email: string; password: string; phone?: string; city?: string }) => {
    return z
      .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email(),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        phone: z.string().optional().default(''),
        city: z.string().optional().default(''),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { db, schema } = await import('../server/db');
    const { hashPassword, loginUser } = await import('../server/auth');
    const { eq } = await import('drizzle-orm');
    const crypto = await import('node:crypto');

    const normalizedEmail = data.email.trim().toLowerCase();

    // Check if user exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      throw new Error('An account with this email already exists.');
    }

    const userId = crypto.randomUUID();
    const customerId = crypto.randomUUID();
    const passwordHash = await hashPassword(data.password);

    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        name: data.name,
        email: normalizedEmail,
        passwordHash,
        role: 'CUSTOMER',
        branchId: null,
        isActive: true,
        createdAt: new Date(),
      });

      await tx.insert(schema.customers).values({
        id: customerId,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone || '',
        city: data.city || '',
        address: '',
        idProofType: '',
        idProofNumber: '',
        userId,
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { writeAudit } = await import('../server/audit');
      await writeAudit({
        tx,
        actor: { userId, role: 'CUSTOMER', branchId: null },
        action: 'user.registered',
        entity: 'user',
        entityId: userId,
        oldValue: null,
        newValue: { name: data.name, email: normalizedEmail, role: 'CUSTOMER' },
        summary: `New customer account registered: ${data.name} (${normalizedEmail})`,
      });
    });

    return loginUser(normalizedEmail, data.password);
  });

export const getPublicBranchesServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { db, schema } = await import('../server/db');
  const branches = await db
    .select({
      id: schema.branches.id,
      branchName: schema.branches.branchName,
      city: schema.branches.city,
    })
    .from(schema.branches);
  return branches;
});

export const registerUnifiedUserServerFn = createServerFn({ method: 'POST' })
  .validator((d: {
    name: string;
    email: string;
    password: string;
    role: 'CUSTOMER' | 'EMPLOYEE' | 'BRANCH_MANAGER' | 'OWNER';
    branchId?: string | null;
    phone?: string;
    city?: string;
    ownerSignupCode?: string;
  }) => {
    return z
      .object({
        name: z.string().min(2, 'Name must be at least 2 characters'),
        email: z.string().email('Please enter a valid email address'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        role: z.enum(['CUSTOMER', 'EMPLOYEE', 'BRANCH_MANAGER', 'OWNER']),
        branchId: z.string().nullable().optional(),
        phone: z.string().optional().default(''),
        city: z.string().optional().default(''),
        ownerSignupCode: z.string().optional(),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { db, schema } = await import('../server/db');
    const { hashPassword, loginUser } = await import('../server/auth');
    const { eq } = await import('drizzle-orm');
    const crypto = await import('node:crypto');

    const normalizedEmail = data.email.trim().toLowerCase();

    // Check if user already exists
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (existing) {
      if (existing.approvalStatus === 'PENDING') {
        throw new Error('An account with this email is already registered and waiting for Owner approval.');
      }
      throw new Error('An account with this email already exists. Please sign in instead.');
    }

    const passwordHash = await hashPassword(data.password);
    const userId = crypto.randomUUID();

    // 1. OWNER REGISTRATION
    if (data.role === 'OWNER') {
      const expectedCode = process.env.OWNER_SIGNUP_CODE || 'CDMS-OWNER-2025';
      if (!data.ownerSignupCode || data.ownerSignupCode.trim() !== expectedCode) {
        throw new Error('Invalid Owner Secret Code. If you are locked out, run "bun run create-owner" in the server terminal.');
      }

      await db.transaction(async (tx) => {
        await tx.insert(schema.users).values({
          id: userId,
          name: data.name,
          email: normalizedEmail,
          passwordHash,
          role: 'OWNER',
          branchId: null,
          isActive: true,
          approvalStatus: 'APPROVED',
          createdAt: new Date(),
        });

        const { writeAudit } = await import('../server/audit');
        await writeAudit({
          tx,
          actor: { userId, role: 'OWNER', branchId: null },
          action: 'user.registered',
          entity: 'user',
          entityId: userId,
          oldValue: null,
          newValue: { name: data.name, email: normalizedEmail, role: 'OWNER' },
          summary: `New Dealership Owner registered: ${data.name} (${normalizedEmail})`,
        });
      });

      return loginUser(normalizedEmail, data.password);
    }

    // 2. CUSTOMER REGISTRATION
    if (data.role === 'CUSTOMER') {
      await db.transaction(async (tx) => {
        await tx.insert(schema.users).values({
          id: userId,
          name: data.name,
          email: normalizedEmail,
          passwordHash,
          role: 'CUSTOMER',
          branchId: null,
          isActive: true,
          approvalStatus: 'APPROVED',
          createdAt: new Date(),
        });

        const customerId = crypto.randomUUID();
        await tx.insert(schema.customers).values({
          id: customerId,
          name: data.name,
          email: normalizedEmail,
          phone: data.phone || '',
          city: data.city || '',
          address: '',
          idProofType: '',
          idProofNumber: '',
          userId,
          isDemo: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });

        const { writeAudit } = await import('../server/audit');
        await writeAudit({
          tx,
          actor: { userId, role: 'CUSTOMER', branchId: null },
          action: 'user.registered',
          entity: 'user',
          entityId: userId,
          oldValue: null,
          newValue: { name: data.name, email: normalizedEmail, role: 'CUSTOMER' },
          summary: `New customer registered: ${data.name} (${normalizedEmail})`,
        });
      });

      return loginUser(normalizedEmail, data.password);
    }

    // 3. EMPLOYEE / BRANCH_MANAGER REGISTRATION (Requires Branch & Enters PENDING state)
    if (!data.branchId) {
      throw new Error('Please select a showroom branch location for staff registration.');
    }

    // Verify branch exists
    const [branch] = await db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.id, data.branchId))
      .limit(1);

    if (!branch) {
      throw new Error('Selected branch does not exist.');
    }

    const employeeId = crypto.randomUUID();

    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({
        id: userId,
        name: data.name,
        email: normalizedEmail,
        passwordHash,
        role: data.role,
        branchId: data.branchId,
        isActive: false,
        approvalStatus: 'PENDING',
        createdAt: new Date(),
      });

      await tx.insert(schema.employees).values({
        id: employeeId,
        name: data.name,
        email: normalizedEmail,
        phone: data.phone || '',
        userId,
        branchId: data.branchId,
        monthlyTarget: data.role === 'BRANCH_MANAGER' ? 15 : 8,
        isActive: false,
        isDemo: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const { writeAudit } = await import('../server/audit');
      await writeAudit({
        tx,
        actor: { userId, role: data.role, branchId: data.branchId },
        action: 'user.staff_registered',
        entity: 'user',
        entityId: userId,
        oldValue: null,
        newValue: { name: data.name, email: normalizedEmail, role: data.role, branchId: data.branchId, approvalStatus: 'PENDING' },
        summary: `New staff sign-up (${data.role}): ${data.name} (${normalizedEmail}) at branch ${data.branchId} - Pending Owner Approval`,
      });
    });

    return {
      success: true,
      pendingApproval: true,
      message: 'Waiting for Owner approval. You will receive access once approved.',
      user: {
        name: data.name,
        email: normalizedEmail,
        role: data.role,
        branchName: branch.branchName,
        city: branch.city,
      },
    };
  });

export const requestPasswordResetServerFn = createServerFn({ method: 'POST' })
  .validator((d: { email: string }) => {
    return z.object({ email: z.string().email('Please enter a valid email address') }).parse(d);
  })
  .handler(async ({ data }) => {
    const { db, schema } = await import('../server/db');
    const { eq } = await import('drizzle-orm');
    const crypto = await import('node:crypto');

    const normalizedEmail = data.email.trim().toLowerCase();
    const [user] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalizedEmail))
      .limit(1);

    if (!user) {
      return {
        success: true,
        message: 'If an account exists with this email, a reset link has been generated.',
      };
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(schema.users)
      .set({ resetToken: token, resetTokenExpiry: expiry })
      .where(eq(schema.users.id, user.id));

    const resetUrl = `/auth?mode=reset&token=${token}&email=${encodeURIComponent(normalizedEmail)}`;

    console.log('\n============================================================');
    console.log(' [CDMS AUTH DEV] PASSWORD RESET LINK GENERATED');
    console.log(` Account  : ${user.name} (${user.email}) - Role: ${user.role}`);
    console.log(` Reset URL: http://localhost:3000${resetUrl}`);
    console.log('============================================================\n');

    return {
      success: true,
      message: 'Reset link generated. In development mode, check your server console or use the link below.',
      devResetUrl: resetUrl,
    };
  });

export const completePasswordResetServerFn = createServerFn({ method: 'POST' })
  .validator((d: { email: string; token: string; newPassword: string }) => {
    return z
      .object({
        email: z.string().email(),
        token: z.string().min(1, 'Token is required'),
        newPassword: z.string().min(8, 'Password must be at least 8 characters'),
      })
      .parse(d);
  })
  .handler(async ({ data }) => {
    const { db, schema } = await import('../server/db');
    const { hashPassword } = await import('../server/auth');
    const { eq, and, gt } = await import('drizzle-orm');

    const normalizedEmail = data.email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(schema.users)
      .where(
        and(
          eq(schema.users.email, normalizedEmail),
          eq(schema.users.resetToken, data.token),
          gt(schema.users.resetTokenExpiry, new Date())
        )
      )
      .limit(1);

    if (!user) {
      throw new Error('Password reset link is invalid or has expired. Please request a new one.');
    }

    const passwordHash = await hashPassword(data.newPassword);

    await db.transaction(async (tx) => {
      await tx
        .update(schema.users)
        .set({
          passwordHash,
          resetToken: null,
          resetTokenExpiry: null,
        })
        .where(eq(schema.users.id, user.id));

      const { writeAudit } = await import('../server/audit');
      await writeAudit({
        tx,
        actor: { userId: user.id, role: user.role, branchId: user.branchId },
        action: 'user.password_reset',
        entity: 'user',
        entityId: user.id,
        oldValue: null,
        newValue: { passwordReset: true },
        summary: `User ${user.name} (${normalizedEmail}) completed password reset`,
      });
    });

    return {
      success: true,
      message: 'Password reset successful! You can now log in with your new password.',
    };
  });

