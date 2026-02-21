# Herald

MCP server that enables AI agents to publish files and websites via OAuth 2.1.

## Stack

- **Next.js 16** (App Router) + TypeScript
- **Neon PostgreSQL** (serverless driver)
- **Vercel Blob** for file storage
- **Vercel** for deployment
- **mcp-handler** for MCP protocol
- **jose** for JWT, **bcryptjs** for password hashing

## Build & Run

```bash
npm run dev       # Dev server (Turbopack)
npm run build     # Production build (Turbopack)
npm run migrate   # Run database migrations
npm run lint      # ESLint
```

Always build with Turbopack — it's configured in `package.json` scripts.

## Key Constraints

### Turbopack JSON Response Bug

`Response.json()` and `NextResponse.json()` fail silently in Turbopack production builds for certain route paths (e.g., `.well-known`). Always use the `jsonResponse()` helper from `lib/oauth.ts`:

```typescript
import { jsonResponse } from "@/lib/oauth";
jsonResponse({ data }, 200);
```

### Database Access

- Use `neon()` tagged template (via `lib/db.ts` proxy) for queries
- Use `Pool` for DDL/migrations (unpooled connection)
- `lib/db.ts` exports a Proxy with callable function target for lazy initialization

### MCP Endpoints

Two endpoints serve MCP — both are required:
- `/api/mcp` — Standard MCP endpoint
- `/mcp` — Root-level endpoint for Claude Desktop compatibility

### OAuth 2.1

- PKCE with S256 only (plain not supported)
- Authorization codes: 10-minute expiry
- Access tokens: JWT with HS256, 1-hour expiry
- Refresh tokens: 30-day expiry with rotation
- JIT auto-registration for allowed domains (claude.ai, localhost)

## Project Structure

```
app/
  (admin)/          # Protected admin UI (dashboard, buckets, uploads, users)
  api/
    oauth/          # OAuth endpoints (authorize, token, register, userinfo)
    admin/          # Admin CRUD (buckets, users, stats, uploads)
    mcp/            # MCP Streamable HTTP transport
    cron/cleanup    # Token cleanup (runs every 6 hours via Vercel cron)
  .well-known/      # OAuth server metadata (RFC 8414)
  mcp/              # Root-level MCP endpoint
  sites/[...path]/  # File proxy for serving published files
lib/
  oauth.ts          # OAuth 2.1 implementation (core auth logic)
  oauth-client.ts   # Client-side OAuth flow for admin UI
  mcp-tools.ts      # MCP tool definitions (list_buckets, publish_file, etc.)
  blob.ts           # Vercel Blob storage integration
  db.ts             # Neon database client (lazy-init Proxy)
  admin-auth.ts     # Bearer token & scope validation
  auth-context.tsx  # React context for auth state
  env.ts            # Environment variable validation (Zod)
migrations/
  001_neon_schema.sql  # Full schema (tenants, users, oauth, buckets, uploads)
scripts/
  migrate.ts        # Migration runner
middleware.ts       # CORS, security headers, frame policy
```

## MCP Tools

| Tool | Scope | Description |
|------|-------|-------------|
| `list_buckets` | `read` | List accessible buckets with permissions |
| `publish_file` | `write` | Upload file to a bucket |
| `list_files` | `read` | List files in a bucket |
| `delete_file` | `write` | Delete a file from a bucket |

## Multi-Tenancy

Every table has a `tenant_id` FK. Queries are always filtered by tenant. Vercel Blob paths follow `tenant-slug/bucket-name/file-path`.

## Environment Variables

Required: `DATABASE_URL`, `JWT_SECRET`, `BLOB_READ_WRITE_TOKEN`, `NEXT_PUBLIC_URL`
Optional: `ENVIRONMENT`, `CRON_SECRET`, `ALLOWED_DCR_DOMAINS`

See `.env.example` for the template.
