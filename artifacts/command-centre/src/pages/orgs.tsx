import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { api, type OrgRow } from "@/lib/api";

export default function Orgs() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const { data: orgs, isLoading } = useQuery({
    queryKey: ["/api/orgs"],
    queryFn: () => api.get<OrgRow[]>("/api/orgs"),
  });
  const create = useMutation({
    mutationFn: (input: { name: string; slug: string }) => api.post<OrgRow>("/api/orgs", input),
    onSuccess: () => {
      setName("");
      setSlug("");
      queryClient.invalidateQueries({ queryKey: ["/api/orgs"] });
      toast({ title: "Organization created" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container max-w-4xl py-8 px-4">
        <h1 className="font-display text-3xl tracking-wider mb-2">TEAMS</h1>
        <p className="text-muted-foreground font-mono text-sm mb-8">
          Organizations you own or belong to. Active team-seat subs elevate every
          member to <strong className="text-primary">INSTITUTION</strong> tier.
        </p>

        <section className="border border-border rounded-lg p-6 bg-card mb-8">
          <h2 className="font-display text-lg tracking-wider mb-4">CREATE ORGANIZATION</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || !slug.trim()) return;
              create.mutate({ name: name.trim(), slug: slug.trim().toLowerCase() });
            }}
            className="flex flex-col gap-3 md:flex-row md:items-end"
          >
            <div className="flex-1">
              <label className="text-xs font-mono uppercase text-muted-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-mono uppercase text-muted-foreground">Slug</label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="acme-corp"
                pattern="[a-z0-9][a-z0-9-]+[a-z0-9]"
              />
            </div>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "CREATING…" : "CREATE"}
            </Button>
          </form>
        </section>

        <section>
          <h2 className="font-display text-lg tracking-wider mb-4">YOUR ORGANIZATIONS</h2>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !orgs || orgs.length === 0 ? (
            <p className="text-muted-foreground font-mono text-sm">No organizations yet.</p>
          ) : (
            <ul className="space-y-3">
              {orgs.map((o) => (
                <li key={o.id} className="border border-border rounded-lg p-4 bg-card">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Link href={`/orgs/${o.id}`} className="font-display text-lg tracking-wider hover:text-primary">
                        {o.name}
                      </Link>
                      <p className="text-xs font-mono text-muted-foreground">
                        {o.slug} · {o.role} · {o.status}
                        {o.seatsPurchased ? ` · ${o.seatsPurchased} seats` : ""}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/orgs/${o.id}`}>MANAGE</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
