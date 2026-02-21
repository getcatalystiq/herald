import { put, list, del } from "@vercel/blob";
import path from "node:path";

export function tenantPath(tenantSlug: string, filePath: string): string {
  const normalized = path.normalize(filePath).replace(/^(\.\.[/\\])+/, "");
  if (normalized.startsWith("/") || normalized.includes("..")) {
    throw new Error("Invalid file path");
  }
  return `${tenantSlug}/${normalized}`;
}

export async function uploadFile(
  tenantSlug: string,
  filePath: string,
  content: string | Buffer,
  contentType?: string
) {
  const pathname = tenantPath(tenantSlug, filePath);
  return put(pathname, content, {
    access: "public",
    addRandomSuffix: false,
    contentType,
    cacheControlMaxAge: 31536000,
  });
}

export async function listFiles(
  tenantSlug: string,
  prefix?: string,
  limit: number = 100
) {
  const fullPrefix = prefix
    ? tenantPath(tenantSlug, prefix)
    : `${tenantSlug}/`;
  const result = await list({ prefix: fullPrefix, limit });
  return result.blobs.map((blob) => ({
    url: blob.url,
    pathname: blob.pathname.replace(`${tenantSlug}/`, ""),
    size: blob.size,
    uploadedAt: blob.uploadedAt,
  }));
}

export async function deleteFile(tenantSlug: string, filePath: string) {
  const pathname = tenantPath(tenantSlug, filePath);
  // Vercel Blob del() takes a URL, not a path.
  // We need to list to find the full URL first.
  const result = await list({ prefix: pathname, limit: 1 });
  if (result.blobs.length === 0) {
    throw new Error(`File not found: ${filePath}`);
  }
  await del(result.blobs[0].url);
}
