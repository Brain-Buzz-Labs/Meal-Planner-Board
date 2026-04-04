export default function AccountPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-2xl font-bold text-foreground mb-6">Account Settings</h1>
        <p className="text-sm text-muted-foreground">
          Account management is handled by Neon Auth. Configure your{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 text-xs">NEXT_PUBLIC_NEON_AUTH_URL</code>{" "}
          environment variable to enable account management.
        </p>
      </div>
    </div>
  );
}
