import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

const authConfigured =
  !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET;

/**
 * Extract the user ID from the request.
 * Uses Neon Auth session cookie when configured, falls back to headers.
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  if (authConfigured) {
    try {
      const { data: session } = await auth.getSession();
      if (session?.user?.id) {
        return session.user.id;
      }
    } catch {
      // Fall through to header-based auth
    }
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  const userIdHeader = request.headers.get("x-user-id");
  if (userIdHeader) {
    return userIdHeader;
  }

  return null;
}

/**
 * Require authentication. Returns the user ID or falls back to "default".
 */
export async function requireUserId(request: NextRequest): Promise<string> {
  const userId = await getUserId(request);
  return userId ?? "default";
}
