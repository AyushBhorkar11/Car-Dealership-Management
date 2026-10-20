import { useState, useMemo } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  LayoutDashboard,
  Car,
  MessageSquare,
  CalendarDays,
  Wallet,
  Wrench,
  Truck,
  TrendingUp,
  Users,
  Building2,
  UserRound,
  LogOut,
  Plus,
  ArrowUpRight,
  Check,
  X,
  Pencil,
  Trash2,
  Download,
  ArrowRightLeft,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { workspaceQuery } from '@/lib/workspace-query';
import { money, aggregateDemand, paymentSummary } from '@/lib/cdms';
import { assignRole, transferCar } from '@/lib/cdms.functions';
import { logoutServerFn } from '@/lib/auth.functions';
import { EnquiryForm } from './enquiry-form';
import { toast } from 'sonner';

type Module =
  | 'overview'
  | 'enquiries'
  | 'appointments'
  | 'bookings'
  | 'sales'
  | 'services'
  | 'cars'
  | 'customers'
  | 'employees'
  | 'branches'
  | 'suppliers'
  | 'purchases'
  | 'demand'
  | 'profile';

type Editable = 'cars' | 'customers' | 'employees' | 'branches' | 'suppliers' | 'sales' | 'services' | 'purchases';
type RecordRow = { id: string; [key: string]: unknown };

const names: Record<Module, string> = {
  overview: 'Overview',
  enquiries: 'Enquiries',
  appointments: 'Appointments',
  bookings: 'Bookings',
  sales: 'Sales & payments',
  services: 'Services',
  cars: 'Inventory',
  customers: 'Customers',
  employees: 'Team',
  branches: 'Branches',
  suppliers: 'Suppliers',
  purchases: 'Purchases',
  demand: 'Demand insights',
  profile: 'My profile',
};

const icons: Record<Module, typeof Car> = {
  overview: LayoutDashboard,
  enquiries: MessageSquare,
  appointments: CalendarDays,
  bookings: CalendarDays,
  sales: Wallet,
  services: Wrench,
  cars: Car,
  customers: Users,
  employees: Users,
  branches: Building2,
  suppliers: Truck,
  purchases: Truck,
  demand: TrendingUp,
  profile: UserRound,
};

function ThemedTooltip({ active, payload, label, unit = '' }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-border bg-card/95 backdrop-blur-xs px-3 py-2 text-xs shadow-md text-card-foreground">
      {label && <p className="font-semibold text-foreground mb-1">{label}</p>}
      {payload.map((entry: any, index: number) => (
        <div key={`tooltip-${index}`} className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: entry.color || entry.fill || 'var(--foreground)' }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground">
            {typeof entry.value === 'number' ? entry.value.toLocaleString('en-IN') : entry.value} {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

function Status({ value }: { value: unknown }) {
  const s = String(value);
  const isPositive = ['Available', 'Completed', 'Received', 'Approved', 'Converted', 'Confirmed', 'Scheduled', 'Booked'].includes(s);
  const isAttention = ['Pending', 'New', 'Requested', 'Pending Approval', 'Partial'].includes(s);
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border inline-block ${
        isPositive
          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
          : isAttention
          ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
          : 'bg-secondary text-secondary-foreground border-border'
      }`}
    >
      {s}
    </span>
  );
}

export function Workspace() {
  const { data } = useSuspenseQuery(workspaceQuery);
  const query = useQueryClient();
  const navigate = useNavigate();
  const assign = useServerFn(assignRole);
  const transfer = useServerFn(transferCar);

  const role = (data.user?.role || 'CUSTOMER').toLowerCase();
  const isCustomer = role === 'customer';
  const manager = ['owner', 'branch_manager'].includes(role);
  const owner = role === 'owner';

  const [tab, setTab] = useState<Module>('overview');
  const [filter, setFilter] = useState('');
  const [request, setRequest] = useState(false);

  const modules: Module[] = ['overview', 'enquiries', 'appointments', 'bookings', 'sales', 'profile'];
  const myCustomer = data.customers.find((c) => c.userId === data.user.id || c.email === data.user.email);
  const branchName = data.user.branchId
    ? data.branches.find((b) => b.id === data.user.branchId)?.branch_name || 'CDMS Experience'
    : data.enquiries[0]?.branch_id
      ? data.branches.find((b) => b.id === data.enquiries[0].branch_id)?.branch_name || 'CDMS Experience'
      : 'CDMS Customer Experience';

  const revenue = data.sales.filter((s) => s.status !== 'Cancelled').reduce((a, s) => a + Number(s.sale_amount), 0);
  const paid = data.sales.filter((s) => s.status !== 'Cancelled').reduce((a, s) => a + Number(s.amount_paid), 0);

  const customerName = (id: unknown) => data.customers.find((c) => c.id === id)?.name ?? 'Customer';
  const carName = (id: unknown) => {
    const c = data.cars.find((car) => car.id === id);
    return c ? `${c.brand} ${c.model}` : 'Vehicle';
  };

  const enquiries = data.enquiries.filter((e) =>
    tab === 'appointments'
      ? ['Appointment', 'Test Drive'].includes(e.enquiry_type)
      : tab === 'bookings'
        ? e.enquiry_type === 'Booking Request'
        : true
  );

  const financialData = useMemo(() => {
    return [
      { name: 'Total Booking', amount: Math.round(revenue / 1000) },
      { name: 'Amount Paid', amount: Math.round(paid / 1000) },
      { name: 'Outstanding', amount: Math.round(Math.max(0, revenue - paid) / 1000) },
    ];
  }, [revenue, paid]);

  return (
    <main className="workspace-layout pt-[var(--header-height)]">
      <aside className="workspace-sidebar">
        <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground block mb-4 px-2">CUSTOMER SUITE</span>
        <nav className="workspace-nav">
          {modules.map((m) => {
            const Icon = icons[m];
            const isActive = tab === m;
            return (
              <button
                key={m}
                onClick={() => {
                  setTab(m);
                  setFilter('');
                  setRequest(false);
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2 text-xs font-medium rounded-full transition-colors text-left ${
                  isActive
                    ? 'bg-foreground text-background font-semibold shadow-xs'
                    : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                }`}
              >
                <Icon size={16} />
                {names[m]}
              </button>
            );
          })}
        </nav>
        <div className="workspace-account pt-4 border-t border-border mt-6">
          <p className="text-xs text-muted-foreground font-mono truncate px-2 mb-2">{data.user.email}</p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            onClick={async () => {
              await query.cancelQueries();
              query.clear();
              await logoutServerFn();
              navigate({ to: '/auth', search: { mode: 'login' }, replace: true });
            }}
          >
            <LogOut size={14} className="mr-2" />
            Sign out
          </Button>
        </div>
      </aside>

      <div className="workspace-main">
        <div className="workspace-top">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">{branchName}</span>
            <h1 className="text-2xl font-light tracking-tight text-foreground mt-0.5">
              {tab === 'overview' ? `Welcome, ${(myCustomer?.name || 'Customer').split(' ')[0]}.` : names[tab]}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">Your vehicle journey with CDMS</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" className="rounded-full text-xs font-medium">
              <Link to="/cars" search={{ search: false }}>
                Explore cars <ArrowUpRight size={14} className="ml-1" />
              </Link>
            </Button>
          </div>
        </div>

        {tab === 'overview' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {[
                ['My requests', data.enquiries.length, 'Enquiries & bookings'],
                ['My bookings', data.sales.length, 'Purchase contracts'],
                ['Amount paid', money(paid), 'Recorded receipts'],
                ['Outstanding', money(revenue - paid), 'Remaining balance'],
              ].map(([title, value, sub]) => (
                <div className="bg-card border border-border rounded-2xl p-5 shadow-xs" key={String(title)}>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>
                  <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{value}</p>
                  <span className="text-[11px] text-muted-foreground mt-1 inline-block">{sub}</span>
                </div>
              ))}
            </div>

            {data.sales.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs mb-6">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">PAYMENT PROGRESS</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Booking Financial Breakdown (₹ Thousands)</h3>
                <div className="h-[200px] min-h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} unit="k" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                      <Tooltip content={<ThemedTooltip unit="k" />} />
                      <Bar dataKey="amount" name="Amount (₹k)" fill="var(--foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">ACTIVITY LOG</span>
                <h2 className="text-sm font-medium text-foreground mt-0.5">Recent Requests</h2>
              </div>
            </div>
            {data.enquiries.length ? (
              <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Request</th>
                      <th className="py-2.5 px-4 font-semibold">Vehicle</th>
                      <th className="py-2.5 px-4 font-semibold">Created</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {data.enquiries.slice(0, 5).map((e) => (
                      <tr key={e.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium text-foreground">{e.enquiry_type}</td>
                        <td className="py-3 px-4">{e.car_id ? carName(e.car_id) : `${e.requested_brand} ${e.requested_model}`}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{new Date(e.created_at).toLocaleDateString('en-IN')}</td>
                        <td className="py-3 px-4">
                          <Status value={e.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-xs">
                <h3 className="text-sm font-medium text-foreground">Ready for your next drive?</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Explore the collection and send your first enquiry.</p>
                <Button asChild className="rounded-full text-xs font-medium px-4">
                  <Link to="/cars" search={{ search: false }}>
                    Find my car <ArrowUpRight size={14} className="ml-1" />
                  </Link>
                </Button>
              </div>
            )}
          </>
        )}

        {['enquiries', 'appointments', 'bookings'].includes(tab) && (
          <>
            <div className="management-bar">
              <h2 className="text-lg">Your {names[tab].toLowerCase()}</h2>
              <Button onClick={() => setRequest(!request)}>
                <Plus />
                New request
              </Button>
            </div>
            {request && (
              <div className="workspace-form mb-8">
                <EnquiryForm
                  branches={data.branches}
                  type={
                    tab === 'appointments'
                      ? 'Test Drive'
                      : tab === 'bookings'
                        ? 'Booking Request'
                        : 'General Enquiry'
                  }
                />
              </div>
            )}
            {!enquiries.length ? (
              <div className="empty-state">
                <h3>Your journey starts here.</h3>
                <p>No {names[tab].toLowerCase()} yet.</p>
                <Button asChild variant="outline">
                  <Link to="/cars" search={{ search: false }}>
                    Explore cars <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Request</th>
                      <th>Car / preference</th>
                      <th>Branch</th>
                      <th>Appointment</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enquiries.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {e.enquiry_type}
                          <small>{new Date(e.created_at).toLocaleDateString('en-IN')}</small>
                        </td>
                        <td>{e.car_id ? carName(e.car_id) : `${e.requested_brand} ${e.requested_model}`}</td>
                        <td>{data.branches.find((b) => b.id === e.branch_id)?.city}</td>
                        <td>{e.test_drive_slot || (e.appointment_date ? new Date(e.appointment_date).toLocaleString('en-IN') : '—')}</td>
                        <td>
                          <Status value={e.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {tab === 'profile' && (
          <div className="space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">Customer Profile</h3>
            <div className="bg-card border border-border rounded-xl p-5 space-y-3 text-xs shadow-sm">
              <div>
                <span className="text-muted-foreground">Account Name</span>
                <p className="font-medium text-foreground mt-0.5">{myCustomer?.name || 'Customer'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Email Address</span>
                <p className="font-medium text-foreground mt-0.5">{data.user.email}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Phone Number</span>
                <p className="font-medium text-foreground mt-0.5">{myCustomer?.phone || 'Not provided'}</p>
              </div>
              <div>
                <span className="text-muted-foreground">City / Address</span>
                <p className="font-medium text-foreground mt-0.5">{myCustomer?.address || 'Not provided'}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
