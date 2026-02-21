# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

### How to Report

1. **Do not** open a public GitHub issue for security vulnerabilities
2. Email security concerns to the maintainers privately
3. Include as much detail as possible:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

### What to Expect

- Acknowledgment within 48 hours
- Regular updates on the progress
- Credit in the security advisory (if desired)

## Security Best Practices

When deploying Herald, follow these security practices:

### OAuth Security

- Use PKCE for all authorization flows
- Rotate client secrets regularly
- Configure appropriate token expiration times
- Validate redirect URIs strictly

### Database Security

- Never expose the database publicly
- Use SSL/TLS for all database connections
- Regularly rotate database credentials

### Deployment Security

- Set strong JWT_SECRET (min 32 characters)
- Configure ALLOWED_DCR_DOMAINS to restrict auto-registration
- Use Vercel environment variables for all secrets
