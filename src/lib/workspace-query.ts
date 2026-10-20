import { queryOptions } from '@tanstack/react-query';
import { getWorkspaceDataServerFn } from '@/lib/cdms.functions';

export const workspaceQuery = queryOptions({
  queryKey: ['workspace'],
  queryFn: async () => {
    return getWorkspaceDataServerFn();
  },
  refetchInterval: 15000, // 15 seconds live cross-role sync
  refetchIntervalInBackground: false, // pause when browser tab is inactive
  staleTime: 5000,
});

export type WorkspaceData = Awaited<ReturnType<NonNullable<typeof workspaceQuery.queryFn>>>;
