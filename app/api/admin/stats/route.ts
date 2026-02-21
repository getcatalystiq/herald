import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { jsonResponse } from "@/lib/oauth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  // Consolidated stats query (single round-trip)
  const statsRows = await sql`
    SELECT
      (SELECT COUNT(*) FROM tenant_buckets WHERE tenant_id = ${auth.tenantId}::uuid) as bucket_count,
      (SELECT COUNT(*) FROM file_uploads WHERE tenant_id = ${auth.tenantId}::uuid) as upload_count,
      (SELECT COUNT(*) FROM users WHERE tenant_id = ${auth.tenantId}::uuid) as user_count
  `;

  const recentRows = await sql`
    SELECT fu.id, fu.file_name, tb.name as bucket_name, fu.created_at
    FROM file_uploads fu
    LEFT JOIN tenant_buckets tb ON tb.id = fu.bucket_id
    WHERE fu.tenant_id = ${auth.tenantId}::uuid
    ORDER BY fu.created_at DESC
    LIMIT 5
  `;

  const stats = statsRows[0];
  return jsonResponse({
    bucketCount: Number(stats.bucket_count),
    uploadCount: Number(stats.upload_count),
    userCount: Number(stats.user_count),
    recentUploads: recentRows,
  });
}
