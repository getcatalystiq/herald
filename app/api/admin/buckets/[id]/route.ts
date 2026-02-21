import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { jsonResponse } from "@/lib/oauth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    SELECT * FROM tenant_buckets
    WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
  `;

  if (rows.length === 0) {
    return jsonResponse({ error: "Bucket not found" }, 404);
  }

  return jsonResponse({ bucket: rows[0] });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;
  const body = await request.json();

  const { name, bucket_name, prefix, public_url_base, is_default, enabled, settings } = body;

  const rows = await sql`
    UPDATE tenant_buckets
    SET
      name = COALESCE(${name ?? null}, name),
      bucket_name = COALESCE(${bucket_name ?? null}, bucket_name),
      prefix = COALESCE(${prefix ?? null}, prefix),
      public_url_base = COALESCE(${public_url_base ?? null}, public_url_base),
      is_default = COALESCE(${is_default ?? null}, is_default),
      enabled = COALESCE(${enabled ?? null}, enabled),
      settings = COALESCE(${settings ? JSON.stringify(settings) : null}::jsonb, settings)
    WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
    RETURNING *
  `;

  if (rows.length === 0) {
    return jsonResponse({ error: "Bucket not found" }, 404);
  }

  return jsonResponse({ bucket: rows[0] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;

  const rows = await sql`
    DELETE FROM tenant_buckets
    WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
    RETURNING id
  `;

  if (rows.length === 0) {
    return jsonResponse({ error: "Bucket not found" }, 404);
  }

  return new Response(null, { status: 204 });
}
