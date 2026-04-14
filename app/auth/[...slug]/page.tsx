"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { createRoot } from "react-dom/client";
import { CookingPot, Eye, EyeOff } from "lucide-react";
import { AuthView } from "@neondatabase/auth/react";

export default function AuthPage() {
  const pathname = usePathname();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pathname?.endsWith("/sign-in")) return;
    const container = containerRef.current;
    if (!container) return;

    let cleanup: (() => void) | undefined;

    const hideSignup = () => {
      const links = container.querySelectorAll<HTMLAnchorElement>('a[href*="sign-up"]');
      links.forEach((a) => {
        const wrapper = a.closest("p, div");
        (wrapper ?? a).setAttribute("hidden", "");
      });
    };

    const tryAttach = () => {
      const input = container.querySelector<HTMLInputElement>('input[type="password"]');
      if (!input || input.dataset.eyeToggleAttached) return false;
      input.dataset.eyeToggleAttached = "true";

      const parent = input.parentElement;
      if (!parent) return false;
      if (getComputedStyle(parent).position === "static") {
        parent.style.position = "relative";
      }
      input.classList.add("pr-10");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", "Toggle password visibility");
      btn.className =
        "absolute top-1/2 right-2 -translate-y-1/2 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors";
      parent.appendChild(btn);

      const root = createRoot(btn);
      let visible = false;
      const render = () =>
        root.render(visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />);
      render();

      btn.addEventListener("click", () => {
        visible = !visible;
        input.type = visible ? "text" : "password";
        render();
      });

      cleanup = () => {
        root.unmount();
        btn.remove();
      };
      return true;
    };

    hideSignup();
    if (tryAttach()) {
      const signupObserver = new MutationObserver(() => hideSignup());
      signupObserver.observe(container, { childList: true, subtree: true });
      return () => {
        signupObserver.disconnect();
        cleanup?.();
      };
    }

    const observer = new MutationObserver(() => {
      hideSignup();
      if (tryAttach()) observer.disconnect();
    });
    observer.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      cleanup?.();
    };
  }, [pathname]);

  return (
    <div
      ref={containerRef}
      className="min-h-screen flex flex-col items-center justify-center bg-background p-4 sm:p-6"
    >
      <div className="flex items-center gap-3 mb-6 sm:mb-8">
        <CookingPot className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Meal Planner</h1>
      </div>
      <AuthView pathname={pathname ?? "/auth/sign-in"} />
    </div>
  );
}
