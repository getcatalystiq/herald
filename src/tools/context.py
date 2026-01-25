"""Request-scoped context for Herald tools."""

from typing import Optional

# Thread-local context for tool execution
_current_tenant_id: Optional[str] = None
_current_user_id: Optional[str] = None
_current_session_id: Optional[str] = None


def set_herald_context(tenant_id: str, user_id: str, session_id: Optional[str] = None) -> None:
    """Set the current context for Herald tools."""
    global _current_tenant_id, _current_user_id, _current_session_id
    _current_tenant_id = tenant_id
    _current_user_id = user_id
    _current_session_id = session_id


def clear_herald_context() -> None:
    """Clear the current context."""
    global _current_tenant_id, _current_user_id, _current_session_id
    _current_tenant_id = None
    _current_user_id = None
    _current_session_id = None


def get_tenant_id() -> str:
    """Get the current tenant ID."""
    if not _current_tenant_id:
        raise RuntimeError("No Herald context set. Call set_herald_context first.")
    return _current_tenant_id


def get_user_id() -> str:
    """Get the current user ID."""
    if not _current_user_id:
        raise RuntimeError("No Herald context set. Call set_herald_context first.")
    return _current_user_id


def get_session_id() -> Optional[str]:
    """Get the current session ID."""
    return _current_session_id
