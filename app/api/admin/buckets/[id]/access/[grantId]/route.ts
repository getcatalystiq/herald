import { requireAdmin, isErrorResponse } from "@/lib/admin-auth";
import { sql } from "@/lib/db";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string; grantId: string }> }
) {
  const auth = await requireAdmin(request);
  if (isErrorResponse(auth)) return auth;
  const { grantId } = await params;

  const rows = await sql`
    DELETE FROM bucket_access_grants
    WHERE id = ${grantId}::uuid AND tenant_id = ${auth.tenantId}::uuid
    RETURNING id
  `;

  if (rows.length === 0) {
    return Response.json({ error: "Grant not found" }, { status: 404 });
  }

  return new Response(null, { status: 204 });
}
