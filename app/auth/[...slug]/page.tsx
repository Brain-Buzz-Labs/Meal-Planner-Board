"use client";

import { AuthView } from "@neondatabase/auth/react";

export default function AuthPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 sm:p-6">
      <AuthView pathname="/auth/sign-in" />
    </div>
  );
}
