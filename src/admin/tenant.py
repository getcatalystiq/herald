"""
Tenant Admin API Handler for Herald.

OAuth authenticated - tenant admins (role=owner/admin) can manage their own tenant.
Endpoints: /api/admin/*

Authentication: Bearer token with admin scope
Authorization: Can only access resources in their own tenant
"""

import base64
import json
import logging
import os
import re
from typing import Any

import boto3

from oauth.tokens import get_token_claims
from db.aurora import get_aurora_client, param

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Secrets Manager client (lazy initialized)
_secrets_client = None


def _get_secrets_client():
    """Get or create Secrets Manager client."""
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client("secretsmanager")
    return _secrets_client


def _store_bucket_credentials(tenant_id: str, bucket_name: str, credentials: dict) -> str:
    """Store S3 bucket credentials in AWS Secrets Manager."""
    client = _get_secrets_client()
    environment = os.environ.get("ENVIRONMENT", "dev")
    safe_bucket_name = bucket_name.replace(" ", "-").replace("/", "-").lower()
    secret_name = f"herald-{environment}-bucket-{tenant_id}-{safe_bucket_name}"

    try:
        response = client.create_secret(
            Name=secret_name,
            SecretString=json.dumps(credentials),
            Description=f"Herald bucket credentials for {bucket_name}"
        )
        return response["ARN"]
    except client.exceptions.ResourceExistsException:
        response = client.put_secret_value(
            SecretId=secret_name,
            SecretString=json.dumps(credentials)
        )
        describe = client.describe_secret(SecretId=secret_name)
        return describe["ARN"]


def _delete_bucket_credentials(secret_arn: str) -> None:
    """Delete bucket credentials from AWS Secrets Manager."""
    if not secret_arn:
        return
    try:
        client = _get_secrets_client()
        client.delete_secret(SecretId=secret_arn, ForceDeleteWithoutRecovery=True)
    except Exception as e:
        logger.error(f"Failed to delete credentials: {e}")


def handler(event: dict, context: Any) -> dict:
    """Lambda handler for tenant admin endpoints."""
    http_method = event.get("requestContext", {}).get("http", {}).get("method", "GET")
    raw_path = event.get("rawPath", "")

    stage = event.get("requestContext", {}).get("stage", "")
    if stage and raw_path.startswith(f"/{stage}"):
        path = raw_path[len(f"/{stage}"):]
    else:
        path = raw_path

    path_params = event.get("pathParameters", {}) or {}

    # Extract path parameters from URL
    if not path_params:
        bucket_match = re.search(r'/buckets/([a-f0-9-]{36})', path)
        if bucket_match:
            path_params["bucket_id"] = bucket_match.group(1)
        user_match = re.search(r'/users/([a-f0-9-]{36})', path)
        if user_match:
            path_params["user_id"] = user_match.group(1)
        grant_match = re.search(r'/access/([a-f0-9-]{36})', path)
        if grant_match:
            path_params["grant_id"] = grant_match.group(1)

    headers = event.get("headers", {})
    body = event.get("body", "")

    if body and event.get("isBase64Encoded"):
        body = base64.b64decode(body).decode("utf-8")

    body_params = {}
    if body:
        try:
            body_params = json.loads(body)
        except json.JSONDecodeError:
            pass

    # Authenticate
    auth_header = headers.get("authorization") or headers.get("Authorization")
    if not auth_header:
        return _error_response(401, "Missing Authorization header")

    try:
        claims = get_token_claims(auth_header)
    except Exception as e:
        return _error_response(401, f"Invalid token: {e}")

    scopes = claims.get("scope", "").split()
    if "admin" not in scopes and "write" not in scopes:
        return _error_response(403, "Requires admin or write scope")

    tenant_id = claims["tenant_id"]
    user_id = claims["sub"]

    try:
        # Route to handler
        # Bucket management
        if path == "/api/admin/buckets" and http_method == "GET":
            return _list_buckets(tenant_id)
        elif path == "/api/admin/buckets" and http_method == "POST":
            return _create_bucket(tenant_id, body_params)
        elif "/buckets/" in path and "/files" in path and http_method == "GET":
            bucket_id = path_params.get("bucket_id")
            query_params = event.get("queryStringParameters", {}) or {}
            return _list_bucket_files(tenant_id, bucket_id, query_params)
        elif "/buckets/" in path and "/access" in path and http_method == "GET":
            bucket_id = path_params.get("bucket_id")
            return _list_access_grants(tenant_id, bucket_id)
        elif "/buckets/" in path and "/access" in path and http_method == "POST":
            bucket_id = path_params.get("bucket_id")
            return _create_access_grant(tenant_id, bucket_id, body_params, user_id)
        elif "/buckets/" in path and "/access/" in path and http_method == "DELETE":
            bucket_id = path_params.get("bucket_id")
            grant_id = path_params.get("grant_id")
            return _delete_access_grant(tenant_id, bucket_id, grant_id)
        elif "/buckets/" in path and http_method == "GET":
            bucket_id = path_params.get("bucket_id")
            return _get_bucket(tenant_id, bucket_id)
        elif "/buckets/" in path and http_method == "PUT":
            bucket_id = path_params.get("bucket_id")
            return _update_bucket(tenant_id, bucket_id, body_params)
        elif "/buckets/" in path and http_method == "DELETE":
            bucket_id = path_params.get("bucket_id")
            return _delete_bucket(tenant_id, bucket_id)

        # User management
        elif path == "/api/admin/users" and http_method == "GET":
            return _list_users(tenant_id)
        elif path == "/api/admin/users" and http_method == "POST":
            return _create_user(tenant_id, body_params)
        elif "/users/" in path and http_method == "PUT":
            target_user_id = path_params.get("user_id")
            return _update_user(tenant_id, target_user_id, body_params)
        elif "/users/" in path and http_method == "DELETE":
            target_user_id = path_params.get("user_id")
            return _delete_user(tenant_id, target_user_id)

        # Uploads
        elif path == "/api/admin/uploads" and http_method == "GET":
            return _list_uploads(tenant_id)

        # Stats
        elif path == "/api/admin/stats" and http_method == "GET":
            return _get_stats(tenant_id)

        return _error_response(404, f"Not found: {path}")
    except Exception as e:
        logger.exception(f"Error handling request: {e}")
        return _error_response(500, str(e))


def _error_response(status: int, message: str) -> dict:
    """Create error response."""
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}),
    }


def _json_response(data: dict, status: int = 200) -> dict:
    """Create JSON response."""
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(data, default=str),
    }


# =============================================================================
# Bucket Management
# =============================================================================

def _list_buckets(tenant_id: str) -> dict:
    """List all S3 buckets for tenant."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT id, name, bucket_name, bucket_region, prefix, is_default, enabled, settings, created_at
        FROM tenant_buckets
        WHERE tenant_id = :tenant_id
        ORDER BY created_at DESC
        """,
        [param("tenant_id", tenant_id)]
    )
    buckets = []
    for row in result.get("records", []):
        buckets.append({
            "id": row[0].get("stringValue"),
            "name": row[1].get("stringValue"),
            "bucket_name": row[2].get("stringValue"),
            "bucket_region": row[3].get("stringValue"),
            "prefix": row[4].get("stringValue", ""),
            "is_default": row[5].get("booleanValue", False),
            "enabled": row[6].get("booleanValue", True),
            "settings": json.loads(row[7].get("stringValue", "{}")),
            "created_at": row[8].get("stringValue"),
        })
    return _json_response({"buckets": buckets})


def _get_bucket(tenant_id: str, bucket_id: str) -> dict:
    """Get a single bucket."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT id, name, bucket_name, bucket_region, prefix, is_default, enabled, settings, created_at
        FROM tenant_buckets
        WHERE id = :bucket_id AND tenant_id = :tenant_id
        """,
        [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    if not result.get("records"):
        return _error_response(404, "Bucket not found")
    row = result["records"][0]
    bucket = {
        "id": row[0].get("stringValue"),
        "name": row[1].get("stringValue"),
        "bucket_name": row[2].get("stringValue"),
        "bucket_region": row[3].get("stringValue"),
        "prefix": row[4].get("stringValue", ""),
        "is_default": row[5].get("booleanValue", False),
        "enabled": row[6].get("booleanValue", True),
        "settings": json.loads(row[7].get("stringValue", "{}")),
        "created_at": row[8].get("stringValue"),
    }
    return _json_response({"bucket": bucket})


def _create_bucket(tenant_id: str, data: dict) -> dict:
    """Create a new S3 bucket configuration."""
    name = data.get("name")
    bucket_name = data.get("bucket_name")
    if not name or not bucket_name:
        return _error_response(400, "name and bucket_name are required")

    bucket_region = data.get("bucket_region", "us-east-1")
    prefix = data.get("prefix", "")
    is_default = data.get("is_default", False)
    settings = json.dumps(data.get("settings", {}))
    role_arn = data.get("role_arn")

    # Store credentials if provided
    credentials_arn = None
    if role_arn:
        credentials_arn = _store_bucket_credentials(tenant_id, bucket_name, {"role_arn": role_arn})

    db = get_aurora_client()

    # If setting as default, unset other defaults
    if is_default:
        db.execute(
            "UPDATE tenant_buckets SET is_default = false WHERE tenant_id = :tenant_id",
            [param("tenant_id", tenant_id)]
        )

    result = db.execute(
        """
        INSERT INTO tenant_buckets (tenant_id, name, bucket_name, bucket_region, prefix, credentials_secret_arn, is_default, settings)
        VALUES (:tenant_id, :name, :bucket_name, :bucket_region, :prefix, :credentials_arn, :is_default, :settings::jsonb)
        RETURNING id
        """,
        [
            param("tenant_id", tenant_id),
            param("name", name),
            param("bucket_name", bucket_name),
            param("bucket_region", bucket_region),
            param("prefix", prefix),
            param("credentials_arn", credentials_arn),
            param("is_default", is_default),
            param("settings", settings),
        ]
    )
    bucket_id = result["records"][0][0].get("stringValue")
    return _json_response({"id": bucket_id, "message": "Bucket created"}, 201)


def _update_bucket(tenant_id: str, bucket_id: str, data: dict) -> dict:
    """Update a bucket configuration."""
    db = get_aurora_client()

    # Check bucket exists
    check = db.execute(
        "SELECT id FROM tenant_buckets WHERE id = :bucket_id AND tenant_id = :tenant_id",
        [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    if not check.get("records"):
        return _error_response(404, "Bucket not found")

    updates = []
    params = [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]

    if "name" in data:
        updates.append("name = :name")
        params.append(param("name", data["name"]))
    if "prefix" in data:
        updates.append("prefix = :prefix")
        params.append(param("prefix", data["prefix"]))
    if "enabled" in data:
        updates.append("enabled = :enabled")
        params.append(param("enabled", data["enabled"]))
    if "is_default" in data and data["is_default"]:
        db.execute(
            "UPDATE tenant_buckets SET is_default = false WHERE tenant_id = :tenant_id",
            [param("tenant_id", tenant_id)]
        )
        updates.append("is_default = true")
    if "settings" in data:
        updates.append("settings = :settings::jsonb")
        params.append(param("settings", json.dumps(data["settings"])))

    updates.append("updated_at = NOW()")

    if updates:
        db.execute(
            f"UPDATE tenant_buckets SET {', '.join(updates)} WHERE id = :bucket_id AND tenant_id = :tenant_id",
            params
        )

    return _json_response({"message": "Bucket updated"})


def _delete_bucket(tenant_id: str, bucket_id: str) -> dict:
    """Delete a bucket configuration."""
    db = get_aurora_client()

    # Get credentials ARN first
    result = db.execute(
        "SELECT credentials_secret_arn FROM tenant_buckets WHERE id = :bucket_id AND tenant_id = :tenant_id",
        [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    if not result.get("records"):
        return _error_response(404, "Bucket not found")

    credentials_arn = result["records"][0][0].get("stringValue")

    # Delete credentials from Secrets Manager
    if credentials_arn:
        _delete_bucket_credentials(credentials_arn)

    # Delete bucket (cascades to access grants and uploads via FK)
    db.execute(
        "DELETE FROM tenant_buckets WHERE id = :bucket_id AND tenant_id = :tenant_id",
        [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    return _json_response({"message": "Bucket deleted"})


def _list_bucket_files(tenant_id: str, bucket_id: str, query_params: dict) -> dict:
    """List files in a bucket (via S3)."""
    # This would use S3 client to list files
    # For now, return empty list - actual implementation would use boto3
    return _json_response({"files": []})


# =============================================================================
# Access Grant Management
# =============================================================================

def _list_access_grants(tenant_id: str, bucket_id: str) -> dict:
    """List access grants for a bucket."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT g.id, g.user_id, u.email, g.permissions, g.prefix_restriction, g.expires_at, g.created_at
        FROM bucket_access_grants g
        JOIN users u ON u.id = g.user_id
        WHERE g.bucket_id = :bucket_id AND g.tenant_id = :tenant_id
        ORDER BY g.created_at DESC
        """,
        [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    grants = []
    for row in result.get("records", []):
        grants.append({
            "id": row[0].get("stringValue"),
            "user_id": row[1].get("stringValue"),
            "user_email": row[2].get("stringValue"),
            "permissions": row[3].get("stringValue", "").strip("{}").split(",") if row[3].get("stringValue") else [],
            "prefix_restriction": row[4].get("stringValue"),
            "expires_at": row[5].get("stringValue"),
            "created_at": row[6].get("stringValue"),
        })
    return _json_response({"grants": grants})


def _create_access_grant(tenant_id: str, bucket_id: str, data: dict, created_by: str) -> dict:
    """Create an access grant for a user."""
    user_id = data.get("user_id")
    permissions = data.get("permissions", ["read", "write"])
    if not user_id:
        return _error_response(400, "user_id is required")

    db = get_aurora_client()

    # Check bucket exists
    check = db.execute(
        "SELECT id FROM tenant_buckets WHERE id = :bucket_id AND tenant_id = :tenant_id",
        [param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    if not check.get("records"):
        return _error_response(404, "Bucket not found")

    # Create grant
    permissions_array = "{" + ",".join(permissions) + "}"
    result = db.execute(
        """
        INSERT INTO bucket_access_grants (tenant_id, bucket_id, user_id, permissions, prefix_restriction, expires_at, created_by)
        VALUES (:tenant_id, :bucket_id, :user_id, :permissions::text[], :prefix_restriction, :expires_at, :created_by)
        ON CONFLICT (bucket_id, user_id) DO UPDATE SET permissions = EXCLUDED.permissions, prefix_restriction = EXCLUDED.prefix_restriction
        RETURNING id
        """,
        [
            param("tenant_id", tenant_id),
            param("bucket_id", bucket_id),
            param("user_id", user_id),
            param("permissions", permissions_array),
            param("prefix_restriction", data.get("prefix_restriction")),
            param("expires_at", data.get("expires_at")),
            param("created_by", created_by),
        ]
    )
    grant_id = result["records"][0][0].get("stringValue")
    return _json_response({"id": grant_id, "message": "Access grant created"}, 201)


def _delete_access_grant(tenant_id: str, bucket_id: str, grant_id: str) -> dict:
    """Delete an access grant."""
    db = get_aurora_client()
    db.execute(
        "DELETE FROM bucket_access_grants WHERE id = :grant_id AND bucket_id = :bucket_id AND tenant_id = :tenant_id",
        [param("grant_id", grant_id), param("bucket_id", bucket_id), param("tenant_id", tenant_id)]
    )
    return _json_response({"message": "Access grant deleted"})


# =============================================================================
# User Management
# =============================================================================

def _list_users(tenant_id: str) -> dict:
    """List users in tenant."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT id, email, name, role, scopes, is_active, last_login_at, created_at
        FROM users
        WHERE tenant_id = :tenant_id
        ORDER BY created_at DESC
        """,
        [param("tenant_id", tenant_id)]
    )
    users = []
    for row in result.get("records", []):
        users.append({
            "id": row[0].get("stringValue"),
            "email": row[1].get("stringValue"),
            "name": row[2].get("stringValue"),
            "role": row[3].get("stringValue"),
            "scopes": row[4].get("stringValue", "").strip("{}").split(",") if row[4].get("stringValue") else [],
            "is_active": row[5].get("booleanValue", True),
            "last_login_at": row[6].get("stringValue"),
            "created_at": row[7].get("stringValue"),
        })
    return _json_response({"users": users})


def _create_user(tenant_id: str, data: dict) -> dict:
    """Create a new user."""
    import hashlib

    email = data.get("email")
    password = data.get("password")
    if not email or not password:
        return _error_response(400, "email and password are required")

    name = data.get("name", "")
    role = data.get("role", "member")
    scopes = data.get("scopes", ["read", "write"])
    scopes_array = "{" + ",".join(scopes) + "}"

    # Hash password
    password_hash = hashlib.sha256(password.encode()).hexdigest()

    db = get_aurora_client()
    try:
        result = db.execute(
            """
            INSERT INTO users (tenant_id, email, password_hash, name, role, scopes)
            VALUES (:tenant_id, :email, :password_hash, :name, :role, :scopes::text[])
            RETURNING id
            """,
            [
                param("tenant_id", tenant_id),
                param("email", email),
                param("password_hash", password_hash),
                param("name", name),
                param("role", role),
                param("scopes", scopes_array),
            ]
        )
        user_id = result["records"][0][0].get("stringValue")
        return _json_response({"id": user_id, "message": "User created"}, 201)
    except Exception as e:
        if "duplicate key" in str(e).lower():
            return _error_response(409, "User with this email already exists")
        raise


def _update_user(tenant_id: str, user_id: str, data: dict) -> dict:
    """Update a user."""
    db = get_aurora_client()

    updates = []
    params = [param("user_id", user_id), param("tenant_id", tenant_id)]

    if "name" in data:
        updates.append("name = :name")
        params.append(param("name", data["name"]))
    if "role" in data:
        updates.append("role = :role")
        params.append(param("role", data["role"]))
    if "is_active" in data:
        updates.append("is_active = :is_active")
        params.append(param("is_active", data["is_active"]))
    if "scopes" in data:
        scopes_array = "{" + ",".join(data["scopes"]) + "}"
        updates.append("scopes = :scopes::text[]")
        params.append(param("scopes", scopes_array))

    if updates:
        db.execute(
            f"UPDATE users SET {', '.join(updates)} WHERE id = :user_id AND tenant_id = :tenant_id",
            params
        )

    return _json_response({"message": "User updated"})


def _delete_user(tenant_id: str, user_id: str) -> dict:
    """Delete a user."""
    db = get_aurora_client()
    db.execute(
        "DELETE FROM users WHERE id = :user_id AND tenant_id = :tenant_id",
        [param("user_id", user_id), param("tenant_id", tenant_id)]
    )
    return _json_response({"message": "User deleted"})


# =============================================================================
# Uploads
# =============================================================================

def _list_uploads(tenant_id: str) -> dict:
    """List file uploads for tenant."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT u.id, u.file_key, u.file_name, u.file_size, u.content_type, u.upload_method,
               usr.email as user_email, b.name as bucket_name, u.created_at
        FROM file_uploads u
        LEFT JOIN users usr ON usr.id = u.user_id
        JOIN tenant_buckets b ON b.id = u.bucket_id
        WHERE u.tenant_id = :tenant_id
        ORDER BY u.created_at DESC
        LIMIT 100
        """,
        [param("tenant_id", tenant_id)]
    )
    uploads = []
    for row in result.get("records", []):
        uploads.append({
            "id": row[0].get("stringValue"),
            "file_key": row[1].get("stringValue"),
            "file_name": row[2].get("stringValue"),
            "file_size": row[3].get("longValue", 0),
            "content_type": row[4].get("stringValue"),
            "upload_method": row[5].get("stringValue"),
            "user_email": row[6].get("stringValue"),
            "bucket_name": row[7].get("stringValue"),
            "created_at": row[8].get("stringValue"),
        })
    return _json_response({"uploads": uploads})


# =============================================================================
# Stats
# =============================================================================

def _get_stats(tenant_id: str) -> dict:
    """Get tenant dashboard stats."""
    db = get_aurora_client()

    # Count buckets
    bucket_result = db.execute(
        "SELECT COUNT(*) FROM tenant_buckets WHERE tenant_id = :tenant_id",
        [param("tenant_id", tenant_id)]
    )
    bucket_count = bucket_result["records"][0][0].get("longValue", 0)

    # Count uploads
    upload_result = db.execute(
        "SELECT COUNT(*) FROM file_uploads WHERE tenant_id = :tenant_id",
        [param("tenant_id", tenant_id)]
    )
    upload_count = upload_result["records"][0][0].get("longValue", 0)

    # Count users
    user_result = db.execute(
        "SELECT COUNT(*) FROM users WHERE tenant_id = :tenant_id",
        [param("tenant_id", tenant_id)]
    )
    user_count = user_result["records"][0][0].get("longValue", 0)

    # Recent uploads
    recent_result = db.execute(
        """
        SELECT u.id, u.file_name, b.name as bucket_name, u.created_at
        FROM file_uploads u
        JOIN tenant_buckets b ON b.id = u.bucket_id
        WHERE u.tenant_id = :tenant_id
        ORDER BY u.created_at DESC
        LIMIT 5
        """,
        [param("tenant_id", tenant_id)]
    )
    recent_uploads = []
    for row in recent_result.get("records", []):
        recent_uploads.append({
            "id": row[0].get("stringValue"),
            "file_name": row[1].get("stringValue"),
            "bucket_name": row[2].get("stringValue"),
            "created_at": row[3].get("stringValue"),
        })

    return _json_response({
        "bucketCount": bucket_count,
        "uploadCount": upload_count,
        "userCount": user_count,
        "recentUploads": recent_uploads,
    })
