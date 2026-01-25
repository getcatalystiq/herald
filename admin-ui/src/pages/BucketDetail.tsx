import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Cloud, File, Folder, Users, Settings, Save, Info, ChevronDown, Copy, Check, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface BucketInfo {
  id: string;
  name: string;
  bucket_name: string;
  bucket_region: string;
  prefix: string;
  is_default: boolean;
  enabled: boolean;
  settings: Record<string, unknown>;
  public_url_base?: string;
}

interface FileItem {
  key: string;
  size: number;
  last_modified: string;
}

export function BucketDetail() {
  const { id } = useParams<{ id: string }>();
  const { getToken } = useAuth();
  const navigate = useNavigate();
  const isNew = id === 'new';

  const [bucket, setBucket] = useState<BucketInfo | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPrefix, setCurrentPrefix] = useState('');

  // Form state for new bucket
  const [formData, setFormData] = useState({
    name: '',
    bucket_name: '',
    bucket_region: 'us-east-1',
    prefix: '',
    role_arn: '',
    is_default: false,
    public_url_base: '',
  });
  const [showCrossAccountInfo, setShowCrossAccountInfo] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  useEffect(() => {
    if (isNew) return;

    async function fetchBucket() {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(`${API_BASE}/api/admin/buckets/${id}`, {
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
  }, [id, getToken, isNew]);

  const handleCreateBucket = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/buckets`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        const data = await response.json();
        navigate(`/buckets/${data.id}`);
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create bucket');
      }
    } catch (error) {
      console.error('Failed to create bucket:', error);
      alert('Failed to create bucket');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBucket = async () => {
    if (!bucket) return;
    if (!confirm(`Are you sure you want to delete "${bucket.name}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(true);
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/api/admin/buckets/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        navigate('/buckets');
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to delete bucket');
      }
    } catch (error) {
      console.error('Failed to delete bucket:', error);
      alert('Failed to delete bucket');
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
          `${API_BASE}/api/admin/buckets/${id}/files?prefix=${encodeURIComponent(currentPrefix)}`,
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

  // Create new bucket form
  if (isNew) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/buckets">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Add S3 Bucket</h1>
            <p className="text-muted-foreground mt-1">Configure a new bucket for file publishing</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Bucket Configuration</CardTitle>
            <CardDescription>
              Enter the details for your S3 bucket. The bucket must already exist in AWS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBucket} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    placeholder="My Bucket"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bucket_name">S3 Bucket Name</Label>
                  <Input
                    id="bucket_name"
                    placeholder="my-company-files"
                    value={formData.bucket_name}
                    onChange={(e) => setFormData({ ...formData, bucket_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bucket_region">Region</Label>
                  <Input
                    id="bucket_region"
                    placeholder="us-east-1"
                    value={formData.bucket_region}
                    onChange={(e) => setFormData({ ...formData, bucket_region: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prefix">Path Prefix (optional)</Label>
                  <Input
                    id="prefix"
                    placeholder="uploads/"
                    value={formData.prefix}
                    onChange={(e) => setFormData({ ...formData, prefix: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_arn">IAM Role ARN (for cross-account access)</Label>
                <Input
                  id="role_arn"
                  placeholder="arn:aws:iam::123456789012:role/HeraldBucketAccess"
                  value={formData.role_arn}
                  onChange={(e) => setFormData({ ...formData, role_arn: e.target.value })}
                />
                <p className="text-sm text-muted-foreground">
                  Leave empty for buckets in the same AWS account. For cross-account buckets, provide the IAM role ARN that Herald can assume.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="public_url_base">Public URL Base <span className="text-red-500">*</span></Label>
                <Input
                  id="public_url_base"
                  placeholder="http://bucket-name.s3-website-us-east-1.amazonaws.com"
                  value={formData.public_url_base}
                  onChange={(e) => setFormData({ ...formData, public_url_base: e.target.value })}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  Base URL where published files will be publicly accessible. This is returned to AI agents after publishing.
                </p>
                <Alert className="mt-2">
                  <Info className="h-4 w-4" />
                  <AlertDescription className="space-y-3">
                    <p className="font-medium">How to get your Public URL:</p>
                    <div className="space-y-2 text-sm">
                      <p><strong>Option 1: S3 Website Hosting</strong> (simplest)</p>
                      <ol className="list-decimal list-inside space-y-1 ml-2">
                        <li>Go to S3 → Your bucket → Properties</li>
                        <li>Enable "Static website hosting"</li>
                        <li>Set index document to <code className="bg-muted px-1 rounded">index.html</code></li>
                        <li>Go to Permissions → uncheck "Block all public access"</li>
                        <li>Add a bucket policy to allow public reads (see below)</li>
                        <li>Your URL will be: <code className="bg-muted px-1 rounded">http://BUCKET.s3-website-REGION.amazonaws.com</code></li>
                      </ol>
                      <details className="mt-2">
                        <summary className="cursor-pointer text-primary hover:underline">Show bucket policy for public access</summary>
                        <pre className="bg-muted p-2 rounded text-xs mt-1 overflow-x-auto">{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Sid": "PublicReadGetObject",
    "Effect": "Allow",
    "Principal": "*",
    "Action": "s3:GetObject",
    "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
  }]
}`}</pre>
                      </details>
                      <p className="mt-2"><strong>Option 2: CloudFront</strong> (recommended for HTTPS)</p>
                      <p className="ml-2">Create a CloudFront distribution with your S3 bucket as origin. Your URL will be: <code className="bg-muted px-1 rounded">https://d1234abcd.cloudfront.net</code></p>
                    </div>
                  </AlertDescription>
                </Alert>
              </div>

              <Collapsible open={showCrossAccountInfo} onOpenChange={setShowCrossAccountInfo}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
                    <Info className="h-4 w-4" />
                    How to set up cross-account access
                    <ChevronDown className={`h-4 w-4 transition-transform ${showCrossAccountInfo ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Alert className="mt-3">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="space-y-4">
                      <p className="font-medium">To access an S3 bucket in another AWS account:</p>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">1. Create an IAM role in the target AWS account with this trust policy:</p>
                        <div className="relative">
                          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::807467870613:root"
    },
    "Action": "sts:AssumeRole"
  }]
}`}</pre>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={() => copyToClipboard(`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "AWS": "arn:aws:iam::807467870613:root"
    },
    "Action": "sts:AssumeRole"
  }]
}`, 'trust')}
                          >
                            {copiedText === 'trust' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">2. Attach S3 permissions to the role:</p>
                        <div className="relative">
                          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto">{`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ],
    "Resource": [
      "arn:aws:s3:::YOUR-BUCKET-NAME",
      "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    ]
  }]
}`}</pre>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="absolute top-2 right-2 h-6 w-6"
                            onClick={() => copyToClipboard(`{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      "s3:ListBucket"
    ],
    "Resource": [
      "arn:aws:s3:::YOUR-BUCKET-NAME",
      "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    ]
  }]
}`, 's3')}
                          >
                            {copiedText === 's3' ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                          </Button>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <p className="text-sm font-medium">3. Enter the role ARN above:</p>
                        <code className="bg-muted px-2 py-1 rounded text-xs">
                          arn:aws:iam::TARGET-ACCOUNT-ID:role/HeraldBucketAccess
                        </code>
                      </div>
                    </AlertDescription>
                  </Alert>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={formData.is_default}
                  onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="is_default">Set as default bucket</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" asChild>
                  <Link to="/buckets">Cancel</Link>
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
          <Button
            variant="destructive"
            onClick={handleDeleteBucket}
            disabled={deleting}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {deleting ? 'Deleting...' : 'Delete'}
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
