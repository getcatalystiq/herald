import { ISSUER } from "@/lib/oauth";

export async function GET() {
  const baseUrl = ISSUER;

  return Response.json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ["read", "write", "admin"],
    bearer_methods_supported: ["header"],
  });
}
