"""
Platform Admin API Handler for Herald.

IAM authenticated - for platform operators to manage tenants.
Endpoints: /tenants, /metrics
"""

import json
import logging
from typing import Any

from db.aurora import get_aurora_client, param

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def handler(event: dict, context: Any) -> dict:
    """Lambda handler for platform admin endpoints (IAM authenticated)."""
    http_method = event.get("httpMethod", event.get("requestContext", {}).get("http", {}).get("method", "GET"))
    path = event.get("path", event.get("rawPath", ""))
    path_params = event.get("pathParameters", {}) or {}

    body = event.get("body", "")
    if body and event.get("isBase64Encoded"):
        import base64
        body = base64.b64decode(body).decode("utf-8")

    body_params = {}
    if body:
        try:
            body_params = json.loads(body)
        except json.JSONDecodeError:
            pass

    try:
        # Tenant management
        if path == "/tenants" and http_method == "GET":
            return _list_tenants()
        elif path == "/tenants" and http_method == "POST":
            return _create_tenant(body_params)
        elif path.startswith("/tenants/") and http_method == "GET":
            tenant_id = path_params.get("tenant_id") or path.split("/")[-1]
            return _get_tenant(tenant_id)
        elif path.startswith("/tenants/") and http_method == "PUT":
            tenant_id = path_params.get("tenant_id") or path.split("/")[-1]
            return _update_tenant(tenant_id, body_params)
        elif path.startswith("/tenants/") and http_method == "DELETE":
            tenant_id = path_params.get("tenant_id") or path.split("/")[-1]
            return _delete_tenant(tenant_id)

        # Metrics
        elif path == "/metrics" and http_method == "GET":
            return _get_metrics()

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


def _list_tenants() -> dict:
    """List all tenants."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT t.id, t.name, t.slug, t.email, t.is_active, t.created_at,
               (SELECT COUNT(*) FROM users WHERE tenant_id = t.id) as user_count,
               (SELECT COUNT(*) FROM tenant_buckets WHERE tenant_id = t.id) as bucket_count
        FROM tenants t
        ORDER BY t.created_at DESC
        """
    )
    tenants = []
    for row in result.get("records", []):
        tenants.append({
            "id": row[0].get("stringValue"),
            "name": row[1].get("stringValue"),
            "slug": row[2].get("stringValue"),
            "email": row[3].get("stringValue"),
            "is_active": row[4].get("booleanValue", True),
            "created_at": row[5].get("stringValue"),
            "user_count": row[6].get("longValue", 0),
            "bucket_count": row[7].get("longValue", 0),
        })
    return _json_response({"tenants": tenants})


def _get_tenant(tenant_id: str) -> dict:
    """Get a single tenant."""
    db = get_aurora_client()
    result = db.execute(
        """
        SELECT id, name, slug, email, settings, is_active, created_at
        FROM tenants
        WHERE id = :tenant_id
        """,
        [param("tenant_id", tenant_id)]
    )
    if not result.get("records"):
        return _error_response(404, "Tenant not found")
    row = result["records"][0]
    tenant = {
        "id": row[0].get("stringValue"),
        "name": row[1].get("stringValue"),
        "slug": row[2].get("stringValue"),
        "email": row[3].get("stringValue"),
        "settings": json.loads(row[4].get("stringValue", "{}")),
        "is_active": row[5].get("booleanValue", True),
        "created_at": row[6].get("stringValue"),
    }
    return _json_response({"tenant": tenant})


def _create_tenant(data: dict) -> dict:
    """Create a new tenant with owner user."""
    import hashlib

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")
    if not name or not email or not password:
        return _error_response(400, "name, email, and password are required")

    slug = data.get("slug", name.lower().replace(" ", "-"))
    settings = json.dumps(data.get("settings", {}))
    password_hash = hashlib.sha256(password.encode()).hexdigest()

    db = get_aurora_client()

    # Create tenant
    try:
        tenant_result = db.execute(
            """
            INSERT INTO tenants (name, slug, email, settings)
            VALUES (:name, :slug, :email, :settings::jsonb)
            RETURNING id
            """,
            [
                param("name", name),
                param("slug", slug),
                param("email", email),
                param("settings", settings),
            ]
        )
        tenant_id = tenant_result["records"][0][0].get("stringValue")

        # Create owner user
        db.execute(
            """
            INSERT INTO users (tenant_id, email, password_hash, name, role, scopes)
            VALUES (:tenant_id, :email, :password_hash, :name, 'owner', ARRAY['read', 'write', 'admin'])
            """,
            [
                param("tenant_id", tenant_id),
                param("email", email),
                param("password_hash", password_hash),
                param("name", name),
            ]
        )

        return _json_response({"id": tenant_id, "message": "Tenant created"}, 201)
    except Exception as e:
        if "duplicate key" in str(e).lower():
            return _error_response(409, "Tenant with this slug or email already exists")
        raise


def _update_tenant(tenant_id: str, data: dict) -> dict:
    """Update a tenant."""
    db = get_aurora_client()

    updates = []
    params = [param("tenant_id", tenant_id)]

    if "name" in data:
        updates.append("name = :name")
        params.append(param("name", data["name"]))
    if "is_active" in data:
        updates.append("is_active = :is_active")
        params.append(param("is_active", data["is_active"]))
    if "settings" in data:
        updates.append("settings = :settings::jsonb")
        params.append(param("settings", json.dumps(data["settings"])))

    if updates:
        db.execute(
            f"UPDATE tenants SET {', '.join(updates)} WHERE id = :tenant_id",
            params
        )

    return _json_response({"message": "Tenant updated"})


def _delete_tenant(tenant_id: str) -> dict:
    """Delete a tenant and all associated data."""
    db = get_aurora_client()
    db.execute(
        "DELETE FROM tenants WHERE id = :tenant_id",
        [param("tenant_id", tenant_id)]
    )
    return _json_response({"message": "Tenant deleted"})


def _get_metrics() -> dict:
    """Get platform-wide metrics."""
    db = get_aurora_client()

    tenant_result = db.execute("SELECT COUNT(*) FROM tenants")
    tenant_count = tenant_result["records"][0][0].get("longValue", 0)

    user_result = db.execute("SELECT COUNT(*) FROM users")
    user_count = user_result["records"][0][0].get("longValue", 0)

    bucket_result = db.execute("SELECT COUNT(*) FROM tenant_buckets")
    bucket_count = bucket_result["records"][0][0].get("longValue", 0)

    upload_result = db.execute("SELECT COUNT(*) FROM file_uploads")
    upload_count = upload_result["records"][0][0].get("longValue", 0)

    return _json_response({
        "tenants": tenant_count,
        "users": user_count,
        "buckets": bucket_count,
        "uploads": upload_count,
    })
