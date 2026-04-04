import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NeonAuthUIProvider, SignedIn, SignedOut, AuthLoading, AuthView, AccountView } from "@neondatabase/neon-js/auth/react/ui";
import { authClient } from "@/lib/auth";
import NotFound from "@/pages/not-found";
import Board from "@/pages/Board";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

function AuthPage() {
  const pathname = window.location.pathname.replace(/^\/auth\//, "");
  return (
    <div className="auth-page-wrapper min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg p-6 sm:p-8">
        <AuthView pathname={pathname} />
      </div>
    </div>
  );
}

function AccountPage() {
  const pathname = window.location.pathname.replace(/^\/account\//, "");
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <AccountView pathname={pathname} />
      </div>
    </div>
  );
}

function ProtectedContent({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-pulse flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-muted-foreground font-medium">Loading...</p>
          </div>
        </div>
      </AuthLoading>
      <SignedIn>
        {children}
      </SignedIn>
      <SignedOut>
        <Redirect to="/auth/sign-in" />
      </SignedOut>
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/auth/:rest*" component={AuthPage} />
      <Route path="/account/:rest*">
        <ProtectedContent>
          <AccountPage />
        </ProtectedContent>
      </Route>
      <Route path="/">
        <ProtectedContent>
          <Board />
        </ProtectedContent>
      </Route>
      <Route>
        <ProtectedContent>
          <NotFound />
        </ProtectedContent>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <NeonAuthUIProvider authClient={authClient}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
          <SonnerToaster position="bottom-right" richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </NeonAuthUIProvider>
  );
}

export default App;
