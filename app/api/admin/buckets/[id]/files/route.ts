import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { listFiles } from "@/lib/blob";
import { jsonResponse } from "@/lib/oauth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { id } = await params;
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") ?? undefined;

  const rows = await sql`
    SELECT bucket_name, prefix as bucket_prefix
    FROM tenant_buckets
    WHERE id = ${id}::uuid AND tenant_id = ${auth.tenantId}::uuid
  `;

  if (rows.length === 0) {
    return jsonResponse({ error: "Bucket not found" }, 404);
  }

  const bucket = rows[0];
  const fullPrefix = bucket.bucket_prefix
    ? prefix
      ? `${bucket.bucket_prefix}/${prefix}`
      : (bucket.bucket_prefix as string)
    : prefix;

  const files = await listFiles(
    bucket.bucket_name as string,
    fullPrefix,
    100
  );

  return jsonResponse({ files });
}
