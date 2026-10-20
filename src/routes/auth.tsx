import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useState, useEffect } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Zap,
  CheckCircle2,
  Clock,
  KeyRound,
  UserCheck,
  AlertCircle,
  Sun,
  Moon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  loginServerFn,
  quickLoginServerFn,
  registerUnifiedUserServerFn,
  requestPasswordResetServerFn,
  completePasswordResetServerFn,
  getPublicBranchesServerFn,
} from '@/lib/auth.functions';

export const Route = createFileRoute('/auth')({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: s['mode'] === 'register' ? 'register' : s['mode'] === 'reset' ? 'reset' : 'login',
    token: typeof s['token'] === 'string' ? s['token'] : undefined,
    email: typeof s['email'] === 'string' ? s['email'] : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Dealership Portal Access — CDMS Automotive' },
      {
        name: 'description',
        content: 'Role-based access to multi-branch dealership operations, procurement, customer bookings and analytics.',
      },
    ],
  }),
  component: AuthPage,
});

type PortalRole = 'CUSTOMER' | 'EMPLOYEE' | 'BRANCH_MANAGER' | 'OWNER';

const ROLES: { id: PortalRole; label: string; sampleEmail: string; desc: string }[] = [
  { id: 'CUSTOMER', label: 'Customer', sampleEmail: 'rahul.chitale@example.com', desc: 'Track vehicle bookings, test drives, and invoices.' },
  { id: 'EMPLOYEE', label: 'Employee', sampleEmail: 'employee.pune1@cdms.local', desc: 'Manage leads, quotations, bookings, and deliveries.' },
  { id: 'BRANCH_MANAGER', label: 'Branch Manager', sampleEmail: 'manager.pune@cdms.local', desc: 'Manage showroom inventory, discounts, and sales targets.' },
  { id: 'OWNER', label: 'Owner', sampleEmail: 'owner@cdms.local', desc: 'Executive governance, branch transfers, and procurement approvals.' },
];

function AuthPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const currentMode = search.mode as 'login' | 'register' | 'reset';
  const resetToken = search.token;
  const resetEmailPrefill = search.email || '';

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devResetUrl, setDevResetUrl] = useState('');
  const [lastEnteredEmail, setLastEnteredEmail] = useState(resetEmailPrefill);

  // Selected role for login or register (Customer, Employee, Branch Manager, Owner)
  const [selectedRole, setSelectedRole] = useState<PortalRole>('CUSTOMER');

  // Register branches state
  const [branches, setBranches] = useState<{ id: string; branchName: string; city: string }[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [pendingNotice, setPendingNotice] = useState<{
    name: string;
    email: string;
    role: string;
    branchName?: string;
  } | null>(null);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const isLight = document.documentElement.dataset['theme'] === 'light' || (!document.documentElement.classList.contains('dark') && document.documentElement.dataset['theme'] !== 'dark');
    setTheme(isLight ? 'light' : 'dark');
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.dataset['theme'] = nextTheme;
    if (nextTheme === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
    }
    localStorage.setItem('cdms-theme', nextTheme);
  };

  const isDev = import.meta.env.DEV;

  // Load branches for staff registration
  useEffect(() => {
    let active = true;
    getPublicBranchesServerFn().then((list) => {
      if (active && Array.isArray(list)) {
        setBranches(list);
        if (list.length > 0 && !selectedBranchId) {
          setSelectedBranchId(list[0].id);
        }
      }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const handleQuickLogin = async (role: 'OWNER' | 'BRANCH_MANAGER' | 'EMPLOYEE') => {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const res = await quickLoginServerFn({ data: { role } });
      if (res && res.redirectTo) {
        navigate({ to: res.redirectTo as any });
      }
    } catch (err: any) {
      setError(err?.message || 'Quick login failed. Please run bun run seed first.');
    } finally {
      setBusy(false);
    }
  };

  const currentRoleInfo = ROLES.find((r) => r.id === selectedRole) || ROLES[0];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* 1. Slim Top Bar with Logo on left and Back to home on right */}
      <header className="w-full h-14 border-b border-border bg-background/80 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-6xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between">
          <Link
            to="/"
            className="wordmark text-foreground flex items-center gap-2 hover:opacity-90 transition-opacity"
            aria-label="CDMS home"
          >
            <span className="brand-symbol"><i /><i /><i /></span>
            <span className="font-semibold text-lg tracking-tight flex items-center gap-1.5">
              CDMS <small className="text-[9px] tracking-widest text-muted-foreground font-normal">THE NEXT MILE.</small>
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link
              to="/"
              className="text-xs font-medium text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 transition-colors py-1.5 px-3 rounded-full hover:bg-secondary"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to home
            </Link>
          </div>
        </div>
      </header>

      {/* 2. Main Centered Card Container */}
      <main className="flex-1 flex items-center justify-center py-10 px-4">
        <div className="w-full max-w-[460px] rounded-2xl border border-border bg-card text-card-foreground p-6 sm:p-7 shadow-xs">
          {/* Staff Registration Pending Confirmation */}
          {pendingNotice ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-emerald-500">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Request Submitted</h3>
                  <p className="text-xs text-muted-foreground">Waiting for Dealership Owner approval</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-muted/60 border border-border text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Candidate Name:</span>
                  <span className="font-semibold text-foreground">{pendingNotice.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registered Email:</span>
                  <span className="font-mono text-foreground">{pendingNotice.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Requested Role:</span>
                  <span className="font-semibold text-primary">{pendingNotice.role.replace('_', ' ')}</span>
                </div>
                {pendingNotice.branchName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Requested Branch:</span>
                    <span className="text-foreground">{pendingNotice.branchName}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground">Approval Status:</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                    <Clock className="h-3 w-3" /> PENDING
                  </span>
                </div>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Your profile has been created and placed in the Dealership Owner's approval queue. Once approved, you can immediately log in with your email and password.
              </p>

              <Button
                variant="outline"
                className="w-full h-10 rounded-full font-medium text-xs"
                onClick={() => {
                  setPendingNotice(null);
                  navigate({ to: '/auth', search: { mode: 'login' } });
                }}
              >
                Back to Log In
              </Button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setError('');
                setMessage('');
                setDevResetUrl('');
                setBusy(true);
                const f = new FormData(e.currentTarget);

                try {
                  // 1. REGISTER MODE
                  if (currentMode === 'register') {
                    const name = String(f.get('name') || '').trim();
                    const email = String(f.get('email') || '').trim();
                    const password = String(f.get('password') || '');
                    const phone = String(f.get('phone') || '').trim();
                    const city = String(f.get('city') || '').trim();
                    const ownerSignupCode = String(f.get('ownerSignupCode') || '').trim();

                    const res = await registerUnifiedUserServerFn({
                      data: {
                        name,
                        email,
                        password,
                        role: selectedRole,
                        branchId: selectedRole === 'OWNER' || selectedRole === 'CUSTOMER' ? null : selectedBranchId,
                        phone,
                        city,
                        ownerSignupCode: selectedRole === 'OWNER' ? ownerSignupCode : undefined,
                      },
                    });

                    if (res?.pendingApproval) {
                      setPendingNotice({
                        name,
                        email,
                        role: selectedRole,
                        branchName: branches.find((b) => b.id === selectedBranchId)?.branchName,
                      });
                    } else if (res?.redirectTo) {
                      navigate({ to: res.redirectTo as any });
                    }
                  }
                  // 2. PASSWORD RESET MODE (Confirm Token)
                  else if (currentMode === 'reset' && resetToken) {
                    const newPassword = String(f.get('password') || '');
                    const confirmPassword = String(f.get('confirmPassword') || '');

                    if (newPassword !== confirmPassword) {
                      throw new Error('Passwords do not match. Please re-enter.');
                    }

                    const res = await completePasswordResetServerFn({
                      data: {
                        email: resetEmailPrefill || String(f.get('email') || ''),
                        token: resetToken,
                        newPassword,
                      },
                    });

                    setMessage(res.message);
                  }
                  // 3. PASSWORD RESET REQUEST MODE (Email only)
                  else if (currentMode === 'reset') {
                    const email = String(f.get('email') || '').trim();
                    const res = await requestPasswordResetServerFn({ data: { email } });
                    setMessage(res.message);
                    if (res.devResetUrl) {
                      setDevResetUrl(res.devResetUrl);
                    }
                  }
                  // 4. LOG IN MODE
                  else {
                    const email = String(f.get('email') || '').trim();
                    const password = String(f.get('password') || '');
                    setLastEnteredEmail(email);
                    const res = await loginServerFn({ data: { email, password } });
                    if (res?.redirectTo) {
                      navigate({ to: res.redirectTo as any });
                    }
                  }
                } catch (err: any) {
                  const errMsg = err?.message || 'Authentication operation failed. Please verify credentials.';
                  if (errMsg.includes('No account found') || errMsg.includes('sign up')) {
                    const typedEmail = String(f?.get('email') || '').trim();
                    setLastEnteredEmail(typedEmail);
                    setError('No account found with this email. Please sign up to create your account.');
                  } else {
                    setError(errMsg);
                  }
                } finally {
                  setBusy(false);
                }
              }}
            >
              {/* Top Eyebrow */}
              <div className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground uppercase">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                {currentMode === 'login'
                  ? `${selectedRole.replace('_', ' ')} PORTAL`
                  : currentMode === 'register'
                  ? 'DEALERSHIP REGISTRATION'
                  : 'ACCOUNT RECOVERY'}
              </div>

              {/* Title & Subtitle */}
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {currentMode === 'login'
                    ? 'Log in to Dealership'
                    : currentMode === 'register'
                    ? 'Create an Account'
                    : resetToken
                    ? 'Set New Password'
                    : 'Reset Your Password'}
                </h1>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {currentMode === 'login'
                    ? currentRoleInfo.desc
                    : currentMode === 'register'
                    ? 'Select your role to register. Staff profiles are routed directly to the Owner for approval.'
                    : resetToken
                    ? 'Choose a secure new password of at least 8 characters for your dealership account.'
                    : 'Enter your registered email address to receive password reset instructions.'}
                </p>
              </div>

              {/* Role Segmented Control (Customer, Employee, Branch Manager, Owner) */}
              {currentMode !== 'reset' && (
                <div>
                  <div
                    className="grid grid-cols-2 sm:grid-cols-4 gap-1 p-1 rounded-xl bg-muted border border-border"
                    role="tablist"
                    aria-label="Select role"
                  >
                    {ROLES.map((r) => {
                      const active = selectedRole === r.id;
                      return (
                        <button
                          type="button"
                          key={r.id}
                          role="tab"
                          aria-selected={active}
                          className={`py-2 px-1 text-[11px] sm:text-xs font-medium text-center rounded-lg transition-all whitespace-nowrap ${
                            active
                              ? 'bg-card text-foreground font-semibold shadow-xs'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => {
                            setSelectedRole(r.id);
                            setError('');
                            setMessage('');
                          }}
                        >
                          {r.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Role Registration Notice Banner */}
              {currentMode === 'register' && (
                <div className="p-3 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground leading-relaxed">
                  {selectedRole === 'CUSTOMER' && (
                    <span className="text-foreground font-medium">
                      ✓ Instant Access: Explore cars, request test drives, and view quotations.
                    </span>
                  )}
                  {selectedRole === 'EMPLOYEE' && (
                    <span className="text-amber-500 font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" /> Requires Owner Approval: The owner reviews branch assignment before activation.
                    </span>
                  )}
                  {selectedRole === 'BRANCH_MANAGER' && (
                    <span className="text-amber-500 font-medium flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 shrink-0" /> Requires Owner Approval: Dealership owner assigns and activates your manager access.
                    </span>
                  )}
                  {selectedRole === 'OWNER' && (
                    <span className="text-primary font-medium flex items-center gap-1.5">
                      <KeyRound className="h-3.5 w-3.5 shrink-0" /> Passcode Protected: Requires the OWNER_SIGNUP_CODE configured in .env.
                    </span>
                  )}
                </div>
              )}

              {/* Development Mode Quick-Login (Subtle & Readable in both themes) */}
              {currentMode === 'login' && isDev && (
                <div className="p-3 rounded-xl bg-muted/60 border border-border/80 text-xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    <span className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-500" />
                      Quick Dev Log-In
                    </span>
                    <span className="text-[10px] text-muted-foreground font-normal lowercase">local dev</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs font-medium h-8 bg-card text-foreground hover:bg-accent border-border"
                      disabled={busy}
                      onClick={() => handleQuickLogin('OWNER')}
                    >
                      Owner
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs font-medium h-8 bg-card text-foreground hover:bg-accent border-border"
                      disabled={busy}
                      onClick={() => handleQuickLogin('BRANCH_MANAGER')}
                    >
                      Manager
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs font-medium h-8 bg-card text-foreground hover:bg-accent border-border"
                      disabled={busy}
                      onClick={() => handleQuickLogin('EMPLOYEE')}
                    >
                      Employee
                    </Button>
                  </div>
                </div>
              )}

              {/* Form Fields: LOGIN MODE */}
              {currentMode === 'login' && (
                <>
                  <div>
                    <label htmlFor="login-email" className="text-xs font-medium text-foreground block mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="login-email"
                      type="email"
                      name="email"
                      key={`email-${selectedRole}`}
                      required
                      autoComplete="email"
                      defaultValue={currentRoleInfo.sampleEmail}
                      placeholder="you@cdms.local"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label htmlFor="login-password" className="text-xs font-medium text-foreground">
                        Password
                      </label>
                      <Link
                        to="/auth"
                        search={{ mode: 'reset' }}
                        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors hover:underline"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      key={`pwd-${selectedRole}`}
                      type="password"
                      required
                      minLength={8}
                      defaultValue="Dealership@2026"
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </>
              )}

              {/* Form Fields: REGISTER MODE */}
              {currentMode === 'register' && (
                <>
                  <div>
                    <label htmlFor="reg-name" className="text-xs font-medium text-foreground block mb-1.5">
                      Full Name
                    </label>
                    <input
                      id="reg-name"
                      name="name"
                      required
                      autoComplete="name"
                      placeholder="Anand Sharma"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-email" className="text-xs font-medium text-foreground block mb-1.5">
                      Email Address
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      name="email"
                      required
                      autoComplete="email"
                      defaultValue={search.email || lastEnteredEmail || ''}
                      placeholder="anand@example.com"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label htmlFor="reg-phone" className="text-xs font-medium text-foreground block mb-1.5">
                        Phone Number
                      </label>
                      <input
                        id="reg-phone"
                        name="phone"
                        autoComplete="tel"
                        placeholder="+91 98200 12345"
                        className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                    <div>
                      <label htmlFor="reg-city" className="text-xs font-medium text-foreground block mb-1.5">
                        City
                      </label>
                      <input
                        id="reg-city"
                        name="city"
                        placeholder="Pune / Mumbai"
                        className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  </div>

                  {(selectedRole === 'EMPLOYEE' || selectedRole === 'BRANCH_MANAGER') && (
                    <div>
                      <label htmlFor="reg-branch" className="text-xs font-medium text-foreground block mb-1.5">
                        Assigned Showroom Branch
                      </label>
                      <select
                        id="reg-branch"
                        className="w-full h-10 px-3 rounded-xl border border-input bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        required
                      >
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.branchName} ({b.city})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedRole === 'OWNER' && (
                    <div>
                      <label htmlFor="reg-owner-code" className="text-xs font-medium text-foreground block mb-1.5">
                        Dealership Owner Secret Passcode
                      </label>
                      <input
                        id="reg-owner-code"
                        name="ownerSignupCode"
                        type="password"
                        required
                        placeholder="Enter OWNER_SIGNUP_CODE"
                        className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                      <span className="text-[10px] text-muted-foreground mt-1 block">
                        Default dev passcode: <code className="text-foreground font-mono bg-muted px-1 py-0.5 rounded">CDMS-OWNER-2025</code>
                      </span>
                    </div>
                  )}

                  <div>
                    <label htmlFor="reg-pwd" className="text-xs font-medium text-foreground block mb-1.5">
                      Create Password (min 8 characters)
                    </label>
                    <input
                      id="reg-pwd"
                      name="password"
                      type="password"
                      required
                      minLength={8}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                </>
              )}

              {/* Form Fields: RESET MODE */}
              {currentMode === 'reset' && (
                <>
                  {resetToken ? (
                    <>
                      <input type="hidden" name="email" value={resetEmailPrefill} />
                      <div>
                        <label htmlFor="reset-new-pwd" className="text-xs font-medium text-foreground block mb-1.5">
                          New Password (min 8 characters)
                        </label>
                        <input
                          id="reset-new-pwd"
                          name="password"
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                      <div>
                        <label htmlFor="reset-confirm-pwd" className="text-xs font-medium text-foreground block mb-1.5">
                          Confirm New Password
                        </label>
                        <input
                          id="reset-confirm-pwd"
                          name="confirmPassword"
                          type="password"
                          required
                          minLength={8}
                          autoComplete="new-password"
                          placeholder="••••••••"
                          className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                      </div>
                    </>
                  ) : (
                    <div>
                      <label htmlFor="reset-email" className="text-xs font-medium text-foreground block mb-1.5">
                        Registered Email Address
                      </label>
                      <input
                        id="reset-email"
                        type="email"
                        name="email"
                        required
                        autoComplete="email"
                        defaultValue={resetEmailPrefill}
                        placeholder="you@cdms.local"
                        className="w-full h-10 px-3.5 rounded-xl border border-input bg-background text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Alerts: Error & Success */}
              {error && (
                <div role="alert" className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{error}</span>
                  </div>
                  {error.includes('No account found') && (
                    <div className="pl-6 pt-1">
                      <Link
                        to="/auth"
                        search={{ mode: 'register', email: lastEnteredEmail }}
                        className="inline-flex items-center gap-1 font-semibold text-foreground underline hover:text-primary transition-colors text-xs"
                        onClick={() => { setError(''); }}
                      >
                        Sign up now →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {message && (
                <div role="status" className="p-3 rounded-xl bg-success/10 border border-success/20 text-success text-xs flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{message}</span>
                </div>
              )}

              {/* Dev Mode Direct Reset Link */}
              {devResetUrl && (
                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                  <div className="font-semibold text-primary mb-1 flex items-center gap-1">
                    <Zap className="h-3.5 w-3.5" /> Dev Mode Direct Reset:
                  </div>
                  <Link
                    to={devResetUrl as any}
                    className="text-foreground underline break-all font-mono hover:text-primary"
                  >
                    Click here to set new password now →
                  </Link>
                </div>
              )}

              {/* Submit Button */}
              <Button
                disabled={busy}
                variant="default"
                className="w-full h-11 rounded-full font-semibold text-xs shadow-xs mt-2"
              >
                {busy
                  ? 'Processing…'
                  : currentMode === 'register'
                  ? selectedRole === 'CUSTOMER'
                    ? 'Create Customer Account'
                    : selectedRole === 'OWNER'
                    ? 'Register as Owner'
                    : 'Submit for Owner Approval'
                  : currentMode === 'reset'
                  ? resetToken
                    ? 'Update Password'
                    : 'Send Reset Link'
                  : 'Log In to Portal'}
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>

              {/* Bottom Navigation Links (Clean, under form, no floating elements) */}
              <div className="text-center text-xs text-muted-foreground mt-4 pt-4 border-t border-border">
                {currentMode === 'login' ? (
                  <p>
                    New to the dealership?{' '}
                    <Link
                      to="/auth"
                      search={{ mode: 'register' }}
                      className="font-semibold text-foreground hover:underline ml-1"
                      onClick={() => { setError(''); setMessage(''); }}
                    >
                      Create an account
                    </Link>
                  </p>
                ) : (
                  <p>
                    Already have an account?{' '}
                    <Link
                      to="/auth"
                      search={{ mode: 'login' }}
                      className="font-semibold text-foreground hover:underline ml-1"
                      onClick={() => { setError(''); setMessage(''); }}
                    >
                      Log in
                    </Link>
                  </p>
                )}
              </div>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
