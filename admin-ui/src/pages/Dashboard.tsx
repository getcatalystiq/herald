import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingCard } from '@/components/ui/loading';
import { Cloud, FileUp, Users, Plus } from 'lucide-react';

interface Stats {
  bucketCount: number;
  uploadCount: number;
  userCount: number;
  recentUploads: Array<{
    id: string;
    file_name: string;
    bucket_name: string;
    created_at: string;
  }>;
}

export function Dashboard() {
  const { user, getToken } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const response = await fetch(`${API_BASE}/api/admin/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.ok) {
          const data = await response.json();
          setStats(data);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [getToken]);

  return (
    <div>
      <header className="mb-8">
        <h1 className="text-2xl font-bold font-serif text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.name || user?.email}
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {loading ? (
          <>
            <LoadingCard />
            <LoadingCard />
            <LoadingCard />
          </>
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">S3 Buckets</CardTitle>
                <Cloud className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold font-serif text-foreground">
                  {stats?.bucketCount || 0}
                </div>
                <Link to="/buckets" className="inline-block mt-2 text-sm text-primary hover:underline">
                  Manage buckets
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Uploads</CardTitle>
                <FileUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold font-serif text-foreground">
                  {stats?.uploadCount || 0}
                </div>
                <Link to="/uploads" className="inline-block mt-2 text-sm text-primary hover:underline">
                  View history
                </Link>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Team Members</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold font-serif text-foreground">
                  {stats?.userCount || 0}
                </div>
                <Link to="/users" className="inline-block mt-2 text-sm text-primary hover:underline">
                  Manage users
                </Link>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {stats?.recentUploads && stats.recentUploads.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold font-serif text-foreground mb-4">Recent Uploads</h2>
          <Card>
            <CardContent className="p-0">
              <div className="divide-y">
                {stats.recentUploads.map((upload) => (
                  <div key={upload.id} className="flex items-center justify-between p-4">
                    <div>
                      <div className="font-medium">{upload.file_name}</div>
                      <div className="text-sm text-muted-foreground">{upload.bucket_name}</div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {new Date(upload.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-lg font-bold font-serif text-foreground mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          <Link
            to="/buckets/new"
            className="flex flex-col items-center justify-center p-6 bg-card border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors no-underline"
          >
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-sm font-medium">Add Bucket</span>
          </Link>
          <Link
            to="/users"
            className="flex flex-col items-center justify-center p-6 bg-card border-2 border-dashed border-border rounded-lg text-muted-foreground hover:border-primary hover:text-primary transition-colors no-underline"
          >
            <Plus className="h-8 w-8 mb-2" />
            <span className="text-sm font-medium">Invite User</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
