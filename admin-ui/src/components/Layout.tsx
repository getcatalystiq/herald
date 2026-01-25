import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { cn } from '@/lib/utils';
import { Github } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/buckets', label: 'Buckets' },
    { path: '/uploads', label: 'Uploads' },
    { path: '/users', label: 'Users' },
  ];

  return (
    <div className="flex min-h-screen">
      <nav className="w-60 bg-gray-900 dark:bg-gray-950 text-white flex flex-col fixed top-0 left-0 bottom-0">
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img src="/herald-logo.png" alt="Herald" className="h-10 w-10 rounded-xl" />
            <div>
              <h1 className="text-2xl font-bold">Herald</h1>
              <span className="text-xs text-gray-500 uppercase tracking-wider">Admin</span>
            </div>
          </div>
        </div>

        <ul className="py-4 flex-1">
          {navItems.map((item) => (
            <li key={item.path}>
              <Link
                to={item.path}
                className={cn(
                  "block px-6 py-3 text-gray-300 no-underline transition-colors hover:bg-white/5 hover:text-white",
                  location.pathname === item.path && "bg-[#e07856]/20 text-[#e07856] border-l-[3px] border-[#e07856]"
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="p-4 border-t border-white/10">
          <div className="mb-3">
            <span className="block text-sm font-medium truncate">{user?.email}</span>
            <span className="block text-xs text-gray-500 capitalize">{user?.role}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="flex-1" onClick={logout}>
              Logout
            </Button>
            <a
              href="https://github.com/getcatalystiq/herald"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:text-white transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-5 w-5" />
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>

      <main className="flex-1 ml-60 p-8 min-h-screen">
        {children}
      </main>
    </div>
  );
}
