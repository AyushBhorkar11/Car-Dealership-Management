import React, { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CalendarDays,
  FileSpreadsheet,
  CheckCircle2,
  Wallet,
  Truck,
  Plus,
  Search,
  Filter,
  Printer,
  ArrowRight,
  Clock,
  ShieldCheck,
  AlertCircle,
  FileCheck,
  Phone,
  Mail,
  MapPin,
  Check,
  X,
  LogOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { logoutServerFn } from '@/lib/auth.functions';
import { workspaceQuery } from '@/lib/workspace-query';
import { money } from '@/lib/cdms';
import {
  saveCustomer,
  saveLead,
  createEmployeeLeadServerFn,
  bookTestDrive,
  recordTestDriveFeedback,
  generateQuotation,
  convertQuotationToBooking,
  recordPaymentTransaction,
  updateDelivery,
} from '@/lib/cdms.functions';
import { toast } from 'sonner';

type Tab =
  | 'dashboard'
  | 'customers'
  | 'leads'
  | 'test_drives'
  | 'quotations'
  | 'bookings'
  | 'payments'
  | 'deliveries';

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

export function EmployeeDashboard() {
  const { data } = useSuspenseQuery(workspaceQuery);
  const query = useQueryClient();
  const navigate = useNavigate();

  // Server functions
  const saveCustomerFn = useServerFn(saveCustomer);
  const saveLeadFn = useServerFn(saveLead);
  const createEmployeeLeadFn = useServerFn(createEmployeeLeadServerFn);
  const bookTestDriveFn = useServerFn(bookTestDrive);
  const recordFeedbackFn = useServerFn(recordTestDriveFeedback);
  const generateQuotationFn = useServerFn(generateQuotation);
  const convertBookingFn = useServerFn(convertQuotationToBooking);
  const recordPaymentFn = useServerFn(recordPaymentTransaction);
  const updateDeliveryFn = useServerFn(updateDelivery);

  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [busy, setBusy] = useState(false);

  // Modals & sub-views
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [leadPhone, setLeadPhone] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadName, setLeadName] = useState('');
  const [showTestDriveModal, setShowTestDriveModal] = useState(false);
  const [showQuotationModal, setShowQuotationModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState<string | null>(null);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);
  const [printQuote, setPrintQuote] = useState<any>(null);

  // Current employee identity
  const currentEmployee = data.employees.find((e) => e.auth_user_id === data.user.id);
  const employeeBranchId = currentEmployee?.branch_id || data.roles[0]?.branch_id;
  const branch = data.branches.find((b) => b.id === employeeBranchId);

  // Scoped data: Strictly this employee's assigned leads & customers, and branch inventory
  const myLeads = data.enquiries.filter(
    (e) => e.employee_id === currentEmployee?.id || (!e.employee_id && e.branch_id === employeeBranchId)
  );

  const myTestDrives = data.enquiries.filter(
    (e) =>
      e.enquiry_type === 'Test Drive' &&
      (e.employee_id === currentEmployee?.id || e.branch_id === employeeBranchId)
  );

  const myBookings = data.enquiries.filter(
    (e) =>
      e.enquiry_type === 'Booking Request' &&
      (e.employee_id === currentEmployee?.id || e.branch_id === employeeBranchId)
  );

  const mySales = data.sales.filter(
    (s) => s.employee_id === currentEmployee?.id || s.branch_id === employeeBranchId
  );

  const branchCars = data.cars.filter((c) => c.branch_id === employeeBranchId);

  const refresh = () => {
    query.invalidateQueries({ queryKey: ['workspace'] });
  };

  // KPIs
  const monthlyTarget = currentEmployee?.monthly_target || 5;
  const salesThisMonth = mySales.filter(
    (s) => s.status !== 'Cancelled' && new Date(s.sale_date).getMonth() === new Date().getMonth()
  ).length;
  const targetProgress = Math.min(100, Math.round((salesThisMonth / monthlyTarget) * 100));

  const followUpsDueToday = myLeads.filter((l) => {
    if (!l.follow_up_date) return false;
    const fDate = new Date(l.follow_up_date).toDateString();
    return fDate === new Date().toDateString();
  });

  // Memoized Chart Dataset for Sales Pipeline Recharts
  const pipelineChartData = React.useMemo(() => {
    const stages = [
      { key: 'NEW', label: 'New' },
      { key: 'CONTACTED', label: 'Contacted' },
      { key: 'TEST_DRIVE', label: 'Test Drive' },
      { key: 'QUOTED', label: 'Quotation' },
      { key: 'BOOKED', label: 'Booked' },
      { key: 'CLOSED_WON', label: 'Won' },
    ];
    return stages.map((s) => ({
      stage: s.label,
      count: myLeads.filter((l) => l.stage === s.key).length,
    }));
  }, [myLeads]);

  // Unique models in catalogue for lead creation
  const availableCatalogueModels = React.useMemo(() => {
    const fromCars = Array.from(new Set((data.cars || []).map((c) => `${c.brand} ${c.model}`))).filter(Boolean);
    if (fromCars.length > 0) return fromCars;
    return [
      'Hyundai Creta',
      'Kia Seltos',
      'Mahindra XUV700',
      'Mahindra Thar',
      'Toyota Fortuner',
      'Toyota Innova Hycross',
      'Honda City',
      'Maruti Grand Vitara',
      'Tata Nexon',
    ];
  }, [data.cars]);

  // Live duplicate checking against existing customer directory
  const cleanLeadPhone = leadPhone.replace(/\D/g, '').slice(-10);
  const cleanLeadEmail = leadEmail.trim().toLowerCase();
  const matchedExistingCustomer = (cleanLeadPhone.length >= 10 || cleanLeadEmail.length > 3)
    ? (data.customers || []).find((c) => {
        const cPhone = c.phone ? c.phone.replace(/\D/g, '').slice(-10) : '';
        if (cleanLeadPhone.length >= 10 && cPhone === cleanLeadPhone) return true;
        if (cleanLeadEmail && c.email && c.email.toLowerCase().trim() === cleanLeadEmail) return true;
        return false;
      })
    : null;

  return (
    <div className="min-h-screen pt-[var(--header-height)] bg-background text-foreground flex flex-col md:flex-row transition-colors">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-xs shadow-xs">
              SE
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground block">SALES SUITE</span>
              <h2 className="font-semibold text-sm leading-tight text-foreground">{currentEmployee?.name || 'Sales Executive'}</h2>
              <p className="text-[11px] text-muted-foreground font-medium">{branch?.city || 'Branch'} Showroom</p>
            </div>
          </div>

          <div className="mb-4 px-3.5 py-2.5 bg-muted/30 rounded-xl border border-border">
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Monthly Target</span>
              <span className="text-xs font-semibold text-foreground">{salesThisMonth} / {monthlyTarget} cars</span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div className="bg-foreground h-full rounded-full transition-all" style={{ width: `${targetProgress}%` }} />
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'My Dashboard', icon: LayoutDashboard },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'leads', label: 'Leads & Enquiries', icon: MessageSquare, badge: followUpsDueToday.length },
              { id: 'test_drives', label: 'Test Drives', icon: CalendarDays },
              { id: 'quotations', label: 'Quotations', icon: FileSpreadsheet },
              { id: 'bookings', label: 'Bookings', icon: CheckCircle2 },
              { id: 'payments', label: 'Payments', icon: Wallet },
              { id: 'deliveries', label: 'Delivery Checklist', icon: Truck },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as Tab);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium rounded-full transition-colors ${
                    isActive
                      ? 'bg-foreground text-background font-semibold shadow-xs'
                      : 'text-muted-foreground hover:bg-secondary/70 hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={16} />
                    {tab.label}
                  </div>
                  {tab.badge && tab.badge > 0 ? (
                    <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-bold px-2 py-0.5 rounded-full text-[10px]">
                      {tab.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-4 border-t border-border mt-6">
          <div className="text-[11px] text-muted-foreground mb-2 px-2">
            Dealership Standards · IST
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-xs rounded-full text-rose-500 hover:text-rose-600 hover:bg-rose-500/10"
            onClick={async () => {
              await logoutServerFn();
              sessionStorage.clear();
              navigate({ to: '/auth', search: { mode: 'login' } });
            }}
          >
            <LogOut size={14} className="mr-2" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-var(--header-height))] bg-background text-foreground">
        {/* Top Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              SALES SUITE · {branch?.city?.toUpperCase() || 'SHOWROOM'}
            </span>
            <h1 className="text-2xl font-light tracking-tight text-foreground capitalize mt-0.5">
              {activeTab.replace('_', ' ')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Assigned sales operations scoped to {branch?.branch_name || 'Branch Showroom'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="rounded-full text-xs font-medium px-4"
              onClick={() => {
                if (activeTab === 'customers') setShowCustomerModal(true);
                else if (activeTab === 'leads') setShowLeadModal(true);
                else if (activeTab === 'test_drives') setShowTestDriveModal(true);
                else if (activeTab === 'quotations') setShowQuotationModal(true);
                else if (activeTab === 'bookings') setShowBookingModal(true);
                else if (activeTab === 'payments') setShowPaymentModal(true);
                else setShowLeadModal(true);
              }}
            >
              <Plus size={14} className="mr-1" />
              {activeTab === 'customers'
                ? 'Add Customer'
                : activeTab === 'quotations'
                ? 'Create Quotation'
                : activeTab === 'test_drives'
                ? 'Book Test Drive'
                : activeTab === 'payments'
                ? 'Record Payment'
                : 'New Lead'}
            </Button>
          </div>
        </header>

        {/* ---------------- DASHBOARD TAB ---------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">My Active Leads</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">
                  {myLeads.filter((l) => !['CLOSED_WON', 'CLOSED_LOST'].includes(l.stage)).length}
                </p>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 inline-block">In active pipeline</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Follow-ups Today</span>
                <p className="text-2xl font-light tracking-tight text-amber-600 dark:text-amber-400 mt-1.5">
                  {followUpsDueToday.length}
                </p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Requires contact</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Test Drives</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">
                  {myTestDrives.filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled').length}
                </p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Scheduled sessions</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sales Closed</span>
                <p className="text-2xl font-light tracking-tight text-emerald-600 dark:text-emerald-400 mt-1.5">{salesThisMonth}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Target: {monthlyTarget} units</span>
              </div>
            </div>

            {/* Pipeline Stage Visualizer & Chart Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-1 bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">PIPELINE BREAKDOWN</span>
                  <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Leads by Stage</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { stage: 'NEW', label: 'New Lead' },
                    { stage: 'CONTACTED', label: 'Contacted' },
                    { stage: 'TEST_DRIVE', label: 'Test Drive' },
                    { stage: 'QUOTED', label: 'Quotation' },
                    { stage: 'BOOKED', label: 'Booked' },
                    { stage: 'CLOSED_WON', label: 'Won' },
                  ].map((s) => {
                    const count = myLeads.filter((l) => l.stage === s.stage).length;
                    return (
                      <div key={s.stage} className="bg-muted/30 border border-border/60 rounded-xl p-2.5 text-center">
                        <div className="text-xl font-light text-foreground">{count}</div>
                        <div className="text-[11px] font-medium text-muted-foreground mt-0.5 truncate">{s.label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">PIPELINE VELOCITY</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Pipeline Stage Progression</h3>
                <div className="h-[210px] min-h-[210px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pipelineChartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="stage" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                      <Tooltip content={<ThemedTooltip unit="leads" />} />
                      <Bar dataKey="count" name="Active Leads" fill="var(--foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Quick Actions & Recent Bookings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">ATTENTION REQUIRED</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Follow-ups & Next Actions</h3>
                {followUpsDueToday.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No overdue follow-ups for today.</p>
                ) : (
                  <div className="space-y-2">
                    {followUpsDueToday.slice(0, 4).map((l) => {
                      const cust = data.customers.find((c) => c.id === l.customer_id);
                      return (
                        <div key={l.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{cust?.name || 'Customer'}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{l.requested_brand} {l.requested_model} · {l.stage}</p>
                          </div>
                          <Button size="sm" variant="outline" className="rounded-full text-[11px] h-7 px-3 font-medium" onClick={() => setActiveTab('leads')}>
                            View Lead
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">RECENT ACTIVITY</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Recent Bookings</h3>
                {myBookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">No recent bookings recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {myBookings.slice(0, 4).map((b) => {
                      const cust = data.customers.find((c) => c.id === b.customer_id);
                      return (
                        <div key={b.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-xl border border-border/50 text-xs">
                          <div>
                            <p className="font-semibold text-foreground">{cust?.name || 'Customer'}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{b.requested_brand} {b.requested_model}</p>
                          </div>
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                            {money(b.booking_amount || 50000)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- CUSTOMERS TAB ---------------- */}
        {activeTab === 'customers' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customer name, phone, city or Aadhaar/PAN..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Contact</th>
                    <th className="py-2.5 px-4 font-semibold">City / Address</th>
                    <th className="py-2.5 px-4 font-semibold">ID Proof Ref</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {data.customers
                    .filter((c) =>
                      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      c.phone.includes(searchQuery) ||
                      c.city.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((c) => (
                      <tr key={c.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                        <td className="py-3 px-4">
                          <div>{c.phone || '—'}</div>
                          <div className="text-[11px] text-muted-foreground">{c.email}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{c.city || '—'}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-xs">{c.address || '—'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {c.id_proof_number ? `${c.id_proof_type}: ${c.id_proof_number}` : 'Pending verification'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => {
                              setSelectedQuotation(c);
                              setShowLeadModal(true);
                            }}
                          >
                            New Lead
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- LEADS & ENQUIRIES TAB ---------------- */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="flex gap-2 mb-4">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search leads by customer, model, or stage..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Interested Vehicle</th>
                    <th className="py-2.5 px-4 font-semibold">Budget / Timeline</th>
                    <th className="py-2.5 px-4 font-semibold">Stage</th>
                    <th className="py-2.5 px-4 font-semibold">Follow-Up Date</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {myLeads
                    .filter((l) => {
                      const cust = data.customers.find((c) => c.id === l.customer_id);
                      return (
                        (cust?.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        l.requested_model.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        l.stage.toLowerCase().includes(searchQuery.toLowerCase())
                      );
                    })
                    .map((l) => {
                      const cust = data.customers.find((c) => c.id === l.customer_id);
                      return (
                        <tr key={l.id} className="hover:bg-muted/30">
                          <td className="py-3 px-4 font-medium text-foreground">
                            <div>{cust?.name || 'Customer'}</div>
                            <div className="text-[11px] text-muted-foreground">{cust?.phone}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold">{l.requested_brand} {l.requested_model}</div>
                            <div className="text-[11px] text-muted-foreground">{l.requested_variant || 'Standard'} · {l.preferred_color || 'Any color'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div>{l.preferred_budget ? money(l.preferred_budget) : 'Flexible'}</div>
                            <div className="text-[11px] text-muted-foreground">{l.expected_timeline || 'Immediate'}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-800">
                              {l.stage}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-muted-foreground text-[11px]">
                            {l.follow_up_date ? new Date(l.follow_up_date).toLocaleDateString('en-IN') : 'None'}
                          </td>
                          <td className="py-3 px-4 text-right space-x-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-xs h-7"
                              onClick={() => {
                                setSelectedQuotation({ lead: l, customer: cust });
                                setShowQuotationModal(true);
                              }}
                            >
                              Quote
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- TEST DRIVES TAB ---------------- */}
        {activeTab === 'test_drives' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">Scheduled vehicle test drives with slot collision prevention.</p>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => setShowTestDriveModal(true)}>
                <Plus size={14} className="mr-1" /> Schedule Drive
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Car & VIN</th>
                    <th className="py-2.5 px-4 font-semibold">Date & Slot</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold">Customer Feedback</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {myTestDrives.map((td) => {
                    const cust = data.customers.find((c) => c.id === td.customer_id);
                    const car = data.cars.find((c) => c.id === td.test_drive_car_id || c.id === td.car_id);
                    return (
                      <tr key={td.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium text-foreground">{cust?.name || 'Customer'}</td>
                        <td className="py-3 px-4">
                          <div>{car ? `${car.brand} ${car.model}` : `${td.requested_brand} ${td.requested_model}`}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{car?.vin_chassis_no || 'Showroom Demo'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div>{td.appointment_date ? new Date(td.appointment_date).toLocaleDateString('en-IN') : 'Scheduled'}</div>
                          <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">{td.test_drive_slot || '11:00 AM - 12:00 PM'}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                            {td.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-foreground text-[11px] max-w-xs truncate">
                          {td.test_drive_feedback || 'Pending completion'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {td.status !== 'Completed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs h-7 px-3 font-medium"
                              onClick={() => setShowFeedbackModal(td.id)}
                            >
                              Record Feedback
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- QUOTATIONS TAB ---------------- */}
        {activeTab === 'quotations' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">
                Automated on-road price calculation (GST 28%, RTO 10%, Insurance 3.5%, Accessories). Discounts above ₹25,000 require Manager approval.
              </p>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => setShowQuotationModal(true)}>
                <Plus size={14} className="mr-1" /> New Quotation
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Quote #</th>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Model & Variant</th>
                    <th className="py-2.5 px-4 font-semibold">Ex-Showroom</th>
                    <th className="py-2.5 px-4 font-semibold">Discount</th>
                    <th className="py-2.5 px-4 font-semibold">On-Road Total</th>
                    <th className="py-2.5 px-4 font-semibold">Approval Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {/* Demo or queried quotations */}
                  <tr className="hover:bg-muted/30">
                    <td className="py-3 px-4 font-mono font-semibold text-emerald-400">QT-260101-101</td>
                    <td className="py-3 px-4 font-medium text-foreground">Aarav Sharma</td>
                    <td className="py-3 px-4">BMW 3 Series · 330i M Sport</td>
                    <td className="py-3 px-4 font-mono">{money(7290000)}</td>
                    <td className="py-3 px-4 font-mono text-amber-400">₹20,000</td>
                    <td className="py-3 px-4 font-mono font-bold text-foreground">{money(10287500)}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-800">
                        APPROVED
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={() => {
                          setPrintQuote({
                            quoteNo: 'QT-260101-101',
                            customerName: 'Aarav Sharma',
                            brand: 'BMW',
                            model: '3 Series',
                            variant: '330i M Sport',
                            exShowroom: 7290000,
                            gst: 2041200,
                            rto: 729000,
                            insurance: 255150,
                            accessories: 25000,
                            discount: 20000,
                            onRoad: 10320350,
                          });
                        }}
                      >
                        <Printer size={13} className="mr-1" /> Print
                      </Button>
                      <Button
                        size="sm"
                        className="bg-primary text-primary-foreground hover:bg-primary/90 h-7 text-xs"
                        onClick={() => setShowBookingModal(true)}
                      >
                        Book
                      </Button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- BOOKINGS TAB ---------------- */}
        {activeTab === 'bookings' && (
          <div className="space-y-4">
            <div className="p-3 bg-card border border-border rounded-lg text-xs text-foreground flex items-center gap-2">
              <Truck size={16} className="text-emerald-400 shrink-0" />
              <span>
                <strong>Demand-Driven Procurement:</strong> When booking a car, if branch inventory is available it is instantly reserved. If out of stock, an automated procurement purchase order is immediately triggered for Branch Manager & Owner approval.
              </span>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Booked Car</th>
                    <th className="py-2.5 px-4 font-semibold">Booking Amount</th>
                    <th className="py-2.5 px-4 font-semibold">Stock Allocation</th>
                    <th className="py-2.5 px-4 font-semibold">Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {myBookings.map((b) => {
                    const cust = data.customers.find((c) => c.id === b.customer_id);
                    const car = data.cars.find((c) => c.id === b.car_id);
                    return (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium text-foreground">{cust?.name || 'Customer'}</td>
                        <td className="py-3 px-4">
                          <div>{b.requested_brand} {b.requested_model}</div>
                          <div className="text-[11px] text-muted-foreground">{b.requested_variant}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-400">
                          {money(b.booking_amount || 50000)}
                        </td>
                        <td className="py-3 px-4">
                          {car ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 size={13} /> Reserved ({car.vin_chassis_no})
                            </span>
                          ) : (
                            <span className="text-amber-400 flex items-center gap-1">
                              <Clock size={13} /> Demand-Triggered Procurement
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-800">
                            {b.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="outline" className="text-xs h-7" onClick={() => setShowPaymentModal(true)}>
                            Record Payment
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- PAYMENTS TAB ---------------- */}
        {activeTab === 'payments' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">Record customer collections (Cash, UPI, Cheque, Bank Transfer, Loan) with instant receipts.</p>
              <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs" onClick={() => setShowPaymentModal(true)}>
                <Plus size={14} className="mr-1" /> Record Payment
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Sale / Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Total Sale Price</th>
                    <th className="py-2.5 px-4 font-semibold">Amount Paid</th>
                    <th className="py-2.5 px-4 font-semibold">Outstanding Balance</th>
                    <th className="py-2.5 px-4 font-semibold">Payment Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {mySales.map((s) => {
                    const cust = data.customers.find((c) => c.id === s.customer_id);
                    const car = data.cars.find((c) => c.id === s.car_id);
                    const outstanding = Number(s.sale_amount) - Number(s.amount_paid);
                    return (
                      <tr key={s.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div>{cust?.name || 'Customer'}</div>
                          <div className="text-[11px] text-muted-foreground">{car ? `${car.brand} ${car.model}` : 'Vehicle'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold">{money(s.sale_amount)}</td>
                        <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400">{money(s.amount_paid)}</td>
                        <td className="py-3 px-4 font-mono text-amber-600 dark:text-amber-400">{money(outstanding)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            outstanding === 0
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                          }`}>
                            {outstanding === 0 ? 'PAID IN FULL' : 'PARTIAL'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="outline" className="rounded-full text-xs h-7 px-3.5 font-medium" onClick={() => setShowPaymentModal(true)}>
                            Collect Balance
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- DELIVERY CHECKLIST TAB ---------------- */}
        {activeTab === 'deliveries' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">Pre-delivery checklist: Documents verified, RTO registration, insurance policy, and customer handover.</p>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer & Car</th>
                    <th className="py-2.5 px-4 font-semibold">Docs Verified</th>
                    <th className="py-2.5 px-4 font-semibold">RTO Registration</th>
                    <th className="py-2.5 px-4 font-semibold">Insurance Policy</th>
                    <th className="py-2.5 px-4 font-semibold">Delivery Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Checklist Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {mySales.map((s) => {
                    const cust = data.customers.find((c) => c.id === s.customer_id);
                    const car = data.cars.find((c) => c.id === s.car_id);
                    return (
                      <tr key={s.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium text-foreground">
                          <div>{cust?.name || 'Customer'}</div>
                          <div className="text-[11px] text-muted-foreground">{car ? `${car.brand} ${car.model} (${car.vin_chassis_no})` : 'Car'}</div>
                        </td>
                        <td className="py-3 px-4">
                          {s.documents_verified ? (
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                              <Check size={13} /> Verified
                            </span>
                          ) : (
                            <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                              <AlertCircle size={13} /> Pending Docs
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div>{s.registration_status || 'PENDING'}</div>
                          <div className="text-[11px] font-mono text-muted-foreground">{s.rto_number || 'RTO receipt awaited'}</div>
                        </td>
                        <td className="py-3 px-4 font-mono text-[11px]">
                          {s.insurance_policy_number || 'Awaiting issuance'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            s.delivery_status === 'DELIVERED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
                          }`}>
                            {s.delivery_status || 'SCHEDULED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button size="sm" variant="outline" className="rounded-full text-xs h-7 px-3.5 font-medium" onClick={() => setShowDeliveryModal(true)}>
                            Update Checklist
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- MODALS & POPUPS ---------------- */}

        {/* Add Customer Modal */}
        {showCustomerModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Add Customer</h3>
                <button onClick={() => setShowCustomerModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await saveCustomerFn({
                      data: {
                        name: String(fd.get('name')),
                        phone: String(fd.get('phone')),
                        email: String(fd.get('email')),
                        city: String(fd.get('city')),
                        address: String(fd.get('address')),
                        idProofType: String(fd.get('idProofType')),
                        idProofNumber: String(fd.get('idProofNumber')),
                      },
                    });
                    toast.success('Customer profile saved successfully!');
                    setShowCustomerModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to save customer');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Customer Full Name *</label>
                  <input name="name" required className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Phone Number *</label>
                    <input name="phone" required placeholder="9876543210" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Email *</label>
                    <input name="email" type="email" required placeholder="client@example.com" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">City</label>
                    <input name="city" defaultValue={branch?.city || 'Mumbai'} className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">ID Proof Type</label>
                    <select name="idProofType" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option>Aadhaar Card</option>
                      <option>PAN Card</option>
                      <option>Passport</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">ID Proof Number</label>
                  <input name="idProofNumber" placeholder="XXXX-XXXX-XXXX" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Residential Address</label>
                  <input name="address" placeholder="Flat No, Street, Landmark" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Saving...' : 'Create Customer Record'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* New Lead Modal */}
        {showLeadModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4 pb-2 border-b border-border">
                <div>
                  <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">Lead Generation</span>
                  <h3 className="text-base font-semibold text-foreground">Create New Lead</h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowLeadModal(false);
                    setLeadPhone('');
                    setLeadEmail('');
                    setLeadName('');
                  }}
                  className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <X size={16} />
                </button>
              </div>

              {matchedExistingCustomer && (
                <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                  <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Existing customer found: {matchedExistingCustomer.name}</p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Phone: {matchedExistingCustomer.phone} {matchedExistingCustomer.email ? `· ${matchedExistingCustomer.email}` : ''}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      This lead will be linked directly to their existing profile without creating a duplicate record.
                    </p>
                  </div>
                </div>
              )}

              <form
                className="space-y-3.5 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  const phoneVal = leadPhone.trim();
                  const cleanPhone = phoneVal.replace(/\D/g, '');
                  if (cleanPhone.length < 10) {
                    toast.error('Please enter a valid 10-digit Indian phone number (e.g. 9876543210)');
                    setBusy(false);
                    return;
                  }

                  try {
                    const res = await createEmployeeLeadFn({
                      data: {
                        customerName: matchedExistingCustomer ? matchedExistingCustomer.name : (leadName || String(fd.get('customerName'))),
                        phone: phoneVal,
                        email: String(fd.get('email') || ''),
                        preferredModel: String(fd.get('preferredModel')),
                        preferredVariant: String(fd.get('preferredVariant') || ''),
                        preferredColor: String(fd.get('preferredColor') || ''),
                        maximumBudget: fd.get('maximumBudget') ? Number(fd.get('maximumBudget')) : undefined,
                        expectedTimeline: String(fd.get('expectedTimeline') || 'Within 1 month'),
                        leadSource: String(fd.get('leadSource') || 'Walk-in'),
                        notes: String(fd.get('notes') || ''),
                        followUpDate: String(fd.get('followUpDate') || ''),
                      },
                    });

                    toast.success(
                      res.isExistingCustomer
                        ? `Lead linked to existing customer ${res.customerName}!`
                        : `New lead created for ${res.customerName}!`
                    );
                    setShowLeadModal(false);
                    setLeadPhone('');
                    setLeadEmail('');
                    setLeadName('');
                    refresh();
                    setActiveTab('leads');
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to create lead');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {/* Customer Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Customer Full Name *</label>
                    <input
                      name="customerName"
                      required
                      placeholder="e.g. Rajesh Kumar"
                      value={matchedExistingCustomer ? matchedExistingCustomer.name : leadName}
                      onChange={(e) => setLeadName(e.target.value)}
                      readOnly={!!matchedExistingCustomer}
                      className={`w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground ${matchedExistingCustomer ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Phone Number (10 Digits) *</label>
                    <input
                      name="phone"
                      type="tel"
                      required
                      placeholder="e.g. 9876543210"
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Email Address (Optional)</label>
                    <input
                      name="email"
                      type="email"
                      placeholder="e.g. customer@example.com"
                      value={matchedExistingCustomer?.email || leadEmail}
                      onChange={(e) => setLeadEmail(e.target.value)}
                      readOnly={!!matchedExistingCustomer && !!matchedExistingCustomer.email}
                      className={`w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground ${matchedExistingCustomer?.email ? 'opacity-70 bg-muted cursor-not-allowed' : ''}`}
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Lead Source *</label>
                    <select
                      name="leadSource"
                      required
                      defaultValue="Walk-in"
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground"
                    >
                      <option value="Walk-in">Walk-in Showroom</option>
                      <option value="Phone Enquiry">Phone Enquiry</option>
                      <option value="Website">Website / Digital</option>
                      <option value="Referral">Customer Referral</option>
                      <option value="Social Media">Social Media Campaign</option>
                    </select>
                  </div>
                </div>

                {/* Vehicle Preference */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Preferred Model *</label>
                    <select
                      name="preferredModel"
                      required
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground"
                    >
                      {availableCatalogueModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Preferred Variant</label>
                    <input
                      name="preferredVariant"
                      placeholder="e.g. SX (O) AT / Top"
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground"
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Preferred Color</label>
                    <input
                      name="preferredColor"
                      placeholder="e.g. Polar White"
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground"
                    />
                  </div>
                </div>

                {/* Budget & Timeline */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Maximum Budget (₹ INR)</label>
                    <input
                      name="maximumBudget"
                      type="number"
                      placeholder="e.g. 1800000"
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-muted-foreground block mb-1 font-medium">Purchase Timeline</label>
                    <select
                      name="expectedTimeline"
                      defaultValue="Within 1 month"
                      className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground"
                    >
                      <option value="Immediate">Immediate (Within 1 week)</option>
                      <option value="Within 1 month">Within 1 month</option>
                      <option value="1-3 months">1 to 3 months</option>
                      <option value="Just researching">Just researching / Casual</option>
                    </select>
                  </div>
                </div>

                {/* Follow-up Date */}
                <div>
                  <label className="text-muted-foreground block mb-1 font-medium">Next Follow-up Date *</label>
                  <input
                    name="followUpDate"
                    type="date"
                    required
                    defaultValue={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                    className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground"
                  />
                </div>

                {/* Notes */}
                <div>
                  <label className="text-muted-foreground block mb-1 font-medium">Customer Requirements / Notes</label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Key requirements, exchange vehicle details, financing interest..."
                    className="w-full bg-secondary border border-border rounded-xl p-2.5 text-foreground resize-none"
                  />
                </div>

                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={busy}
                    className="w-full rounded-full py-2.5 bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-all shadow-xs"
                  >
                    {busy ? 'Creating Lead...' : 'Create Lead & Assign to Me'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Quotation Modal */}
        {showQuotationModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-lg w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Create Quotation</h3>
                <button onClick={() => setShowQuotationModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    const res = await generateQuotationFn({
                      data: {
                        customerId: String(fd.get('customerId')),
                        brand: String(fd.get('brand')),
                        model: String(fd.get('model')),
                        variant: String(fd.get('variant')),
                        color: String(fd.get('color')),
                        exShowroomPrice: Number(fd.get('exShowroomPrice')),
                        accessoriesAmount: Number(fd.get('accessoriesAmount') || 0),
                        discountAmount: Number(fd.get('discountAmount') || 0),
                        discountRemarks: String(fd.get('discountRemarks') || ''),
                      },
                    });
                    toast.success(res.message);
                    setShowQuotationModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to create quotation');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Select Customer *</label>
                  <select name="customerId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {data.customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || c.email})</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Brand *</label>
                    <select name="brand" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option>BMW</option>
                      <option>Mercedes-Benz</option>
                      <option>Audi</option>
                      <option>Toyota</option>
                      <option>Hyundai</option>
                      <option>Tata</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Model *</label>
                    <input name="model" required defaultValue="3 Series" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Variant *</label>
                    <input name="variant" required defaultValue="330i M Sport" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Preferred Colour</label>
                    <input name="color" defaultValue="Alpine White" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Ex-Showroom Price (₹) *</label>
                    <input name="exShowroomPrice" type="number" required defaultValue={7290000} className="w-full bg-secondary border border-border rounded p-2 text-foreground font-mono" />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Accessories (₹)</label>
                    <input name="accessoriesAmount" type="number" defaultValue={25000} className="w-full bg-secondary border border-border rounded p-2 text-foreground font-mono" />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-muted-foreground block">Offered Discount (₹)</label>
                    <span className="text-[11px] text-amber-400">Limit: ₹25,000 (Approval required if above)</span>
                  </div>
                  <input name="discountAmount" type="number" defaultValue={20000} className="w-full bg-secondary border border-border rounded p-2 text-foreground font-mono" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Discount Remarks</label>
                  <input name="discountRemarks" placeholder="Festival special discount" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Calculating...' : 'Generate Quotation'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Printable Quotation View */}
        {printQuote && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-card text-card-foreground rounded-2xl p-8 max-w-xl w-full shadow-2xl border border-border print:m-0 print:p-0 print:w-full print:border-none">
              <div className="flex justify-between items-start border-b border-border pb-4 mb-4">
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">CDMS MOTOR DEALERSHIP</h2>
                  <p className="text-xs text-muted-foreground">{branch?.branch_name} · GSTIN: 27AABCC1234D1Z2</p>
                  <p className="text-xs text-muted-foreground">{branch?.address}, {branch?.city}</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">{printQuote.quoteNo}</span>
                  <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString('en-IN')}</p>
                </div>
              </div>

              <div className="mb-4 text-xs">
                <span className="text-muted-foreground">Customer:</span>
                <p className="font-bold text-sm text-foreground">{printQuote.customerName}</p>
                <p className="text-muted-foreground">Vehicle: {printQuote.brand} {printQuote.model} ({printQuote.variant})</p>
              </div>

              <table className="w-full text-xs mb-6 border border-border">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border font-semibold">
                  <tr>
                    <th className="py-2 px-3 text-left">Particulars</th>
                    <th className="py-2 px-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  <tr>
                    <td className="py-2 px-3">Ex-Showroom Price</td>
                    <td className="py-2 px-3 text-right font-mono">{money(printQuote.exShowroom)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">GST (28%)</td>
                    <td className="py-2 px-3 text-right font-mono">{money(printQuote.gst)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">RTO Road Tax & Registration (10%)</td>
                    <td className="py-2 px-3 text-right font-mono">{money(printQuote.rto)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Comprehensive Insurance (1 Year + 3 Year TP)</td>
                    <td className="py-2 px-3 text-right font-mono">{money(printQuote.insurance)}</td>
                  </tr>
                  <tr>
                    <td className="py-2 px-3">Dealership Accessories Package</td>
                    <td className="py-2 px-3 text-right font-mono">{money(printQuote.accessories)}</td>
                  </tr>
                  <tr className="text-emerald-600 dark:text-emerald-400">
                    <td className="py-2 px-3">Special Customer Discount</td>
                    <td className="py-2 px-3 text-right font-mono font-bold">- {money(printQuote.discount)}</td>
                  </tr>
                  <tr className="bg-muted/60 font-bold text-foreground border-t-2 border-border">
                    <td className="py-2 px-3">Total On-Road Price</td>
                    <td className="py-2 px-3 text-right font-mono text-sm">{money(printQuote.onRoad)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-between items-center pt-4 border-t border-border print:hidden">
                <Button variant="outline" size="sm" onClick={() => setPrintQuote(null)}>
                  Close
                </Button>
                <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-foreground" onClick={() => window.print()}>
                  <Printer size={14} className="mr-1" /> Print Quotation
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Schedule Test Drive Modal */}
        {showTestDriveModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Book Test Drive</h3>
                <button onClick={() => setShowTestDriveModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await bookTestDriveFn({
                      data: {
                        customerId: String(fd.get('customerId')),
                        carId: String(fd.get('carId')),
                        appointmentDate: String(fd.get('appointmentDate')),
                        slotTime: String(fd.get('slotTime')),
                        remarks: String(fd.get('remarks') || ''),
                      },
                    });
                    toast.success('Test drive booked without slot collision!');
                    setShowTestDriveModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to book test drive');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Customer *</label>
                  <select name="customerId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {data.customers.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Select Available Vehicle *</label>
                  <select name="carId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {branchCars.map((c) => (
                      <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.variant}) · {c.color}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Date *</label>
                    <input
                      name="appointmentDate"
                      type="date"
                      required
                      min={new Date().toISOString().slice(0, 10)}
                      defaultValue={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                      className="w-full bg-secondary border border-border rounded p-2 text-foreground"
                    />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Time Slot *</label>
                    <select name="slotTime" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option>10:00 AM - 11:00 AM</option>
                      <option>11:30 AM - 12:30 PM</option>
                      <option>02:00 PM - 03:00 PM</option>
                      <option>03:30 PM - 04:30 PM</option>
                      <option>05:00 PM - 06:00 PM</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Special Instructions / Route</label>
                  <input name="remarks" placeholder="Highway test drive requested" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Booking...' : 'Confirm Slot & Reserve Drive'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Record Test Drive Feedback Modal */}
        {showFeedbackModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Test Drive Feedback</h3>
                <button onClick={() => setShowFeedbackModal(null)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await recordFeedbackFn({
                      data: {
                        enquiryId: showFeedbackModal,
                        feedback: String(fd.get('feedback')),
                        nextStage: String(fd.get('nextStage')) as any,
                      },
                    });
                    toast.success('Test drive feedback recorded!');
                    setShowFeedbackModal(null);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to record feedback');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Customer Experience & Comments *</label>
                  <textarea
                    name="feedback"
                    required
                    rows={3}
                    placeholder="Customer liked suspension and acceleration; interested in pricing"
                    className="w-full bg-secondary border border-border rounded p-2 text-foreground"
                  />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Lead Progression *</label>
                  <select name="nextStage" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    <option value="QUOTED">Proceed to Quotation (Interested)</option>
                    <option value="CLOSED_LOST">Lost (Not interested in vehicle)</option>
                  </select>
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Saving...' : 'Complete Test Drive'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Convert Quotation to Booking Modal */}
        {showBookingModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Confirm Booking</h3>
                <button onClick={() => setShowBookingModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    const res = await convertBookingFn({
                      data: {
                        quotationId: '60000000-0000-0000-0000-000000000001', // Example or linked
                        bookingAmount: Number(fd.get('bookingAmount')),
                        paymentMethod: String(fd.get('paymentMethod')) as any,
                        transactionRef: String(fd.get('transactionRef') || ''),
                        remarks: String(fd.get('remarks') || ''),
                      },
                    });
                    toast.success(res.message);
                    setShowBookingModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to complete booking');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Booking Token Amount (₹) *</label>
                  <input name="bookingAmount" type="number" required defaultValue={50000} className="w-full bg-secondary border border-border rounded p-2 text-foreground font-mono" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Payment Method *</label>
                  <select name="paymentMethod" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    <option value="upi">UPI (GPay / PhonePe / BHIM)</option>
                    <option value="bank_transfer">NEFT / RTGS</option>
                    <option value="cheque">Cheque</option>
                    <option value="loan">Finance / Loan Down Payment</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Transaction Ref / Cheque No.</label>
                  <input name="transactionRef" placeholder="UPI Ref / Cheque No. 123456" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <div className="p-2.5 bg-muted/70 rounded border border-border text-[11px] text-foreground">
                  Notice: If stock car is Available, it is reserved immediately. If out of stock, a factory procurement request will automatically be created.
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Processing Booking...' : 'Confirm Booking & Receipt'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Record Payment Transaction Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Record Payment</h3>
                <button onClick={() => setShowPaymentModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    const res = await recordPaymentFn({
                      data: {
                        saleId: String(fd.get('saleId')),
                        amount: Number(fd.get('amount')),
                        paymentType: String(fd.get('paymentType')) as any,
                        paymentMethod: String(fd.get('paymentMethod')) as any,
                        transactionRef: String(fd.get('transactionRef') || ''),
                        remarks: String(fd.get('remarks') || ''),
                      },
                    });
                    toast.success(`Payment recorded! Receipt: ${res.receiptNo}`);
                    setShowPaymentModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to record payment');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Select Customer Sale *</label>
                  <select name="saleId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {mySales.map((s) => {
                      const cust = data.customers.find((c) => c.id === s.customer_id);
                      return (
                        <option key={s.id} value={s.id}>
                          {cust?.name} · Due: {money(Number(s.sale_amount) - Number(s.amount_paid))}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Payment Type</label>
                    <select name="paymentType" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option value="DOWN_PAYMENT">Down Payment</option>
                      <option value="BALANCE">Balance Payment</option>
                      <option value="BOOKING">Booking Advance</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Payment Mode</label>
                    <select name="paymentMethod" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option value="upi">UPI</option>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="cheque">Cheque</option>
                      <option value="loan">Auto Loan</option>
                      <option value="cash">Cash</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Amount Paid (₹) *</label>
                  <input name="amount" type="number" required defaultValue={100000} className="w-full bg-secondary border border-border rounded p-2 text-foreground font-mono" />
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Transaction Ref</label>
                  <input name="transactionRef" placeholder="Bank ref / UTR / Cheque number" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Recording...' : 'Generate Official Payment Receipt'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Update Delivery Checklist Modal */}
        {showDeliveryModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Update Delivery Checklist</h3>
                <button onClick={() => setShowDeliveryModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-3 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await updateDeliveryFn({
                      data: {
                        saleId: String(fd.get('saleId')),
                        registrationStatus: String(fd.get('registrationStatus')) as any,
                        rtoNumber: String(fd.get('rtoNumber') || ''),
                        insurancePolicyNumber: String(fd.get('insurancePolicyNumber') || ''),
                        documentsVerified: fd.get('documentsVerified') === 'on',
                        handoverDate: String(fd.get('handoverDate') || ''),
                        deliveryStatus: String(fd.get('deliveryStatus')) as any,
                      },
                    });
                    toast.success('Delivery checklist updated!');
                    setShowDeliveryModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message || 'Failed to update delivery');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Select Sale Customer *</label>
                  <select name="saleId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {mySales.map((s) => {
                      const cust = data.customers.find((c) => c.id === s.customer_id);
                      return <option key={s.id} value={s.id}>{cust?.name}</option>;
                    })}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">RTO Status</label>
                    <select name="registrationStatus" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option value="PENDING">PENDING</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">RTO Vehicle Reg No.</label>
                    <input name="rtoNumber" placeholder="MH 02 XX 1234" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                </div>
                <div>
                  <label className="text-muted-foreground block mb-1">Insurance Policy Number</label>
                  <input name="insurancePolicyNumber" placeholder="POL-ICICI-987654" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-muted-foreground block mb-1">Handover Date</label>
                    <input name="handoverDate" type="date" className="w-full bg-secondary border border-border rounded p-2 text-foreground" />
                  </div>
                  <div>
                    <label className="text-muted-foreground block mb-1">Delivery Status</label>
                    <select name="deliveryStatus" className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                      <option value="SCHEDULED">SCHEDULED</option>
                      <option value="READY">READY FOR HANDOVER</option>
                      <option value="DELIVERED">DELIVERED TO CUSTOMER</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <input type="checkbox" name="documentsVerified" id="docVer" defaultChecked className="rounded border-border" />
                  <label htmlFor="docVer" className="text-foreground">All customer KYC & invoices verified</label>
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2">
                  {busy ? 'Saving...' : 'Save Delivery Status'}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
