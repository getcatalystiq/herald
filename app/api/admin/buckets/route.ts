import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  const rows = await sql`
    SELECT id, name, bucket_name, prefix, public_url_base, is_default, enabled, settings, created_at, updated_at
    FROM tenant_buckets
    WHERE tenant_id = ${auth.tenantId}::uuid
    ORDER BY created_at DESC
  `;

  return Response.json({ buckets: rows });
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  const body = await request.json();
  const { name, bucket_name, prefix, public_url_base, is_default, settings } = body;

  if (!name || !bucket_name) {
    return Response.json(
      { error: "name and bucket_name are required" },
      { status: 400 }
    );
  }

  const rows = await sql`
    INSERT INTO tenant_buckets (tenant_id, name, bucket_name, prefix, public_url_base, is_default, settings)
    VALUES (${auth.tenantId}::uuid, ${name}, ${bucket_name}, ${prefix ?? ""}, ${public_url_base ?? null}, ${is_default ?? false}, ${JSON.stringify(settings ?? {})})
    RETURNING *
  `;
  const bucket = rows[0];

  // Grant creator full access
  await sql`
    INSERT INTO bucket_access_grants (tenant_id, bucket_id, user_id, permissions, created_by)
    VALUES (${auth.tenantId}::uuid, ${bucket.id}::uuid, ${auth.userId}::uuid, ARRAY['read', 'write', 'delete'], ${auth.userId}::uuid)
  `;

  return Response.json({ bucket }, { status: 201 });
}
