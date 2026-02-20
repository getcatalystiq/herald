import { headers } from "next/headers";

export async function GET() {
  const h = await headers();
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
  const proto = h.get("x-forwarded-proto") || "https";
  const baseUrl = `${proto}://${host}`;

  return Response.json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ["read", "write", "admin"],
    bearer_methods_supported: ["header"],
  });
}
