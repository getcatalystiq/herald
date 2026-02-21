import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyAccessToken } from "@/lib/oauth";
import { registerTools } from "@/lib/mcp-tools";

const handler = createMcpHandler(
  (server) => {
    registerTools(server);
  },
  {},
  { basePath: "/", maxDuration: 60 }
);

const authHandler = withMcpAuth(
  handler,
  async (_req, bearerToken) => {
    if (!bearerToken) return undefined;
    try {
      const payload = await verifyAccessToken(bearerToken);
      return {
        token: bearerToken,
        scopes: payload.scope.split(" "),
        clientId: payload.client_id,
        extra: {
          userId: payload.sub,
          tenantId: payload.tenant_id,
        },
      };
    } catch {
      return undefined;
    }
  },
  { required: true }
);

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
