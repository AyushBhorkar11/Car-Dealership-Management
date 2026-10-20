import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { getCurrentUserServerFn } from '@/lib/auth.functions';

export const Route = createFileRoute('/_authenticated')({
  ssr: false,
  beforeLoad: async () => {
    const user = await getCurrentUserServerFn();
    if (!user) {
      throw redirect({ to: '/auth', search: { mode: 'login' } });
    }
    return { user };
  },
  component: () => <Outlet />,
});
