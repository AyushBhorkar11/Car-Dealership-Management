import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';

export const getBranchAnalyticsServerFn = createServerFn({ method: 'GET' })
  .validator((d?: { period?: 'today' | '7days' | '30days' | 'this_year'; branchId?: string }) => d)
  .handler(async ({ data }) => {
    const { fetchBranchAnalytics } = await import('../server/analytics');
    return fetchBranchAnalytics(data?.branchId, data?.period);
  });

export const getOwnerAnalyticsServerFn = createServerFn({ method: 'GET' }).handler(async () => {
  const { fetchOwnerAnalytics } = await import('../server/analytics');
  return fetchOwnerAnalytics();
});
