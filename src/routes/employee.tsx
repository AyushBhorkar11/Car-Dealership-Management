import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUserServerFn } from '@/lib/auth.functions';
import { workspaceQuery } from '@/lib/workspace-query';
import { EmployeeDashboard } from '@/components/cdms/employee-dashboard';

export const Route = createFileRoute('/employee')({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUserServerFn();
    if (!user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }

    if (!['EMPLOYEE', 'BRANCH_MANAGER', 'OWNER'].includes(user.role)) {
      throw redirect({ to: '/workspace' });
    }

    return { user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQuery),
  component: EmployeeDashboard,
});
