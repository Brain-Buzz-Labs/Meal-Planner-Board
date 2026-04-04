"use client";

import { usePathname } from "next/navigation";
import { AccountView } from "@neondatabase/auth/react";

export default function AccountPage() {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-background px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
      <div className="mx-auto max-w-5xl">
        <AccountView pathname={pathname} />
      </div>
    </div>
  );
}
