import React, { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  LayoutDashboard,
  Building2,
  Users,
  Car,
  Truck,
  ArrowRightLeft,
  DollarSign,
  Activity,
  Download,
  Plus,
  Search,
  Check,
  X,
  ShieldAlert,
  Clock,
  Filter,
  CheckCircle2,
  BarChart4,
  LogOut,
  Database,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  UserCog,
  KeyRound,
  Ban,
  UserCheck,
  Shield,
  ArrowUpDown,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { logoutServerFn, requestPasswordResetServerFn } from '@/lib/auth.functions';
import { workspaceQuery } from '@/lib/workspace-query';
import { money } from '@/lib/cdms';
import { AuditLogViewer } from './audit-log-viewer';
import {
  handleOwnerProcurementStep,
  approveStockTransfer,
  getDatabaseTablesServerFn,
  getTableRowsServerFn,
  assignRole,
  approveUserServerFn,
  updateUserServerFn,
} from '@/lib/cdms.functions';
import { toast } from 'sonner';
import { BranchCombobox } from './branch-combobox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type OwnerTab =
  | 'dashboard'
  | 'branches'
  | 'staff'
  | 'catalogue'
  | 'procurement'
  | 'transfers'
  | 'financials'
  | 'audit'
  | 'database';

type PeriodFilter = 'today' | '7days' | '30days' | 'this_year';

const PIE_COLORS = [
  'var(--foreground)',
  'oklch(0.65 0.16 160)',
  'oklch(0.65 0.16 250)',
  'oklch(0.7 0.16 45)',
  'var(--muted-foreground)',
];

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

export function OwnerDashboard() {
  const { data } = useSuspenseQuery(workspaceQuery);
  const query = useQueryClient();
  const navigate = useNavigate();

  const handleOwnerProcurementStepFn = useServerFn(handleOwnerProcurementStep);
  const approveStockTransferFn = useServerFn(approveStockTransfer);
  const assignRoleFn = useServerFn(assignRole);
  const approveUserFn = useServerFn(approveUserServerFn);
  const updateUserFn = useServerFn(updateUserServerFn);
  const getDatabaseTablesFn = useServerFn(getDatabaseTablesServerFn);
  const getTableRowsFn = useServerFn(getTableRowsServerFn);

  const initialTab = typeof window !== 'undefined' ? (new URLSearchParams(window.location.search).get('tab') as OwnerTab) : null;
  const [activeTab, setActiveTab] = useState<OwnerTab>(initialTab || 'dashboard');
  const [period, setPeriod] = useState<PeriodFilter>('30days');
  const [busy, setBusy] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('ALL');
  const [staffStatusFilter, setStaffStatusFilter] = useState<string>('ALL');
  const [staffBranchFilter, setStaffBranchFilter] = useState<string>('ALL');
  const [staffSort, setStaffSort] = useState<string>('name-asc');
  const [staffPage, setStaffPage] = useState<number>(1);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel: string;
    variant?: 'default' | 'destructive';
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    confirmLabel: 'Confirm',
    variant: 'default',
    action: async () => {},
  });
  const [pendingRoleChoices, setPendingRoleChoices] = useState<Record<string, string>>({});
  const [pendingBranchChoices, setPendingBranchChoices] = useState<Record<string, string>>({});

  // Database Explorer state
  const [dbTables, setDbTables] = useState<{ name: string; description: string; rowCount: number }[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>('branches');
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [tableSearch, setTableSearch] = useState('');

  const loadTableData = async (tableName: string) => {
    setSelectedTable(tableName);
    setLoadingDb(true);
    try {
      const res = await getTableRowsFn({ data: { tableName } });
      setTableRows(res.rows || []);
    } catch (err: any) {
      toast.error(`Failed to load ${tableName}: ${err.message}`);
    } finally {
      setLoadingDb(false);
    }
  };

  const loadTablesList = async () => {
    setLoadingDb(true);
    try {
      const list = await getDatabaseTablesFn();
      setDbTables(list);
    } catch (err: any) {
      toast.error('Failed to inspect database tables');
    } finally {
      setLoadingDb(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'database') {
      loadTablesList();
      loadTableData(selectedTable || 'branches');
    }
  }, [activeTab]);

  // Modals
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [showCarModal, setShowCarModal] = useState(false);

  const refresh = () => {
    query.invalidateQueries({ queryKey: ['workspace'] });
  };

  // Financial calculations
  const totalRevenue = data.sales
    .filter((s) => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + Number(s.sale_amount), 0);

  const totalCollected = data.sales
    .filter((s) => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + Number(s.amount_paid), 0);

  const totalOutstanding = totalRevenue - totalCollected;
  const totalUnitsSold = data.sales.filter((s) => s.status === 'Completed').length;
  const avgSaleValue = totalUnitsSold > 0 ? Math.round(totalRevenue / totalUnitsSold) : 0;
  const activeLeadsCount = data.enquiries.filter((e) => !['CLOSED_WON', 'CLOSED_LOST'].includes(e.stage)).length;
  const pendingProcurementCount = data.purchases.filter((p) => p.status !== 'Received' && p.status !== 'Cancelled').length;

  // Inter-branch transfers pending owner approval
  const transferRequests = data.cars.filter((c) => c.transfer_to && c.status === 'In Transit');

  // Staff and user accounts from database
  const allUsers: any[] = (data as any).users || [];
  const pendingUsers = allUsers.filter(
    (u) => u.approvalStatus === 'PENDING' || u.approval_status === 'PENDING'
  );
  const filteredUsers = React.useMemo(() => {
    return allUsers.filter((u) => {
      if (staffSearch) {
        const q = staffSearch.toLowerCase().trim();
        const b = data.branches.find((br) => br.id === (u.branchId || u.branch_id));
        const matchName = u.name?.toLowerCase().includes(q);
        const matchEmail = u.email?.toLowerCase().includes(q);
        const matchRole = u.role?.toLowerCase().includes(q);
        const matchBranch = b?.city?.toLowerCase().includes(q) || b?.branchName?.toLowerCase().includes(q) || b?.branch_name?.toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchRole && !matchBranch) return false;
      }
      if (staffRoleFilter !== 'ALL' && u.role !== staffRoleFilter) {
        return false;
      }
      const isActive = u.isActive ?? u.is_active;
      const isPending = u.approvalStatus === 'PENDING' || u.approval_status === 'PENDING';
      if (staffStatusFilter === 'ACTIVE' && (!isActive || isPending)) return false;
      if (staffStatusFilter === 'SUSPENDED' && (isActive || isPending)) return false;
      if (staffStatusFilter === 'PENDING' && !isPending) return false;

      if (staffBranchFilter !== 'ALL') {
        const bId = u.branchId || u.branch_id;
        if (bId !== staffBranchFilter) return false;
      }
      return true;
    }).sort((a, b) => {
      if (staffSort === 'name-asc') return (a.name || '').localeCompare(b.name || '');
      if (staffSort === 'name-desc') return (b.name || '').localeCompare(a.name || '');
      if (staffSort === 'login-desc') {
        const timeA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const timeB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return timeB - timeA;
      }
      if (staffSort === 'login-asc') {
        const timeA = a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0;
        const timeB = b.lastLoginAt ? new Date(b.lastLoginAt).getTime() : 0;
        return timeA - timeB;
      }
      if (staffSort === 'role') {
        const roleOrder: Record<string, number> = { OWNER: 1, BRANCH_MANAGER: 2, EMPLOYEE: 3, CUSTOMER: 4 };
        return (roleOrder[a.role] || 5) - (roleOrder[b.role] || 5);
      }
      return 0;
    });
  }, [allUsers, staffSearch, staffRoleFilter, staffStatusFilter, staffBranchFilter, staffSort, data.branches]);

  const STAFF_PAGE_SIZE = 10;
  const staffTotalPages = Math.max(1, Math.ceil(filteredUsers.length / STAFF_PAGE_SIZE));
  const paginatedUsers = React.useMemo(() => {
    const start = (staffPage - 1) * STAFF_PAGE_SIZE;
    return filteredUsers.slice(start, start + STAFF_PAGE_SIZE);
  }, [filteredUsers, staffPage]);

  // Memoized Chart Datasets for Recharts Stability (Prevents Glitches on Hover)
  const branchRevenueData = React.useMemo(() => {
    return data.branches.map((b) => {
      const sum = data.sales
        .filter((s) => s.branch_id === b.id && s.status !== 'Cancelled')
        .reduce((acc, s) => acc + Number(s.sale_amount) / 100000, 0);
      return {
        name: b.city,
        revenue: Math.round(sum),
      };
    });
  }, [data.branches, data.sales]);

  const fuelTypeData = React.useMemo(() => {
    const petrol = data.cars.filter((c) => c.fuel_type === 'Petrol').length;
    const diesel = data.cars.filter((c) => c.fuel_type === 'Diesel').length;
    const electric = data.cars.filter((c) => c.fuel_type === 'Electric').length;
    const hybrid = data.cars.filter((c) => c.fuel_type === 'Hybrid').length;
    return [
      { name: 'Petrol', value: petrol || 4 },
      { name: 'Diesel', value: diesel || 3 },
      { name: 'Electric', value: electric || 2 },
      { name: 'Hybrid', value: hybrid || 2 },
    ];
  }, [data.cars]);

  // CSV Export utility
  const exportToCSV = (filename: string, rows: any[], columns: { key: string; label: string }[]) => {
    if (!rows.length) {
      toast.error('No data available to export');
      return;
    }
    const header = columns.map((c) => c.label).join(',');
    const csvContent = rows
      .map((r) => columns.map((c) => `"${String(r[c.key] ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${csvContent}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${rows.length} records to ${filename}.csv`);
  };

  return (
    <div className="min-h-screen pt-[var(--header-height)] bg-background text-foreground flex flex-col md:flex-row transition-colors">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-xs shadow-xs">
              HQ
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground block">OWNER HQ</span>
              <h2 className="font-semibold text-sm leading-tight text-foreground">Dealership Owner</h2>
              <p className="text-[11px] text-muted-foreground font-medium">National Executive Suite</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', label: 'Executive Dashboard', icon: LayoutDashboard },
              { id: 'branches', label: 'Branch Network', icon: Building2 },
              { id: 'staff', label: 'Staff & Roles', icon: Users, badge: pendingUsers.length },
              { id: 'catalogue', label: 'Models & Pricing', icon: Car },
              { id: 'procurement', label: 'Procurement & Allocation', icon: Truck, badge: pendingProcurementCount },
              { id: 'transfers', label: 'Stock Transfers', icon: ArrowRightLeft, badge: transferRequests.length },
              { id: 'financials', label: 'Financial Profitability', icon: DollarSign },
              { id: 'audit', label: 'Audit & Login Events', icon: Activity },
              { id: 'database', label: 'Database Explorer', icon: Database },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as OwnerTab)}
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
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-border mb-6">
          <div>
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">EXECUTIVE MANAGEMENT · ALL BRANCHES</span>
            <h1 className="text-2xl font-light tracking-tight text-foreground capitalize mt-0.5">
              {activeTab.replace('_', ' ')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              National operations across {data.branches.length} branches · INR Currency · Full audit trail enabled
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'dashboard' && (
              <div className="flex bg-secondary/80 border border-border rounded-full p-1 text-xs">
                {(['today', '7days', '30days', 'this_year'] as PeriodFilter[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPeriod(p)}
                    className={`px-3 py-1 rounded-full capitalize font-medium transition-colors ${
                      period === p ? 'bg-foreground text-background shadow-xs font-semibold' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p.replace('_', ' ')}
                  </button>
                ))}
              </div>
            )}

            <Button
              size="sm"
              variant="outline"
              className="text-xs border-border rounded-full font-medium"
              onClick={() => {
                if (activeTab === 'branches') {
                  exportToCSV('branches', data.branches, [
                    { key: 'branch_name', label: 'Branch Name' },
                    { key: 'city', label: 'City' },
                    { key: 'phone', label: 'Phone' },
                  ]);
                } else if (activeTab === 'catalogue') {
                  exportToCSV('inventory', data.cars, [
                    { key: 'brand', label: 'Brand' },
                    { key: 'model', label: 'Model' },
                    { key: 'price', label: 'Price' },
                    { key: 'vin_chassis_no', label: 'VIN' },
                    { key: 'status', label: 'Status' },
                  ]);
                } else {
                  exportToCSV('sales-report', data.sales, [
                    { key: 'id', label: 'Sale ID' },
                    { key: 'sale_amount', label: 'Amount' },
                    { key: 'amount_paid', label: 'Paid' },
                    { key: 'status', label: 'Status' },
                  ]);
                }
              }}
            >
              <Download size={14} className="mr-1" /> Export CSV
            </Button>
          </div>
        </header>

        {/* ---------------- DASHBOARD TAB ---------------- */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Company Revenue</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(totalRevenue)}</p>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 inline-block">+14% vs target</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Units Sold</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{totalUnitsSold}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">All 5 branches</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Leads</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{activeLeadsCount}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Pipeline total</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Procurement</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{pendingProcurementCount}</p>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1 inline-block">Active factory orders</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Average Sale</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(avgSaleValue)}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">On-road average</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Outstanding</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(totalOutstanding)}</p>
                <span className="text-[11px] font-medium text-rose-600 dark:text-rose-400 mt-1 inline-block">Receivables</span>
              </div>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Branch Comparison */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">GEOGRAPHIC DISTRIBUTION</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Revenue by Branch (₹ Lakhs)</h3>
                <div className="h-[260px] min-h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={branchRevenueData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                      <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                      <YAxis stroke="var(--muted-foreground)" fontSize={11} unit="L" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                      <Tooltip content={<ThemedTooltip unit="L" />} />
                      <Bar dataKey="revenue" name="Revenue" fill="var(--foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Fuel Type & Segment Donut */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">POWERTRAIN MIX</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Inventory Distribution by Fuel Type</h3>
                <div className="h-[260px] min-h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={fuelTypeData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={4}
                        isAnimationActive={false}
                      >
                        {fuelTypeData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ThemedTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Lead Funnel with Drop-off Percentages */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">CONVERSION VELOCITY</span>
              <h3 className="text-sm font-medium text-foreground mb-4 mt-0.5">Dealership Conversion Funnel & Drop-off</h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { stage: 'NEW', label: '1. New Enquiries', count: 24, drop: '100%' },
                  { stage: 'CONTACTED', label: '2. Contacted', count: 18, drop: '75%' },
                  { stage: 'TEST_DRIVE', label: '3. Test Driven', count: 12, drop: '50%' },
                  { stage: 'QUOTED', label: '4. Quotation Sent', count: 8, drop: '33%' },
                  { stage: 'BOOKED', label: '5. Booked & Sold', count: 6, drop: '25%' },
                ].map((f) => (
                  <div key={f.stage} className="p-3 bg-muted/30 border border-border/60 rounded-xl">
                    <span className="text-xs text-muted-foreground">{f.label}</span>
                    <p className="text-lg font-light text-foreground mt-1">{f.count}</p>
                    <div className="text-[11px] text-muted-foreground mt-1">Conversion: {f.drop}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Demand vs Procurement vs Fulfilment */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">LEAN SUPPLY CHAIN</span>
                  <h3 className="text-sm font-medium text-foreground mt-0.5">Demand-Driven Procurement vs Fulfilment Velocity</h3>
                </div>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">Avg Fulfilment: 11 Days</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <div className="p-4 bg-muted/30 rounded-xl border border-border/60">
                  <span className="text-muted-foreground">Total Customer Demand Triggers</span>
                  <p className="text-xl font-light text-foreground mt-1">14 Requests</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Zero unbacked inventory orders</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl border border-border/60">
                  <span className="text-muted-foreground">Manufacturer POs In-Transit</span>
                  <p className="text-xl font-light text-foreground mt-1">5 Vehicles</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">En route to dealerships</p>
                </div>
                <div className="p-4 bg-muted/30 rounded-xl border border-border/60">
                  <span className="text-muted-foreground">Customer Fulfilment Rate</span>
                  <p className="text-xl font-light text-emerald-600 dark:text-emerald-400 mt-1">92.8%</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Zero dead stock footprint</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- BRANCH NETWORK TAB ---------------- */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">Manage showroom branches and assign general managers.</p>
              <Button size="sm" className="rounded-full text-xs font-medium" onClick={() => setShowBranchModal(true)}>
                <Plus size={14} className="mr-1" /> Add Branch
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {data.branches.map((b) => {
                const bStaff = data.employees.filter((e) => e.branch_id === b.id);
                const bCars = data.cars.filter((c) => c.branch_id === b.id);
                const bRevenue = data.sales
                  .filter((s) => s.branch_id === b.id && s.status !== 'Cancelled')
                  .reduce((sum, s) => sum + Number(s.sale_amount), 0);
                return (
                  <div key={b.id} className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-xs">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm">{b.branch_name}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{b.city} · {b.phone}</p>
                      </div>
                      <span className="bg-foreground text-background px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider">
                        ACTIVE
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{b.address}</p>
                    <div className="pt-3 border-t border-border grid grid-cols-3 text-center text-xs">
                      <div>
                        <div className="font-semibold text-foreground">{bStaff.length}</div>
                        <div className="text-[10px] text-muted-foreground">Staff</div>
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{bCars.length}</div>
                        <div className="text-[10px] text-muted-foreground">Cars</div>
                      </div>
                      <div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">{money(bRevenue)}</div>
                        <div className="text-[10px] text-muted-foreground">Sales</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ---------------- STAFF & ROLE GOVERNANCE TAB ---------------- */}
        {activeTab === 'staff' && (
          <div className="space-y-6">
            {/* Tab Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">GOVERNANCE & ROLES</span>
                <h2 className="text-xl font-light tracking-tight text-foreground mt-0.5">Staff & Role Management</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Approve incoming staff requests, assign showroom branch scopes, and configure system permissions.
                </p>
              </div>

              {/* Quick Summary Badges */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-secondary border border-border text-foreground font-medium">
                  Total: <strong className="font-semibold">{allUsers.length}</strong>
                </span>
                <span className="text-[11px] px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                  Active: <strong className="font-semibold">{allUsers.filter((u) => u.isActive ?? u.is_active).length}</strong>
                </span>
                {pendingUsers.length > 0 && (
                  <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-semibold animate-pulse">
                    Pending: <strong>{pendingUsers.length}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* 1. APPROVAL QUEUE */}
            <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs">
              <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold text-xs border border-amber-500/30">
                    {pendingUsers.length}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Pending Account Approvals</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Staff registrations waiting for Owner role verification and branch assignment.
                    </p>
                  </div>
                </div>
                {pendingUsers.length > 0 && (
                  <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 font-semibold px-2.5 py-0.5 rounded-full text-[11px] border border-amber-500/30">
                    Action Required ({pendingUsers.length})
                  </span>
                )}
              </div>

              {pendingUsers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500 opacity-80" />
                  <p className="text-sm font-medium text-foreground">All Staff Requests Approved</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    There are no registrations waiting in the queue. New employee signups will appear here instantly.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Staff Member</th>
                        <th className="py-2.5 px-4 font-semibold">Registered Email</th>
                        <th className="py-2.5 px-4 font-semibold">Requested Role</th>
                        <th className="py-2.5 px-4 font-semibold">Assigned Branch</th>
                        <th className="py-2.5 px-4 font-semibold">Registered Date</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Approval Decision</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-border text-foreground">
                      {pendingUsers.map((u) => {
                        const reqRole = pendingRoleChoices[u.id] || u.role;
                        const reqBranch =
                          pendingBranchChoices[u.id] !== undefined
                            ? pendingBranchChoices[u.id]
                            : u.branchId || (data.branches[0]?.id || '');

                        return (
                          <tr key={u.id} className="hover:bg-muted/20">
                            <td className="py-3 px-4 font-semibold text-foreground">{u.name}</td>
                            <td className="py-3 px-4 font-mono text-muted-foreground">{u.email}</td>
                            <td className="py-3 px-4">
                              <Select
                                value={reqRole}
                                onValueChange={(val) =>
                                  setPendingRoleChoices((prev) => ({ ...prev, [u.id]: val }))
                                }
                              >
                                <SelectTrigger className="h-8 w-[140px] text-xs bg-card border-border">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-popover border-border">
                                  <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                  <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="py-3 px-4">
                              <BranchCombobox
                                value={reqBranch}
                                branches={data.branches}
                                onChange={(val) =>
                                  setPendingBranchChoices((prev) => ({ ...prev, [u.id]: val }))
                                }
                                className="h-8 w-[160px]"
                              />
                            </td>
                            <td className="py-3 px-4 text-muted-foreground">
                              {u.createdAt
                                ? new Date(u.createdAt).toLocaleDateString('en-IN', {
                                    timeZone: 'Asia/Kolkata',
                                  })
                                : 'Recent'}
                            </td>
                            <td className="py-3 px-4 text-right space-x-2">
                              <Button
                                size="sm"
                                disabled={busy}
                                className="rounded-full h-8 text-xs font-medium px-3.5"
                                onClick={() => {
                                  const targetBranch = data.branches.find((b) => b.id === reqBranch);
                                  const bName = targetBranch ? `${targetBranch.branchName || targetBranch.branch_name} (${targetBranch.city})` : 'Assigned Branch';
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Approve Staff Registration',
                                    description: `Approve ${u.name} as ${reqRole.replace('_', ' ')} assigned to ${bName}?`,
                                    confirmLabel: 'Approve Registration',
                                    variant: 'default',
                                    action: async () => {
                                      setBusy(true);
                                      try {
                                        await approveUserFn({
                                          data: {
                                            userId: u.id,
                                            approved: true,
                                            role: reqRole,
                                            branchId: reqBranch,
                                          },
                                        });
                                        toast.success(`Approved account for ${u.name}!`);
                                        refresh();
                                      } catch (err: any) {
                                        toast.error(err.message || 'Failed to approve user');
                                      } finally {
                                        setBusy(false);
                                      }
                                    },
                                  });
                                }}
                              >
                                <Check className="h-3.5 w-3.5 mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                className="rounded-full h-8 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 px-3.5"
                                onClick={() => {
                                  setConfirmDialog({
                                    isOpen: true,
                                    title: 'Reject Staff Registration',
                                    description: `Reject account registration request from ${u.name} (${u.email})?`,
                                    confirmLabel: 'Reject Request',
                                    variant: 'destructive',
                                    action: async () => {
                                      setBusy(true);
                                      try {
                                        await approveUserFn({
                                          data: {
                                            userId: u.id,
                                            approved: false,
                                          },
                                        });
                                        toast.success(`Rejected registration for ${u.name}.`);
                                        refresh();
                                      } catch (err: any) {
                                        toast.error(err.message || 'Failed to reject user');
                                      } finally {
                                        setBusy(false);
                                      }
                                    },
                                  });
                                }}
                              >
                                <X className="h-3.5 w-3.5 mr-1" /> Reject
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 2. DIRECTORY OF ALL USERS WITH FILTERS & RADIX SELECTS */}
            <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-xs space-y-4 p-4">
              {/* Directory Header */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-border">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">All Registered Accounts</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Showing {filteredUsers.length} accounts matching filters. Modify role permissions, assign branches, or suspend accounts.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full h-8 text-xs font-medium"
                  onClick={() =>
                    exportToCSV('cdms_users_directory', filteredUsers, [
                      { key: 'name', label: 'Name' },
                      { key: 'email', label: 'Email' },
                      { key: 'role', label: 'Role' },
                      { key: 'approvalStatus', label: 'Approval Status' },
                      { key: 'isActive', label: 'Active' },
                    ])
                  }
                >
                  <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
                </Button>
              </div>

              {/* Filters Toolbar (Matching dropdown-style-reference.png) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
                {/* Search Field */}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <input
                    type="text"
                    value={staffSearch}
                    onChange={(e) => {
                      setStaffSearch(e.target.value);
                      setStaffPage(1);
                    }}
                    placeholder="Search name or email..."
                    className="h-9 pl-8 pr-3 w-full rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                {/* Role Filter */}
                <Select
                  value={staffRoleFilter}
                  onValueChange={(val) => {
                    setStaffRoleFilter(val);
                    setStaffPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ALL">All Roles</SelectItem>
                    <SelectItem value="OWNER">Dealership Owner</SelectItem>
                    <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                    <SelectItem value="EMPLOYEE">Employee</SelectItem>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                  </SelectContent>
                </Select>

                {/* Status Filter */}
                <Select
                  value={staffStatusFilter}
                  onValueChange={(val) => {
                    setStaffStatusFilter(val);
                    setStaffPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="All Statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ALL">All Statuses</SelectItem>
                    <SelectItem value="ACTIVE">Active Only</SelectItem>
                    <SelectItem value="SUSPENDED">Suspended Only</SelectItem>
                    <SelectItem value="PENDING">Pending Approval</SelectItem>
                  </SelectContent>
                </Select>

                {/* Branch Filter */}
                <Select
                  value={staffBranchFilter}
                  onValueChange={(val) => {
                    setStaffBranchFilter(val);
                    setStaffPage(1);
                  }}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border truncate">
                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="ALL">All Branches</SelectItem>
                    {data.branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.branchName || b.branch_name} ({b.city})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {/* Sort Order */}
                <Select
                  value={staffSort}
                  onValueChange={(val) => setStaffSort(val)}
                >
                  <SelectTrigger className="h-9 text-xs bg-background border-border">
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    <SelectItem value="name-asc">Name (A → Z)</SelectItem>
                    <SelectItem value="name-desc">Name (Z → A)</SelectItem>
                    <SelectItem value="login-desc">Last Login (Newest)</SelectItem>
                    <SelectItem value="login-asc">Last Login (Oldest)</SelectItem>
                    <SelectItem value="role">Role Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Table */}
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/40 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-3 px-4 font-semibold">User</th>
                        <th className="py-3 px-4 font-semibold">Role</th>
                        <th className="py-3 px-4 font-semibold">Branch</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold">Last Login</th>
                        <th className="py-3 px-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-border text-foreground">
                      {paginatedUsers.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-muted-foreground">
                            No accounts match your search and filter criteria.
                          </td>
                        </tr>
                      ) : (
                        paginatedUsers.map((u) => {
                          const isActive = u.isActive ?? u.is_active;
                          const isSelf = u.id === data.user.id;
                          const currentBranchId = u.branchId || u.branch_id || '';

                          return (
                            <tr key={u.id} className="hover:bg-muted/20 transition-colors">
                              {/* 1. User Column (Name and Email) */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-2.5">
                                  <div className="h-7 w-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] border border-primary/20 shrink-0">
                                    {u.name ? u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : 'U'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-semibold text-foreground flex items-center gap-1.5 truncate">
                                      <span className="truncate">{u.name}</span>
                                      {isSelf && (
                                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary border border-primary/20 font-semibold">
                                          YOU
                                        </span>
                                      )}
                                    </div>
                                    <div className="font-mono text-[11px] text-muted-foreground truncate">{u.email}</div>
                                  </div>
                                </div>
                              </td>

                              {/* 2. Role Column (Badge) */}
                              <td className="py-3 px-4">
                                <span
                                  className={`px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider uppercase inline-block whitespace-nowrap ${
                                    u.role === 'OWNER'
                                      ? 'bg-primary text-primary-foreground'
                                      : u.role === 'BRANCH_MANAGER'
                                      ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30'
                                      : u.role === 'EMPLOYEE'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30'
                                      : 'bg-muted text-muted-foreground border border-border'
                                  }`}
                                >
                                  {u.role.replace('_', ' ')}
                                </span>
                              </td>

                              {/* 3. Branch Column (Combobox) */}
                              <td className="py-3 px-4">
                                {u.role === 'OWNER' ? (
                                  <span className="text-muted-foreground font-medium text-xs flex items-center gap-1">
                                    <Shield className="h-3 w-3 text-primary shrink-0" />
                                    All Branches (HQ)
                                  </span>
                                ) : (
                                  <BranchCombobox
                                    value={currentBranchId}
                                    branches={data.branches}
                                    disabled={busy || isSelf}
                                    onChange={(newBId) => {
                                      if (newBId === currentBranchId) return;
                                      const targetBranch = data.branches.find((b) => b.id === newBId);
                                      const bName = targetBranch
                                        ? `${targetBranch.branchName || targetBranch.branch_name} (${targetBranch.city})`
                                        : 'No Branch Assigned';
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Confirm Branch Assignment',
                                        description: `Assign ${u.name} to ${bName}?`,
                                        confirmLabel: 'Assign Branch',
                                        variant: 'default',
                                        action: async () => {
                                          setBusy(true);
                                          try {
                                            await updateUserFn({
                                              data: { userId: u.id, branchId: newBId || null },
                                            });
                                            toast.success(`Assigned ${u.name} to ${bName}`);
                                            refresh();
                                          } catch (err: any) {
                                            toast.error(err.message || 'Failed to update branch');
                                          } finally {
                                            setBusy(false);
                                          }
                                        },
                                      });
                                    }}
                                  />
                                )}
                              </td>

                              {/* 4. Status Column */}
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  <span
                                    className={`inline-block w-2 h-2 rounded-full ${
                                      isActive ? 'bg-emerald-500' : 'bg-destructive'
                                    }`}
                                  />
                                  <span className="text-[11px] font-medium text-foreground">
                                    {isActive ? 'Active' : 'Suspended'}
                                  </span>
                                  {(u.approvalStatus === 'PENDING' || u.approval_status === 'PENDING') && (
                                    <span className="text-[10px] text-amber-500 bg-amber-500/10 px-1 py-0.2 rounded font-medium">
                                      (Pending)
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* 5. Last Login Column */}
                              <td className="py-3 px-4 text-muted-foreground text-[11px] whitespace-nowrap">
                                {u.lastLoginAt
                                  ? new Date(u.lastLoginAt).toLocaleDateString('en-IN', {
                                      timeZone: 'Asia/Kolkata',
                                      day: '2-digit',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : 'Never'}
                              </td>

                              {/* 6. Actions Column (Role Select + DropdownMenu) */}
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center gap-1.5 justify-end">
                                  {/* Role Switcher Select */}
                                  <Select
                                    value={u.role}
                                    disabled={busy || isSelf}
                                    onValueChange={(newRole) => {
                                      if (newRole === u.role) return;
                                      const oldRoleLabel = u.role.replace('_', ' ');
                                      const newRoleLabel = newRole.replace('_', ' ');
                                      setConfirmDialog({
                                        isOpen: true,
                                        title: 'Confirm Role Change',
                                        description: `Change role for ${u.name} from ${oldRoleLabel} to ${newRoleLabel}?`,
                                        confirmLabel: 'Confirm Role Change',
                                        variant: 'default',
                                        action: async () => {
                                          setBusy(true);
                                          try {
                                            await updateUserFn({
                                              data: { userId: u.id, role: newRole as any },
                                            });
                                            toast.success(`Updated role for ${u.name} to ${newRoleLabel}`);
                                            refresh();
                                          } catch (err: any) {
                                            toast.error(err.message || 'Failed to update role');
                                          } finally {
                                            setBusy(false);
                                          }
                                        },
                                      });
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-[130px] text-xs bg-background border-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-popover border-border">
                                      <SelectItem value="OWNER">Dealership Owner</SelectItem>
                                      <SelectItem value="BRANCH_MANAGER">Branch Manager</SelectItem>
                                      <SelectItem value="EMPLOYEE">Employee</SelectItem>
                                      <SelectItem value="CUSTOMER">Customer</SelectItem>
                                    </SelectContent>
                                  </Select>

                                  {/* Action Dropdown Menu */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="icon"
                                        disabled={busy || isSelf}
                                        className="h-8 w-8 rounded-lg border-border bg-background hover:bg-secondary/70"
                                        title="User Actions"
                                      >
                                        <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 rounded-xl border-border bg-popover text-popover-foreground p-1">
                                      <DropdownMenuItem
                                        onClick={() => {
                                          const willSuspend = isActive;
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: willSuspend ? 'Confirm Account Suspension' : 'Confirm Account Activation',
                                            description: willSuspend
                                              ? `Are you sure you want to suspend ${u.name}? They will be blocked from logging in.`
                                              : `Reactivate login access for ${u.name}?`,
                                            confirmLabel: willSuspend ? 'Suspend Account' : 'Reactivate Account',
                                            variant: willSuspend ? 'destructive' : 'default',
                                            action: async () => {
                                              setBusy(true);
                                              try {
                                                await updateUserFn({
                                                  data: { userId: u.id, isActive: !isActive },
                                                });
                                                toast.success(`${willSuspend ? 'Suspended' : 'Activated'} account for ${u.name}`);
                                                refresh();
                                              } catch (err: any) {
                                                toast.error(err.message || 'Action failed');
                                              } finally {
                                                setBusy(false);
                                              }
                                            },
                                          });
                                        }}
                                        className={`text-xs py-2 px-2.5 rounded-lg cursor-pointer flex items-center gap-2 ${
                                          isActive ? 'text-destructive focus:bg-destructive/10 focus:text-destructive' : 'text-emerald-600 dark:text-emerald-400'
                                        }`}
                                      >
                                        {isActive ? (
                                          <>
                                            <Ban className="h-3.5 w-3.5 shrink-0" />
                                            <span>Suspend Account</span>
                                          </>
                                        ) : (
                                          <>
                                            <UserCheck className="h-3.5 w-3.5 shrink-0" />
                                            <span>Reactivate Account</span>
                                          </>
                                        )}
                                      </DropdownMenuItem>

                                      <DropdownMenuSeparator className="my-1 bg-border/60" />

                                      <DropdownMenuItem
                                        onClick={() => {
                                          setConfirmDialog({
                                            isOpen: true,
                                            title: 'Send Password Reset Link',
                                            description: `Send password recovery instructions to ${u.name} (${u.email})?`,
                                            confirmLabel: 'Send Reset Link',
                                            variant: 'default',
                                            action: async () => {
                                              setBusy(true);
                                              try {
                                                const res = await requestPasswordResetServerFn({
                                                  data: { email: u.email },
                                                });
                                                toast.success(res.message || `Password reset link sent to ${u.email}`);
                                                if (res.devResetUrl) {
                                                  toast.info(`Dev Reset URL: ${res.devResetUrl}`);
                                                }
                                              } catch (err: any) {
                                                toast.error(err.message || 'Failed to request reset');
                                              } finally {
                                                setBusy(false);
                                              }
                                            },
                                          });
                                        }}
                                        className="text-xs py-2 px-2.5 rounded-lg cursor-pointer flex items-center gap-2 text-foreground hover:bg-secondary"
                                      >
                                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                        <span>Reset Password</span>
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination Controls */}
                <div className="p-3 bg-muted/20 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                  <div>
                    Showing <strong className="text-foreground">{filteredUsers.length === 0 ? 0 : (staffPage - 1) * STAFF_PAGE_SIZE + 1}</strong> to{' '}
                    <strong className="text-foreground">{Math.min(staffPage * STAFF_PAGE_SIZE, filteredUsers.length)}</strong> of{' '}
                    <strong className="text-foreground">{filteredUsers.length}</strong> accounts
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={staffPage <= 1}
                      onClick={() => setStaffPage((p) => Math.max(1, p - 1))}
                      className="h-8 px-2.5 text-xs rounded-lg border-border"
                    >
                      <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                    </Button>
                    <span className="px-2 text-xs font-medium text-foreground">
                      Page {staffPage} of {staffTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={staffPage >= staffTotalPages}
                      onClick={() => setStaffPage((p) => Math.min(staffTotalPages, p + 1))}
                      className="h-8 px-2.5 text-xs rounded-lg border-border"
                    >
                      Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Global Confirmation Dialog */}
            <AlertDialog open={confirmDialog.isOpen} onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, isOpen: open }))}>
              <AlertDialogContent className="rounded-2xl border-border bg-card text-card-foreground p-6 shadow-xl max-w-md">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-base font-semibold text-foreground">
                    {confirmDialog.title}
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
                    {confirmDialog.description}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4 gap-2">
                  <AlertDialogCancel className="h-9 rounded-full text-xs font-medium border-border">
                    Cancel
                  </AlertDialogCancel>
                  <AlertDialogAction
                    className={`h-9 rounded-full text-xs font-semibold px-4 ${
                      confirmDialog.variant === 'destructive'
                        ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90'
                    }`}
                    onClick={async (e) => {
                      e.preventDefault();
                      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                      await confirmDialog.action();
                    }}
                  >
                    {confirmDialog.confirmLabel}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        {/* ---------------- PROCUREMENT & ALLOCATION WORKFLOW TAB ---------------- */}
        {activeTab === 'procurement' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">
                Owner approval stepper: REQUESTED → MANAGER_APPROVED → OWNER_APPROVED → ORDERED → IN_TRANSIT → RECEIVED → ALLOCATED
              </p>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">PO ID</th>
                    <th className="py-2.5 px-4 font-semibold">Vehicle Specification</th>
                    <th className="py-2.5 px-4 font-semibold">Branch</th>
                    <th className="py-2.5 px-4 font-semibold">Cost</th>
                    <th className="py-2.5 px-4 font-semibold">Procurement Stage</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Workflow Progression</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {data.purchases.map((po) => {
                    const car = data.cars.find((c) => c.id === po.car_id);
                    const b = data.branches.find((br) => br.id === po.branch_id);
                    const stage = po.procurement_stage || 'REQUESTED';
                    return (
                      <tr key={po.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-mono font-semibold">{po.id.slice(0, 8)}</td>
                        <td className="py-3 px-4 font-semibold text-foreground">
                          {car ? `${car.brand} ${car.model} (${car.variant})` : 'Vehicle'}
                        </td>
                        <td className="py-3 px-4">{b?.city || 'Branch'}</td>
                        <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400">{money(po.purchase_cost)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${
                            stage === 'ALLOCATED'
                              ? 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30'
                              : stage === 'RECEIVED'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : 'bg-secondary text-secondary-foreground border-border'
                          }`}>
                            {stage}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right space-x-1.5">
                          {stage === 'REQUESTED' && (
                            <Button
                              size="sm"
                              className="rounded-full h-7 text-xs font-medium px-3.5"
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await handleOwnerProcurementStepFn({
                                    data: { purchaseId: po.id, nextStage: 'OWNER_APPROVED' },
                                  });
                                  toast.success('Owner approved procurement!');
                                  refresh();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Approve PO
                            </Button>
                          )}
                          {stage === 'OWNER_APPROVED' && (
                            <Button
                              size="sm"
                              className="rounded-full h-7 text-xs font-medium px-3.5"
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await handleOwnerProcurementStepFn({
                                    data: { purchaseId: po.id, nextStage: 'ORDERED' },
                                  });
                                  toast.success('Order placed with manufacturer!');
                                  refresh();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Mark Ordered
                            </Button>
                          )}
                          {stage === 'ORDERED' && (
                            <Button
                              size="sm"
                              className="rounded-full h-7 text-xs font-medium px-3.5"
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await handleOwnerProcurementStepFn({
                                    data: { purchaseId: po.id, nextStage: 'IN_TRANSIT' },
                                  });
                                  toast.success('Marked In-Transit from factory!');
                                  refresh();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              In-Transit
                            </Button>
                          )}
                          {stage === 'IN_TRANSIT' && (
                            <Button
                              size="sm"
                              className="rounded-full h-7 text-xs font-medium px-3.5"
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await handleOwnerProcurementStepFn({
                                    data: { purchaseId: po.id, nextStage: 'RECEIVED' },
                                  });
                                  toast.success('Vehicle received into stock!');
                                  refresh();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Receive Vehicle
                            </Button>
                          )}
                          {stage === 'RECEIVED' && (
                            <Button
                              size="sm"
                              className="rounded-full h-7 text-xs font-medium px-3.5"
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await handleOwnerProcurementStepFn({
                                    data: { purchaseId: po.id, nextStage: 'ALLOCATED' },
                                  });
                                  toast.success('Vehicle allocated to customer booking!');
                                  refresh();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              Allocate to Customer
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

        {/* ---------------- STOCK TRANSFERS TAB ---------------- */}
        {activeTab === 'transfers' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Pending Transfer Approvals</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Inter-branch inventory transfer requests requiring Owner authorization.</p>
            </div>

            {data.cars.filter((c) => c.transfer_to && c.status === 'Transfer Pending').length === 0 ? (
              <div className="p-8 bg-card border border-border rounded-2xl text-center text-xs text-muted-foreground shadow-xs">
                No pending inter-branch transfers requiring approval.
              </div>
            ) : (
              <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Vehicle</th>
                      <th className="py-2.5 px-4 font-semibold">Origin Branch</th>
                      <th className="py-2.5 px-4 font-semibold">Target Branch</th>
                      <th className="py-2.5 px-4 font-semibold">Status</th>
                      <th className="py-2.5 px-4 font-semibold text-right">Owner Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-foreground">
                    {data.cars
                      .filter((c) => c.transfer_to && c.status === 'Transfer Pending')
                      .map((c) => {
                        const fromB = data.branches.find((b) => b.id === c.branch_id);
                        const toB = data.branches.find((b) => b.id === c.transfer_to);
                        return (
                          <tr key={c.id} className="hover:bg-muted/20">
                            <td className="py-3 px-4 font-medium text-foreground">{c.brand} {c.model} ({c.vin_chassis_no})</td>
                            <td className="py-3 px-4">{fromB?.city || 'Origin'}</td>
                            <td className="py-3 px-4 font-semibold text-foreground">{toB?.city || 'Destination'}</td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                Transfer Requested
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <Button
                                size="sm"
                                className="rounded-full h-7 text-xs font-medium px-3.5"
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await approveStockTransferFn({
                                      data: { carId: c.id, decision: 'APPROVE' },
                                    });
                                    toast.success('Transfer approved! Vehicle is now In Transit.');
                                    refresh();
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                <Check size={14} className="mr-1" /> Approve Transfer
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 px-3.5"
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await approveStockTransferFn({
                                      data: { carId: c.id, decision: 'REJECT' },
                                    });
                                    toast.info('Transfer rejected. Vehicle returned to origin branch.');
                                    refresh();
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                <X size={14} className="mr-1" /> Reject
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Currently In Transit Section */}
            <div className="pt-4 border-t border-border">
              <h3 className="text-sm font-semibold text-foreground mb-1">Vehicles Currently In Transit</h3>
              <p className="text-xs text-muted-foreground mb-3">Transfers approved by Owner awaiting showroom arrival and confirmation.</p>

              {data.cars.filter((c) => c.status === 'In Transit' || c.inventory_status === 'IN_TRANSIT').length === 0 ? (
                <div className="p-6 bg-card border border-border rounded-2xl text-center text-xs text-muted-foreground shadow-xs">
                  No vehicles currently in transit between branches.
                </div>
              ) : (
                <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Vehicle & VIN</th>
                        <th className="py-2.5 px-4 font-semibold">Origin Showroom</th>
                        <th className="py-2.5 px-4 font-semibold">Destination Showroom</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {data.cars
                        .filter((c) => c.status === 'In Transit' || c.inventory_status === 'IN_TRANSIT')
                        .map((c) => {
                          const fromB = data.branches.find((b) => b.id === c.branch_id);
                          const toB = data.branches.find((b) => b.id === c.transfer_to);
                          return (
                            <tr key={c.id} className="hover:bg-muted/20">
                              <td className="py-3 px-4 font-medium text-foreground">
                                <div>{c.brand} {c.model} {c.variant}</div>
                                <div className="text-[11px] font-mono text-muted-foreground">{c.vin_chassis_no}</div>
                              </td>
                              <td className="py-3 px-4">{fromB?.city || 'Origin'} ({fromB?.branch_name})</td>
                              <td className="py-3 px-4 font-semibold text-foreground">{toB?.city || 'Destination'} ({toB?.branch_name})</td>
                              <td className="py-3 px-4">
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/30">
                                  In Transit
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ---------------- FINANCIAL PROFITABILITY TAB ---------------- */}
        {activeTab === 'financials' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Company-Wide Financial Profitability & Analytics</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Comprehensive revenue, margin realization, and inventory valuation across all branches.</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Sales Revenue</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(totalRevenue)}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">{totalUnitsSold} confirmed contracts</span>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Estimated Gross Profit</span>
                <p className="text-2xl font-light tracking-tight text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {money(Math.round(totalRevenue * 0.12))}
                </p>
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 inline-block font-medium">~12.0% blended margin</span>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Avg Unit Realization</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(avgSaleValue)}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Across active models</span>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active Stock Valuation</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">
                  {money(data.cars.filter((c) => c.status === 'Available' || c.status === 'In Stock').reduce((sum, c) => sum + Number(c.price), 0))}
                </p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">{data.cars.filter((c) => c.status === 'Available' || c.status === 'In Stock').length} vehicles ready</span>
              </div>
            </div>

            {/* Branch Performance Comparison Chart */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">REGIONAL PERFORMANCE</span>
              <h3 className="text-sm font-medium text-foreground mb-4 mt-0.5">Branch Revenue Breakdown (₹ Lakhs)</h3>
              <div className="h-[280px] min-h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.branches.map((b) => {
                      const bSales = data.sales.filter((s) => s.branch_id === b.id && s.status !== 'Cancelled');
                      const rev = bSales.reduce((sum, s) => sum + Number(s.sale_amount), 0);
                      const margin = Math.round(rev * 0.12);
                      return {
                        name: b.city,
                        revenue: Math.round(rev / 100000),
                        margin: Math.round(margin / 100000),
                      };
                    })}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} unit="L" tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <Tooltip content={<ThemedTooltip unit="Lakhs" />} />
                    <Bar dataKey="revenue" name="Revenue (₹L)" fill="var(--foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="margin" name="Gross Margin (₹L)" fill="oklch(0.65 0.16 160)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Model Realization & Sales Leaderboard */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Top Selling Models */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">MODEL REALIZATION</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Top Performing Models</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 pb-2.5 font-semibold">Model</th>
                        <th className="py-2 pb-2.5 font-semibold text-center">Units Sold</th>
                        <th className="py-2 pb-2.5 font-semibold text-right">Avg Realization</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {Array.from(new Set(data.cars.map((c) => `${c.brand} ${c.model}`)))
                        .slice(0, 5)
                        .map((modelName) => {
                          const matchingCars = data.cars.filter((c) => `${c.brand} ${c.model}` === modelName);
                          const carIds = new Set(matchingCars.map((c) => c.id));
                          const sales = data.sales.filter((s) => carIds.has(s.car_id as string));
                          const avgPrice = matchingCars.length > 0 ? Number(matchingCars[0].price) : 0;
                          return (
                            <tr key={modelName}>
                              <td className="py-2.5 font-medium text-foreground">{modelName}</td>
                              <td className="py-2.5 text-center font-mono">{sales.length}</td>
                              <td className="py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{money(avgPrice)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Staff Leaderboard */}
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">TEAM EXCELLENCE</span>
                <h3 className="text-sm font-medium text-foreground mb-3 mt-0.5">Sales Employee Leaderboard</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2 pb-2.5 font-semibold">Executive</th>
                        <th className="py-2 pb-2.5 font-semibold">Branch</th>
                        <th className="py-2 pb-2.5 font-semibold text-center">Deals</th>
                        <th className="py-2 pb-2.5 font-semibold text-right">Volume (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.employees
                        .filter((e) => e.role === 'EMPLOYEE' || e.role === 'employee')
                        .map((emp) => {
                          const empSales = data.sales.filter((s) => s.employee_id === emp.id && s.status !== 'Cancelled');
                          const volume = empSales.reduce((sum, s) => sum + Number(s.sale_amount), 0);
                          const b = data.branches.find((br) => br.id === emp.branch_id);
                          return { emp, branch: b?.city || '—', deals: empSales.length, volume };
                        })
                        .sort((a, b) => b.volume - a.volume)
                        .slice(0, 5)
                        .map(({ emp, branch, deals, volume }, idx) => (
                          <tr key={emp.id}>
                            <td className="py-2.5 font-medium text-foreground flex items-center gap-2">
                              <span className="text-[10px] w-4 h-4 rounded-full bg-secondary flex items-center justify-center font-mono">{idx + 1}</span>
                              {emp.name}
                            </td>
                            <td className="py-2.5 text-muted-foreground">{branch}</td>
                            <td className="py-2.5 text-center font-mono">{deals}</td>
                            <td className="py-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400">{money(volume)}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- AUDIT & LOGIN EVENTS TAB ---------------- */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <AuditLogViewer
              role="owner"
              branchId={null}
              branches={data.branches}
              logs={data.audit_logs || []}
              users={data.users || []}
            />
          </div>
        )}

        {/* ---------------- DATABASE EXPLORER TAB ---------------- */}
        {activeTab === 'database' && (
          <div className="space-y-6">
            {/* Database Engine Information Header */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Database size={18} className="text-muted-foreground" />
                    <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                      Local MySQL Database: <span className="font-mono text-foreground">cdms</span>
                    </h2>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Direct access to all 18 relational MySQL tables. Fully independent of external hosted services.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs rounded-full border-border font-medium"
                    onClick={() => {
                      toast.info('Run "bun run db:studio" in terminal to launch Drizzle Studio GUI!');
                    }}
                  >
                    Drizzle Studio (`bun run db:studio`)
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs rounded-full border-border font-medium"
                    onClick={() => {
                      loadTablesList();
                      loadTableData(selectedTable);
                      toast.success('Database table statistics refreshed');
                    }}
                  >
                    Refresh Tables
                  </Button>
                </div>
              </div>

              {/* Info Badges */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border text-xs">
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-muted-foreground text-[10px]">Host & Port</span>
                  <p className="font-mono text-foreground font-semibold mt-0.5">localhost:3306</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-muted-foreground text-[10px]">Dialect & Collation</span>
                  <p className="text-foreground font-semibold mt-0.5">MySQL 8.0 (utf8mb4)</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-muted-foreground text-[10px]">Total Tables</span>
                  <p className="text-foreground font-bold mt-0.5">{dbTables.length || 18} Tables</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-xl border border-border/50">
                  <span className="text-muted-foreground text-[10px]">SQL Schema Dump</span>
                  <p className="text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">database.sql (Ready)</p>
                </div>
              </div>
            </div>

            {/* Table Selection Pills */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Select Table to Inspect Live Rows
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {dbTables.map((t) => {
                  const isSelected = selectedTable === t.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => loadTableData(t.name)}
                      className={`text-left p-2.5 rounded-xl border transition-all text-xs ${
                        isSelected
                          ? 'bg-foreground text-background font-medium shadow-xs border-foreground'
                          : 'bg-muted/30 border-border text-foreground hover:bg-secondary/70 hover:text-foreground'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-mono font-semibold truncate">{t.name}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            isSelected
                              ? 'bg-background text-foreground'
                              : t.rowCount > 0
                              ? 'bg-secondary text-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {t.rowCount}
                        </span>
                      </div>
                      <p className={`text-[10px] truncate ${isSelected ? 'text-background/80' : 'text-muted-foreground'}`}>{t.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Table Rows Viewer */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <span className="font-mono">`{selectedTable}`</span>
                    <span className="text-xs text-muted-foreground font-normal">
                      ({tableRows.length} rows loaded)
                    </span>
                  </h3>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                    ✓ Sensitive columns (such as password_hash) are masked for security.
                  </p>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Search size={14} className="absolute left-3.5 top-2.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder={`Filter ${selectedTable} rows...`}
                      value={tableSearch}
                      onChange={(e) => setTableSearch(e.target.value)}
                      className="w-full bg-secondary border border-border rounded-full pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                  </div>
                  {tableRows.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs border-border h-8 rounded-full font-medium"
                      onClick={() => {
                        const cols = Object.keys(tableRows[0] || {}).map((k) => ({ key: k, label: k }));
                        exportToCSV(selectedTable, tableRows, cols);
                      }}
                    >
                      <Download size={14} className="mr-1" /> Export
                    </Button>
                  )}
                </div>
              </div>

              {loadingDb ? (
                <div className="p-8 text-center text-xs text-muted-foreground">Loading live rows from MySQL...</div>
              ) : tableRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                  No records found in table `{selectedTable}`.
                </div>
              ) : (
                <div className="border border-border rounded-xl overflow-x-auto max-h-[500px]">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/70 text-foreground border-b border-border sticky top-0">
                      <tr>
                        {Object.keys(tableRows[0]).map((col) => (
                          <th key={col} className="py-2.5 px-3 font-mono font-semibold whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {tableRows
                        .filter((r) => {
                          if (!tableSearch) return true;
                          return JSON.stringify(r).toLowerCase().includes(tableSearch.toLowerCase());
                        })
                        .map((row, idx) => (
                          <tr key={idx} className="hover:bg-muted/30">
                            {Object.entries(row).map(([k, val]: [string, any]) => {
                              const strVal =
                                val === null || val === undefined
                                  ? 'NULL'
                                  : typeof val === 'object'
                                    ? JSON.stringify(val)
                                    : String(val);
                              const isNull = val === null || val === undefined;
                              const isMasked = k === 'password_hash';

                              return (
                                <td
                                  key={k}
                                  className={`py-2 px-3 whitespace-nowrap font-mono text-[11px] ${
                                    isNull
                                      ? 'text-muted-foreground italic'
                                      : isMasked
                                        ? 'text-amber-500'
                                        : 'text-foreground'
                                  }`}
                                  title={strVal}
                                >
                                  {strVal.length > 50 ? `${strVal.slice(0, 50)}…` : strVal}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
