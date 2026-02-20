"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Cloud,
  File,
  Folder,
  Users,
  Save,
  Trash2,
} from "lucide-react";

interface BucketInfo {
  id: string;
  name: string;
  is_default: boolean;
  enabled: boolean;
}

interface FileItem {
  key: string;
  size: number;
  last_modified: string;
}

export default function BucketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { getToken } = useAuth();
  const router = useRouter();
  const isNew = id === "new";

  const [bucket, setBucket] = useState<BucketInfo | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState("");

  const [formData, setFormData] = useState({
    name: "",
    bucket_name: "",
    is_default: false,
  });

  useEffect(() => {
    if (isNew) return;

    async function fetchBucket() {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(`/api/admin/buckets/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setBucket(data.bucket);
        }
      } catch (error) {
        console.error("Failed to fetch bucket:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBucket();
  }, [id, getToken, isNew]);

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch("/api/admin/buckets", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/buckets/${data.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to create bucket");
      }
    } catch (error) {
      console.error("Failed to create bucket:", error);
      alert("Failed to create bucket");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBucket = async () => {
    if (!bucket) return;
    if (
      !confirm(
        `Are you sure you want to delete "${bucket.name}"? This cannot be undone.`
      )
    ) {
      return;
    }

    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`/api/admin/buckets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        router.push("/buckets");
      } else {
        const error = await response.json();
        alert(error.error || "Failed to delete bucket");
      }
    } catch (error) {
      console.error("Failed to delete bucket:", error);
      alert("Failed to delete bucket");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    async function fetchFiles() {
      if (!bucket) return;

      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(
          `/api/admin/buckets/${id}/files?prefix=${encodeURIComponent(currentPrefix)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (response.ok) {
          const data = await response.json();
          setFiles(data.files || []);
        }
      } catch (error) {
        console.error("Failed to fetch files:", error);
      }
    }

    fetchFiles();
  }, [id, bucket, currentPrefix, getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/buckets">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add Bucket</h1>
            <p className="text-muted-foreground mt-1">
              Configure a new bucket for file publishing
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bucket Configuration</CardTitle>
            <CardDescription>
              Enter the details for your storage bucket.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBucket} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Display Name</Label>
                <Input
                  id="name"
                  placeholder="My Bucket"
                  value={formData.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
                    setFormData({ ...formData, name, bucket_name: slug });
                  }}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="bucket_name">Storage Path</Label>
                <Input
                  id="bucket_name"
                  placeholder="my-bucket"
                  value={formData.bucket_name}
                  onChange={(e) =>
                    setFormData({ ...formData, bucket_name: e.target.value })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Path prefix used for file storage in Vercel Blob.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) =>
                    setFormData({ ...formData, is_default: e.target.checked })
                  }
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_default">Set as default bucket</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" asChild>
                  <Link href="/buckets">Cancel</Link>
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Create Bucket
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!bucket) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium mb-2">Bucket not found</h2>
        <Button asChild variant="link">
          <Link href="/buckets">Back to Buckets</Link>
        </Button>
      </div>
    );
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/buckets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">{bucket.name}</h1>
            {bucket.is_default && <Badge variant="secondary">Default</Badge>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/buckets/${id}/access`}>
              <Users className="mr-2 h-4 w-4" />
              Access
            </Link>
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteBucket}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Files</CardTitle>
          <CardDescription>
            {currentPrefix ? (
              <span className="font-mono">/{currentPrefix}</span>
            ) : (
              "Root directory"
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No files in this directory
            </div>
          ) : (
            <div className="divide-y">
              {files.map((file) => {
                const isFolder = file.key.endsWith("/");
                const name =
                  file.key.split("/").filter(Boolean).pop() || file.key;

                return (
                  <div
                    key={file.key}
                    className="flex items-center justify-between py-3 hover:bg-muted/50 px-2 rounded cursor-pointer"
                    onClick={() => isFolder && setCurrentPrefix(file.key)}
                  >
                    <div className="flex items-center gap-3">
                      {isFolder ? (
                        <Folder className="h-5 w-5 text-primary" />
                      ) : (
                        <File className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">{name}</span>
                    </div>
                    {!isFolder && (
                      <span className="text-sm text-muted-foreground">
                        {formatSize(file.size)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
