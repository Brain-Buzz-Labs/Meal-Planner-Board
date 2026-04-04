import { redirect } from "next/navigation";
import Board from "@/components/Board";
import { auth } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

const authConfigured =
  !!process.env.NEON_AUTH_BASE_URL && !!process.env.NEON_AUTH_COOKIE_SECRET;

export default async function HomePage() {
  if (authConfigured) {
    let signedIn = false;
    try {
      const { data: session } = await auth.getSession();
      signedIn = !!session?.user?.id;
    } catch (err) {
      console.error("auth.getSession() failed:", err);
    }
    if (!signedIn) {
      redirect("/auth/sign-in");
    }
  }
  return <Board />;
}
