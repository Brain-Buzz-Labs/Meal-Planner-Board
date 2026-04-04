export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card shadow-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-center mb-6 text-foreground">Sign In</h1>
        <p className="text-sm text-muted-foreground text-center">
          Authentication is handled by Neon Auth. Configure your{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_NEON_AUTH_URL</code>{" "}
          environment variable to enable sign-in.
        </p>
      </div>
    </div>
  );
}
