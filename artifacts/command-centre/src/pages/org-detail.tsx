import { useState } from "react";
import { Link, useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { api, type OrgInvite, type OrgMember, type OrgRow } from "@/lib/api";

type OrgRole = "owner" | "admin" | "member";

export default function OrgDetail() {
  const { id } = useParams<{ id: string }>();
  const orgId = id ?? "";
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const orgQ = useQuery({
    queryKey: ["/api/orgs", orgId],
    queryFn: () => api.get<OrgRow>(`/api/orgs/${orgId}`),
    enabled: Boolean(orgId),
  });
  const membersQ = useQuery({
    queryKey: ["/api/orgs", orgId, "members"],
    queryFn: () => api.get<OrgMember[]>(`/api/orgs/${orgId}/members`),
    enabled: Boolean(orgId),
  });
  const invitesQ = useQuery({
    queryKey: ["/api/orgs", orgId, "invites"],
    queryFn: () => api.get<OrgInvite[]>(`/api/orgs/${orgId}/invites`),
    enabled: Boolean(orgId) && (orgQ.data?.role === "owner" || orgQ.data?.role === "admin"),
  });

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("member");
  const [seats, setSeats] = useState(1);
  const [interval, setInterval] = useState<"month" | "year">("month");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/orgs", orgId, "members"] });
    queryClient.invalidateQueries({ queryKey: ["/api/orgs", orgId, "invites"] });
  };

  const createInvite = useMutation({
    mutationFn: (input: { email: string; role: OrgRole }) =>
      api.post(`/api/orgs/${orgId}/invites`, input),
    onSuccess: () => {
      setInviteEmail("");
      invalidate();
      toast({ title: "Invite sent" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const revokeInvite = useMutation({
    mutationFn: (inviteId: string) => api.delete(`/api/orgs/${orgId}/invites/${inviteId}`),
    onSuccess: invalidate,
  });
  const updateMember = useMutation({
    mutationFn: (input: { userId: string; role: OrgRole }) =>
      api.patch(`/api/orgs/${orgId}/members/${input.userId}`, { role: input.role }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Role updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const removeMember = useMutation({
    mutationFn: (userId: string) => api.delete(`/api/orgs/${orgId}/members/${userId}`),
    onSuccess: () => {
      invalidate();
      toast({ title: "Member removed" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const checkout = useMutation({
    mutationFn: (input: { seats: number; interval: "month" | "year" }) =>
      api.post<{ url: string }>(`/api/orgs/${orgId}/billing/checkout`, input),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
  const portal = useMutation({
    mutationFn: () => api.post<{ url: string }>(`/api/orgs/${orgId}/billing/portal`, {}),
    onSuccess: (res) => {
      if (res.url) window.location.href = res.url;
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });

  if (orgQ.isLoading || !orgQ.data) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <TopNav />
        <main className="flex-1 container max-w-4xl py-8 px-4">
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  const org = orgQ.data;
  const isAdmin = org.role === "owner" || org.role === "admin";
  // Resolve the caller's local user id so we can render a "Leave" button on
  // their own row. The buggy `m.userId === org.id` condition this replaces
  // compared a user id to an org id, so non-admins could never self-remove.
  const meQ = useQuery({
    queryKey: ["/api/me/min"],
    queryFn: () => api.get<{ id: string }>("/api/me"),
  });
  const myUserId = meQ.data?.id ?? null;
  const isOwner = org.role === "owner";
  const isActive = org.status === "active" || org.status === "trialing";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container max-w-4xl py-8 px-4 space-y-8">
        <Link href="/orgs" className="text-sm font-mono text-muted-foreground hover:text-foreground">
          ← All organizations
        </Link>
        <header>
          <h1 className="font-display text-3xl tracking-wider">{org.name}</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">
            {org.slug} · your role: <strong>{org.role}</strong> · status:{" "}
            <strong className={isActive ? "text-primary" : ""}>{org.status}</strong>
            {org.seatsPurchased ? ` · ${org.seatsPurchased} seats` : ""}
          </p>
        </header>

        {isOwner && (
          <section className="border border-border rounded-lg p-6 bg-card">
            <h2 className="font-display text-lg tracking-wider mb-4">TEAM SEAT SUBSCRIPTION</h2>
            {isActive ? (
              <div className="space-y-3">
                <p className="text-sm font-mono text-muted-foreground">
                  Active subscription · {org.seatsPurchased} seats. Every member is elevated to{" "}
                  <strong className="text-primary">INSTITUTION</strong> tier.
                </p>
                <Button onClick={() => portal.mutate()} disabled={portal.isPending}>
                  OPEN BILLING PORTAL
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-mono text-muted-foreground">
                  Start a team-seat subscription. Each seat elevates one member to INSTITUTION.
                </p>
                <div className="flex flex-col md:flex-row gap-3 items-end">
                  <div className="w-32">
                    <label className="text-xs font-mono uppercase text-muted-foreground">Seats</label>
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={seats}
                      onChange={(e) => setSeats(Math.max(1, Number(e.target.value) || 1))}
                    />
                  </div>
                  <div className="w-40">
                    <label className="text-xs font-mono uppercase text-muted-foreground">Interval</label>
                    <Select value={interval} onValueChange={(v) => setInterval(v as "month" | "year")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="month">Monthly</SelectItem>
                        <SelectItem value="year">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={() => checkout.mutate({ seats, interval })} disabled={checkout.isPending}>
                    {checkout.isPending ? "REDIRECTING…" : "CHECKOUT"}
                  </Button>
                </div>
              </div>
            )}
          </section>
        )}

        <section className="border border-border rounded-lg p-6 bg-card">
          <h2 className="font-display text-lg tracking-wider mb-4">MEMBERS</h2>
          {membersQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : (
            <ul className="divide-y divide-border">
              {membersQ.data?.map((m) => (
                <li key={m.userId} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-mono truncate">{m.email ?? m.userId}</p>
                    {m.displayName && (
                      <p className="text-xs text-muted-foreground">{m.displayName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isOwner ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          updateMember.mutate({ userId: m.userId, role: v as OrgRole })
                        }
                      >
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="owner">owner</SelectItem>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="member">member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs font-mono uppercase">{m.role}</span>
                    )}
                    {(isAdmin || (myUserId !== null && m.userId === myUserId)) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember.mutate(m.userId)}
                      >
                        REMOVE
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAdmin && (
          <section className="border border-border rounded-lg p-6 bg-card">
            <h2 className="font-display text-lg tracking-wider mb-4">INVITES</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!inviteEmail.trim()) return;
                createInvite.mutate({ email: inviteEmail.trim(), role: inviteRole });
              }}
              className="flex flex-col md:flex-row gap-3 items-end mb-6"
            >
              <div className="flex-1">
                <label className="text-xs font-mono uppercase text-muted-foreground">Email</label>
                <Input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  required
                />
              </div>
              <div className="w-40">
                <label className="text-xs font-mono uppercase text-muted-foreground">Role</label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as OrgRole)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">member</SelectItem>
                    <SelectItem value="admin">admin</SelectItem>
                    {isOwner && <SelectItem value="owner">owner</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createInvite.isPending}>
                {createInvite.isPending ? "SENDING…" : "INVITE"}
              </Button>
            </form>

            {invitesQ.data && invitesQ.data.length > 0 && (
              <ul className="divide-y divide-border">
                {invitesQ.data.map((iv) => {
                  const expired = new Date(iv.expiresAt).getTime() < Date.now();
                  const accepted = Boolean(iv.acceptedAt);
                  const revoked = Boolean(iv.revokedAt);
                  return (
                    <li key={iv.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-mono truncate">{iv.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {iv.role} ·{" "}
                          {revoked
                            ? "revoked"
                            : accepted
                            ? `accepted ${new Date(iv.acceptedAt!).toLocaleString()}`
                            : expired
                            ? "expired"
                            : `expires ${new Date(iv.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      {!accepted && !revoked && (
                        <Button variant="ghost" size="sm" onClick={() => revokeInvite.mutate(iv.id)}>
                          REVOKE
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {isAdmin && (
          <section className="border border-border rounded-lg p-6 bg-card">
            <h2 className="font-display text-lg tracking-wider mb-4">ACTIVITY</h2>
            <p className="text-sm font-mono text-muted-foreground mb-3">
              View the full audit log for this organization (all members' engine runs + billing events).
            </p>
            <Button variant="outline" asChild>
              <Link href={`/me/activity?orgId=${org.id}`}>OPEN ACTIVITY LOG</Link>
            </Button>
          </section>
        )}
      </main>
    </div>
  );
}
