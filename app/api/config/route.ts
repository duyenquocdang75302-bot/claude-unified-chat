import { NextRequest } from "next/server";
import { getBaseUrl } from "@/lib/server/upstream";
import { isAuthenticationEnabled, sessionFromRequest } from "@/lib/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await sessionFromRequest(request);
  return Response.json({
    baseUrl: getBaseUrl(),
    passwordEnabled: isAuthenticationEnabled(),
    user: session
      ? { id: session.id, username: session.username, role: session.role }
      : null,
  });
}
