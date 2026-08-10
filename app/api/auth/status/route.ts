import { cookies } from "next/headers";
import { AUTH_COOKIE, isAuthenticationEnabled, verifySessionToken } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAuthenticationEnabled()) {
    return Response.json({
      enabled: false,
      authenticated: true,
      user: { id: "admin", username: "admin", role: "admin" },
    });
  }
  const cookieStore = await cookies();
  const session = await verifySessionToken(cookieStore.get(AUTH_COOKIE)?.value);
  const user = session ? { id: session.id, username: session.username, role: session.role } : null;
  return Response.json({ enabled: true, authenticated: Boolean(session), user });
}
