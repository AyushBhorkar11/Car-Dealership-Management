import { useState } from 'react';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  LayoutDashboard,
  User,
  Settings,
  LogOut,
  Sun,
  Moon,
  Laptop,
  ChevronDown,
  Building2,
  Shield,
  Check,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { logoutServerFn } from '@/lib/auth.functions';
import { useSession, type CdmsUser } from './session';

export function getDashboardUrl(role: string): string {
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

export function getRoleBadge(role: string) {
  switch (role) {
    case 'OWNER':
      return {
        label: 'Owner',
        className: 'bg-primary/10 text-primary border-primary/20',
      };
    case 'BRANCH_MANAGER':
      return {
        label: 'Branch Manager',
        className: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30',
      };
    case 'EMPLOYEE':
      return {
        label: 'Employee',
        className: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      };
    case 'CUSTOMER':
    default:
      return {
        label: 'Customer',
        className: 'bg-muted text-muted-foreground border-border',
      };
  }
}

export function getInitials(name: string): string {
  if (!name) return 'U';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface AccountMenuProps {
  user: CdmsUser;
  isTransparent?: boolean;
}

export function AccountMenu({ user, isTransparent = false }: AccountMenuProps) {
  const { refresh } = useSession();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = getInitials(user.name);
  const firstName = user.name.split(' ')[0] || user.name;
  const roleBadge = getRoleBadge(user.role);
  const dashboardUrl = getDashboardUrl(user.role);

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await logoutServerFn();
      await refresh();
      navigate({ to: '/auth', search: { mode: 'login' } });
    } catch {
      window.location.href = '/auth';
    } finally {
      setLoggingOut(false);
    }
  };

  const setTheme = (theme: 'light' | 'dark' | 'system') => {
    if (theme === 'system') {
      localStorage.removeItem('cdms-theme');
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      document.documentElement.dataset['theme'] = prefersLight ? 'light' : 'dark';
      if (prefersLight) {
        document.documentElement.classList.remove('dark');
      } else {
        document.documentElement.classList.add('dark');
      }
    } else {
      localStorage.setItem('cdms-theme', theme);
      document.documentElement.dataset['theme'] = theme;
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const currentTheme =
    typeof window !== 'undefined'
      ? localStorage.getItem('cdms-theme') || 'system'
      : 'system';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full text-xs transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            isTransparent
              ? 'bg-[var(--on-image)] text-[var(--on-image-foreground)] border border-[var(--on-image-border)] hover:opacity-90'
              : 'bg-card text-foreground border border-border hover:bg-secondary/70 shadow-xs'
          }`}
          aria-label="User account menu"
        >
          <Avatar className="h-6 w-6 text-[10px] font-semibold border border-border/50">
            <AvatarFallback className="bg-primary text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-xs max-w-[110px] truncate">{firstName}</span>
          <span
            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded-full border leading-tight ${roleBadge.className}`}
          >
            {roleBadge.label}
          </span>
          <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 rounded-2xl border border-border bg-popover text-popover-foreground p-2 shadow-xl"
      >
        {/* User Identity Header */}
        <div className="px-2 py-2.5 border-b border-border/70 mb-1">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 text-xs font-semibold border border-border/80">
              <AvatarFallback className="bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground truncate">{user.name}</p>
              <p className="text-[11px] font-mono text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-border/40">
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleBadge.className}`}
            >
              {roleBadge.label}
            </span>
            <span className="text-[10px] text-muted-foreground truncate">
              {user.role === 'OWNER' ? 'National HQ (All Branches)' : user.branchId ? 'Assigned Branch' : 'Direct Member'}
            </span>
          </div>
        </div>

        {/* Navigation Actions */}
        <DropdownMenuGroup className="py-1">
          <DropdownMenuItem asChild>
            <Link
              to={dashboardUrl as any}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
              <span>{user.role === 'OWNER' ? 'Executive Dashboard' : 'My Dashboard'}</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              to="/workspace"
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <User className="h-4 w-4 text-muted-foreground" />
              <span>Account & Profile</span>
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 bg-border/70" />

        {/* Theme Selector Submenu */}
        <DropdownMenuGroup>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors hover:bg-accent hover:text-accent-foreground">
              <Sun className="h-4 w-4 text-muted-foreground" />
              <span>Appearance Theme</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="w-36 rounded-xl border border-border bg-popover text-popover-foreground p-1 shadow-lg">
                <DropdownMenuItem
                  onClick={() => setTheme('light')}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Sun className="h-3.5 w-3.5" /> Light
                  </span>
                  {currentTheme === 'light' && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme('dark')}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Moon className="h-3.5 w-3.5" /> Dark
                  </span>
                  {currentTheme === 'dark' && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setTheme('system')}
                  className="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs cursor-pointer hover:bg-accent hover:text-accent-foreground"
                >
                  <span className="flex items-center gap-2">
                    <Laptop className="h-3.5 w-3.5" /> System
                  </span>
                  {currentTheme === 'system' && <Check className="h-3 w-3" />}
                </DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 bg-border/70" />

        {/* Sign Out Action */}
        <DropdownMenuItem
          disabled={loggingOut}
          onClick={handleSignOut}
          className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-xs font-medium text-destructive cursor-pointer transition-colors hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          <span>{loggingOut ? 'Signing out...' : 'Sign Out'}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
