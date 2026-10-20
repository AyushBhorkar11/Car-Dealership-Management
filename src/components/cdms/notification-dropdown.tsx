import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import {
  Bell,
  Check,
  CheckCheck,
  UserPlus,
  Car,
  ArrowRightLeft,
  CheckSquare,
  Wallet,
  Calendar,
  Clock,
  ExternalLink,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { workspaceQuery } from '@/lib/workspace-query';
import {
  markNotificationAsReadServerFn,
  markAllNotificationsAsReadServerFn,
} from '@/lib/cdms.functions';
import { useSession } from './session';
import { getDashboardUrl } from './account-menu';
import { toast } from 'sonner';

interface NotificationDropdownProps {
  isTransparent?: boolean;
}

function formatRelativeTime(dateInput: string | Date | undefined): string {
  if (!dateInput) return '';
  const date = new Date(dateInput);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'LEAD':
      return <UserPlus size={14} className="text-blue-500" />;
    case 'TEST_DRIVE':
      return <Car size={14} className="text-emerald-500" />;
    case 'TRANSFER':
      return <ArrowRightLeft size={14} className="text-purple-500" />;
    case 'APPROVAL':
      return <CheckSquare size={14} className="text-amber-500" />;
    case 'BOOKING':
      return <Wallet size={14} className="text-teal-500" />;
    default:
      return <Bell size={14} className="text-muted-foreground" />;
  }
}

export function NotificationDropdown({ isTransparent = false }: NotificationDropdownProps) {
  const { session } = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const markReadFn = useServerFn(markNotificationAsReadServerFn);
  const markAllReadFn = useServerFn(markAllNotificationsAsReadServerFn);

  const { data } = useQuery({
    ...workspaceQuery,
    enabled: !!session,
  });

  const notifications = (data?.notifications || []) as any[];
  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const handleMarkAsRead = async (id: string, link?: string) => {
    try {
      await markReadFn({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });

      if (link && session) {
        const base = getDashboardUrl(session.user.role);
        const destination = link.startsWith('?') ? `${base}${link}` : link;
        navigate({ to: destination as any });
      }
    } catch (err: any) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllReadFn();
      await queryClient.invalidateQueries({ queryKey: ['workspace'] });
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error('Failed to mark all as read');
    }
  };

  if (!session) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="nav"
          size="icon"
          className="relative rounded-full hover:bg-secondary/80 transition-colors"
          title="Notifications"
          aria-label="View notifications"
        >
          <Bell size={18} className={isTransparent ? 'text-[var(--hero-foreground)]' : 'text-foreground'} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground px-1 shadow-xs animate-in zoom-in-50">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-80 md:w-96 rounded-2xl border border-border bg-card p-0 shadow-xl backdrop-blur-md text-foreground z-50 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <span className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full text-[10px] font-bold">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-[11px] font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <CheckCheck size={13} />
              Mark all read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-border/50">
          {notifications.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-10 h-10 rounded-full bg-muted/40 mx-auto flex items-center justify-center mb-2.5">
                <Bell size={18} className="text-muted-foreground/60" />
              </div>
              <p className="text-xs font-medium text-foreground">No notifications</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                New leads, approvals, and system alerts will appear here in real-time.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const isUnread = !n.is_read;
              return (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id, n.link)}
                  className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer text-left ${
                    isUnread
                      ? 'bg-secondary/40 hover:bg-secondary/70'
                      : 'hover:bg-secondary/30'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-card border border-border flex items-center justify-center shrink-0 mt-0.5 shadow-2xs">
                    {getNotificationIcon(n.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs leading-tight truncate ${isUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                        {n.title}
                      </p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {formatRelativeTime(n.created_at)}
                      </span>
                    </div>

                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                      {n.message}
                    </p>

                    {n.link && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary mt-1.5 hover:underline">
                        View details <ExternalLink size={10} />
                      </span>
                    )}
                  </div>

                  {isUnread && (
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0 mt-1.5" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-border bg-muted/10 flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live sync (every 15s)
          </span>
          <span>CDMS Central</span>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
