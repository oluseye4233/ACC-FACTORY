import { Link } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { useGetMe, useBillingPortal } from "@workspace/api-client-react";
import { TierBadge } from "@/components/shared/TierBadge";
import { ENGINES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Zap, Calendar, ExternalLink, Lock } from "lucide-react";
import { format } from "date-fns";
import { BILLING_ENABLED } from "@/lib/billing-flag";

export default function Billing() {
  const { data: me, isLoading } = useGetMe();
  const portal = useBillingPortal();
  const { toast } = useToast();

  const handleManageSubscription = () => {
    portal.mutate(
      { data: {} },
      {
        onSuccess: (res) => {
          if (res.url) {
            window.location.href = res.url;
          }
        },
        onError: (err) => {
          toast({
            title: "Error accessing billing portal",
            description: (err as any)?.data?.error || "An unexpected error occurred",
            variant: "destructive",
          });
        }
      }
    );
  };

  const usage = me?.subscriber?.usage || { f1: 0, f2: 0, f3: 0, f4: 0, f5: 0, f6: 0, f7: 0 };
  const tier = me?.subscriber?.tier || "EXPLORER";
  
  const dailyCap = tier === "EXPLORER" ? 5 : 
                   tier === "PRACTITIONER" ? 20 : 
                   tier === "ARCHITECT" ? 100 : 999;

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-12 px-4 md:px-6 max-w-4xl">
        
        <div className="mb-10">
          <h1 className="font-display text-4xl tracking-wider mb-2">
            BILLING & USAGE
          </h1>
          <p className="text-muted-foreground font-mono text-sm">
            Manage your operational capacity and subscription
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Subscription Info */}
          <div className="md:col-span-1 space-y-6">
            <Card className="bg-card">
              <CardHeader>
                <CardTitle className="font-display tracking-wide text-xl">CURRENT PLAN</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  {isLoading ? <Skeleton className="h-6 w-24" /> : <TierBadge tier={tier} />}
                </div>
                
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground font-mono">STATUS</span>
                      <span className={`font-mono font-bold ${
                        me?.subscriber?.status === 'active' || me?.subscriber?.status === 'trialing' 
                          ? 'text-primary' 
                          : 'text-destructive'
                      }`}>
                        {me?.subscriber?.status?.toUpperCase() || 'UNKNOWN'}
                      </span>
                    </div>
                    
                    {me?.subscriber?.currentPeriodEnd && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-mono flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" /> ENDS
                        </span>
                        <span className="font-mono">
                          {format(new Date(me.subscriber.currentPeriodEnd), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}

                    {me?.subscriber?.cancelAtPeriodEnd && (
                      <div className="p-3 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive font-mono">
                        Plan will cancel at end of billing period.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="pt-2">
                {BILLING_ENABLED ? (
                  <Button
                    className="w-full font-mono text-xs gap-2"
                    onClick={handleManageSubscription}
                    disabled={portal.isPending || tier === "EXPLORER"}
                  >
                    <CreditCard className="h-4 w-4" />
                    {portal.isPending ? "CONNECTING..." : "MANAGE SUBSCRIPTION"}
                    <ExternalLink className="h-3 w-3 ml-auto opacity-50" />
                  </Button>
                ) : (
                  <div
                    className="w-full rounded border border-secondary/30 bg-secondary/10 px-3 py-2 text-center text-[10px] font-mono uppercase tracking-wider text-secondary flex items-center justify-center gap-2"
                    data-testid="badge-billing-private-preview"
                  >
                    <Lock className="h-3 w-3" />
                    Billing opens at General Availability
                  </div>
                )}
              </CardFooter>
            </Card>

            <Card className="bg-secondary/5 border-secondary/20">
              <CardHeader>
                <CardTitle className="font-display tracking-wide text-secondary text-lg">NEED MORE CAPACITY?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Higher tiers provide increased daily limits and access to advanced engine capabilities.
              </CardContent>
              <CardFooter>
                <Button asChild variant="outline" className="w-full font-display tracking-wider border-secondary/20 hover:bg-secondary/10 hover:text-secondary">
                  <Link href="/pricing">VIEW PLANS</Link>
                </Button>
              </CardFooter>
            </Card>
          </div>

          {/* Usage Meters */}
          <div className="md:col-span-2">
            <Card className="bg-card h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-display tracking-wide text-2xl">DAILY TELEMETRY</CardTitle>
                    <CardDescription className="font-mono text-xs mt-1">
                      Engine executions vs daily allocation limit
                    </CardDescription>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Zap className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-8 pt-4">
                {isLoading ? (
                  Array(7).fill(0).map((_, i) => (
                    <div key={i} className="space-y-2">
                      <div className="flex justify-between"><Skeleton className="h-4 w-20" /><Skeleton className="h-4 w-12" /></div>
                      <Skeleton className="h-2 w-full" />
                    </div>
                  ))
                ) : (
                  ENGINES.filter(e => e.id <= 7).map(engine => {
                    const usageKey = `f${engine.id}` as keyof typeof usage;
                    const currentUsage = (usage as any)?.[usageKey] || 0;
                    const usagePercent = dailyCap < 999 ? Math.min(100, (currentUsage / dailyCap) * 100) : 0;
                    const isMaxed = dailyCap < 999 && currentUsage >= dailyCap;

                    return (
                      <div key={engine.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-primary w-6">{engine.name}</span>
                            <span className="font-medium text-sm">{engine.title}</span>
                          </div>
                          <div className="font-mono text-xs flex items-center gap-1">
                            <span className={isMaxed ? 'text-destructive font-bold' : 'text-foreground'}>
                              {currentUsage}
                            </span>
                            <span className="text-muted-foreground">/ {dailyCap < 999 ? dailyCap : '∞'}</span>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full transition-all duration-500 ${isMaxed ? 'bg-destructive' : 'bg-primary'}`}
                            style={{ width: `${usagePercent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>
          
        </div>
      </main>
    </div>
  );
}
