# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2025-01-25

### Added

- OAuth 2.1 server with PKCE authorization flow
- Dynamic Client Registration (DCR) support
- MCP server for AI agent integration
- Multi-tenant architecture with role-based access control
- S3 bucket management and file publishing tools
- Admin UI for tenant, user, and bucket management
- Aurora PostgreSQL Serverless v2 backend
- CloudFront distribution for Admin UI
- Database migration system
- Platform admin API with IAM authentication

### Security

- JWT-based token authentication
- Encrypted storage for all credentials
- VPC-isolated database deployment
- S3 bucket encryption at rest
