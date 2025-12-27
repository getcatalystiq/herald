import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Cloud, FileText, Check } from 'lucide-react';

const files = [
  { name: 'report.pdf', size: '2.4 MB', type: 'PDF' },
  { name: 'data.csv', size: '156 KB', type: 'CSV' },
  { name: 'image.png', size: '1.2 MB', type: 'PNG' },
];

export function Hero() {
  const [uploadPhase, setUploadPhase] = useState<'idle' | 'uploading' | 'success'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentFileIndex, setCurrentFileIndex] = useState(0);

  useEffect(() => {
    let mounted = true;
    let progressInterval: ReturnType<typeof setInterval>;

    const startUpload = () => {
      if (!mounted) return;
      setUploadPhase('uploading');
      let progress = 0;

      progressInterval = setInterval(() => {
        if (!mounted) {
          clearInterval(progressInterval);
          return;
        }
        progress += 2;
        setUploadProgress(progress);
        if (progress >= 100) {
          clearInterval(progressInterval);
          setUploadPhase('success');
          setTimeout(() => {
            if (!mounted) return;
            setUploadPhase('idle');
            setUploadProgress(0);
            setCurrentFileIndex((prev) => (prev + 1) % files.length);
            setTimeout(() => startUpload(), 500);
          }, 2000);
        }
      }, 50);
    };

    const startDelay = setTimeout(() => startUpload(), 1000);

    return () => {
      mounted = false;
      clearTimeout(startDelay);
      if (progressInterval) clearInterval(progressInterval);
    };
  }, []);

  const currentFile = files[currentFileIndex];

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gray-950 pt-20">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-900 via-gray-950 to-gray-950" />

      {/* Subtle grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />

      {/* Radial glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-primary/10 rounded-full blur-[120px] opacity-60" />

      <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left column - Text content */}
          <div className="text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400 mb-8 animate-fade-in">
              <Cloud className="h-4 w-4 text-primary" />
              <span>Powered by MCP + S3</span>
            </div>

            {/* Headline */}
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-[1.1] tracking-tight mb-6 animate-fade-in-up">
              Publish files to S3,{' '}
              <span className="text-primary">with AI agents.</span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-gray-400 max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed animate-fade-in-up animation-delay-100">
              Herald is a hosted MCP server that enables AI agents to publish files
              directly to your S3 buckets. Configure access, grant permissions, and start publishing.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up animation-delay-200">
              <Button size="lg" className="text-base px-8 py-6 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow" asChild>
                <Link to="/login">
                  Try Herald Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="text-base px-8 py-6 border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white hover:border-white/60" asChild>
                <a href="https://docs.herald.dev" target="_blank" rel="noopener noreferrer">
                  View Documentation
                </a>
              </Button>
            </div>

            {/* Trust indicator */}
            <p className="text-sm text-gray-500 mt-8 animate-fade-in-up animation-delay-300">
              No credit card required. Start publishing in minutes.
            </p>
          </div>

          {/* Right column - File Upload Animation */}
          <div className="relative animate-fade-in-up animation-delay-200">
            {/* Glow behind the card */}
            <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent rounded-3xl blur-2xl opacity-60" />

            {/* Code window */}
            <div className="relative bg-gray-900/80 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Window header */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-gray-900/50">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <span className="text-xs text-gray-500 ml-2 font-mono">herald-upload</span>
              </div>

              {/* MCP Tool Call */}
              <div className="p-4 border-b border-white/5">
                <div className="flex items-start gap-3">
                  <span className="text-primary font-mono text-sm mt-0.5">Tool:</span>
                  <code className="text-gray-300 text-sm">publish_file</code>
                </div>
              </div>

              {/* File Upload UI */}
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-medium">{currentFile.name}</p>
                    <p className="text-sm text-gray-500">{currentFile.size}</p>
                  </div>
                  {uploadPhase === 'success' && (
                    <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center animate-scale-in">
                      <Check className="h-4 w-4 text-green-400" />
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-orange-500 rounded-full transition-all duration-100"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>

                {/* S3 destination */}
                <div className="flex items-center gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                  <Cloud className="h-4 w-4 text-gray-400" />
                  <code className="text-xs text-gray-400">
                    s3://my-bucket/uploads/{currentFile.name}
                  </code>
                </div>

                {/* Status message */}
                <div className="mt-4 text-center">
                  {uploadPhase === 'idle' && (
                    <span className="text-sm text-gray-500">Ready to upload...</span>
                  )}
                  {uploadPhase === 'uploading' && (
                    <span className="text-sm text-primary">Uploading to S3... {uploadProgress}%</span>
                  )}
                  {uploadPhase === 'success' && (
                    <span className="text-sm text-green-400 flex items-center justify-center gap-2">
                      <Check className="h-4 w-4" />
                      Successfully published!
                    </span>
                  )}
                </div>
              </div>

              {/* Status bar */}
              <div className="px-4 py-2 border-t border-white/5 bg-gray-900/50 flex items-center justify-between">
                <span className="text-xs text-gray-500">Amazon S3</span>
                <span className="text-xs text-green-400 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  Connected
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
}
