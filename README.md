# Herald

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![MCP](https://img.shields.io/badge/MCP-2025--03--26-green.svg)](https://modelcontextprotocol.io)

Publish websites and files, with AI agents. Herald is an MCP server that enables AI agents to publish files through OAuth 2.1 authentication.

## Features

- **OAuth 2.1 Server** - Complete implementation with S256-only PKCE, Dynamic Client Registration, and JWT tokens
- **MCP Server** - Model Context Protocol server for AI agent integration (works with Claude.ai)
- **Multi-tenant Architecture** - Isolated tenants with role-based access control
- **File Publishing** - Secure storage management with Vercel Blob and per-user access grants
- **Admin Dashboard** - Next.js App Router dashboard for managing tenants, users, and buckets
- **Edge-ready** - Runs on Vercel with Neon PostgreSQL

## Architecture

```
┌─────────────────┐     ┌──────────────────┐
│   Claude.ai     │────▶│   Vercel Edge    │
│   (AI Agent)    │     │   /api/mcp       │
└─────────────────┘     └────────┬─────────┘
                                 │
┌─────────────────┐              │
│   Admin UI      │──────────────┤
│   (Next.js)     │              ▼
└─────────────────┘     ┌─────────────────┐
                        │   Neon          │
┌─────────────────┐     │   PostgreSQL    │
│   OAuth Flow    │────▶│                 │
│   (Browser)     │     └─────────────────┘
└─────────────────┘              │
                                 ▼
                        ┌─────────────────┐
                        │  Vercel Blob    │
                        │  (per tenant)   │
                        └─────────────────┘
```

## Prerequisites

- Node.js 20+
- A [Vercel](https://vercel.com) account
- A [Neon](https://neon.tech) PostgreSQL database
- A Vercel Blob store

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/nichochar/herald.git
cd herald
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment

Create a `.env.local` file:

```env
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/herald
JWT_SECRET=your-secret-at-least-32-characters-long
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx
NEXT_PUBLIC_URL=http://localhost:3000
```

### 4. Run migrations

```bash
npx tsx scripts/migrate.ts
```

### 5. Start development server

```bash
npm run dev
```

### 6. Create your first tenant

```bash
curl -X POST http://localhost:3000/api/signup \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_name": "My Company",
    "email": "admin@example.com",
    "password": "your-password-here"
  }'
```

## Deploy to Vercel

```bash
# Link to Vercel
npx vercel link

# Set environment variables
npx vercel env add DATABASE_URL
npx vercel env add JWT_SECRET
npx vercel env add BLOB_READ_WRITE_TOKEN
npx vercel env add NEXT_PUBLIC_URL

# Deploy
npx vercel --prod
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | Neon PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | Yes |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob read/write token | Yes |
| `NEXT_PUBLIC_URL` | Public URL of the deployment | Yes |
| `CRON_SECRET` | Secret for cron job authentication | No |
| `ALLOWED_DCR_DOMAINS` | Comma-separated domains for auto-registration | No |

## API Endpoints

### OAuth 2.1

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | OAuth server metadata |
| `/.well-known/oauth-protected-resource` | GET | Protected resource metadata |
| `/api/oauth/register` | POST | Dynamic client registration |
| `/api/oauth/authorize` | GET/POST | Authorization endpoint |
| `/api/oauth/token` | POST | Token endpoint |
| `/api/oauth/userinfo` | GET | User info endpoint |

### MCP Server

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp` | GET/POST/DELETE | MCP Streamable HTTP transport |
| `/mcp` | GET/POST/DELETE | Root-level MCP endpoint (Claude Desktop) |

### File Serving

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/sites/{tenant-slug}/{path}` | GET | Serve published files inline |

### Admin API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/buckets` | GET/POST | List/create buckets |
| `/api/admin/buckets/{id}` | GET/PUT/DELETE | Manage bucket |
| `/api/admin/buckets/{id}/files` | GET | List files in bucket |
| `/api/admin/buckets/{id}/access` | GET/POST | Manage access grants |
| `/api/admin/users` | GET/POST | List/create users |
| `/api/admin/users/{id}` | PUT/DELETE | Manage user |
| `/api/admin/stats` | GET | Dashboard statistics |
| `/api/admin/uploads` | GET | Upload history |

## MCP Integration

Herald implements the [Model Context Protocol](https://modelcontextprotocol.io/) for AI agent integration.

### Available Tools

| Tool | Description |
|------|-------------|
| `list_buckets` | List accessible storage buckets |
| `publish_file` | Publish a file to a bucket |
| `list_files` | List files in a bucket |
| `delete_file` | Delete a file |

### Connecting Claude.ai

1. Navigate to Claude.ai settings
2. Add a new MCP server
3. Enter your Herald MCP URL: `https://your-app.vercel.app/api/mcp`
4. Complete the OAuth authorization flow

## Project Structure

```
herald/
├── app/
│   ├── (admin)/          # Protected admin pages
│   ├── api/              # API routes
│   │   ├── oauth/        # OAuth 2.1 endpoints
│   │   ├── mcp/          # MCP server
│   │   ├── admin/        # Admin API
│   │   └── cron/         # Cleanup cron
│   ├── .well-known/      # OAuth metadata
│   ├── mcp/              # Root-level MCP endpoint
│   ├── sites/[...path]/  # File serving proxy
│   ├── login/            # Login page
│   └── callback/         # OAuth callback
├── components/
│   ├── landing/          # Landing page sections
│   └── ui/               # shadcn/ui components
├── lib/
│   ├── oauth.ts          # OAuth 2.1 server logic
│   ├── blob.ts           # Vercel Blob storage
│   ├── mcp-tools.ts      # MCP tool definitions
│   ├── db.ts             # Neon database client
│   ├── admin-auth.ts     # Admin auth middleware
│   ├── auth-context.tsx   # Client auth context
│   └── oauth-client.ts   # Client OAuth flow
├── migrations/           # SQL migrations
└── scripts/              # Utility scripts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policy and reporting vulnerabilities.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
