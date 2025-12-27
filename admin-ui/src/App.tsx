import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Callback } from './pages/Callback';
import { Dashboard } from './pages/Dashboard';
import { Buckets } from './pages/Buckets';
import { BucketDetail } from './pages/BucketDetail';
import { Users } from './pages/Users';
import { Uploads } from './pages/Uploads';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        Loading...
      </div>
    );
  }

  if (!isLoggedIn) {
    return <Navigate to="/login" replace />;
  }

  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/callback" element={<Callback />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/buckets"
        element={
          <ProtectedRoute>
            <Buckets />
          </ProtectedRoute>
        }
      />

      <Route
        path="/buckets/:id"
        element={
          <ProtectedRoute>
            <BucketDetail />
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute>
            <Users />
          </ProtectedRoute>
        }
      />

      <Route
        path="/uploads"
        element={
          <ProtectedRoute>
            <Uploads />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
