"use client";

import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";

/**
 * Clears the React Query cache whenever the authenticated user ID changes
 * (sign-in, sign-out, or account switch). Prevents one user's cached data
 * from leaking into another user's session in the same tab.
 */
function AuthCacheGuard() {
  const queryClient = useQueryClient();
  const { data: session, isPending } = authClient.useSession();
  const currentUserId = session?.user?.id ?? null;
  // `undefined` sentinel means "session has never settled yet". Distinguishing
  // this from `null` (settled, signed-out) prevents a spurious cache clear on
  // the initial null -> userId transition when the page first loads.
  const lastSettledUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (isPending) return;
    if (lastSettledUserIdRef.current === undefined) {
      lastSettledUserIdRef.current = currentUserId;
      return;
    }
    if (lastSettledUserIdRef.current !== currentUserId) {
      lastSettledUserIdRef.current = currentUserId;
      queryClient.clear();
    }
  }, [isPending, currentUserId, queryClient]);

  return null;
}

export function Providers({
  children,
  authEnabled,
}: {
  children: React.ReactNode;
  authEnabled: boolean;
}) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 5,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  const content = (
    <QueryClientProvider client={queryClient}>
      {authEnabled && <AuthCacheGuard />}
      {children}
      <SonnerToaster position="bottom-center" richColors />
    </QueryClientProvider>
  );

  if (!authEnabled) {
    return content;
  }

  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(path) => router.push(path)}
      replace={(path) => router.replace(path)}
      Link={Link}
    >
      {content}
    </NeonAuthUIProvider>
  );
}
