import { Cloud, Users, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    number: 1,
    title: "Connect",
    description:
      "Deploy Herald on Vercel and connect your Neon database. Configure your storage bucket in the admin panel.",
    icon: Cloud,
    color: "from-blue-500 to-cyan-500",
  },
  {
    number: 2,
    title: "Authorize",
    description:
      "Grant users access to specific buckets with fine-grained permissions: read, write, or delete.",
    icon: Users,
    color: "from-primary to-orange-500",
  },
  {
    number: 3,
    title: "Publish",
    description:
      "AI agents can now publish files directly using MCP tools. Every upload is logged for audit.",
    icon: Upload,
    color: "from-green-500 to-emerald-500",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-24 bg-muted/30 relative overflow-hidden"
    >
      <div className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]">
        <svg className="w-full h-full">
          <pattern
            id="diagonal-lines"
            patternUnits="userSpaceOnUse"
            width="40"
            height="40"
            patternTransform="rotate(45)"
          >
            <line
              x1="0"
              y1="0"
              x2="0"
              y2="40"
              stroke="currentColor"
              strokeWidth="1"
            />
          </pattern>
          <rect
            fill="url(#diagonal-lines)"
            width="100%"
            height="100%"
          />
        </svg>
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground mb-4">
            From setup to publishing{" "}
            <span className="text-primary">in minutes</span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Three simple steps to enable AI agents to publish files to your
            storage buckets.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className="relative animate-fade-in-up"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[60%] w-full h-px bg-gradient-to-r from-border via-border to-transparent" />
                )}

                <div className="relative bg-card rounded-2xl border border-border p-6 h-full hover:shadow-lg hover:border-primary/20 transition-all duration-300">
                  <div
                    className={cn(
                      "absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center",
                      "text-white text-sm font-bold shadow-lg",
                      `bg-gradient-to-br ${step.color}`
                    )}
                  >
                    {step.number}
                  </div>

                  <div
                    className={cn(
                      "inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4",
                      step.number === 1 && "bg-blue-100 dark:bg-blue-950",
                      step.number === 2 && "bg-orange-100 dark:bg-orange-950",
                      step.number === 3 && "bg-green-100 dark:bg-green-950"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-6 w-6",
                        step.number === 1 &&
                          "text-blue-600 dark:text-blue-400",
                        step.number === 2 &&
                          "text-orange-600 dark:text-orange-400",
                        step.number === 3 &&
                          "text-green-600 dark:text-green-400"
                      )}
                    />
                  </div>

                  <h3 className="font-serif text-xl font-bold text-foreground mb-2">
                    {step.title}
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
