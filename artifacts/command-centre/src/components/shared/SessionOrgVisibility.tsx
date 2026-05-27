import { useEffect, useState } from "react";
import { api, type OrgRow } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Users } from "lucide-react";

interface Props {
  sessionId: string;
  initialOrgId: string | null | undefined;
  initialOrgVisible: boolean | undefined;
  /**
   * When true (non-owner viewing a shared session), render a static
   * read-only badge instead of the editable select + checkbox.
   */
  readOnly?: boolean;
}

export function SessionOrgVisibility({ sessionId, initialOrgId, initialOrgVisible, readOnly }: Props) {
  const [orgs, setOrgs] = useState<OrgRow[] | null>(null);
  const [orgId, setOrgId] = useState<string | "">(initialOrgId ?? "");
  const [visible, setVisible] = useState<boolean>(Boolean(initialOrgVisible));
  const [pending, setPending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (readOnly) return;
    let cancelled = false;
    api
      .get<OrgRow[]>("/api/orgs")
      .then((rows) => {
        if (!cancelled) setOrgs(rows);
      })
      .catch(() => {
        if (!cancelled) setOrgs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [readOnly]);

  if (readOnly) {
    if (!initialOrgId || !initialOrgVisible) return null;
    return (
      <div
        className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-primary border border-primary/30 bg-primary/5 rounded px-2 py-1"
        data-testid="badge-session-org-visible"
        title="Shared with your team"
      >
        <Users className="h-3 w-3" />
        <span>Team visible</span>
      </div>
    );
  }

  if (orgs === null) return null;
  if (orgs.length === 0) return null;

  const save = async (nextOrgId: string, nextVisible: boolean) => {
    setPending(true);
    try {
      await api.patch(`/api/sessions/${sessionId}/org-visibility`, {
        orgId: nextOrgId === "" ? null : nextOrgId,
        orgVisible: nextVisible,
      });
      toast({
        title: "Team visibility updated",
        description: nextVisible && nextOrgId
          ? "Visible to team members"
          : "Hidden from teams",
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not update visibility";
      toast({ title: "Update failed", description: msg, variant: "destructive" });
      // revert local state
      setOrgId(initialOrgId ?? "");
      setVisible(Boolean(initialOrgVisible));
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className="hidden md:flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider text-muted-foreground border border-dashed rounded px-2 py-1"
      data-testid="session-org-visibility"
    >
      <Users className="h-3 w-3 text-primary" />
      <span>Team</span>
      <select
        value={orgId}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setOrgId(v);
          void save(v, visible && v !== "");
        }}
        className="bg-transparent border-0 text-[11px] font-mono focus:outline-none cursor-pointer"
        data-testid="select-session-org"
      >
        <option value="">— none —</option>
        {orgs.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <label className="flex items-center gap-1 cursor-pointer">
        <input
          type="checkbox"
          checked={visible}
          disabled={pending || !orgId}
          onChange={(e) => {
            const v = e.target.checked;
            setVisible(v);
            void save(orgId, v);
          }}
          data-testid="toggle-session-org-visible"
        />
        <span>visible</span>
      </label>
    </div>
  );
}
