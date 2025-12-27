"""Herald MCP tool implementations."""

import base64
import json
import logging
import mimetypes
from datetime import datetime, timezone
from typing import Optional

from botocore.exceptions import ClientError

from db.aurora import get_aurora_client, param
from mcp.protocol import create_tool_result, text_content
from .s3_client import get_s3_client_for_bucket

logger = logging.getLogger(__name__)

# Maximum file size for direct upload (5MB)
MAX_DIRECT_UPLOAD_SIZE = 5 * 1024 * 1024


def _get_accessible_buckets(tenant_id: str, user_id: str) -> list[dict]:
    """Get all buckets the user has access to."""
    aurora = get_aurora_client()
    buckets = aurora.query(
        """
        SELECT
            tb.id,
            tb.name,
            tb.bucket_name,
            tb.bucket_region,
            tb.prefix,
            tb.is_default,
            tb.settings,
            tb.credentials_secret_arn,
            bag.permissions,
            bag.prefix_restriction
        FROM tenant_buckets tb
        JOIN bucket_access_grants bag ON bag.bucket_id = tb.id
        WHERE tb.tenant_id = :tenant_id::uuid
          AND bag.user_id = :user_id::uuid
          AND tb.enabled = TRUE
          AND (bag.expires_at IS NULL OR bag.expires_at > NOW())
        ORDER BY tb.is_default DESC, tb.name
        """,
        [
            param("tenant_id", tenant_id, "UUID"),
            param("user_id", user_id, "UUID"),
        ]
    )
    return buckets


def _get_accessible_bucket(
    tenant_id: str,
    user_id: str,
    bucket_name: Optional[str] = None
) -> Optional[dict]:
    """
    Get a specific bucket the user has access to.

    If bucket_name is None, returns the default bucket.
    """
    aurora = get_aurora_client()

    if bucket_name:
        # Look up by name
        bucket = aurora.query_one(
            """
            SELECT
                tb.id,
                tb.name,
                tb.bucket_name,
                tb.bucket_region,
                tb.prefix,
                tb.is_default,
                tb.settings,
                tb.credentials_secret_arn,
                bag.permissions,
                bag.prefix_restriction
            FROM tenant_buckets tb
            JOIN bucket_access_grants bag ON bag.bucket_id = tb.id
            WHERE tb.tenant_id = :tenant_id::uuid
              AND bag.user_id = :user_id::uuid
              AND tb.name = :bucket_name
              AND tb.enabled = TRUE
              AND (bag.expires_at IS NULL OR bag.expires_at > NOW())
            """,
            [
                param("tenant_id", tenant_id, "UUID"),
                param("user_id", user_id, "UUID"),
                param("bucket_name", bucket_name),
            ]
        )
    else:
        # Get default bucket
        bucket = aurora.query_one(
            """
            SELECT
                tb.id,
                tb.name,
                tb.bucket_name,
                tb.bucket_region,
                tb.prefix,
                tb.is_default,
                tb.settings,
                tb.credentials_secret_arn,
                bag.permissions,
                bag.prefix_restriction
            FROM tenant_buckets tb
            JOIN bucket_access_grants bag ON bag.bucket_id = tb.id
            WHERE tb.tenant_id = :tenant_id::uuid
              AND bag.user_id = :user_id::uuid
              AND tb.is_default = TRUE
              AND tb.enabled = TRUE
              AND (bag.expires_at IS NULL OR bag.expires_at > NOW())
            """,
            [
                param("tenant_id", tenant_id, "UUID"),
                param("user_id", user_id, "UUID"),
            ]
        )

    return bucket


def _log_upload(
    tenant_id: str,
    bucket_id: str,
    user_id: str,
    file_key: str,
    file_name: str,
    file_size: int,
    content_type: str,
    upload_method: str = "direct",
    metadata: Optional[dict] = None
) -> None:
    """Log a file upload to the audit table."""
    aurora = get_aurora_client()
    aurora.execute(
        """
        INSERT INTO file_uploads
            (tenant_id, bucket_id, user_id, file_key, file_name, file_size,
             content_type, upload_method, metadata)
        VALUES
            (:tenant_id::uuid, :bucket_id::uuid, :user_id::uuid, :file_key,
             :file_name, :file_size, :content_type, :upload_method, :metadata::jsonb)
        """,
        [
            param("tenant_id", tenant_id, "UUID"),
            param("bucket_id", bucket_id, "UUID"),
            param("user_id", user_id, "UUID"),
            param("file_key", file_key),
            param("file_name", file_name),
            param("file_size", file_size, "BIGINT"),
            param("content_type", content_type),
            param("upload_method", upload_method),
            param("metadata", json.dumps(metadata or {})),
        ]
    )


def _build_full_key(bucket_config: dict, file_path: str) -> str:
    """Build the full S3 key including bucket prefix and any user restrictions."""
    prefix = bucket_config.get("prefix", "") or ""
    prefix_restriction = bucket_config.get("prefix_restriction", "") or ""

    # Combine prefixes
    full_prefix = prefix
    if prefix_restriction:
        if full_prefix and not full_prefix.endswith("/"):
            full_prefix += "/"
        full_prefix += prefix_restriction

    # Build full key
    if full_prefix:
        if not full_prefix.endswith("/"):
            full_prefix += "/"
        return f"{full_prefix}{file_path.lstrip('/')}"

    return file_path.lstrip("/")


def list_buckets_handler(
    arguments: dict,
    tenant_id: str,
    user_id: str,
) -> dict:
    """List all S3 buckets the user has access to."""
    buckets = _get_accessible_buckets(tenant_id, user_id)

    if not buckets:
        return create_tool_result([
            text_content("You don't have access to any S3 buckets. Contact your administrator to get bucket access.")
        ])

    lines = ["**Available Buckets:**\n"]
    for b in buckets:
        default_marker = " (default)" if b.get("is_default") else ""
        permissions = ", ".join(b.get("permissions", []))
        prefix = b.get("prefix_restriction") or b.get("prefix") or "/"

        lines.append(f"- **{b['name']}**{default_marker}")
        lines.append(f"  - S3: `s3://{b['bucket_name']}/{prefix}`")
        lines.append(f"  - Permissions: {permissions}")
        lines.append("")

    return create_tool_result([text_content("\n".join(lines))])


def publish_file_handler(
    arguments: dict,
    tenant_id: str,
    user_id: str,
) -> dict:
    """Upload a file to an authorized S3 bucket."""
    bucket_name = arguments.get("bucket")
    file_path = arguments.get("file_path")
    content = arguments.get("content")
    content_type = arguments.get("content_type")
    is_base64 = arguments.get("is_base64", False)

    if not file_path:
        return create_tool_result(
            [text_content("Error: file_path is required")],
            is_error=True
        )

    if not content:
        return create_tool_result(
            [text_content("Error: content is required")],
            is_error=True
        )

    # Get bucket config
    bucket_config = _get_accessible_bucket(tenant_id, user_id, bucket_name)
    if not bucket_config:
        if bucket_name:
            return create_tool_result(
                [text_content(f"Error: No access to bucket '{bucket_name}' or bucket not found.")],
                is_error=True
            )
        return create_tool_result(
            [text_content("Error: No default bucket configured. Specify a bucket name or contact your administrator.")],
            is_error=True
        )

    # Check write permission
    permissions = bucket_config.get("permissions", [])
    if "write" not in permissions:
        return create_tool_result(
            [text_content(f"Error: No write permission for bucket '{bucket_config['name']}'")],
            is_error=True
        )

    # Decode content
    if is_base64:
        try:
            body = base64.b64decode(content)
        except Exception as e:
            return create_tool_result(
                [text_content(f"Error: Invalid base64 content: {e}")],
                is_error=True
            )
    else:
        body = content.encode("utf-8")

    # Check file size
    if len(body) > MAX_DIRECT_UPLOAD_SIZE:
        return create_tool_result(
            [text_content(
                f"Error: File size ({len(body):,} bytes) exceeds maximum for direct upload "
                f"({MAX_DIRECT_UPLOAD_SIZE:,} bytes). Use get_presigned_url for large files."
            )],
            is_error=True
        )

    # Auto-detect content type
    if not content_type:
        content_type, _ = mimetypes.guess_type(file_path)
        content_type = content_type or "application/octet-stream"

    # Build full S3 key
    full_key = _build_full_key(bucket_config, file_path)

    # Get S3 client and upload
    try:
        s3 = get_s3_client_for_bucket(bucket_config)
        s3.put_object(
            Bucket=bucket_config["bucket_name"],
            Key=full_key,
            Body=body,
            ContentType=content_type,
        )

        # Log upload
        _log_upload(
            tenant_id=tenant_id,
            bucket_id=bucket_config["id"],
            user_id=user_id,
            file_key=full_key,
            file_name=file_path.split("/")[-1],
            file_size=len(body),
            content_type=content_type,
            upload_method="direct",
        )

        s3_uri = f"s3://{bucket_config['bucket_name']}/{full_key}"
        return create_tool_result([
            text_content(f"Successfully uploaded to {s3_uri}\n\nFile size: {len(body):,} bytes\nContent-Type: {content_type}")
        ])

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.exception(f"S3 upload failed: {error_code}")
        return create_tool_result(
            [text_content(f"Upload failed: {error_code} - {error_msg}")],
            is_error=True
        )
    except Exception as e:
        logger.exception("Upload failed")
        return create_tool_result(
            [text_content(f"Upload failed: {e}")],
            is_error=True
        )


def get_presigned_url_handler(
    arguments: dict,
    tenant_id: str,
    user_id: str,
) -> dict:
    """Generate a presigned URL for uploading large files."""
    bucket_name = arguments.get("bucket")
    file_path = arguments.get("file_path")
    content_type = arguments.get("content_type", "application/octet-stream")
    expires_in = arguments.get("expires_in", 3600)

    if not file_path:
        return create_tool_result(
            [text_content("Error: file_path is required")],
            is_error=True
        )

    # Validate expires_in
    expires_in = min(max(60, expires_in), 86400)  # 1 minute to 24 hours

    # Get bucket config
    bucket_config = _get_accessible_bucket(tenant_id, user_id, bucket_name)
    if not bucket_config:
        if bucket_name:
            return create_tool_result(
                [text_content(f"Error: No access to bucket '{bucket_name}' or bucket not found.")],
                is_error=True
            )
        return create_tool_result(
            [text_content("Error: No default bucket configured. Specify a bucket name or contact your administrator.")],
            is_error=True
        )

    # Check write permission
    permissions = bucket_config.get("permissions", [])
    if "write" not in permissions:
        return create_tool_result(
            [text_content(f"Error: No write permission for bucket '{bucket_config['name']}'")],
            is_error=True
        )

    # Build full S3 key
    full_key = _build_full_key(bucket_config, file_path)

    # Generate presigned URL
    try:
        s3 = get_s3_client_for_bucket(bucket_config)
        presigned_url = s3.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": bucket_config["bucket_name"],
                "Key": full_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

        # Log the presigned URL generation (not the actual upload)
        _log_upload(
            tenant_id=tenant_id,
            bucket_id=bucket_config["id"],
            user_id=user_id,
            file_key=full_key,
            file_name=file_path.split("/")[-1],
            file_size=0,  # Unknown at this point
            content_type=content_type,
            upload_method="presigned",
            metadata={"expires_in": expires_in},
        )

        return create_tool_result([
            text_content(
                f"**Presigned Upload URL Generated**\n\n"
                f"Destination: `s3://{bucket_config['bucket_name']}/{full_key}`\n"
                f"Content-Type: `{content_type}`\n"
                f"Expires in: {expires_in} seconds\n\n"
                f"**Upload URL:**\n```\n{presigned_url}\n```\n\n"
                f"Use this URL with a PUT request to upload your file directly to S3."
            )
        ])

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.exception(f"Presigned URL generation failed: {error_code}")
        return create_tool_result(
            [text_content(f"Failed to generate presigned URL: {error_code} - {error_msg}")],
            is_error=True
        )
    except Exception as e:
        logger.exception("Presigned URL generation failed")
        return create_tool_result(
            [text_content(f"Failed to generate presigned URL: {e}")],
            is_error=True
        )


def list_files_handler(
    arguments: dict,
    tenant_id: str,
    user_id: str,
) -> dict:
    """List files in an S3 bucket."""
    bucket_name = arguments.get("bucket")
    prefix = arguments.get("prefix", "")
    max_results = min(arguments.get("max_results", 100), 1000)

    # Get bucket config
    bucket_config = _get_accessible_bucket(tenant_id, user_id, bucket_name)
    if not bucket_config:
        if bucket_name:
            return create_tool_result(
                [text_content(f"Error: No access to bucket '{bucket_name}' or bucket not found.")],
                is_error=True
            )
        return create_tool_result(
            [text_content("Error: No default bucket configured. Specify a bucket name or contact your administrator.")],
            is_error=True
        )

    # Check read permission
    permissions = bucket_config.get("permissions", [])
    if "read" not in permissions:
        return create_tool_result(
            [text_content(f"Error: No read permission for bucket '{bucket_config['name']}'")],
            is_error=True
        )

    # Build full prefix
    full_prefix = _build_full_key(bucket_config, prefix) if prefix else ""
    if not full_prefix:
        # If no user prefix, use bucket's base prefix
        full_prefix = bucket_config.get("prefix", "") or ""
        prefix_restriction = bucket_config.get("prefix_restriction", "") or ""
        if prefix_restriction:
            if full_prefix and not full_prefix.endswith("/"):
                full_prefix += "/"
            full_prefix += prefix_restriction

    # List objects
    try:
        s3 = get_s3_client_for_bucket(bucket_config)
        response = s3.list_objects_v2(
            Bucket=bucket_config["bucket_name"],
            Prefix=full_prefix,
            MaxKeys=max_results,
        )

        objects = response.get("Contents", [])
        if not objects:
            return create_tool_result([
                text_content(f"No files found in `s3://{bucket_config['bucket_name']}/{full_prefix}`")
            ])

        lines = [f"**Files in {bucket_config['name']}** (`s3://{bucket_config['bucket_name']}/{full_prefix}`)\n"]

        for obj in objects:
            key = obj["Key"]
            size = obj["Size"]
            modified = obj["LastModified"].strftime("%Y-%m-%d %H:%M")

            # Format size
            if size < 1024:
                size_str = f"{size} B"
            elif size < 1024 * 1024:
                size_str = f"{size / 1024:.1f} KB"
            else:
                size_str = f"{size / 1024 / 1024:.1f} MB"

            lines.append(f"- `{key}` ({size_str}, {modified})")

        if response.get("IsTruncated"):
            lines.append(f"\n*Results truncated. Showing first {max_results} files.*")

        return create_tool_result([text_content("\n".join(lines))])

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.exception(f"List files failed: {error_code}")
        return create_tool_result(
            [text_content(f"Failed to list files: {error_code} - {error_msg}")],
            is_error=True
        )
    except Exception as e:
        logger.exception("List files failed")
        return create_tool_result(
            [text_content(f"Failed to list files: {e}")],
            is_error=True
        )


def delete_file_handler(
    arguments: dict,
    tenant_id: str,
    user_id: str,
) -> dict:
    """Delete a file from an S3 bucket."""
    bucket_name = arguments.get("bucket")
    file_path = arguments.get("file_path")

    if not file_path:
        return create_tool_result(
            [text_content("Error: file_path is required")],
            is_error=True
        )

    # Get bucket config
    bucket_config = _get_accessible_bucket(tenant_id, user_id, bucket_name)
    if not bucket_config:
        if bucket_name:
            return create_tool_result(
                [text_content(f"Error: No access to bucket '{bucket_name}' or bucket not found.")],
                is_error=True
            )
        return create_tool_result(
            [text_content("Error: No default bucket configured. Specify a bucket name or contact your administrator.")],
            is_error=True
        )

    # Check delete permission
    permissions = bucket_config.get("permissions", [])
    if "delete" not in permissions:
        return create_tool_result(
            [text_content(f"Error: No delete permission for bucket '{bucket_config['name']}'")],
            is_error=True
        )

    # Build full S3 key
    full_key = _build_full_key(bucket_config, file_path)

    # Delete object
    try:
        s3 = get_s3_client_for_bucket(bucket_config)

        # Check if object exists first
        try:
            s3.head_object(Bucket=bucket_config["bucket_name"], Key=full_key)
        except ClientError as e:
            if e.response.get("Error", {}).get("Code") == "404":
                return create_tool_result(
                    [text_content(f"File not found: `s3://{bucket_config['bucket_name']}/{full_key}`")],
                    is_error=True
                )
            raise

        s3.delete_object(
            Bucket=bucket_config["bucket_name"],
            Key=full_key,
        )

        return create_tool_result([
            text_content(f"Successfully deleted `s3://{bucket_config['bucket_name']}/{full_key}`")
        ])

    except ClientError as e:
        error_code = e.response.get("Error", {}).get("Code", "Unknown")
        error_msg = e.response.get("Error", {}).get("Message", str(e))
        logger.exception(f"Delete failed: {error_code}")
        return create_tool_result(
            [text_content(f"Delete failed: {error_code} - {error_msg}")],
            is_error=True
        )
    except Exception as e:
        logger.exception("Delete failed")
        return create_tool_result(
            [text_content(f"Delete failed: {e}")],
            is_error=True
        )
