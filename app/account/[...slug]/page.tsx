"use client";

import { useContext } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AccountView, UserButton, AuthUIContext } from "@neondatabase/auth/react";
import { CookingPot, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";

export default function AccountPage() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();
  const authContext = useContext(AuthUIContext);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between shadow-sm">
        <Link href="/" className="flex items-center gap-2 sm:gap-3">
          <CookingPot className="w-8 h-8 sm:w-10 sm:h-10 text-primary" />
          <h1 className="text-lg sm:text-2xl font-bold text-foreground">Meal Planner</h1>
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="rounded-full h-8 w-8 sm:h-9 sm:w-9">
            {theme === "dark" ? <Sun className="w-4 h-4 sm:w-5 sm:h-5 text-primary" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5 text-foreground/70" />}
          </Button>
          {authContext && <UserButton />}
        </div>
      </header>

      <div className="flex-1 px-4 py-6 sm:px-6 sm:py-8 md:px-8 md:py-10">
        <div className="mx-auto max-w-5xl">
          <AccountView pathname={pathname} />
        </div>
      </div>
    </div>
  );
}
