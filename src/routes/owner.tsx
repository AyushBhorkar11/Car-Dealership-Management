import { createFileRoute, redirect } from '@tanstack/react-router';
import { getCurrentUserServerFn } from '@/lib/auth.functions';
import { workspaceQuery } from '@/lib/workspace-query';
import { OwnerDashboard } from '@/components/cdms/owner-dashboard';

export const Route = createFileRoute('/owner')({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  beforeLoad: async () => {
    const user = await getCurrentUserServerFn();
    if (!user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }

    if (user.role !== 'OWNER') {
      if (user.role === 'BRANCH_MANAGER') throw redirect({ to: '/manager' });
      if (user.role === 'EMPLOYEE') throw redirect({ to: '/employee' });
      throw redirect({ to: '/workspace' });
    }

    return { user };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(workspaceQuery),
  component: OwnerDashboard,
});
