# Contributing to Herald

Thank you for your interest in contributing to Herald! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (OS, Python version, AWS region)
- Relevant logs or error messages

### Suggesting Features

Feature requests are welcome. Please provide:

- A clear description of the feature
- The problem it solves
- Potential implementation approaches
- Any relevant examples from other projects

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

### Prerequisites

- Python 3.12+
- Node.js 18+ and npm
- AWS CLI configured with appropriate credentials
- AWS SAM CLI
- Docker (for local Lambda testing)
- PostgreSQL client (for database access)

### Backend Setup

```bash
# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install pytest pytest-asyncio black ruff mypy
```

### Frontend Setup

```bash
cd admin-ui

# Install dependencies
npm install

# Start development server
npm run dev
```

### Running Locally

Herald is designed to run on AWS Lambda. For local development:

```bash
# Start SAM local API
sam local start-api

# Or invoke a specific function
sam local invoke OAuthFunction --event events/test-event.json
```

### Database Migrations

Migrations are in the `migrations/` directory and run automatically on deployment. To run manually:

```bash
# Via SAM
sam local invoke MigrationFunction
```

## Code Style

### Python

- Follow PEP 8
- Use type hints
- Format with Black: `black src/`
- Lint with Ruff: `ruff check src/`
- Maximum line length: 100 characters

### TypeScript/React

- Use TypeScript strict mode
- Follow React best practices
- Format with Prettier
- Lint with ESLint

### Commit Messages

- Use present tense ("Add feature" not "Added feature")
- Use imperative mood ("Move cursor to..." not "Moves cursor to...")
- Keep the first line under 72 characters
- Reference issues and PRs when relevant

## Project Structure

```
herald/
├── src/                    # Python backend
│   ├── oauth/             # OAuth 2.1 server
│   ├── mcp/               # MCP server implementation
│   ├── admin/             # Tenant admin API
│   ├── platform/          # Platform admin API
│   ├── database/          # Database models and utilities
│   └── tools/             # MCP tools (S3 operations)
├── admin-ui/              # React frontend
│   └── src/
│       ├── components/    # UI components
│       ├── pages/         # Page components
│       └── lib/           # Utilities
├── migrations/            # SQL migrations
├── scripts/               # Deployment scripts
└── template.yaml          # AWS SAM template
```

## Testing

```bash
# Run Python tests
pytest

# Run with coverage
pytest --cov=src

# Run frontend tests
cd admin-ui && npm test
```

## Documentation

- Update README.md for user-facing changes
- Add inline comments for complex logic
- Update API documentation for endpoint changes

## Questions?

Feel free to open an issue for any questions about contributing.
