import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Cloud, File, Folder, Users, Settings } from 'lucide-react';

interface BucketInfo {
  id: string;
  name: string;
  bucket_name: string;
  bucket_region: string;
  prefix: string;
  is_default: boolean;
  enabled: boolean;
  settings: Record<string, unknown>;
}

interface FileItem {
  key: string;
  size: number;
  last_modified: string;
}

export function BucketDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const [bucket, setBucket] = useState<BucketInfo | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrefix, setCurrentPrefix] = useState('');

  useEffect(() => {
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
        console.error('Failed to fetch bucket:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBucket();
  }, [id, getToken]);

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
        console.error('Failed to fetch files:', error);
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

  if (!bucket) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium mb-2">Bucket not found</h2>
        <Button asChild variant="link">
          <Link to="/buckets">Back to Buckets</Link>
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
          <Link to="/buckets">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Cloud className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">{bucket.name}</h1>
            {bucket.is_default && <Badge variant="secondary">Default</Badge>}
          </div>
          <p className="text-muted-foreground font-mono text-sm mt-1">
            s3://{bucket.bucket_name}/{bucket.prefix}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to={`/buckets/${id}/access`}>
              <Users className="mr-2 h-4 w-4" />
              Access
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to={`/buckets/${id}/settings`}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Link>
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
              'Root directory'
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
                const isFolder = file.key.endsWith('/');
                const name = file.key.split('/').filter(Boolean).pop() || file.key;

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
