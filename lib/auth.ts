import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

const authConfigured =
  !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET;

/**
 * Map user IDs to a shared owner ID so multiple users can see the same data.
 * Nicole shares Eric's dashboard.
 */
const USER_ID_ALIASES: Record<string, string> = {
  "50a8c2f5-00ee-40ef-9d0d-73e32d2ac11b": "5fce413f-5474-4600-9af6-8678bf35bd51",
};

function resolveUserId(userId: string): string {
  return USER_ID_ALIASES[userId] ?? userId;
}

/**
 * Extract the user ID from the request.
 * Uses Neon Auth session cookie when configured, falls back to headers.
 */
export async function getUserId(request: NextRequest): Promise<string | null> {
  if (authConfigured) {
    try {
      const { data: session } = await auth.getSession();
      if (session?.user?.id) {
        return resolveUserId(session.user.id);
      }
    } catch (err) {
      console.error("auth.getSession() failed:", err);
    }
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return resolveUserId(authHeader.slice(7));
  }

  const userIdHeader = request.headers.get("x-user-id");
  if (userIdHeader) {
    return resolveUserId(userIdHeader);
  }

  return null;
}

/**
 * Require authentication. Returns the user ID, or null when auth is configured
 * and no valid session resolves. Only falls back to "default" in local dev
 * where Neon Auth is not configured.
 */
export async function requireUserId(request: NextRequest): Promise<string | null> {
  const userId = await getUserId(request);
  if (userId) return userId;
  if (!authConfigured) return "default";
  return null;
}

/**
 * Convenience helper for API routes. Returns either the resolved user ID
 * string, or a 401 NextResponse that the caller should return directly.
 *
 * Usage:
 *   const auth = await requireUserIdOrRespond(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const userId = auth;
 */
export async function requireUserIdOrRespond(
  request: NextRequest
): Promise<string | NextResponse> {
  const userId = await requireUserId(request);
  if (userId) return userId;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
