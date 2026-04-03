import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { NeonAuthUIProvider, SignedIn, RedirectToSignIn } from "@neondatabase/neon-js/auth/react/ui";
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

function Router() {
  return (
    <>
      <SignedIn>
        <Switch>
          <Route path="/" component={Board} />
          <Route component={NotFound} />
        </Switch>
      </SignedIn>
      <RedirectToSignIn />
    </>
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
