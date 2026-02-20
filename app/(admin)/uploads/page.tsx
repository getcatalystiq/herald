"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FileUp, User, Clock, HardDrive } from "lucide-react";

interface Upload {
  id: string;
  file_key: string;
  file_name: string;
  file_size: number;
  content_type: string;
  upload_method: string;
  user_email: string;
  bucket_name: string;
  created_at: string;
}

export default function UploadsPage() {
  const { getToken } = useAuth();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUploads() {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch("/api/admin/uploads", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setUploads(data.uploads || []);
        }
      } catch (error) {
        console.error("Failed to fetch uploads:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUploads();
  }, [getToken]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const totalSize = uploads.reduce((sum, u) => sum + u.file_size, 0);
  const uniqueUsers = new Set(uploads.map((u) => u.user_email)).size;
  const todayUploads = uploads.filter((u) => {
    const uploadDate = new Date(u.created_at).toDateString();
    return uploadDate === new Date().toDateString();
  }).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload History</h1>
        <p className="text-muted-foreground mt-1">
          Audit log of all file uploads
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Total Uploads
            </CardTitle>
            <FileUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uploads.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{todayUploads}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Size</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatSize(totalSize)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">
              Active Users
            </CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueUsers}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Uploads</CardTitle>
          <CardDescription>
            View all file uploads across your buckets
          </CardDescription>
        </CardHeader>
        <CardContent>
          {uploads.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No uploads yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Bucket</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploads.map((upload) => (
                  <TableRow key={upload.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{upload.file_name}</div>
                        <div className="text-xs text-muted-foreground font-mono truncate max-w-xs">
                          {upload.file_key}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{upload.bucket_name}</TableCell>
                    <TableCell>{formatSize(upload.file_size)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          upload.upload_method === "direct"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {upload.upload_method}
                      </Badge>
                    </TableCell>
                    <TableCell>{upload.user_email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(upload.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
