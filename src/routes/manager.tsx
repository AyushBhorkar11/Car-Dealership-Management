import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUserServerFn } from '@/lib/auth.functions';
import { workspaceQuery } from '@/lib/workspace-query';
import { ManagerDashboard } from '@/components/cdms/manager-dashboard';

export const Route = createFileRoute('/manager')({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUserServerFn();
    if (!user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }

    if (!['BRANCH_MANAGER', 'OWNER'].includes(user.role)) {
      if (user.role === 'EMPLOYEE') throw redirect({ to: '/employee' });
      throw redirect({ to: '/workspace' });
    }

    return { user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQuery),
  component: ManagerDashboard,
});
