import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type StaffSession = {
  authenticated: boolean;
  name?: string;
  handle?: string;
  role?: string;
  tier?: string;
};

const SESSION_KEY = ["staff-session"] as const;

const StaffSessionContext = createContext<StaffSession | null>(null);

/**
 * Fetches the current staff session from `/api/auth/session`. The endpoint
 * never 401s — an unauthenticated caller gets `{ authenticated: false }`, which
 * lets the gate decide whether to show the access-code screen.
 */
export function useStaffSessionQuery() {
  return useQuery<StaffSession>({
    queryKey: SESSION_KEY,
    queryFn: () => api.get<StaffSession>("/api/auth/session"),
    staleTime: 5 * 60 * 1000,
  });
}

export function StaffSessionProvider({
  session,
  children,
}: {
  session: StaffSession;
  children: ReactNode;
}) {
  return (
    <StaffSessionContext.Provider value={session}>
      {children}
    </StaffSessionContext.Provider>
  );
}

/** Read the resolved staff session inside the authenticated tree. */
export function useStaffSession(): StaffSession {
  const ctx = useContext(StaffSessionContext);
  if (!ctx) {
    return { authenticated: false };
  }
  return ctx;
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { code: string; name: string }) =>
      api.post<StaffSession>("/api/auth/login", body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SESSION_KEY });
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>("/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}
