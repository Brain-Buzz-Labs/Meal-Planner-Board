"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { NeonAuthUIProvider } from "@neondatabase/auth/react";
import { authClient } from "@/lib/auth/client";

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
