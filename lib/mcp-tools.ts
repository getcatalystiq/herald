import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { RequestHandlerExtra } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { sql } from "@/lib/db";
import { uploadFile, listFiles, deleteFile, tenantPath } from "@/lib/blob";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Extra = RequestHandlerExtra<any, any>;

function checkScope(extra: Extra, requiredScope: string): boolean {
  const scopes = (extra.authInfo as Record<string, unknown> | undefined)?.scopes;
  return Array.isArray(scopes) && scopes.includes(requiredScope);
}

function getAuth(extra: Extra) {
  const authExtra = (extra.authInfo as Record<string, unknown> | undefined)?.extra as
    | { userId: string; tenantId: string }
    | undefined;
  const userId = authExtra?.userId;
  const tenantId = authExtra?.tenantId;
  if (!userId || !tenantId) {
    throw new Error("Authentication required");
  }
  return { userId, tenantId };
}

export function registerTools(server: McpServer) {
  // --- list_buckets ---
  server.registerTool(
    "list_buckets",
    {
      title: "List Buckets",
      description:
        "List all storage buckets you have access to, with permissions and paths.",
      inputSchema: {},
    },
    async (_input, extra) => {
      if (!checkScope(extra, "read")) {
        return {
          content: [{ type: "text" as const, text: "Error: 'read' scope required" }],
          isError: true,
        };
      }

      const { userId, tenantId } = getAuth(extra);

      const rows = await sql`
        SELECT tb.name, tb.bucket_name, tb.prefix, tb.public_url_base, tb.is_default, tb.enabled,
               bag.permissions, bag.prefix_restriction
        FROM bucket_access_grants bag
        JOIN tenant_buckets tb ON tb.id = bag.bucket_id
        WHERE bag.user_id = ${userId}::uuid
          AND bag.tenant_id = ${tenantId}::uuid
          AND tb.enabled = TRUE
          AND (bag.expires_at IS NULL OR bag.expires_at > NOW())
      `;

      if (rows.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No buckets available. Ask your admin to grant you access.",
            },
          ],
        };
      }

      const lines = rows.map((r) => {
        const perms = (r.permissions as string[]).join(", ");
        const def = r.is_default ? " (default)" : "";
        return `- **${r.name}**${def}: [${perms}] path: ${r.bucket_name}/${r.prefix ?? ""}`;
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `Your accessible buckets:\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  // --- publish_file ---
  server.registerTool(
    "publish_file",
    {
      title: "Publish File",
      description:
        "Upload a file to a storage bucket. The file_path must include at least one folder (e.g., 'site-name/index.html').",
      inputSchema: {
        bucket: z.string().optional().describe("Bucket name (uses default if omitted)"),
        file_path: z
          .string()
          .describe("File path with folder prefix, e.g. 'my-site/index.html'"),
        content: z.string().describe("File content (text or base64)"),
        content_type: z
          .string()
          .optional()
          .describe("MIME type (auto-detected if omitted)"),
        is_base64: z
          .boolean()
          .optional()
          .default(false)
          .describe("Whether content is base64-encoded"),
      },
    },
    async (input, extra) => {
      if (!checkScope(extra, "write")) {
        return {
          content: [{ type: "text" as const, text: "Error: 'write' scope required" }],
          isError: true,
        };
      }

      const { userId, tenantId } = getAuth(extra);
      const { file_path, content, content_type, is_base64 } = input as {
        bucket?: string;
        file_path: string;
        content: string;
        content_type?: string;
        is_base64?: boolean;
      };

      // Validate path has folder prefix
      const parts = file_path.split("/").filter(Boolean);
      if (parts.length < 2) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: file_path must include a folder prefix (e.g., 'my-site/index.html')",
            },
          ],
          isError: true,
        };
      }

      // Get accessible bucket
      const bucket = await getAccessibleBucket(
        userId,
        tenantId,
        input.bucket as string | undefined
      );
      if (!bucket) {
        return {
          content: [{ type: "text" as const, text: "Error: No accessible bucket found" }],
          isError: true,
        };
      }

      // Check write permission
      if (!(bucket.permissions as string[]).includes("write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: You don't have write permission on this bucket",
            },
          ],
          isError: true,
        };
      }

      const fullPath = bucket.prefix
        ? `${bucket.prefix}/${file_path}`
        : file_path;

      const fileContent = is_base64
        ? Buffer.from(content, "base64")
        : content;

      const fileSize = is_base64
        ? Buffer.from(content, "base64").length
        : Buffer.byteLength(content);

      const MAX_SIZE = 5 * 1024 * 1024; // 5MB
      if (fileSize > MAX_SIZE) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: File too large (${fileSize} bytes). Max: ${MAX_SIZE} bytes`,
            },
          ],
          isError: true,
        };
      }

      const result = await uploadFile(
        bucket.bucket_name as string,
        fullPath,
        fileContent,
        content_type
      );

      // Log the upload
      await sql`
        INSERT INTO file_uploads (tenant_id, bucket_id, user_id, file_key, file_name, file_size, content_type, upload_method)
        VALUES (${tenantId}::uuid, ${bucket.id}::uuid, ${userId}::uuid, ${fullPath}, ${parts[parts.length - 1]}, ${fileSize}, ${content_type ?? "application/octet-stream"}, 'direct')
      `;

      const publicUrl = bucket.public_url_base
        ? `${bucket.public_url_base}/${fullPath}`
        : result.url;

      return {
        content: [
          {
            type: "text" as const,
            text: `File published successfully!\n\nURL: ${publicUrl}\nSize: ${fileSize} bytes`,
          },
        ],
      };
    }
  );

  // --- list_files ---
  server.registerTool(
    "list_files",
    {
      title: "List Files",
      description: "List files in a storage bucket.",
      inputSchema: {
        bucket: z.string().optional().describe("Bucket name (uses default if omitted)"),
        prefix: z.string().optional().describe("Filter by path prefix"),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .default(100)
          .describe("Maximum results to return"),
      },
    },
    async (input, extra) => {
      if (!checkScope(extra, "read")) {
        return {
          content: [{ type: "text" as const, text: "Error: 'read' scope required" }],
          isError: true,
        };
      }

      const { userId, tenantId } = getAuth(extra);
      const { prefix, max_results } = input as {
        bucket?: string;
        prefix?: string;
        max_results: number;
      };

      const bucket = await getAccessibleBucket(
        userId,
        tenantId,
        input.bucket as string | undefined
      );
      if (!bucket) {
        return {
          content: [{ type: "text" as const, text: "Error: No accessible bucket found" }],
          isError: true,
        };
      }

      const fullPrefix = bucket.prefix
        ? prefix
          ? `${bucket.prefix}/${prefix}`
          : (bucket.prefix as string)
        : prefix;

      const files = await listFiles(
        bucket.bucket_name as string,
        fullPrefix ?? undefined,
        max_results
      );

      if (files.length === 0) {
        return {
          content: [{ type: "text" as const, text: "No files found." }],
        };
      }

      const lines = files.map(
        (f) => `- ${f.pathname} (${f.size} bytes, ${f.uploadedAt})`
      );

      return {
        content: [
          {
            type: "text" as const,
            text: `Files (${files.length}):\n\n${lines.join("\n")}`,
          },
        ],
      };
    }
  );

  // --- delete_file ---
  server.registerTool(
    "delete_file",
    {
      title: "Delete File",
      description: "Delete a file from a storage bucket.",
      inputSchema: {
        bucket: z.string().optional().describe("Bucket name (uses default if omitted)"),
        file_path: z.string().describe("Path of the file to delete"),
      },
    },
    async (input, extra) => {
      if (!checkScope(extra, "write")) {
        return {
          content: [{ type: "text" as const, text: "Error: 'write' scope required" }],
          isError: true,
        };
      }

      const { userId, tenantId } = getAuth(extra);
      const { file_path } = input as { bucket?: string; file_path: string };

      const bucket = await getAccessibleBucket(
        userId,
        tenantId,
        input.bucket as string | undefined
      );
      if (!bucket) {
        return {
          content: [{ type: "text" as const, text: "Error: No accessible bucket found" }],
          isError: true,
        };
      }

      if (!(bucket.permissions as string[]).includes("delete") &&
          !(bucket.permissions as string[]).includes("write")) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: You don't have delete permission on this bucket",
            },
          ],
          isError: true,
        };
      }

      const fullPath = bucket.prefix
        ? `${bucket.prefix}/${file_path}`
        : file_path;

      try {
        await deleteFile(bucket.bucket_name as string, fullPath);
        return {
          content: [
            { type: "text" as const, text: `Deleted: ${file_path}` },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: ${err instanceof Error ? err.message : "Delete failed"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

// --- Helper ---

async function getAccessibleBucket(
  userId: string,
  tenantId: string,
  bucketName?: string
) {
  if (bucketName) {
    const rows = await sql`
      SELECT tb.*, bag.permissions, bag.prefix_restriction
      FROM bucket_access_grants bag
      JOIN tenant_buckets tb ON tb.id = bag.bucket_id
      WHERE bag.user_id = ${userId}::uuid
        AND bag.tenant_id = ${tenantId}::uuid
        AND tb.name = ${bucketName}
        AND tb.enabled = TRUE
        AND (bag.expires_at IS NULL OR bag.expires_at > NOW())
      LIMIT 1
    `;
    return rows.length > 0 ? rows[0] : null;
  }

  // Use default bucket
  const rows = await sql`
    SELECT tb.*, bag.permissions, bag.prefix_restriction
    FROM bucket_access_grants bag
    JOIN tenant_buckets tb ON tb.id = bag.bucket_id
    WHERE bag.user_id = ${userId}::uuid
      AND bag.tenant_id = ${tenantId}::uuid
      AND tb.enabled = TRUE
      AND (bag.expires_at IS NULL OR bag.expires_at > NOW())
    ORDER BY tb.is_default DESC
    LIMIT 1
  `;
  return rows.length > 0 ? rows[0] : null;
}
