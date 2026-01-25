import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Security } from '@/components/landing/Security';
import { CTAFooter } from '@/components/landing/CTAFooter';
import { Footer } from '@/components/landing/Footer';

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Security />
        <CTAFooter />
      </main>
      <Footer />
    </div>
  );
}
