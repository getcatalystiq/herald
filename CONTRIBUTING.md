# Contributing to Herald

Thank you for your interest in contributing to Herald!

## Reporting Bugs

Before creating a bug report, please check existing issues. Include:

- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (OS, Node.js version)
- Relevant logs or error messages

## Development Setup

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database
- A [Vercel](https://vercel.com) account with Blob storage

### Setup

```bash
git clone https://github.com/nichochar/herald.git
cd herald
npm install

# Copy and configure environment
cp .env.example .env.local
# Edit .env.local with your values

# Run migrations
npx tsx scripts/migrate.ts

# Start dev server
npm run dev
```

### Running Locally

```bash
npm run dev
```

### Database Migrations

Migrations are in `migrations/` and run via:

```bash
npx tsx scripts/migrate.ts
```

## Code Style

- TypeScript strict mode
- Format with Prettier
- Lint with ESLint

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters

## Project Structure

```
herald/
├── app/
│   ├── (admin)/          # Protected admin pages
│   ├── api/              # API routes
│   │   ├── oauth/        # OAuth 2.1 endpoints
│   │   ├── admin/        # Admin API
│   │   └── cron/         # Cleanup cron
│   ├── .well-known/      # OAuth metadata
│   ├── mcp/              # MCP server
│   ├── sites/            # File proxy (inline serving)
│   └── login/            # Login page
├── components/           # React components
├── lib/                  # Shared logic
├── migrations/           # SQL migrations
└── scripts/              # Utility scripts
```

## Questions?

Feel free to open an issue for any questions about contributing.
