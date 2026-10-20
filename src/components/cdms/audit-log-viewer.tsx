import { useState, useMemo } from 'react';
import {
  Search,
  Download,
  Filter,
  Eye,
  X,
  Calendar,
  Layers,
  User,
  Building2,
  Activity,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface AuditRecord {
  id: string;
  user_id?: string;
  userId?: string;
  role: string;
  branch_id?: string | null;
  branchId?: string | null;
  action: string;
  entity: string;
  entity_id?: string;
  entityId?: string;
  summary?: string | null;
  old_value?: any;
  oldValue?: any;
  new_value?: any;
  newValue?: any;
  ip?: string;
  user_agent?: string;
  userAgent?: string;
  created_at?: string | Date;
  createdAt?: string | Date;
}

interface AuditLogViewerProps {
  role: string;
  branchId?: string | null;
  branches: Array<{ id: string; branch_name?: string; branchName?: string; city?: string }>;
  logs: AuditRecord[];
  users?: Array<{ id: string; name: string; email: string; role: string }>;
}

export function AuditLogViewer({
  role,
  branchId,
  branches,
  logs,
  users = [],
}: AuditLogViewerProps) {
  const isOwner = role.toLowerCase() === 'owner';

  const [search, setSearch] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [selectedEntity, setSelectedEntity] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(isOwner ? '' : branchId || '');
  const [selectedActor, setSelectedActor] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [activeDiffLog, setActiveDiffLog] = useState<AuditRecord | null>(null);

  // Discover all unique actions and entities present in the logs
  const actionOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.action) set.add(l.action);
    });
    return Array.from(set).sort();
  }, [logs]);

  const entityOptions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.entity) set.add(l.entity);
    });
    return Array.from(set).sort();
  }, [logs]);

  // Filter the logs
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Scoping: Branch managers may strictly only see their own branch
      if (!isOwner && branchId) {
        const logBranch = log.branch_id || log.branchId;
        if (logBranch && logBranch !== branchId) return false;
      }

      // Branch filter
      if (selectedBranch) {
        const logBranch = log.branch_id || log.branchId;
        if (logBranch !== selectedBranch) return false;
      }

      // Action filter
      if (selectedAction && log.action !== selectedAction) {
        return false;
      }

      // Entity filter
      if (selectedEntity && log.entity?.toLowerCase() !== selectedEntity.toLowerCase()) {
        return false;
      }

      // Actor filter
      const actorId = log.user_id || log.userId;
      if (selectedActor && actorId !== selectedActor) {
        return false;
      }

      // Date range filter
      const createdDate = new Date(log.created_at || log.createdAt || Date.now());
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (createdDate < start) return false;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (createdDate > end) return false;
      }

      // Search across summary, action, entity, actor, and entityId
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const summary = (log.summary || '').toLowerCase();
        const action = (log.action || '').toLowerCase();
        const entity = (log.entity || '').toLowerCase();
        const eId = String(log.entity_id || log.entityId || '').toLowerCase();
        const aId = String(actorId || '').toLowerCase();

        return (
          summary.includes(q) ||
          action.includes(q) ||
          entity.includes(q) ||
          eId.includes(q) ||
          aId.includes(q)
        );
      }

      return true;
    });
  }, [logs, isOwner, branchId, selectedBranch, selectedAction, selectedEntity, selectedActor, startDate, endDate, search]);

  // CSV Export
  const exportToCsv = () => {
    const headers = [
      'Timestamp',
      'Actor ID',
      'Actor Role',
      'Branch',
      'Action',
      'Entity',
      'Entity ID',
      'Summary',
      'IP',
      'User Agent',
      'Before (Old Value)',
      'After (New Value)',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
      return `"${str.replace(/"/g, '""')}"`;
    };

    const rows = filteredLogs.map((log) => {
      const bId = log.branch_id || log.branchId;
      const bObj = branches.find((b) => b.id === bId);
      const branchName = bObj ? `${bObj.branch_name || bObj.branchName} (${bObj.city})` : (bId || 'Global');
      const timeStr = new Date(log.created_at || log.createdAt || Date.now()).toISOString();

      return [
        escapeCsv(timeStr),
        escapeCsv(log.user_id || log.userId),
        escapeCsv(log.role),
        escapeCsv(branchName),
        escapeCsv(log.action),
        escapeCsv(log.entity),
        escapeCsv(log.entity_id || log.entityId),
        escapeCsv(log.summary || ''),
        escapeCsv(log.ip || ''),
        escapeCsv(log.user_agent || log.userAgent || ''),
        escapeCsv(log.old_value || log.oldValue || null),
        escapeCsv(log.new_value || log.newValue || null),
      ].join(',');
    });

    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cdms-audit-trail-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getBranchLabel = (id?: string | null) => {
    if (!id) return 'Company Global';
    const b = branches.find((br) => br.id === id);
    return b ? `${b.branch_name || b.branchName} (${b.city})` : id.slice(0, 8);
  };

  const getActorLabel = (actorId?: string, actorRole?: string) => {
    if (!actorId) return actorRole || 'System';
    const u = users.find((usr) => usr.id === actorId);
    if (u) return `${u.name} (${u.email})`;
    return `${actorRole || 'User'} (${actorId.slice(0, 8)})`;
  };

  const formatActionBadge = (action: string) => {
    const isCreate = action.includes('created') || action.includes('CREATE') || action.includes('registered');
    const isUpdate = action.includes('updated') || action.includes('UPDATE') || action.includes('changed');
    const isApprove = action.includes('approved') || action.includes('APPROVE') || action.includes('confirmed');
    const isReject = action.includes('rejected') || action.includes('REJECT');

    const badgeClass = isApprove || isCreate
      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : isReject
      ? 'border-destructive/30 bg-destructive/10 text-destructive'
      : isUpdate
      ? 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300'
      : 'border-border bg-secondary text-secondary-foreground';

    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border ${badgeClass}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3.5 top-3 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search audit trail by summary, action, or entity..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-full pl-10 pr-4 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportToCsv}
            disabled={filteredLogs.length === 0}
            className="rounded-full text-xs h-9 px-4 gap-1.5"
          >
            <Download size={13} />
            Export CSV ({filteredLogs.length})
          </Button>
        </div>
      </div>

      {/* Structured Filters */}
      <div className="bg-card border border-border rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Filter size={13} className="text-muted-foreground" />
            Audit Trail Filters
          </span>
          {(selectedAction || selectedEntity || (isOwner && selectedBranch) || selectedActor || startDate || endDate || search) && (
            <button
              onClick={() => {
                setSearch('');
                setSelectedAction('');
                setSelectedEntity('');
                if (isOwner) setSelectedBranch('');
                setSelectedActor('');
                setStartDate('');
                setEndDate('');
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Reset all filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {/* Action Filter */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Action</label>
            <select
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Actions</option>
              {actionOptions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>

          {/* Entity Filter */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Entity</label>
            <select
              value={selectedEntity}
              onChange={(e) => setSelectedEntity(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">All Entities</option>
              {entityOptions.map((e) => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          {/* Branch Filter (Owner only) */}
          {isOwner && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Branch</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Branches</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name || b.branchName} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Actor Filter */}
          {users.length > 0 && (
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">Actor</label>
              <select
                value={selectedActor}
                onChange={(e) => setSelectedActor(e.target.value)}
                className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">All Users</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Start Date */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground block mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Immutable Audit Ledger</h3>
            <p className="text-xs text-muted-foreground">
              Append-only cryptographic transaction log. Modifying or deleting audit rows is blocked at the database engine level.
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {filteredLogs.length} record{filteredLogs.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-xs text-muted-foreground">
            No audit records match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border font-medium">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Timestamp</th>
                  <th className="py-2.5 px-4 font-semibold">Actor & Role</th>
                  <th className="py-2.5 px-4 font-semibold">Action</th>
                  <th className="py-2.5 px-4 font-semibold">Entity</th>
                  <th className="py-2.5 px-4 font-semibold">Summary</th>
                  <th className="py-2.5 px-4 font-semibold text-right">State Diff</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-foreground">
                {filteredLogs.map((log) => {
                  const hasDiff = Boolean(
                    log.old_value || log.oldValue || log.new_value || log.newValue
                  );
                  const actorId = log.user_id || log.userId;
                  const logBranch = log.branch_id || log.branchId;

                  return (
                    <tr key={log.id} className="hover:bg-muted/20 transition-colors">
                      <td className="py-3 px-4 whitespace-nowrap font-mono text-[11px] text-muted-foreground">
                        {new Date(log.created_at || log.createdAt || Date.now()).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-medium text-foreground">
                            {getActorLabel(actorId, log.role)}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {getBranchLabel(logBranch)}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {formatActionBadge(log.action)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="uppercase text-muted-foreground">{log.entity}</span>
                          {(log.entity_id || log.entityId) && (
                            <span className="text-[10px] text-muted-foreground/80">
                              #{String(log.entity_id || log.entityId).slice(0, 8)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs font-normal text-foreground max-w-md">
                        {log.summary || `${log.role} executed ${log.action} on ${log.entity}`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {hasDiff ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setActiveDiffLog(log)}
                            className="rounded-full text-[11px] h-7 px-3 gap-1 hover:bg-secondary"
                          >
                            <Eye size={12} />
                            View Diff
                          </Button>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">None</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Before / After Diff Modal */}
      {activeDiffLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4 animate-in fade-in duration-150"
          onClick={() => setActiveDiffLog(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-foreground">Audit State Diff</h3>
                  {formatActionBadge(activeDiffLog.action)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Entity: <span className="font-mono text-foreground uppercase">{activeDiffLog.entity}</span> ({activeDiffLog.entity_id || activeDiffLog.entityId})
                </p>
              </div>
              <button
                onClick={() => setActiveDiffLog(null)}
                className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 text-xs">
              {/* Summary Banner */}
              <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-foreground">
                <span className="font-medium text-muted-foreground block mb-0.5">Auditor Summary:</span>
                {activeDiffLog.summary || 'No description provided.'}
              </div>

              {/* Context info: IP & User Agent */}
              <div className="grid grid-cols-2 gap-3 text-[11px] font-mono text-muted-foreground">
                <div className="rounded-lg border border-border p-2 bg-card">
                  <span className="block text-[10px] text-muted-foreground/80 uppercase font-sans">Client IP</span>
                  {activeDiffLog.ip || '127.0.0.1'}
                </div>
                <div className="rounded-lg border border-border p-2 bg-card truncate" title={activeDiffLog.user_agent || activeDiffLog.userAgent || ''}>
                  <span className="block text-[10px] text-muted-foreground/80 uppercase font-sans">User Agent</span>
                  {activeDiffLog.user_agent || activeDiffLog.userAgent || 'Unknown'}
                </div>
              </div>

              {/* Side-by-side or stacked Before / After */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* Before (Old Value) */}
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1.5">
                  <span className="text-[11px] font-semibold text-destructive uppercase tracking-wider block">
                    Before (Old State)
                  </span>
                  <pre className="font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap max-h-60 p-2 rounded-lg bg-background/50 border border-border/40">
                    {activeDiffLog.old_value || activeDiffLog.oldValue
                      ? JSON.stringify(activeDiffLog.old_value || activeDiffLog.oldValue, null, 2)
                      : '<null> (Creation Event)'}
                  </pre>
                </div>

                {/* After (New Value) */}
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-1.5">
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider block">
                    After (New State)
                  </span>
                  <pre className="font-mono text-[11px] text-foreground overflow-x-auto whitespace-pre-wrap max-h-60 p-2 rounded-lg bg-background/50 border border-border/40">
                    {activeDiffLog.new_value || activeDiffLog.newValue
                      ? JSON.stringify(activeDiffLog.new_value || activeDiffLog.newValue, null, 2)
                      : '<null> (Deletion Event)'}
                  </pre>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-border flex justify-end bg-muted/10">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveDiffLog(null)}
                className="rounded-full text-xs px-4"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
