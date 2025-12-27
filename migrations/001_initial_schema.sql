-- Herald Database Schema
-- Aurora PostgreSQL

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-------------------------------------------------------------------------------
-- TENANTS (Organizations)
-------------------------------------------------------------------------------
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL UNIQUE,  -- URL-friendly identifier
    email VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_tenants_slug ON tenants(slug);
CREATE INDEX idx_tenants_email ON tenants(email);

-------------------------------------------------------------------------------
-- USERS (Tenant members)
-------------------------------------------------------------------------------
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,  -- bcrypt hash
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'member',  -- owner, admin, member
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read', 'write'],  -- OAuth scopes
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_users_email ON users(email);

-------------------------------------------------------------------------------
-- OAUTH CLIENTS (Dynamic Client Registration)
-------------------------------------------------------------------------------
CREATE TABLE oauth_clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id VARCHAR(255) NOT NULL UNIQUE,
    client_secret_hash VARCHAR(255),  -- NULL for public clients
    client_name VARCHAR(255) NOT NULL,
    client_uri VARCHAR(500),
    redirect_uris TEXT[] NOT NULL,
    grant_types TEXT[] NOT NULL DEFAULT ARRAY['authorization_code', 'refresh_token'],
    response_types TEXT[] NOT NULL DEFAULT ARRAY['code'],
    token_endpoint_auth_method VARCHAR(50) NOT NULL DEFAULT 'client_secret_basic',
    scope TEXT NOT NULL DEFAULT 'read write',
    tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,  -- NULL for global clients
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX idx_oauth_clients_client_id ON oauth_clients(client_id);

-------------------------------------------------------------------------------
-- OAUTH AUTHORIZATION CODES
-------------------------------------------------------------------------------
CREATE TABLE oauth_authorization_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(255) NOT NULL UNIQUE,
    client_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    redirect_uri VARCHAR(500) NOT NULL,
    scope TEXT NOT NULL,
    code_challenge VARCHAR(255),  -- PKCE
    code_challenge_method VARCHAR(10),  -- S256 or plain
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    used_at TIMESTAMPTZ  -- NULL until used
);

CREATE INDEX idx_oauth_codes_code ON oauth_authorization_codes(code);
CREATE INDEX idx_oauth_codes_expires ON oauth_authorization_codes(expires_at);

-------------------------------------------------------------------------------
-- OAUTH REFRESH TOKENS
-------------------------------------------------------------------------------
CREATE TABLE oauth_refresh_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    client_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    scope TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_oauth_refresh_tokens_hash ON oauth_refresh_tokens(token_hash);
CREATE INDEX idx_oauth_refresh_tokens_user ON oauth_refresh_tokens(user_id);

-------------------------------------------------------------------------------
-- MCP SESSIONS (Streamable HTTP session tracking)
-------------------------------------------------------------------------------
CREATE TABLE mcp_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    client_info JSONB,
    capabilities JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_mcp_sessions_session_id ON mcp_sessions(session_id);
CREATE INDEX idx_mcp_sessions_user ON mcp_sessions(user_id);

-------------------------------------------------------------------------------
-- TENANT BUCKETS (S3 bucket configurations per tenant)
-------------------------------------------------------------------------------
CREATE TABLE tenant_buckets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,                    -- Display name
    bucket_name VARCHAR(255) NOT NULL,             -- S3 bucket name
    bucket_region VARCHAR(50) DEFAULT 'us-east-1',
    prefix VARCHAR(500) DEFAULT '',                -- Optional path prefix
    credentials_secret_arn VARCHAR(500),           -- Secrets Manager ARN for IAM role
    is_default BOOLEAN DEFAULT FALSE,
    enabled BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}',                   -- max_file_size, allowed_types
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, name)
);

CREATE INDEX idx_tenant_buckets_tenant ON tenant_buckets(tenant_id);

-- Ensure only one default bucket per tenant
CREATE UNIQUE INDEX idx_tenant_buckets_default
    ON tenant_buckets(tenant_id)
    WHERE is_default = TRUE;

-------------------------------------------------------------------------------
-- BUCKET ACCESS GRANTS (User permissions per bucket)
-------------------------------------------------------------------------------
CREATE TABLE bucket_access_grants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bucket_id UUID NOT NULL REFERENCES tenant_buckets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    permissions TEXT[] DEFAULT ARRAY['read', 'write'],  -- read, write, delete
    prefix_restriction VARCHAR(500),               -- Restrict to specific prefix
    expires_at TIMESTAMPTZ,                        -- Optional expiration
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES users(id),
    UNIQUE(bucket_id, user_id)
);

CREATE INDEX idx_bucket_access_grants_tenant ON bucket_access_grants(tenant_id);
CREATE INDEX idx_bucket_access_grants_bucket ON bucket_access_grants(bucket_id);
CREATE INDEX idx_bucket_access_grants_user ON bucket_access_grants(user_id);

-------------------------------------------------------------------------------
-- FILE UPLOADS (Audit log)
-------------------------------------------------------------------------------
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    bucket_id UUID NOT NULL REFERENCES tenant_buckets(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    file_key VARCHAR(1000) NOT NULL,
    file_name VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    content_type VARCHAR(255),
    upload_method VARCHAR(50) DEFAULT 'direct',    -- direct, presigned
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_file_uploads_tenant ON file_uploads(tenant_id);
CREATE INDEX idx_file_uploads_bucket ON file_uploads(bucket_id);
CREATE INDEX idx_file_uploads_user ON file_uploads(user_id);
CREATE INDEX idx_file_uploads_created ON file_uploads(created_at DESC);

-------------------------------------------------------------------------------
-- UPDATED_AT TRIGGER
-------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tenants_updated_at
    BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tenant_buckets_updated_at
    BEFORE UPDATE ON tenant_buckets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-------------------------------------------------------------------------------
-- SETTINGS (Key-value store for app config)
-------------------------------------------------------------------------------
CREATE TABLE settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER update_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
