import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { hashPassword } from "@/lib/oauth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  const rows = await sql`
    SELECT id, email, name, role, scopes, is_active, last_login_at, created_at, updated_at
    FROM users
    WHERE tenant_id = ${auth.tenantId}::uuid
    ORDER BY created_at DESC
  `;

  return Response.json({ users: rows });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  const body = await request.json();
  const { email, password, name, role, scopes } = body;

  if (!email || !password) {
    return Response.json(
      { error: "email and password are required" },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return Response.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const passwordHash = await hashPassword(password);

  try {
    const rows = await sql`
      INSERT INTO users (tenant_id, email, password_hash, name, role, scopes)
      VALUES (${auth.tenantId}::uuid, ${email}, ${passwordHash}, ${name ?? null}, ${role ?? "member"}, ${scopes ?? ["read", "write"]})
      RETURNING id, email, name, role, scopes, is_active, created_at
    `;

    return Response.json({ user: rows[0] }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    if (message.includes("duplicate") || message.includes("unique")) {
      return Response.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }
    throw err;
  }
}
