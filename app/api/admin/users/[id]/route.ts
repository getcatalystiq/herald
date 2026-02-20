import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/oauth";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  const { name, role, scopes, is_active, password } = body;

  let passwordHash: string | null = null;
  if (password) {
    if (password.length < 8) {
      return Response.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    passwordHash = await hashPassword(password);
  }

  const rows = await sql`
    UPDATE users
    SET
      name = COALESCE(${name ?? null}, name),
      role = COALESCE(${role ?? null}, role),
      scopes = COALESCE(${scopes ?? null}, scopes),
      is_active = COALESCE(${is_active ?? null}, is_active),
      password_hash = COALESCE(${passwordHash}, password_hash)
    WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
    RETURNING id, email, name, role, scopes, is_active, last_login_at, created_at, updated_at
  `;

  if (rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return Response.json({ user: rows[0] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;

  if (id === auth.userId) {
    return Response.json(
      { error: "Cannot delete yourself" },
      { status: 400 }
    );
  }

  const rows = await sql`
    DELETE FROM users
    WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
    RETURNING id
  `;

  if (rows.length === 0) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
