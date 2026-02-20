---
date: 2026-02-20
topic: vercel-typescript-migration
---

# Migrate Herald from Python/AWS to TypeScript/Vercel

## What We're Building

A full rewrite of Herald's backend from Python (Lambda + Aurora + S3) to TypeScript (Next.js + Neon + Vercel Blob), deployed on Vercel. The frontend is already React/TypeScript and will be absorbed into the Next.js project. The MCP server will use the official TypeScript MCP SDK.

## Why This Approach

**Motivation:** Simpler deployment (push-to-deploy vs SAM/CloudFormation), unified TypeScript codebase, and lower costs (Vercel + Neon free tiers vs Aurora + Lambda + VPC).

**Approaches considered:**
1. **Next.js monorepo** (chosen) - Single project with API routes + React frontend. Native Vercel deployment, SSR for landing page, serverless API routes for backend.
2. **Hono + separate frontend** - Lighter backend but requires managing two deployments and loses SSR benefits.
3. **Separate API + Vite SPA** - Most similar to current architecture but doubles deployment complexity.

Next.js was chosen because it unifies frontend and backend, has first-class Vercel support, and allows SSR for the landing page (better SEO).

## Key Decisions

- **Framework:** Next.js (App Router) on Vercel
- **Database:** Neon (serverless PostgreSQL) - same SQL dialect, existing migrations can be reused with minor changes
- **Storage:** Vercel Blob with path-based tenant isolation (`/tenant-slug/files/...`). Drop cross-account S3 bucket support for simplicity.
- **OAuth:** Full TypeScript rewrite of the existing OAuth 2.1 server (DCR, PKCE, JWT, user auth). Keep full control since MCP spec requires specific OAuth flows.
- **MCP Server:** Use `mcp-handler` (Vercel's MCP adapter for Next.js) which wraps `@modelcontextprotocol/sdk`. Provides Streamable HTTP transport, tool registration with Zod schemas, and SSE support — purpose-built for Vercel deployments.
- **Database queries:** Raw SQL via `@neondatabase/serverless` with sql template literals. No ORM — keeps it simple and closest to current Python approach.
- **Auth tokens:** Continue with HS256 JWTs (jose library in TypeScript)

## Migration Mapping

| Current (Python/AWS) | Target (TypeScript/Vercel) |
|----------------------|---------------------------|
| Lambda functions (4) | Next.js API routes |
| Aurora PostgreSQL | Neon PostgreSQL |
| S3 + cross-account IAM | Vercel Blob (single store, path isolation) |
| API Gateway | Next.js built-in routing |
| CloudFront (Admin UI) | Vercel Edge Network |
| CloudFront (Landing) | Next.js SSR pages |
| SAM/CloudFormation | `vercel deploy` / Git push |
| RDS Data API queries | @neondatabase/serverless (raw SQL) |
| boto3 (S3 client) | @vercel/blob SDK |
| python-jose (JWT) | jose (npm) |
| bcrypt (passwords) | bcrypt (npm) |
| AWS Secrets Manager | Vercel Environment Variables |

## What Gets Simpler

- **No VPC** - Neon is accessible over the internet with connection strings
- **No IAM roles** - Vercel Blob uses API tokens, not IAM
- **No CloudFormation** - Push to deploy
- **No cross-account complexity** - Single Blob store
- **Unified language** - TypeScript everywhere
- **SSR landing page** - Better SEO and performance

## What Gets Dropped

- Cross-account S3 bucket support (tenant-managed buckets)
- STS assume role for bucket access
- AWS Secrets Manager for bucket credentials
- Platform Admin API (IAM-authenticated) - fold into regular admin
- RDS Data API (replaced by standard PostgreSQL connection)

## Project Structure (Target)

```
herald/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page (SSR)
│   ├── login/page.tsx
│   ├── dashboard/page.tsx
│   ├── buckets/
│   ├── users/
│   ├── api/
│   │   ├── oauth/               # OAuth endpoints
│   │   │   ├── register/route.ts
│   │   │   ├── authorize/route.ts
│   │   │   ├── token/route.ts
│   │   │   └── userinfo/route.ts
│   │   ├── admin/               # Admin API
│   │   │   ├── buckets/route.ts
│   │   │   ├── users/route.ts
│   │   │   └── stats/route.ts
│   │   └── mcp/route.ts         # MCP server endpoint
│   └── .well-known/
│       └── oauth-authorization-server/route.ts
├── lib/
│   ├── db/                       # Drizzle schema + queries
│   ├── oauth/                    # OAuth logic
│   ├── mcp/                      # MCP server setup
│   └── blob/                     # Vercel Blob utilities
├── components/                   # React components (moved from admin-ui)
├── migrations/                   # SQL migrations
└── vercel.json
```

## Resolved Questions

- **MCP transport on Vercel:** Solved by `mcp-handler` — Vercel's official MCP adapter for Next.js. Handles Streamable HTTP transport and SSE with optional Redis resumability.

## Open Questions

None — all key decisions resolved.

## Next Steps

-> `/workflows:plan` for implementation details
