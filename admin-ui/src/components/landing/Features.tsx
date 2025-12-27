import { Upload, Link, FolderOpen, Trash2, Shield, ClipboardList, Database, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Feature {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  size: 'large' | 'medium' | 'small';
  gradient: string;
}

const features: Feature[] = [
  {
    id: 'publish',
    title: 'Publish Files',
    description: 'Upload files directly to authorized S3 buckets. Supports text, binary, and base64 encoded content up to 5MB.',
    icon: Upload,
    size: 'large',
    gradient: 'from-primary/20 to-orange-500/20',
  },
  {
    id: 'presigned',
    title: 'Large File Uploads',
    description: 'Generate presigned URLs for files larger than 5MB. Direct browser-to-S3 uploads bypass Lambda limits entirely.',
    icon: Link,
    size: 'large',
    gradient: 'from-blue-500/20 to-cyan-500/20',
  },
  {
    id: 'list',
    title: 'Browse Files',
    description: 'List and browse files in your buckets with prefix filtering and pagination.',
    icon: FolderOpen,
    size: 'medium',
    gradient: 'from-green-500/20 to-emerald-500/20',
  },
  {
    id: 'delete',
    title: 'Manage Files',
    description: 'Delete files when needed with proper authorization and audit logging.',
    icon: Trash2,
    size: 'medium',
    gradient: 'from-red-500/20 to-rose-500/20',
  },
  {
    id: 'access',
    title: 'Access Control',
    description: 'Fine-grained permissions per user and bucket.',
    icon: Shield,
    size: 'small',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    id: 'audit',
    title: 'Audit Logging',
    description: 'Track all uploads with timestamps and metadata.',
    icon: ClipboardList,
    size: 'small',
    gradient: 'from-amber-500/20 to-yellow-500/20',
  },
  {
    id: 'multi',
    title: 'Multi-Bucket',
    description: 'Connect and manage multiple S3 buckets.',
    icon: Database,
    size: 'small',
    gradient: 'from-slate-500/20 to-zinc-500/20',
  },
];

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const Icon = feature.icon;
  const sizeClasses = {
    large: 'md:col-span-2 md:row-span-2',
    medium: 'md:col-span-2',
    small: 'md:col-span-1',
  };

  return (
    <div
      className={cn(
        'group relative rounded-2xl border border-border bg-card p-6 transition-all duration-300',
        'hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1',
        sizeClasses[feature.size],
        'animate-fade-in-up'
      )}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className={cn(
        'absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300',
        `bg-gradient-to-br ${feature.gradient}`
      )} />

      <div className="relative">
        <div className={cn(
          'inline-flex items-center justify-center rounded-xl p-3 mb-4',
          'bg-primary/10 text-primary group-hover:bg-primary group-hover:text-white transition-colors duration-300'
        )}>
          <Icon className={cn(feature.size === 'large' ? 'h-6 w-6' : 'h-5 w-5')} />
        </div>

        <h3 className={cn(
          'font-serif font-bold text-foreground mb-2',
          feature.size === 'large' ? 'text-2xl' : feature.size === 'medium' ? 'text-xl' : 'text-lg'
        )}>
          {feature.title}
        </h3>

        <p className={cn(
          'text-muted-foreground leading-relaxed',
          feature.size === 'large' ? 'text-base' : 'text-sm'
        )}>
          {feature.description}
        </p>

        {feature.size === 'large' && (
          <div className="mt-6 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <span>Learn more</span>
              <span className="group-hover:translate-x-1 transition-transform">&rarr;</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="features" className="py-24 bg-background relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            5 powerful tools,{' '}
            <span className="text-primary">one MCP server</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Everything you need to publish files to S3 with AI agents. From direct uploads
            to presigned URLs, all accessible through the Model Context Protocol.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {features.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
