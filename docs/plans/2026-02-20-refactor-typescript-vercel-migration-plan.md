---
title: Migrate Herald from Python/AWS to TypeScript/Vercel
type: refactor
status: active
date: 2026-02-20
deepened: 2026-02-20
---

# Migrate Herald from Python/AWS to TypeScript/Vercel

## Enhancement Summary

**Deepened on:** 2026-02-20
**Sections enhanced:** All phases + technical considerations
**Review agents used:** Security Sentinel, Performance Oracle, Architecture Strategist, TypeScript Reviewer, Code Simplicity Reviewer

### Key Improvements

1. **Security hardening**: Reject PKCE `plain` method (OAuth 2.1 requires S256-only), fix `timingSafeEqual` buffer length crash, add path traversal protection, add Zod validation for JWT payloads
2. **Simplified architecture**: Dropped from 6 phases to 3, eliminated `mcp_sessions` table (mcp-handler manages sessions), dropped `settings` table (use env vars), dropped platform admin endpoints (YAGNI), flattened `lib/` structure
3. **Latest stack**: Next.js 16.1 (Turbopack, `use cache` directive), React 19.2, TypeScript 5.9, mcp-handler 1.0.7

### New Considerations Discovered

- ~984 LOC of Python (21%) should NOT be ported — handled by mcp-handler, Next.js, or dropped entirely
- `bcryptjs` (pure JS) required instead of native `bcrypt` for Vercel serverless compatibility
- Next.js 16 explicit caching model (`use cache`) replaces implicit caching from v15
- Replace `[transport]` catch-all route with explicit `/api/mcp` route for clarity and security

---

## Overview

Full rewrite of Herald from Python Lambda + Aurora + S3 to a Next.js 16 App Router application on Vercel with Neon PostgreSQL and Vercel Blob. The frontend (already React/TypeScript) merges into the Next.js project. The MCP server uses `mcp-handler`. OAuth 2.1 is rewritten in TypeScript. Big bang rewrite — the codebase is small enough (~4,600 LOC backend + ~4,000 LOC frontend), and ~984 LOC of Python doesn't need porting at all.

## Problem Statement / Motivation

- AWS infrastructure (SAM, Lambda, Aurora, VPC, CloudFormation) is heavy for a small project
- Python backend + TypeScript frontend creates a split codebase
- Aurora Serverless + VPC + Lambda costs more than Vercel + Neon free tiers
- Deployment requires `sam build && sam deploy` vs just `git push`

## Proposed Solution

Replace the entire Python/AWS stack with a single Next.js 16 project deployed on Vercel:

| Layer | Current | Target |
|-------|---------|--------|
| Compute | 4 Lambda functions | Next.js API routes |
| Database | Aurora PostgreSQL (Data API) | Neon PostgreSQL (`@neondatabase/serverless`) |
| Storage | S3 + cross-account IAM | Vercel Blob (path-based tenant isolation) |
| MCP Server | Custom JSON-RPC handler | `mcp-handler` 1.0.7 (Vercel adapter) |
| Auth | Custom Python OAuth 2.1 | Custom TypeScript OAuth 2.1 |
| Frontend | Vite SPA on CloudFront | Next.js 16 App Router (SSR landing, client admin) |
| Deploy | SAM/CloudFormation | `vercel deploy` / git push |

### Tech Stack (Latest Versions)

| Package | Version | Purpose |
|---------|---------|---------|
| `next` | 16.1.x | Framework (Turbopack default, `use cache`, SSR) |
| `react` / `react-dom` | 19.2.x | UI library |
| `typescript` | 5.9.x | Type checking (stable; 6.0 is beta) |
| `mcp-handler` | 1.0.7 | MCP server on Vercel (Streamable HTTP + SSE) |
| `@modelcontextprotocol/sdk` | 1.25.x | MCP SDK (peer dep of mcp-handler) |
| `@neondatabase/serverless` | 1.0.x | Neon PostgreSQL driver |
| `@vercel/blob` | 2.3.x | Vercel Blob storage SDK |
| `jose` | 6.1.x | JWT sign/verify (HS256) |
| `bcryptjs` | 3.0.x | Password hashing (pure JS, Vercel-compatible) |
| `zod` | 3.x | Schema validation (JWT payloads, request bodies) |

> **Note:** Use `bcryptjs` (pure JavaScript) instead of native `bcrypt`. Native `bcrypt` requires C++ compilation which fails in Vercel's serverless environment.

## Implementation Phases

### Phase 1: Foundation (Scaffold + Database + OAuth)

Set up the Next.js 16 project, migrate the database schema to Neon, and implement the complete OAuth 2.1 server.

#### 1a. Project Scaffold

- [ ] Initialize Next.js 16 project with App Router, TypeScript 5.9, Tailwind CSS
  - `npx create-next-app@latest . --typescript --tailwind --app --src-dir=false`
  - Preserve existing `docs/`, `migrations/`, license/governance files
- [ ] Install dependencies:
  ```
  npm install @neondatabase/serverless jose bcryptjs @vercel/blob mcp-handler @modelcontextprotocol/sdk zod
  npm install -D @types/bcryptjs
  ```
- [ ] Add runtime validation for environment variables:

```typescript
// lib/env.ts
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  BLOB_READ_WRITE_TOKEN: z.string().min(1),
  NEXT_PUBLIC_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

- [ ] Create Neon sql client:

```typescript
// lib/db.ts
import { neon } from '@neondatabase/serverless';
import { env } from '@/lib/env';

export const sql = neon(env.DATABASE_URL);
```

- [ ] Set up Vercel project, link repo, configure environment variables:
  - `DATABASE_URL` (Neon connection string)
  - `BLOB_READ_WRITE_TOKEN` (Vercel Blob)
  - `JWT_SECRET` (32+ byte secret for HS256)
  - `NEXT_PUBLIC_URL` (app URL for OAuth issuer)

#### 1b. Database Migration

- [ ] Create Neon project and database
- [ ] Adapt migration SQL for Neon:
  - Replace `uuid_generate_v4()` → `gen_random_uuid()` (built-in PG 13+)
  - Drop `uuid-ossp` extension
  - Drop `mcp_sessions` table entirely (mcp-handler manages sessions)
  - Drop `settings` table entirely (use environment variables)
  - Simplify `tenant_buckets` table: drop `credentials_secret_arn`, `bucket_region`; repurpose `bucket_name` as Vercel Blob path prefix
  - Run migrations against Neon
- [ ] Create data migration script (`scripts/migrate-data.ts`) for moving existing Aurora data to Neon:
  - Export from Aurora via pg_dump or Data API queries
  - Transform UUIDs and timestamps as needed
  - Import into Neon
  - Verify row counts match

#### 1c. OAuth 2.1 Server

Port the complete OAuth implementation to TypeScript API routes. S256-only PKCE (OAuth 2.1 prohibits `plain`).

- [ ] `lib/oauth.ts` — All OAuth logic in one file (PKCE, JWT, DCR, user auth)

```typescript
// lib/oauth.ts
import crypto from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';

const jwtSecret = new TextEncoder().encode(env.JWT_SECRET);

// --- PKCE (S256 only, per OAuth 2.1) ---

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

export function verifyCodeChallenge(verifier: string, challenge: string): boolean {
  const computed = generateCodeChallenge(verifier);
  // Pad to equal length to prevent timingSafeEqual crash
  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// --- JWT ---

const AccessTokenPayload = z.object({
  sub: z.string().uuid(),
  tenant_id: z.string().uuid(),
  scope: z.string(),
  client_id: z.string(),
  token_type: z.literal('access_token'),
  iss: z.string(),
  aud: z.string().optional(),
});
type AccessTokenPayload = z.infer<typeof AccessTokenPayload>;

export async function createAccessToken(opts: {
  userId: string;
  tenantId: string;
  scope: string;
  clientId: string;
  issuer: string;
}): Promise<string> {
  return new SignJWT({
    sub: opts.userId,
    tenant_id: opts.tenantId,
    scope: opts.scope,
    client_id: opts.clientId,
    token_type: 'access_token' as const,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(opts.issuer)
    .setAudience(opts.issuer)
    .setExpirationTime('1h')
    .sign(jwtSecret);
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, jwtSecret);
  return AccessTokenPayload.parse(payload);
}

export function createRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString('base64url');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  return { token, hash };
}

// --- Users ---

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// --- Bearer token extraction ---

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
```

- [ ] `app/.well-known/oauth-authorization-server/route.ts` — RFC 8414 metadata
- [ ] `app/.well-known/oauth-protected-resource/route.ts` — RFC 9728 resource metadata
- [ ] `app/api/oauth/register/route.ts` — POST DCR endpoint
- [ ] `app/api/oauth/authorize/route.ts` — GET renders login page, POST authenticates + redirects
- [ ] `app/api/oauth/token/route.ts` — POST token exchange (auth code + refresh)
- [ ] `app/api/oauth/userinfo/route.ts` — GET user info from Bearer token
- [ ] `app/api/signup/route.ts` — POST self-service tenant+user creation
- [ ] `app/api/login/route.ts` — POST direct login

**Port the just-in-time DCR:** When `/authorize` receives an unknown `client_id` from an allowed domain (`claude.ai`, `localhost`, `127.0.0.1`), auto-register a public client. This is critical for Claude.ai MCP integration. Store allowed domains in an env var (`ALLOWED_DCR_DOMAINS`).

**Move authorize login form to a proper Next.js page** instead of inline HTML string. Use `app/oauth/authorize/page.tsx` as a client component that handles the login form and redirects.

**Security considerations:**
- Single-use authorization codes: delete on exchange, add unique constraint
- Reject `code_challenge_method=plain` — only S256 allowed
- Set `aud` (audience) claim on all JWTs
- Add rate limiting on `/api/oauth/token` and `/api/login` (use Vercel's `@vercel/firewall` or simple in-memory counter)

**Files:**

```
lib/env.ts
lib/db.ts
lib/oauth.ts
app/.well-known/oauth-authorization-server/route.ts
app/.well-known/oauth-protected-resource/route.ts
app/api/oauth/register/route.ts
app/api/oauth/authorize/route.ts
app/api/oauth/token/route.ts
app/api/oauth/userinfo/route.ts
app/api/signup/route.ts
app/api/login/route.ts
app/oauth/authorize/page.tsx
```

**Success criteria:** Full OAuth PKCE flow works end-to-end — register client, authorize (S256 only), get tokens, refresh, userinfo. `npm run dev` starts, Neon connection works, schema applied.

---

### Phase 2: MCP Server + Admin API

Set up the MCP server and port all admin endpoints.

#### 2a. MCP Server

- [ ] `lib/blob.ts` — Vercel Blob utilities with path traversal protection

```typescript
// lib/blob.ts
import { put, list, del } from '@vercel/blob';
import path from 'node:path';

export function tenantPath(tenantSlug: string, filePath: string): string {
  // Prevent path traversal attacks
  const normalized = path.normalize(filePath).replace(/^(\.\.[/\\])+/, '');
  if (normalized.startsWith('/') || normalized.includes('..')) {
    throw new Error('Invalid file path');
  }
  return `${tenantSlug}/${normalized}`;
}

export async function uploadFile(
  tenantSlug: string,
  filePath: string,
  content: string | Buffer,
  contentType?: string
) {
  const pathname = tenantPath(tenantSlug, filePath);
  return put(pathname, content, {
    access: 'public',
    addRandomSuffix: false,
    contentType,
  });
}
```

- [ ] `app/api/mcp/route.ts` — Explicit MCP route (not `[transport]` catch-all)

```typescript
// app/api/mcp/route.ts
import { createMcpHandler, withMcpAuth } from 'mcp-handler';
import { z } from 'zod';
import { verifyAccessToken } from '@/lib/oauth';

const handler = createMcpHandler(
  (server) => {
    server.registerTool('list_buckets', { /* zod schema */ }, listBucketsHandler);
    server.registerTool('publish_file', { /* zod schema */ }, publishFileHandler);
    server.registerTool('list_files', { /* zod schema */ }, listFilesHandler);
    server.registerTool('delete_file', { /* zod schema */ }, deleteFileHandler);
  },
  {},
  { basePath: '/api', maxDuration: 60 }
);

const authHandler = withMcpAuth(handler, async (_req, bearerToken) => {
  if (!bearerToken) return undefined;
  try {
    const payload = await verifyAccessToken(bearerToken);
    return {
      token: bearerToken,
      scopes: payload.scope.split(' '),
      clientId: payload.client_id,
      extra: { userId: payload.sub, tenantId: payload.tenant_id },
    };
  } catch {
    return undefined;
  }
}, { required: true });

export { authHandler as GET, authHandler as POST };
```

- [ ] Port 4 MCP tools from Python to TypeScript:
  - `list_buckets` — query `tenant_buckets JOIN bucket_access_grants`, return markdown list
  - `publish_file` — validate path (2+ segments), upload via Vercel Blob, log to `file_uploads`
  - `list_files` — Vercel Blob list with tenant prefix
  - `delete_file` — Vercel Blob del with tenant prefix
  - Drop `get_presigned_url` (not needed with Vercel Blob)
- [ ] Port scope checking: verify tool's required scope against `authInfo.scopes`

#### 2b. Admin API

- [ ] Port admin endpoints (15 routes → Next.js API routes):

| Route file | Methods | Ports from |
|---|---|---|
| `app/api/admin/buckets/route.ts` | GET, POST | `_list_buckets`, `_create_bucket` |
| `app/api/admin/buckets/[id]/route.ts` | GET, PUT, DELETE | `_get_bucket`, `_update_bucket`, `_delete_bucket` |
| `app/api/admin/buckets/[id]/files/route.ts` | GET | `_list_bucket_files` (Vercel Blob list) |
| `app/api/admin/buckets/[id]/access/route.ts` | GET, POST | `_list_access_grants`, `_create_access_grant` |
| `app/api/admin/buckets/[id]/access/[grantId]/route.ts` | DELETE | `_delete_access_grant` |
| `app/api/admin/users/route.ts` | GET, POST | `_list_users`, `_create_user` (bcryptjs!) |
| `app/api/admin/users/[id]/route.ts` | PUT, DELETE | `_update_user`, `_delete_user` |
| `app/api/admin/uploads/route.ts` | GET | `_list_uploads` |
| `app/api/admin/stats/route.ts` | GET | `_get_stats` (consolidate into 1-2 queries) |

- [ ] Admin auth: extract token, verify admin/write scope, get tenant_id — inline in a shared helper function, not a separate file
- [ ] **Fix password bug**: Use `bcryptjs` everywhere (the Python admin used SHA-256)
- [ ] **Drop platform admin endpoints** (YAGNI — fold super-admin into regular admin if needed later)
- [ ] Add security headers middleware (`middleware.ts`): CSP, X-Content-Type-Options, X-Frame-Options

**Files:**

```
lib/blob.ts
lib/mcp-tools.ts
app/api/mcp/route.ts
app/api/admin/buckets/route.ts
app/api/admin/buckets/[id]/route.ts
app/api/admin/buckets/[id]/files/route.ts
app/api/admin/buckets/[id]/access/route.ts
app/api/admin/buckets/[id]/access/[grantId]/route.ts
app/api/admin/users/route.ts
app/api/admin/users/[id]/route.ts
app/api/admin/uploads/route.ts
app/api/admin/stats/route.ts
middleware.ts
```

**Success criteria:** Claude.ai can connect, authenticate via OAuth, and use all tools. All admin API endpoints return correct data with tenant isolation enforced.

---

### Phase 3: Frontend + Cleanup + Deploy

Move React components into Next.js and clean up old code.

#### 3a. Frontend Migration

- [ ] Move UI components from `admin-ui/src/components/ui/` to `components/ui/`
- [ ] Move `lib/utils.ts` (cn helper)
- [ ] Install frontend deps: `@radix-ui/*`, `lucide-react`, `next-themes`, `tailwind-merge`, `clsx`
- [ ] Convert landing page to server components with `use cache`:
  - `app/page.tsx` — Landing page (SSR, `use cache` for static sections)
  - `app/layout.tsx` — Root layout with ThemeProvider
  - Move `components/landing/` (Header, Hero, Features, HowItWorks, Security, CTAFooter, Footer)
- [ ] Convert admin pages to client components:
  - `app/(admin)/layout.tsx` — Sidebar layout, auth check
  - `app/(admin)/dashboard/page.tsx`
  - `app/(admin)/buckets/page.tsx` + `app/(admin)/buckets/[id]/page.tsx`
  - `app/(admin)/users/page.tsx`
  - `app/(admin)/uploads/page.tsx`
- [ ] Convert auth flow:
  - `app/login/page.tsx` — Login page
  - `app/callback/page.tsx` — OAuth callback (client component)
  - Port `AuthContext.tsx` → React context
  - Port `oauth.ts` client-side flow (DCR, PKCE, token exchange)
  - Remove `VITE_API_URL` — API routes are same-origin now
- [ ] Replace React Router:
  - `react-router-dom` → `next/navigation` (`useRouter`, `usePathname`, `Link` from `next/link`)
  - `useParams` → `params` prop from page component
  - `ProtectedRoute` → layout-level auth check

#### 3b. Cleanup + Deploy

- [ ] Delete old files:
  - `src/` (entire Python backend)
  - `admin-ui/` (merged into Next.js)
  - `template.yaml`, `samconfig.toml.example`, `Dockerfile`, `requirements.txt`
  - `scripts/deploy.sh`, `scripts/db-tunnel.sh`, `scripts/migrate.sh`
  - `admin-ui/scripts/deploy.sh`
- [ ] Update `.gitignore` — remove Python entries, add `.next/`, `out/`
- [ ] Update `README.md` — new setup instructions for Vercel + Neon
- [ ] Update `CONTRIBUTING.md` — TypeScript development workflow
- [ ] Create `vercel.json` if needed
- [ ] Create migration script (`scripts/migrate.ts` — runs SQL files against Neon)
- [ ] Add cleanup cron for expired tokens/sessions (Vercel Cron):

```typescript
// app/api/cron/cleanup/route.ts
export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  // Delete expired auth codes, refresh tokens, sessions
  await sql`DELETE FROM oauth_authorization_codes WHERE expires_at < NOW()`;
  await sql`DELETE FROM oauth_refresh_tokens WHERE expires_at < NOW()`;
  return Response.json({ ok: true });
}
```

- [ ] Deploy to Vercel, verify all endpoints
- [ ] Update Claude.ai MCP server URL
- [ ] Update allowed auto-register domains

**Files:**

```
app/layout.tsx
app/page.tsx
app/login/page.tsx
app/callback/page.tsx
app/(admin)/layout.tsx
app/(admin)/dashboard/page.tsx
app/(admin)/buckets/page.tsx
app/(admin)/buckets/[id]/page.tsx
app/(admin)/users/page.tsx
app/(admin)/uploads/page.tsx
components/ui/*.tsx
components/landing/*.tsx
components/theme-provider.tsx
components/theme-toggle.tsx
lib/utils.ts
lib/auth-context.tsx
lib/oauth-client.ts
app/api/cron/cleanup/route.ts
vercel.json
```

**Success criteria:** Landing page renders server-side. Admin pages work with auth. `git push` triggers Vercel build, site is live, Claude.ai MCP integration works.

---

## Technical Considerations

### Database Migration

PostgreSQL schema is compatible between Aurora and Neon with minimal changes:

```sql
-- Before (Aurora)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
id UUID PRIMARY KEY DEFAULT uuid_generate_v4()

-- After (Neon)
-- No extension needed
id UUID PRIMARY KEY DEFAULT gen_random_uuid()
```

**Tables to drop:**
- `mcp_sessions` — mcp-handler manages its own sessions
- `settings` — use environment variables instead

All SQL queries port directly — Neon speaks the same PostgreSQL dialect. The `@neondatabase/serverless` sql template tag replaces the RDS Data API parameter marshaling:

```python
# Before (Python + RDS Data API)
aurora.query("SELECT * FROM users WHERE id = :id::uuid", {"id": user_id})
```

```typescript
// After (TypeScript + Neon)
const [user] = await sql`SELECT * FROM users WHERE id = ${userId}::uuid`;
```

### Data Migration Plan

1. Export existing Aurora data via `pg_dump` or RDS Data API queries
2. Map and transform data (UUIDs compatible, timestamps may need timezone normalization)
3. Import into Neon via `psql` or `@neondatabase/serverless`
4. Verify row counts and referential integrity
5. Re-hash any SHA-256 passwords to bcrypt (requires users to reset passwords, or migrate on next login)

### Vercel Blob vs S3

Storage model changes from per-tenant S3 buckets to a single Vercel Blob store with path-based isolation:

```
# Before: separate S3 buckets per tenant
s3://tenant-a-files/uploads/report.pdf

# After: single Blob store, path-prefixed
herald-blob/tenant-a/uploads/report.pdf
```

The `tenant_buckets` table simplifies — `bucket_name` becomes the Blob path prefix, and `credentials_secret_arn`/`bucket_region` are dropped.

**Path traversal protection:** The `tenantPath()` function normalizes paths and rejects `..` sequences to prevent cross-tenant access.

### Next.js 16 Specific

- **Turbopack is the default bundler** — no configuration needed, 5-10x faster Fast Refresh
- **`use cache` directive** — explicit opt-in caching replaces Next.js 15's implicit caching. Use on landing page components for static content.
- **Cache Components** — complete the PPR story. No `experimental.ppr` flag needed.
- **Node.js runtime for API routes** — all API routes use Node.js runtime (not Edge) for bcryptjs and crypto compatibility

### MCP Handler Auth Flow

`mcp-handler`'s `withMcpAuth` wraps the handler and provides `authInfo` to tools:

```
Client → POST /api/mcp (Bearer token)
  → withMcpAuth verifies token via verifyAccessToken()
  → Handler receives authInfo with userId, tenantId, scopes
  → Tool checks scope, queries DB with tenant isolation
```

### Known Bug Fix

The Python codebase has a password hashing inconsistency:
- `src/oauth/users.py` uses `bcrypt` (correct)
- `src/admin/tenant.py` `_create_user` uses `hashlib.sha256` (wrong)

The TypeScript migration standardizes on `bcryptjs` everywhere.

### What NOT to Port (~984 LOC)

| Python code | Why it's dropped |
|---|---|
| `src/mcp/protocol.py` (202 LOC) | mcp-handler + SDK handles JSON-RPC |
| `src/mcp/server.py` session management (~150 LOC) | mcp-handler manages sessions |
| `src/tools/registry.py` (156 LOC) | Zod schemas replace registry |
| `src/admin/platform.py` (245 LOC) | Platform admin dropped (YAGNI) |
| `src/db/aurora.py` RDS Data API (~130 LOC) | Neon driver replaces it |
| `src/oauth/server.py` HTTP routing (~100 LOC) | Next.js route handlers replace it |

## Acceptance Criteria

### Functional Requirements

- [ ] OAuth 2.1 flow works: DCR, S256-only PKCE authorize, token exchange, refresh, userinfo
- [ ] Just-in-time DCR works for Claude.ai (auto-register from allowed domains)
- [ ] MCP server at `/api/mcp` responds to initialize, tools/list, tools/call
- [ ] All 4 MCP tools work (list_buckets, publish_file, list_files, delete_file)
- [ ] Claude.ai can connect, authenticate, and publish files
- [ ] Admin UI: login, dashboard, buckets CRUD, users CRUD, uploads list
- [ ] Landing page renders server-side (SSR)
- [ ] Multi-tenant isolation: all queries scoped by tenant_id

### Non-Functional Requirements

- [ ] Deploy via `git push` to Vercel
- [ ] No AWS dependencies remain
- [ ] TypeScript strict mode enabled
- [ ] All passwords hashed with bcryptjs
- [ ] Path traversal protection on all file operations
- [ ] JWT tokens include `iss` and `aud` claims
- [ ] Zod validation on JWT payloads and request bodies
- [ ] Security headers set via middleware (CSP, X-Content-Type-Options, X-Frame-Options)

## Dependencies & Risks

| Risk | Mitigation |
|------|------------|
| Vercel Function 60s timeout for MCP | `mcp-handler` designed for this; set `maxDuration: 60` |
| Vercel Blob 4.5MB direct upload limit | Use client upload pattern for larger files |
| Neon cold starts | Neon serverless driver uses HTTP, cold starts are minimal (~100ms) |
| OAuth flow regression | Test with Claude.ai during Phase 1 before proceeding |
| bcrypt incompatibility | Use `bcryptjs` (pure JS) instead of native `bcrypt` |
| SHA-256 password migration | Users with SHA-256 hashes must reset password or migrate on next login |

## Project Structure (Final)

```
herald/
├── app/
│   ├── layout.tsx                            # Root layout + ThemeProvider
│   ├── page.tsx                              # Landing page (SSR, use cache)
│   ├── login/page.tsx
│   ├── callback/page.tsx
│   ├── oauth/
│   │   └── authorize/page.tsx                # OAuth login form (proper page)
│   ├── (admin)/
│   │   ├── layout.tsx                        # Admin sidebar + auth
│   │   ├── dashboard/page.tsx
│   │   ├── buckets/page.tsx
│   │   ├── buckets/[id]/page.tsx
│   │   ├── users/page.tsx
│   │   └── uploads/page.tsx
│   ├── api/
│   │   ├── oauth/
│   │   │   ├── register/route.ts
│   │   │   ├── authorize/route.ts
│   │   │   ├── token/route.ts
│   │   │   └── userinfo/route.ts
│   │   ├── admin/
│   │   │   ├── buckets/route.ts
│   │   │   ├── buckets/[id]/route.ts
│   │   │   ├── buckets/[id]/files/route.ts
│   │   │   ├── buckets/[id]/access/route.ts
│   │   │   ├── buckets/[id]/access/[grantId]/route.ts
│   │   │   ├── users/route.ts
│   │   │   ├── users/[id]/route.ts
│   │   │   ├── uploads/route.ts
│   │   │   └── stats/route.ts
│   │   ├── signup/route.ts
│   │   ├── login/route.ts
│   │   ├── mcp/route.ts                     # MCP handler (explicit route)
│   │   └── cron/cleanup/route.ts            # Token/session cleanup
│   └── .well-known/
│       ├── oauth-authorization-server/route.ts
│       └── oauth-protected-resource/route.ts
├── components/
│   ├── ui/                                    # shadcn/ui components
│   ├── landing/                               # Landing page sections
│   ├── theme-provider.tsx
│   └── theme-toggle.tsx
├── lib/
│   ├── env.ts                                 # Zod-validated env vars
│   ├── db.ts                                  # Neon client
│   ├── utils.ts                               # cn() helper
│   ├── blob.ts                                # Vercel Blob + path traversal guard
│   ├── oauth.ts                               # All OAuth logic (PKCE, JWT, DCR, users)
│   ├── mcp-tools.ts                           # MCP tool implementations
│   ├── auth-context.tsx                       # Client-side auth context
│   └── oauth-client.ts                        # Client-side OAuth flow
├── middleware.ts                               # Security headers, CORS
├── migrations/                                 # SQL files for Neon
├── scripts/
│   ├── migrate.ts                             # Run SQL migrations against Neon
│   └── migrate-data.ts                        # Aurora → Neon data migration
├── docs/
├── public/
└── vercel.json
```

## References & Research

### Internal References
- Brainstorm: `docs/brainstorms/2026-02-20-vercel-typescript-migration-brainstorm.md`
- Current schema: `migrations/001_initial_schema.sql`
- OAuth implementation: `src/oauth/server.py` (829 LOC)
- MCP server: `src/mcp/server.py` (370 LOC)
- MCP tools: `src/tools/tools.py` (646 LOC)
- Admin API: `src/admin/tenant.py` (718 LOC)
- Password hashing bug: `src/admin/tenant.py:_create_user` uses SHA-256, should be bcrypt

### External References
- [Next.js 16](https://nextjs.org/blog/next-16) — Turbopack default, `use cache`, Cache Components
- [Next.js 16.1](https://nextjs.org/blog/next-16-1) — FS caching for Turbopack dev (stable)
- [mcp-handler](https://github.com/vercel/mcp-handler) — Vercel MCP adapter for Next.js
- [@neondatabase/serverless](https://neon.com/docs/serverless/serverless-driver) — Neon driver
- [@vercel/blob](https://vercel.com/docs/vercel-blob/using-blob-sdk) — Vercel Blob SDK
- [jose](https://www.npmjs.com/package/jose) — JWT library (v6.1.x)
- [MCP Authorization spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization)
- [React 19.2](https://react.dev/blog/2025/10/01/react-19-2) — Latest React
