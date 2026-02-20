import { sql } from "@/lib/db";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Delete expired authorization codes
  await sql`DELETE FROM oauth_authorization_codes WHERE expires_at < NOW()`;

  // Delete expired refresh tokens
  await sql`DELETE FROM oauth_refresh_tokens WHERE expires_at < NOW()`;

  // Delete revoked refresh tokens older than 7 days
  await sql`DELETE FROM oauth_refresh_tokens WHERE revoked_at IS NOT NULL AND revoked_at < NOW() - INTERVAL '7 days'`;

  // Delete used authorization codes older than 1 hour
  await sql`DELETE FROM oauth_authorization_codes WHERE used_at IS NOT NULL AND used_at < NOW() - INTERVAL '1 hour'`;

  return Response.json({ ok: true });
}
