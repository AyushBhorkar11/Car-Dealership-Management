import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/owner/database')({
  beforeLoad: () => {
    throw redirect({ to: '/owner', search: { tab: 'database' } });
  },
});
