import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT bag.*, u.email as user_email, u.name as user_name
    FROM bucket_access_grants bag
    JOIN users u ON u.id = bag.user_id
    WHERE bag.bucket_id = ${id}::uuid AND bag.tenant_id = ${auth.tenantId}::uuid
    ORDER BY bag.created_at DESC
  `;

  return Response.json({ grants: rows });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  const { user_id, permissions, prefix_restriction, expires_at } = body;

  if (!user_id) {
    return Response.json({ error: "user_id is required" }, { status: 400 });
  }

  const rows = await sql`
    INSERT INTO bucket_access_grants (tenant_id, bucket_id, user_id, permissions, prefix_restriction, expires_at, created_by)
    VALUES (${auth.tenantId}::uuid, ${id}::uuid, ${user_id}::uuid, ${permissions ?? ["read", "write"]}, ${prefix_restriction ?? null}, ${expires_at ?? null}, ${auth.userId}::uuid)
    ON CONFLICT (bucket_id, user_id) DO UPDATE
    SET permissions = EXCLUDED.permissions, prefix_restriction = EXCLUDED.prefix_restriction, expires_at = EXCLUDED.expires_at
    RETURNING *
  `;

  return Response.json({ grant: rows[0] }, { status: 201 });
}
