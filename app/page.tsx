"use client";

import { AuthProvider } from "@/lib/auth-context";
import { Header } from "@/components/landing/header";
import { Hero } from "@/components/landing/hero";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Security } from "@/components/landing/security";
import { CTAFooter } from "@/components/landing/cta-footer";
import { Footer } from "@/components/landing/footer";

export default function Home() {
  return (
    <AuthProvider>
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
    </AuthProvider>
  );
}
