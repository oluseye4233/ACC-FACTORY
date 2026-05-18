import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { ENGINES } from "@/lib/constants";
import { Shield, Zap, Target, Cpu, CheckCircle } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-24 md:py-32 lg:py-40">
          <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-secondary/5 -z-10" />
          <div className="container px-4 md:px-6 relative">
            <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
              <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-sm font-medium text-primary mb-4">
                <span className="flex h-2 w-2 rounded-full bg-primary mr-2 animate-pulse"></span>
                SYSTEM ONLINE
              </div>
              <h1 className="font-display text-5xl md:text-7xl lg:text-8xl tracking-wider text-foreground">
                FORGE.BONSAI <span className="text-primary">HARNESS</span>
              </h1>
              <p className="font-serif text-xl md:text-2xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                A single coherent sequence. From raw idea to certified MVP PDD. 
                Dense, instrumented, and clandestine.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button asChild size="lg" className="h-14 px-8 text-lg font-display tracking-wider">
                  <Link href="/sign-up">INITIATE SESSION</Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="h-14 px-8 text-lg font-display tracking-wider">
                  <Link href="/pricing">VIEW CAPABILITIES</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="py-24 bg-card border-y">
          <div className="container px-4 md:px-6">
            <div className="mb-16 md:text-center max-w-3xl mx-auto">
              <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-4 text-primary">THE 8 ENGINES</h2>
              <p className="text-muted-foreground font-serif text-lg">
                Eight specialized engines working in concert to refine, grow, and compress your ideas into certified specifications.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {ENGINES.map((engine) => (
                <div key={engine.id} className="flex flex-col p-6 rounded-lg border bg-background hover:bg-accent/50 transition-colors">
                  <div className="font-mono font-bold text-xl text-primary mb-2">{engine.name}</div>
                  <h3 className="font-display text-xl tracking-wide mb-3">{engine.title}</h3>
                  <p className="text-sm text-muted-foreground mt-auto">{engine.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof */}
        <section className="py-24 relative overflow-hidden">
          <div className="container px-4 md:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="font-display text-4xl md:text-5xl tracking-wide text-secondary">
                  CERTIFIED EXCELLENCE
                </h2>
                <div className="space-y-6">
                  {[
                    { icon: Shield, text: "SPARTAN-compressed MVP PDDs" },
                    { icon: Target, text: "Rigorous JCSE diagnostic scoring" },
                    { icon: Cpu, text: "Memetic Algorithm Birth Packages" },
                    { icon: CheckCircle, text: "Public verification URLs for all output" }
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="flex-shrink-0 h-12 w-12 rounded-full bg-secondary/10 flex items-center justify-center">
                        <item.icon className="h-6 w-6 text-secondary" />
                      </div>
                      <span className="font-medium text-lg">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative border border-primary/20 rounded-lg p-8 bg-card/50 backdrop-blur">
                <div className="absolute -top-3 -left-3 h-6 w-6 border-t-2 border-l-2 border-primary"></div>
                <div className="absolute -bottom-3 -right-3 h-6 w-6 border-b-2 border-r-2 border-primary"></div>
                <div className="font-mono text-sm text-muted-foreground mb-6 flex justify-between">
                  <span>TELEMETRY STREAM</span>
                  <span className="text-primary animate-pulse">LIVE</span>
                </div>
                <div className="space-y-4 font-mono text-sm">
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">SESSIONS_ACTIVE</span>
                    <span className="text-foreground">1,042</span>
                  </div>
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">CERTIFICATES_ISSUED</span>
                    <span className="text-secondary">8,934</span>
                  </div>
                  <div className="flex justify-between pb-2">
                    <span className="text-muted-foreground">AVG_JCSE_SCORE</span>
                    <span className="text-primary">42.8/50</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
