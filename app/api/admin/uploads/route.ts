import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";
import { jsonResponse } from "@/lib/oauth";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;

  const rows = await sql`
    SELECT fu.id, fu.file_key, fu.file_name, fu.file_size, fu.content_type,
           fu.upload_method, fu.created_at,
           u.email as user_email,
           tb.name as bucket_name
    FROM file_uploads fu
    LEFT JOIN users u ON u.id = fu.user_id
    LEFT JOIN tenant_buckets tb ON tb.id = fu.bucket_id
    WHERE fu.tenant_id = ${auth.tenantId}::uuid
    ORDER BY fu.created_at DESC
    LIMIT 100
  `;

  return jsonResponse({ uploads: rows });
}
