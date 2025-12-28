-- Add public_url_base to tenant_buckets for generating public URLs
-- This is the base URL (e.g., https://files.example.com or CloudFront URL)
-- that will be combined with the file path to create publicly accessible URLs

ALTER TABLE tenant_buckets
ADD COLUMN public_url_base VARCHAR(500);

COMMENT ON COLUMN tenant_buckets.public_url_base IS 'Base URL for public file access (e.g., https://cdn.example.com). If set, publish_file returns this URL + path instead of s3://';
