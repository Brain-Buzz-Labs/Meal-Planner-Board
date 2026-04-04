import { NextRequest } from "next/server";

/**
 * Extract the user ID from the request.
 * Neon Auth sends the authenticated user's ID via the Authorization header
 * as a Bearer token. Falls back to a query parameter for development.
 */
export function getUserId(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }

  // Fallback: check for x-user-id header (for development/testing)
  const userIdHeader = request.headers.get("x-user-id");
  if (userIdHeader) {
    return userIdHeader;
  }

  return null;
}

/**
 * Require authentication. Returns the user ID or throws a Response.
 */
export function requireUserId(request: NextRequest): string {
  const userId = getUserId(request);
  if (!userId) {
    throw new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return userId;
}
