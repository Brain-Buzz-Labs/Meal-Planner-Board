import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

const authConfigured =
  !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET;

const neonMiddleware = authConfigured
  ? auth.middleware({ loginUrl: "/auth/sign-in" })
  : null;

export default async function middleware(request: NextRequest) {
  if (!neonMiddleware) return NextResponse.next();
  return neonMiddleware(request);
}

export const config = {
  // Run on everything except Next internals, static assets, the auth UI routes,
  // and all API routes (they handle auth themselves and must return JSON, not redirects).
  matcher: ["/((?!_next/static|_next/image|favicon.ico|auth|api).*)"],
};
