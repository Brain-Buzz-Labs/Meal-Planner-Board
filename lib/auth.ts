import { NextRequest } from "next/server";
import { auth } from "@/lib/auth/server";

const authConfigured =
  !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET;

/**
 * Map user IDs to a shared owner ID so multiple users can see the same data.
 * Nicole shares Eric's dashboard.
 */
const USER_ID_ALIASES: Record<string, string> = {
  "395b063b-c2ee-403d-b82a-ac0d81c50eca": "5fce413f-5474-4600-9af6-8678bf35bd51",
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
    } catch {
      // Fall through to header-based auth
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
 * Require authentication. Returns the user ID or falls back to "default".
 */
export async function requireUserId(request: NextRequest): Promise<string> {
  const userId = await getUserId(request);
  return userId ?? "default";
}
