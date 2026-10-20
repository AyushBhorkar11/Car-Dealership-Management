import React, { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  CheckSquare,
  Truck,
  Car,
  Wallet,
  BarChart3,
  ShieldCheck,
  Check,
  X,
  ArrowRightLeft,
  Calendar,
  AlertTriangle,
  Clock,
  LogOut,
  Plus,
  History,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { Button } from '@/components/ui/button';
import { logoutServerFn } from '@/lib/auth.functions';
import { workspaceQuery } from '@/lib/workspace-query';
import { money } from '@/lib/cdms';
import { AuditLogViewer } from './audit-log-viewer';
import {
  handleDiscountApproval,
  handleManagerProcurementApproval,
  reassignLead,
  updateStaffProfile,
  transferCar,
  receiveStockTransfer,
} from '@/lib/cdms.functions';
import { toast } from 'sonner';

type ManagerTab =
  | 'overview'
  | 'staff'
  | 'leads'
  | 'approvals'
  | 'procurement'
  | 'inventory'
  | 'sales'
  | 'reports'
  | 'audit';

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

export function ManagerDashboard() {
  const { data } = useSuspenseQuery(workspaceQuery);
  const query = useQueryClient();
  const navigate = useNavigate();

  const handleDiscountApprovalFn = useServerFn(handleDiscountApproval);
  const handleManagerProcurementFn = useServerFn(handleManagerProcurementApproval);
  const reassignLeadFn = useServerFn(reassignLead);
  const updateStaffProfileFn = useServerFn(updateStaffProfile);
  const transferCarFn = useServerFn(transferCar);
  const receiveStockTransferFn = useServerFn(receiveStockTransfer);

  const [activeTab, setActiveTab] = useState<ManagerTab>('overview');
  const [busy, setBusy] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [transferModalCar, setTransferModalCar] = useState<any>(null);
  const [showOtherBranchModal, setShowOtherBranchModal] = useState(false);

  // Manager identity & branch resolution
  const currentEmployee = data.employees.find((e) => e.auth_user_id === data.user.id);
  const branchId = currentEmployee?.branch_id || data.roles.find((r) => r.role === 'branch_manager')?.branch_id;
  const branch = data.branches.find((b) => b.id === branchId);

  // Scoped Data: strictly this branch
  const branchStaff = data.employees.filter((e) => e.branch_id === branchId);
  const branchLeads = data.enquiries.filter((e) => e.branch_id === branchId);
  const branchCars = data.cars.filter((c) => c.branch_id === branchId || c.transfer_to === branchId);
  const branchSales = data.sales.filter((s) => s.branch_id === branchId);
  const branchProcurements = data.purchases.filter((p) => p.branch_id === branchId);

  // Pending Approvals
  const pendingDiscountQuotations = (data.quotations || []).filter(
    (q) => q.branch_id === branchId && q.discount_approval_status === 'PENDING_APPROVAL'
  );
  const pendingProcurements = branchProcurements.filter(
    (p) => p.procurement_stage === 'REQUESTED' || p.status === 'Pending Approval' || p.procurement_stage === 'SUBMITTED'
  );
  const totalManagerPendingApprovals = pendingDiscountQuotations.length + pendingProcurements.length;

  const refresh = () => {
    query.invalidateQueries({ queryKey: ['workspace'] });
  };

  // Branch Metrics
  const branchRevenue = branchSales
    .filter((s) => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + Number(s.sale_amount), 0);

  const branchCollected = branchSales
    .filter((s) => s.status !== 'Cancelled')
    .reduce((sum, s) => sum + Number(s.amount_paid), 0);

  const branchUnitsSold = branchSales.filter((s) => s.status === 'Completed').length;
  const totalLeadsCount = branchLeads.length;
  const conversionRate = totalLeadsCount > 0 ? Math.round((branchUnitsSold / totalLeadsCount) * 100) : 0;

  // Memoized Chart Datasets for Recharts Stability
  const staffPerformanceData = React.useMemo(() => {
    return branchStaff.map((s) => {
      const count = branchSales.filter((sale) => sale.employee_id === s.id && sale.status !== 'Cancelled').length;
      return {
        name: s.name.split(' ')[0],
        achieved: count,
        target: s.monthly_target || 5,
      };
    });
  }, [branchStaff, branchSales]);

  const modelSalesData = React.useMemo(() => {
    const models = Array.from(new Set(data.cars.map((c) => c.model))).slice(0, 6);
    return models.map((model) => {
      const count = branchSales.filter((s) => {
        const car = data.cars.find((c) => c.id === s.car_id);
        return car?.model === model;
      }).length;
      return { model, count };
    });
  }, [data.cars, branchSales]);

  // Car Ageing Calculation
  const getAgeingDays = (dateStr?: string | null) => {
    if (!dateStr) return 15;
    const diffTime = Math.abs(Date.now() - new Date(dateStr).getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  return (
    <div className="min-h-screen pt-[var(--header-height)] bg-background text-foreground flex flex-col md:flex-row transition-colors">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-card border-r border-border p-4 flex flex-col justify-between shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-6 px-2">
            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center font-semibold text-xs shadow-xs">
              BM
            </div>
            <div>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-muted-foreground block">BRANCH SUITE</span>
              <h2 className="font-semibold text-sm leading-tight text-foreground">{currentEmployee?.name || 'Branch Manager'}</h2>
              <p className="text-[11px] text-muted-foreground font-medium">{branch?.city || 'City'} Showroom Head</p>
            </div>
          </div>

          <div className="mb-4 px-3.5 py-2.5 bg-muted/30 rounded-xl border border-border text-xs">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Current Showroom</div>
            <div className="font-semibold text-foreground mt-0.5">{branch?.branch_name || 'Mumbai South'}</div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'overview', label: 'Branch Overview', icon: LayoutDashboard },
              { id: 'staff', label: 'Staff Management', icon: Users },
              { id: 'leads', label: 'Lead Operations', icon: MessageSquare },
              { id: 'approvals', label: 'Approvals Queue', icon: CheckSquare, badge: totalManagerPendingApprovals },
              { id: 'procurement', label: 'Procurement (Demand)', icon: Truck },
              { id: 'inventory', label: 'Inventory & Ageing', icon: Car },
              { id: 'sales', label: 'Sales & Collections', icon: Wallet },
              { id: 'reports', label: 'Branch Analytics', icon: BarChart3 },
              { id: 'audit', label: 'Audit Trail', icon: History },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ManagerTab)}
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
            <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">
              BRANCH SUITE · {branch?.city?.toUpperCase() || 'SHOWROOM'}
            </span>
            <h1 className="text-2xl font-light tracking-tight text-foreground capitalize mt-0.5">
              {activeTab.replace('_', ' ')}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Branch scope: {branch?.branch_name || 'Showroom'} · Cross-branch access strictly isolated
            </p>
          </div>
        </header>

        {/* ---------------- OVERVIEW TAB ---------------- */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Branch Revenue</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(branchRevenue)}</p>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 inline-block">Sales value booked</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Collections</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{money(branchRevenue - branchCollected)}</p>
                <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 mt-1 inline-block">Outstanding balance</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Units Delivered</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{branchUnitsSold} cars</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Conversion: {conversionRate}%</span>
              </div>

              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Pending Approvals</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{pendingProcurements.length}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Requires manager sign-off</span>
              </div>
            </div>

            {/* Approvals Banner */}
            {pendingProcurements.length > 0 && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between shadow-xs">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="text-amber-600 dark:text-amber-400" size={20} />
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">
                      {pendingProcurements.length} Procurement Request(s) Awaiting Your Review
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Customer bookings triggered automatic procurement. Review specifications and approve.
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="text-xs font-medium border-border rounded-full" onClick={() => setActiveTab('approvals')}>
                  Go to Approvals
                </Button>
              </div>
            )}

            {/* Performance Bar Chart */}
            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">EXECUTIVE PERFORMANCE</span>
              <h3 className="text-sm font-medium text-foreground mb-4 mt-0.5">Branch Sales Performance vs Monthly Target</h3>
              <div className="h-[260px] min-h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={staffPerformanceData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <Tooltip content={<ThemedTooltip unit="units" />} />
                    <Bar dataKey="achieved" name="Units Achieved" fill="var(--foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                    <Bar dataKey="target" name="Monthly Target" fill="var(--muted-foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- STAFF TAB ---------------- */}
        {activeTab === 'staff' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">Manage branch sales executives, set targets, and activate/deactivate access.</p>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Employee</th>
                    <th className="py-2.5 px-4 font-semibold">Contact</th>
                    <th className="py-2.5 px-4 font-semibold">Monthly Target</th>
                    <th className="py-2.5 px-4 font-semibold">Units Sold</th>
                    <th className="py-2.5 px-4 font-semibold">Account Status</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {branchStaff.map((emp) => {
                    const salesCount = branchSales.filter((s) => s.employee_id === emp.id && s.status !== 'Cancelled').length;
                    return (
                      <tr key={emp.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium text-foreground">{emp.name}</td>
                        <td className="py-3 px-4">
                          <div>{emp.phone || '—'}</div>
                          <div className="text-[11px] text-muted-foreground">{emp.email}</div>
                        </td>
                        <td className="py-3 px-4 font-bold text-foreground">{emp.monthly_target || 5} cars</td>
                        <td className="py-3 px-4 font-bold text-emerald-400">{salesCount} cars</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                            emp.is_active ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-destructive/15 text-destructive'
                          }`}>
                            {emp.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => setSelectedStaff(emp)}
                          >
                            Set Target
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

        {/* ---------------- LEADS OPERATIONS TAB ---------------- */}
        {activeTab === 'leads' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">All branch enquiries, pipeline monitoring, and lead reassignment.</p>
            </div>

            <div className="border border-border rounded-lg overflow-hidden bg-card">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Customer</th>
                    <th className="py-2.5 px-4 font-semibold">Requested Vehicle</th>
                    <th className="py-2.5 px-4 font-semibold">Assigned Executive</th>
                    <th className="py-2.5 px-4 font-semibold">Stage</th>
                    <th className="py-2.5 px-4 font-semibold">Follow-Up Date</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {branchLeads.map((l) => {
                    const cust = data.customers.find((c) => c.id === l.customer_id);
                    const emp = data.employees.find((e) => e.id === l.employee_id);
                    return (
                      <tr key={l.id} className="hover:bg-muted/30">
                        <td className="py-3 px-4 font-medium text-foreground">{cust?.name || 'Customer'}</td>
                        <td className="py-3 px-4">
                          <div className="font-semibold">{l.requested_brand} {l.requested_model}</div>
                          <div className="text-[11px] text-muted-foreground">{l.requested_variant}</div>
                        </td>
                        <td className="py-3 px-4">
                          {emp ? emp.name : <span className="text-amber-400 font-semibold">Unassigned</span>}
                        </td>
                        <td className="py-3 px-4">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            {l.stage}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-[11px]">
                          {l.follow_up_date ? new Date(l.follow_up_date).toLocaleDateString('en-IN') : 'None'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7"
                            onClick={() => setSelectedLead(l)}
                          >
                            Reassign
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

        {/* ---------------- APPROVALS QUEUE TAB ---------------- */}
        {activeTab === 'approvals' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Procurement Approvals (Demand Driven)</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Customer bookings for out-of-stock vehicles require branch manager approval before manufacturer PO submission.
              </p>

              {pendingProcurements.length === 0 ? (
                <div className="p-8 bg-card border border-border rounded-lg text-center text-xs text-muted-foreground">
                  No pending procurement approvals.
                </div>
              ) : (
                <div className="border border-border rounded-lg overflow-hidden bg-card">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 text-muted-foreground border-b border-border">
                      <tr>
                        <th className="py-2.5 px-4 font-semibold">Order ID</th>
                        <th className="py-2.5 px-4 font-semibold">Vehicle</th>
                        <th className="py-2.5 px-4 font-semibold">Estimated Cost</th>
                        <th className="py-2.5 px-4 font-semibold">Status</th>
                        <th className="py-2.5 px-4 font-semibold text-right">Decisions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border text-foreground">
                      {pendingProcurements.map((po) => {
                        const car = data.cars.find((c) => c.id === po.car_id);
                        return (
                          <tr key={po.id} className="hover:bg-muted/30">
                            <td className="py-3 px-4 font-mono font-semibold">{po.id.slice(0, 8)}</td>
                            <td className="py-3 px-4 font-semibold text-foreground">
                              {car ? `${car.brand} ${car.model} (${car.variant})` : 'Vehicle'}
                            </td>
                            <td className="py-3 px-4 font-mono text-emerald-600 dark:text-emerald-400">{money(po.purchase_cost)}</td>
                            <td className="py-3 px-4">
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                                {po.procurement_stage || 'REQUESTED'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right space-x-1.5">
                              <Button
                                size="sm"
                                className="rounded-full h-7 text-xs font-medium px-3.5"
                                onClick={async () => {
                                  setBusy(true);
                                  try {
                                    await handleManagerProcurementFn({
                                      data: {
                                        purchaseId: po.id,
                                        decision: 'MANAGER_APPROVED',
                                        remarks: 'Approved by Branch Manager for factory procurement',
                                      },
                                    });
                                    toast.success('Procurement request approved and sent to Owner!');
                                    refresh();
                                  } catch (err: any) {
                                    toast.error(err.message);
                                  } finally {
                                    setBusy(false);
                                  }
                                }}
                              >
                                <Check size={14} className="mr-1" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="rounded-full h-7 text-xs text-destructive hover:bg-destructive/10 border-destructive/30 px-3.5"
                                onClick={async () => {
                                  const reason = prompt('Rejection reason:') || 'Rejected';
                                  setBusy(true);
                                  try {
                                    await handleManagerProcurementFn({
                                      data: {
                                        purchaseId: po.id,
                                        decision: 'REJECTED',
                                        remarks: reason,
                                      },
                                    });
                                    toast.error('Procurement rejected');
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
            </div>
          </div>
        )}

        {/* ---------------- INVENTORY & AGEING TAB ---------------- */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-xs text-muted-foreground">Branch physical inventory with 30/60/90+ day ageing and inter-branch transfer requests.</p>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full text-xs h-7 font-medium"
                onClick={() => setShowOtherBranchModal(true)}
              >
                <ArrowRightLeft size={13} className="mr-1.5" /> Request Car from Another Branch
              </Button>
            </div>

            <div className="border border-border rounded-2xl overflow-hidden bg-card shadow-xs">
              <table className="w-full text-xs text-left">
                <thead className="bg-muted/30 text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Vehicle</th>
                    <th className="py-2.5 px-4 font-semibold">VIN / Chassis No</th>
                    <th className="py-2.5 px-4 font-semibold">Colour / Specs</th>
                    <th className="py-2.5 px-4 font-semibold">Price</th>
                    <th className="py-2.5 px-4 font-semibold">Stock Status</th>
                    <th className="py-2.5 px-4 font-semibold">Ageing (Days)</th>
                    <th className="py-2.5 px-4 font-semibold text-right">Inter-Branch Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border text-foreground">
                  {branchCars.map((c) => {
                    const days = getAgeingDays(c.created_at);
                    return (
                      <tr key={c.id} className="hover:bg-muted/20">
                        <td className="py-3 px-4 font-medium text-foreground">{c.brand} {c.model}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{c.vin_chassis_no}</td>
                        <td className="py-3 px-4">{c.color || 'Standard'} · {c.transmission}</td>
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-600 dark:text-emerald-400">{money(c.price)}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            c.status === 'Available' || c.status === 'In Stock'
                              ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                              : c.status === 'In Transit'
                              ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30'
                              : c.status === 'Transfer Pending' || c.status === 'Reserved'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-secondary text-secondary-foreground border-border'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-mono">
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold border ${
                            days > 90
                              ? 'bg-destructive/15 text-destructive border-destructive/30'
                              : days > 60
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
                              : 'bg-secondary text-secondary-foreground border-border'
                          }`}>
                            {days} Days
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {c.transfer_to === branchId && (c.status === 'In Transit' || c.inventory_status === 'IN_TRANSIT') ? (
                            <Button
                              size="sm"
                              className="rounded-full text-xs h-7 px-3 bg-primary text-primary-foreground hover:bg-primary/90"
                              onClick={async () => {
                                setBusy(true);
                                try {
                                  await receiveStockTransferFn({ data: { carId: c.id } });
                                  toast.success('Stock transfer received! Vehicle is now In Stock at your showroom.');
                                  refresh();
                                } catch (err: any) {
                                  toast.error(err.message);
                                } finally {
                                  setBusy(false);
                                }
                              }}
                            >
                              <Check size={13} className="mr-1" /> Mark Received
                            </Button>
                          ) : c.transfer_to === branchId && c.status === 'Transfer Pending' ? (
                            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">
                              Incoming Requested
                            </span>
                          ) : c.branch_id === branchId && c.transfer_to ? (
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {c.status === 'In Transit' ? 'In Transit Outbound' : 'Transfer Pending Approval'}
                            </span>
                          ) : (c.status === 'Available' || c.status === 'In Stock') && !c.transfer_to ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-full text-xs h-7 px-3"
                              onClick={() => setTransferModalCar(c)}
                            >
                              <ArrowRightLeft size={13} className="mr-1" /> Transfer Out
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ---------------- REPORTS TAB ---------------- */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total Bookings</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{branchSales.length}</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">All recorded sales</span>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Average Sale Value</span>
                <p className="text-2xl font-light tracking-tight text-emerald-600 dark:text-emerald-400 mt-1.5">
                  {branchSales.length > 0 ? money(Math.round(branchRevenue / branchSales.length)) : '₹0'}
                </p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">On-road branch avg</span>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Lead Conversion</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">{conversionRate}%</p>
                <span className="text-[11px] text-muted-foreground mt-1 inline-block">Enquiries to bookings</span>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Company Benchmark</span>
                <p className="text-2xl font-light tracking-tight text-foreground mt-1.5">18%</p>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 mt-1 inline-block">Exceeding national avg</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
              <span className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground">PORTFOLIO DEMAND</span>
              <h3 className="text-sm font-medium text-foreground mb-4 mt-0.5">Model-wise Branch Sales</h3>
              <div className="h-[260px] min-h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={modelSalesData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.6} />
                    <XAxis dataKey="model" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={{ stroke: 'var(--border)' }} />
                    <Tooltip content={<ThemedTooltip unit="units" />} />
                    <Bar dataKey="count" name="Units Sold" fill="var(--foreground)" radius={[6, 6, 0, 0]} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ---------------- AUDIT TRAIL TAB ---------------- */}
        {activeTab === 'audit' && (
          <div className="space-y-6">
            <AuditLogViewer
              role="branch_manager"
              branchId={branchId}
              branches={data.branches}
              logs={data.audit_logs || []}
              users={data.employees || []}
            />
          </div>
        )}

        {/* ---------------- MODALS ---------------- */}

        {/* Reassign Lead Modal */}
        {selectedLead && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Reassign Lead</h3>
                <button onClick={() => setSelectedLead(null)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-4 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await reassignLeadFn({
                      data: {
                        enquiryId: selectedLead.id,
                        targetEmployeeId: String(fd.get('targetEmployeeId')),
                      },
                    });
                    toast.success('Lead successfully reassigned!');
                    setSelectedLead(null);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Select Sales Executive in Branch *</label>
                  <select name="targetEmployeeId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {branchStaff.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {busy ? 'Reassigning...' : 'Confirm Reassignment'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Set Target Modal */}
        {selectedStaff && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Update Staff Target & Status</h3>
                <button onClick={() => setSelectedStaff(null)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-4 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await updateStaffProfileFn({
                      data: {
                        employeeId: selectedStaff.id,
                        monthlyTarget: Number(fd.get('monthlyTarget')),
                        isActive: fd.get('isActive') === 'on',
                      },
                    });
                    toast.success('Staff profile updated!');
                    setSelectedStaff(null);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Monthly Car Sales Target *</label>
                  <input
                    name="monthlyTarget"
                    type="number"
                    required
                    defaultValue={selectedStaff.monthly_target || 5}
                    className="w-full bg-secondary border border-border rounded p-2 text-foreground font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    name="isActive"
                    id="staffActive"
                    defaultChecked={selectedStaff.is_active}
                    className="rounded border-border"
                  />
                  <label htmlFor="staffActive" className="text-foreground">Account Active</label>
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {busy ? 'Saving...' : 'Save Changes'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Stock Transfer Request Modal */}
        {transferModalCar && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Request Inter-Branch Stock Transfer</h3>
                <button onClick={() => setTransferModalCar(null)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-4 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await transferCarFn({
                      data: {
                        carId: transferModalCar.id,
                        targetBranch: String(fd.get('targetBranch')),
                        confirm: false,
                      },
                    });
                    toast.success('Transfer requested! Owner approval requested.');
                    setTransferModalCar(null);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <p className="text-foreground font-semibold mb-2">
                    {transferModalCar.brand} {transferModalCar.model} ({transferModalCar.vin_chassis_no})
                  </p>
                  <label className="text-muted-foreground block mb-1">Target Destination Branch *</label>
                  <select name="targetBranch" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {data.branches
                      .filter((b) => b.id !== branchId)
                      .map((b) => (
                        <option key={b.id} value={b.id}>{b.branch_name} ({b.city})</option>
                      ))}
                  </select>
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {busy ? 'Submitting...' : 'Submit Transfer Request'}
                </Button>
              </form>
            </div>
          </div>
        )}

        {/* Request Car from Another Branch Modal */}
        {showOtherBranchModal && (
          <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-card border border-border rounded-xl p-6 max-w-md w-full shadow-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-foreground">Request Vehicle from Another Showroom</h3>
                <button onClick={() => setShowOtherBranchModal(false)}><X size={16} className="text-muted-foreground" /></button>
              </div>
              <form
                className="space-y-4 text-xs"
                onSubmit={async (e) => {
                  e.preventDefault();
                  setBusy(true);
                  const fd = new FormData(e.currentTarget);
                  try {
                    await transferCarFn({
                      data: {
                        carId: String(fd.get('selectedCarId')),
                        toBranchId: branchId,
                      },
                    });
                    toast.success('Transfer requested! Owner notified for authorization.');
                    setShowOtherBranchModal(false);
                    refresh();
                  } catch (err: any) {
                    toast.error(err.message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <div>
                  <label className="text-muted-foreground block mb-1">Select Available Vehicle at Another Showroom *</label>
                  <select name="selectedCarId" required className="w-full bg-secondary border border-border rounded p-2 text-foreground">
                    {data.cars
                      .filter((c) => c.branch_id !== branchId && (c.status === 'Available' || c.status === 'In Stock') && !c.transfer_to)
                      .map((c) => {
                        const b = data.branches.find((br) => br.id === c.branch_id);
                        return (
                          <option key={c.id} value={c.id}>
                            {c.brand} {c.model} ({c.variant}) · {b?.city || 'Other Showroom'} ({c.vin_chassis_no})
                          </option>
                        );
                      })}
                  </select>
                </div>
                <Button disabled={busy} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  {busy ? 'Submitting...' : 'Send Transfer Request to Owner'}
                </Button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
