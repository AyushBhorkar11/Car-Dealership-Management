import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { getCurrentUserServerFn } from '@/lib/auth.functions';

export interface CdmsUser {
  id: string;
  name: string;
  email: string;
  role: string;
  branchId: string | null;
}

export interface CdmsSession {
  user: CdmsUser;
}

interface SessionContextValue {
  session: CdmsSession | null;
  ready: boolean;
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue>({
  session: null,
  ready: false,
  refresh: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<CdmsSession | null>(null);
  const [ready, setReady] = useState(false);
  const query = useQueryClient();
  const router = useRouter();

  const fetchSession = async () => {
    try {
      const user = await getCurrentUserServerFn();
      if (user) {
        setSession({ user: user as CdmsUser });
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setReady(true);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const refresh = async () => {
    await fetchSession();
    router.invalidate();
    query.invalidateQueries();
  };

  return (
    <SessionContext.Provider value={{ session, ready, refresh }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
