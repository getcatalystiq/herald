import { extractBearerToken, verifyAccessToken } from "@/lib/oauth";

export async function requireAdmin(request: Request): Promise<
  | { userId: string; tenantId: string; scope: string }
  | Response
> {
  const token = extractBearerToken(request);
  if (!token) {
    return Response.json(
      { error: "Bearer token required" },
      { status: 401 }
    );
  }

  try {
    const payload = await verifyAccessToken(token);
    const scopes = payload.scope.split(" ");
    if (!scopes.includes("admin") && !scopes.includes("write")) {
      return Response.json(
        { error: "Admin or write scope required" },
        { status: 403 }
      );
    }
    return {
      userId: payload.sub,
      tenantId: payload.tenant_id,
      scope: payload.scope,
    };
  } catch {
    return Response.json(
      { error: "Invalid or expired token" },
      { status: 401 }
    );
  }
}

export function isErrorResponse(
  result: { userId: string; tenantId: string; scope: string } | Response
): result is Response {
  return result instanceof Response;
}
