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

### AWS Configuration

- Use least-privilege IAM roles
- Enable CloudTrail logging
- Use AWS Secrets Manager for all credentials
- Enable encryption at rest for Aurora and S3
- Configure VPC security groups restrictively

### OAuth Security

- Use PKCE for all authorization flows
- Rotate client secrets regularly
- Configure appropriate token expiration times
- Validate redirect URIs strictly

### Database Security

- Never expose the database publicly
- Use SSL/TLS for all database connections
- Regularly rotate database credentials
- Enable audit logging

### Network Security

- Deploy in private subnets
- Use VPC endpoints where possible
- Configure WAF rules for API Gateway
- Enable DDoS protection

## Known Security Considerations

### db-tunnel.sh Script

The database tunnel script displays the Aurora admin password in the terminal output. This is intentional for development convenience but:

- Only use this script in secure development environments
- Clear terminal history after use
- Never run this script in shared or logged environments
