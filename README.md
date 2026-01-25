# Herald

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![CI](https://github.com/getcatalystiq/herald/actions/workflows/ci.yml/badge.svg)](https://github.com/getcatalystiq/herald/actions/workflows/ci.yml)
[![Python 3.12+](https://img.shields.io/badge/python-3.12+-blue.svg)](https://www.python.org/downloads/)
[![MCP](https://img.shields.io/badge/MCP-2025--03--26-green.svg)](https://modelcontextprotocol.io)

Publish websites and files, with AI agents. Herald is an MCP server that enables AI agents to publish files to S3 buckets through OAuth 2.1 authentication.

## Features

- **OAuth 2.1 Server** - Complete implementation with PKCE, Dynamic Client Registration, and JWT tokens
- **MCP Server** - Model Context Protocol server for AI agent integration (works with Claude.ai)
- **Multi-tenant Architecture** - Isolated tenants with role-based access control
- **S3 File Publishing** - Secure bucket management with per-user access grants
- **Admin UI** - React-based dashboard for managing tenants, users, and buckets
- **Serverless** - Runs on AWS Lambda with Aurora PostgreSQL Serverless v2

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Claude.ai     │────▶│   API Gateway    │────▶│  Lambda (MCP)   │
│   (AI Agent)    │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
┌─────────────────┐     ┌──────────────────┐              │
│   Admin UI      │────▶│   CloudFront     │              │
│   (React SPA)   │     │                  │              ▼
└─────────────────┘     └──────────────────┘     ┌─────────────────┐
                                                 │  Aurora PG      │
┌─────────────────┐                              │  Serverless v2  │
│   OAuth Flow    │──────────────────────────────┤                 │
│   (Browser)     │                              └─────────────────┘
└─────────────────┘                                       │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │   S3 Buckets    │
                                                 │   (per tenant)  │
                                                 └─────────────────┘
```

## Prerequisites

- AWS Account with appropriate permissions
- AWS CLI configured
- AWS SAM CLI
- Python 3.12+
- Node.js 18+ and npm
- Docker (for local testing)

## Quick Start

### 1. Clone the repository

```bash
git clone https://github.com/getcatalystiq/herald.git
cd herald
```

### 2. Configure AWS

Ensure your AWS CLI is configured with credentials that have permissions to create:
- Lambda functions
- API Gateway
- Aurora PostgreSQL clusters
- S3 buckets
- CloudFront distributions
- IAM roles
- Secrets Manager secrets

### 3. Deploy

```bash
# Build and deploy
sam build
sam deploy --guided
```

During guided deployment, you'll configure:
- Stack name (e.g., `herald-dev`)
- AWS Region
- Environment (dev/staging/prod)
- Aurora capacity settings

### 4. Run Migrations

After deployment, run database migrations:

```bash
aws lambda invoke \
  --function-name herald-dev-MigrationFunction \
  --payload '{}' \
  response.json
```

### 5. Create Initial Tenant

Use the Platform Admin API (IAM authenticated) to create your first tenant:

```bash
# Get the Platform Admin API URL from CloudFormation outputs
API_URL=$(aws cloudformation describe-stacks \
  --stack-name herald-dev \
  --query 'Stacks[0].Outputs[?OutputKey==`PlatformAdminApiUrl`].OutputValue' \
  --output text)

# Create a tenant
aws apigateway test-invoke-method \
  --rest-api-id <api-id> \
  --resource-id <resource-id> \
  --http-method POST \
  --path-with-query-string /tenants \
  --body '{"name": "My Tenant", "slug": "my-tenant"}'
```

### 6. Deploy Admin UI

```bash
cd admin-ui
npm install
npm run build

# Upload to S3
aws s3 sync dist/ s3://herald-dev-admin-ui-<account-id>/

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Deployment environment | `dev` |
| `LOG_LEVEL` | Logging level | `INFO` |
| `AURORA_DATABASE` | Database name | `herald` |
| `AURORA_SECRET_ARN` | Secrets Manager ARN for DB credentials | (set by SAM) |
| `AURORA_CLUSTER_ARN` | Aurora cluster ARN | (set by SAM) |

### SAM Parameters

| Parameter | Description | Default |
|-----------|-------------|---------|
| `Environment` | Environment name | `dev` |
| `AuroraMinCapacity` | Minimum Aurora ACUs | `0.5` |
| `AuroraMaxCapacity` | Maximum Aurora ACUs | `4` |

## API Endpoints

### OAuth 2.1

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | OAuth server metadata |
| `/oauth/register` | POST | Dynamic client registration |
| `/oauth/authorize` | GET/POST | Authorization endpoint |
| `/oauth/token` | POST | Token endpoint |
| `/oauth/userinfo` | GET | User info endpoint |

### MCP Server

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/mcp` | GET | Server capabilities |
| `/mcp` | POST | MCP JSON-RPC requests |

### Admin API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/admin/buckets` | GET/POST | List/create buckets |
| `/api/admin/buckets/{id}` | GET/PUT/DELETE | Manage bucket |
| `/api/admin/buckets/{id}/access` | GET/POST | Manage access grants |
| `/api/admin/users` | GET/POST | List/create users |
| `/api/admin/users/{id}` | PUT/DELETE | Manage user |

## MCP Integration

Herald implements the [Model Context Protocol](https://modelcontextprotocol.io/) for AI agent integration.

### Available Tools

| Tool | Description |
|------|-------------|
| `list_buckets` | List accessible S3 buckets |
| `list_files` | List files in a bucket |
| `read_file` | Read file contents |
| `write_file` | Write/upload a file |
| `delete_file` | Delete a file |

### Connecting Claude.ai

1. Navigate to Claude.ai settings
2. Add a new MCP server
3. Enter your Herald MCP URL: `https://<api-gateway-url>/mcp`
4. Complete the OAuth authorization flow

## Development

### Local Setup

```bash
# Backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd admin-ui
npm install
npm run dev
```

### Running Tests

```bash
# Python tests
pytest

# Frontend tests
cd admin-ui && npm test
```

### Database Access

For local database access through a bastion host:

```bash
./scripts/db-tunnel.sh
```

## Project Structure

```
herald/
├── src/
│   ├── oauth/          # OAuth 2.1 server
│   ├── mcp/            # MCP server
│   ├── admin/          # Tenant admin API
│   ├── platform/       # Platform admin API
│   ├── database/       # Database utilities
│   └── tools/          # MCP tools
├── admin-ui/           # React frontend
├── migrations/         # SQL migrations
├── scripts/            # Utility scripts
└── template.yaml       # SAM template
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## Security

See [SECURITY.md](SECURITY.md) for security policy and reporting vulnerabilities.

## License

This project is licensed under the MIT License - see [LICENSE](LICENSE) for details.
