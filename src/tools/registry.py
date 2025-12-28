"""Herald MCP tools registry."""

from .tools import (
    list_buckets_handler,
    publish_file_handler,
    get_presigned_url_handler,
    list_files_handler,
    delete_file_handler,
)

# Tool definitions following MCP specification
TOOLS_REGISTRY = {
    "list_buckets": {
        "description": "List all S3 buckets you have access to. Returns bucket names, permissions, and S3 paths.",
        "input_schema": {
            "type": "object",
            "properties": {},
        },
        "handler": list_buckets_handler,
        "required_scope": "read",
    },
    "publish_file": {
        "description": """Upload a file to an authorized S3 bucket.

Use this tool when you need to:
- Upload a file to cloud storage
- Save generated content (reports, images, documents) to S3
- Share files via S3 URLs

IMPORTANT: file_path MUST include a unique folder prefix. Generate a random folder name (6-8 alphanumeric chars) for each new site to ensure isolation.

For files larger than 5MB, use get_presigned_url instead.

The content can be:
- Plain text (UTF-8 encoded)
- Base64-encoded binary data (set is_base64=true)

If no bucket is specified, the default bucket is used.""",
        "input_schema": {
            "type": "object",
            "properties": {
                "bucket": {
                    "type": "string",
                    "description": "Bucket name (uses default if not specified)",
                },
                "file_path": {
                    "type": "string",
                    "description": "Path/key - MUST include a unique folder prefix (e.g., 'site-a3x9k2/index.html', 'proj-7hf4m1/assets/logo.png')",
                },
                "content": {
                    "type": "string",
                    "description": "File content (text or base64-encoded for binary)",
                },
                "content_type": {
                    "type": "string",
                    "description": "MIME type (auto-detected from file extension if not provided)",
                },
                "is_base64": {
                    "type": "boolean",
                    "description": "Whether content is base64 encoded (default: false)",
                    "default": False,
                },
            },
            "required": ["file_path", "content"],
        },
        "handler": publish_file_handler,
        "required_scope": "write",
    },
    "get_presigned_url": {
        "description": """Generate a presigned URL for uploading large files directly to S3.

Use this tool for files larger than 5MB. The URL can be used to upload directly to S3 without going through Herald.

IMPORTANT: file_path MUST include a unique folder prefix. Use the same folder name as other files for this site.

Returns a presigned URL valid for the specified duration (default: 1 hour).

The user or client can then use this URL with an HTTP PUT request to upload the file directly.""",
        "input_schema": {
            "type": "object",
            "properties": {
                "bucket": {
                    "type": "string",
                    "description": "Bucket name (uses default if not specified)",
                },
                "file_path": {
                    "type": "string",
                    "description": "Path/key - MUST include the site's unique folder prefix (e.g., 'site-a3x9k2/video.mp4', 'proj-7hf4m1/large-file.zip')",
                },
                "content_type": {
                    "type": "string",
                    "description": "MIME type of the file (default: application/octet-stream)",
                    "default": "application/octet-stream",
                },
                "expires_in": {
                    "type": "integer",
                    "description": "URL expiration in seconds (default: 3600, max: 86400)",
                    "default": 3600,
                },
            },
            "required": ["file_path"],
        },
        "handler": get_presigned_url_handler,
        "required_scope": "write",
    },
    "list_files": {
        "description": """List files in an S3 bucket with optional prefix filter.

Use this tool to browse files in a bucket. You can filter by prefix to see files in a specific folder.

Returns file names, sizes, and last modified dates.""",
        "input_schema": {
            "type": "object",
            "properties": {
                "bucket": {
                    "type": "string",
                    "description": "Bucket name (uses default if not specified)",
                },
                "prefix": {
                    "type": "string",
                    "description": "Filter by prefix/folder path (e.g., 'reports/')",
                },
                "max_results": {
                    "type": "integer",
                    "description": "Maximum files to return (default: 100, max: 1000)",
                    "default": 100,
                },
            },
        },
        "handler": list_files_handler,
        "required_scope": "read",
    },
    "delete_file": {
        "description": """Delete a file from an S3 bucket.

Use this tool to remove a file from storage. Requires delete permission on the bucket.

The file path should match the exact key in the bucket.""",
        "input_schema": {
            "type": "object",
            "properties": {
                "bucket": {
                    "type": "string",
                    "description": "Bucket name (uses default if not specified)",
                },
                "file_path": {
                    "type": "string",
                    "description": "Path/key of the file to delete",
                },
            },
            "required": ["file_path"],
        },
        "handler": delete_file_handler,
        "required_scope": "delete",
    },
}
