import { ISSUER } from "@/lib/oauth";

export async function GET() {
  const baseUrl = ISSUER;

  return Response.json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/api/oauth/authorize`,
    token_endpoint: `${baseUrl}/api/oauth/token`,
    registration_endpoint: `${baseUrl}/api/oauth/register`,
    userinfo_endpoint: `${baseUrl}/api/oauth/userinfo`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: ["read", "write", "admin"],
  });
}
