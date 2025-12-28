"""MCP JSON-RPC protocol types and utilities."""

from dataclasses import dataclass, field
from typing import Any, Optional, Union


class McpError(Exception):
    """MCP protocol error."""

    def __init__(self, code: int, message: str, data: Any = None):
        self.code = code
        self.message = message
        self.data = data
        super().__init__(message)

    def to_dict(self) -> dict:
        """Convert to JSON-RPC error object."""
        error = {"code": self.code, "message": self.message}
        if self.data is not None:
            error["data"] = self.data
        return error


# Standard JSON-RPC error codes
PARSE_ERROR = -32700
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603

# MCP-specific error codes
MCP_NOT_INITIALIZED = -32000
MCP_ALREADY_INITIALIZED = -32001
MCP_INVALID_SESSION = -32002


@dataclass
class JsonRpcRequest:
    """JSON-RPC 2.0 request."""

    method: str
    params: dict = field(default_factory=dict)
    id: Optional[Union[str, int]] = None
    jsonrpc: str = "2.0"

    @classmethod
    def from_dict(cls, data: dict) -> "JsonRpcRequest":
        """Parse from dict."""
        if data.get("jsonrpc") != "2.0":
            raise McpError(INVALID_REQUEST, "Invalid JSON-RPC version")

        method = data.get("method")
        if not method:
            raise McpError(INVALID_REQUEST, "Missing method")

        return cls(
            method=method,
            params=data.get("params", {}),
            id=data.get("id"),
            jsonrpc="2.0",
        )

    @property
    def is_notification(self) -> bool:
        """Check if this is a notification (no id)."""
        return self.id is None


@dataclass
class JsonRpcResponse:
    """JSON-RPC 2.0 response."""

    id: Optional[Union[str, int]]
    result: Optional[Any] = None
    error: Optional[dict] = None
    jsonrpc: str = "2.0"

    def to_dict(self) -> dict:
        """Convert to dict for JSON serialization."""
        response = {"jsonrpc": self.jsonrpc, "id": self.id}
        if self.error is not None:
            response["error"] = self.error
        else:
            response["result"] = self.result
        return response

    @classmethod
    def success(cls, id: Optional[Union[str, int]], result: Any) -> "JsonRpcResponse":
        """Create success response."""
        return cls(id=id, result=result)

    @classmethod
    def error(cls, id: Optional[Union[str, int]], error: McpError) -> "JsonRpcResponse":
        """Create error response."""
        return cls(id=id, error=error.to_dict())


# MCP Protocol Version
MCP_PROTOCOL_VERSION = "2025-03-26"

# Server capabilities
SERVER_CAPABILITIES = {
    "tools": {
        "listChanged": False,  # We don't support dynamic tool changes
    },
}

# Server info
SERVER_INFO = {
    "name": "herald-mcp-server",
    "version": "1.0.0",
}

# Server instructions for the LLM
SERVER_INSTRUCTIONS = """You are connected to Herald, an S3 file publishing service.

## Available Operations

1. **List accessible buckets** (list_buckets) - See which S3 buckets you can access
2. **Publish files** (publish_file) - Upload files directly to S3 (up to 5MB)
3. **Get presigned URLs** (get_presigned_url) - Generate upload URLs for large files
4. **Browse files** (list_files) - List files in a bucket with optional prefix filter
5. **Delete files** (delete_file) - Remove files from a bucket

## File Path Requirements

**IMPORTANT:** All file paths MUST include a unique folder prefix to organize files by site/project. Generate a random folder name (6-8 alphanumeric characters) for each new site to ensure isolation.

✅ Valid paths:
- `site-a3x9k2/index.html`
- `proj-7hf4m1/assets/logo.png`
- `web-q8n2p5/styles/main.css`

❌ Invalid paths:
- `index.html` (missing folder)
- `logo.png` (missing folder)

## Workflow

1. Call list_buckets to see available destinations
2. Use publish_file for small files (text, JSON, images under 5MB)
3. Use get_presigned_url for larger files - return the URL to the user
4. All uploads are logged for audit purposes

## Best Practices

- Always use a folder prefix that identifies the site/project (e.g., `mysite/`)
- Check bucket access before attempting uploads
- Use appropriate content types for files
- For binary files, base64-encode the content
- Respect user's bucket and prefix restrictions"""


def create_initialize_result() -> dict:
    """Create response for initialize request."""
    return {
        "protocolVersion": MCP_PROTOCOL_VERSION,
        "capabilities": SERVER_CAPABILITIES,
        "serverInfo": SERVER_INFO,
        "instructions": SERVER_INSTRUCTIONS,
    }


def create_tools_list(tools: list[dict]) -> dict:
    """Create response for tools/list request."""
    return {"tools": tools}


def create_tool_result(
    content: list[dict],
    is_error: bool = False,
) -> dict:
    """Create response for tools/call request."""
    result = {"content": content}
    if is_error:
        result["isError"] = True
    return result


def text_content(text: str) -> dict:
    """Create text content block."""
    return {"type": "text", "text": text}


def image_content(data: str, mime_type: str = "image/png") -> dict:
    """Create image content block (base64 encoded)."""
    return {"type": "image", "data": data, "mimeType": mime_type}


def embedded_resource(uri: str, mime_type: str, text: Optional[str] = None) -> dict:
    """Create embedded resource content block."""
    resource = {
        "type": "resource",
        "resource": {
            "uri": uri,
            "mimeType": mime_type,
        },
    }
    if text is not None:
        resource["resource"]["text"] = text
    return resource
