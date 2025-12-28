import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Cloud, FolderOpen, Settings } from 'lucide-react';

interface Bucket {
  id: string;
  name: string;
  bucket_name: string;
  bucket_region: string;
  prefix: string;
  is_default: boolean;
  enabled: boolean;
  created_at: string;
}

export function Buckets() {
  const { getToken } = useAuth();
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBuckets() {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(`${API_BASE}/api/admin/buckets`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setBuckets(data.buckets || []);
        }
      } catch (error) {
        console.error('Failed to fetch buckets:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBuckets();
  }, [getToken]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">S3 Buckets</h1>
          <p className="text-muted-foreground mt-1">
            Configure S3 buckets for file publishing
          </p>
        </div>
        <Button asChild>
          <Link to="/buckets/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Bucket
          </Link>
        </Button>
      </div>

      {buckets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Cloud className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No buckets configured</h3>
            <p className="text-muted-foreground text-center mb-4">
              Add your first S3 bucket to start publishing files with AI agents.
            </p>
            <Button asChild>
              <Link to="/buckets/new">
                <Plus className="mr-2 h-4 w-4" />
                Add Bucket
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buckets.map((bucket) => (
            <Card key={bucket.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Cloud className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{bucket.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    {bucket.is_default && (
                      <Badge variant="secondary">Default</Badge>
                    )}
                    {!bucket.enabled && (
                      <Badge variant="destructive">Disabled</Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="font-mono text-xs">
                  s3://{bucket.bucket_name}/{bucket.prefix}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{bucket.bucket_region}</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/buckets/${bucket.id}`}>
                        <FolderOpen className="h-4 w-4 mr-1" />
                        Browse
                      </Link>
                    </Button>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/buckets/${bucket.id}/settings`}>
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
