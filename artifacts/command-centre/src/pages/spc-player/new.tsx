import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useCreateSpcPlayerRun,
  useGetSpcDevKit,
  useGetSpcPlayerCatalog,
  type SpcLibraryCard,
} from "@workspace/api-client-react";
import { queryClient } from "@/lib/queryClient";
import { getListSpcPlayerRunsQueryKey } from "@workspace/api-client-react";
import { ArrowLeft, Check, Layers, Loader2, Sparkles, X, ChevronUp, ChevronDown, Search, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArtifactPicker } from "@/components/shared/ArtifactPicker";

const getTokens = (text: string) =>
  text.toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2);

export function rankSpcCards(
  catalog: SpcLibraryCard[],
  title: string,
  brief: string,
  limit = 4,
): SpcLibraryCard[] {
  const requirements = new Set([...getTokens(title), ...getTokens(brief)]);
  if (requirements.size === 0) return [];

  return catalog
    .map((card) => {
      const searchable = getTokens(
        `${card.name} ${card.slug} ${JSON.stringify(card.provenance)}`,
      );
      const score = searchable.reduce(
        (total, token) => total + (requirements.has(token) ? 1 : 0),
        0,
      );
      return { card, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.card.name.localeCompare(b.card.name))
    .slice(0, limit)
    .map(({ card }) => card);
}

export default function SpcPlayerNew() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const sourceSessionId = searchParams.get("sourceSessionId");

  const { toast } = useToast();

  const { data: catalog, isLoading: isCatalogLoading } = useGetSpcPlayerCatalog();
  const { data: devKit } = useGetSpcDevKit();
  const createRun = useCreateSpcPlayerRun();

  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [profile, setProfile] = useState<"full" | "rapid">("full");
  const [sourceArtifactId, setSourceArtifactId] = useState<string | undefined>();
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [dropdownKey, setDropdownKey] = useState(0);

  const MAX_CARDS = 12;

  const toggleCard = (id: string) => {
    setSelectedCards((prev) => {
      if (prev.includes(id)) {
        return prev.filter(c => c !== id);
      } else {
        if (prev.length >= MAX_CARDS) {
          toast({
            title: "Deck Full",
            description: `You can only select up to ${MAX_CARDS} cards.`,
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, id];
      }
    });
  };

  const removeCard = (id: string) => {
    setSelectedCards((prev) => prev.filter(c => c !== id));
  };

  const moveCard = (index: number, direction: -1 | 1) => {
    setSelectedCards(prev => {
      const next = [...prev];
      if (index + direction >= 0 && index + direction < next.length) {
        const temp = next[index];
        next[index] = next[index + direction];
        next[index + direction] = temp;
      }
      return next;
    });
  };

  const addBaseline = () => {
    if (!devKit) return;
    const toAdd = devKit.cardIds.filter(id => !selectedCards.includes(id));

    if (selectedCards.length + toAdd.length > MAX_CARDS) {
      const allowed = toAdd.slice(0, MAX_CARDS - selectedCards.length);
      setSelectedCards(prev => [...prev, ...allowed]);
      toast({
        title: "Deck Limit Reached",
        description: "Added as many baseline cards as possible without exceeding the limit.",
      });
    } else {
      setSelectedCards(prev => [...prev, ...toAdd]);
    }
  };

  const recommendations = useMemo(() => {
    if (!catalog || (!title.trim() && !brief.trim())) return [];
    return rankSpcCards(catalog, title, brief);
  }, [catalog, title, brief]);

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    if (!searchQuery.trim()) return catalog;
    const q = searchQuery.toLowerCase();
    return catalog.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      c.provenance.tagline?.toLowerCase().includes(q)
    );
  }, [catalog, searchQuery]);

  const unselectedCards = useMemo(() => {
    if (!catalog) return [];
    return catalog.filter(c => !selectedCards.includes(c.id));
  }, [catalog, selectedCards]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !brief.trim() || selectedCards.length === 0) {
      toast({
        title: "Incomplete Brief",
        description: "Please provide a title, a brief, and select at least one card.",
        variant: "destructive",
      });
      return;
    }

    createRun.mutate(
      {
        data: {
          title,
          brief,
          selectedCardIds: selectedCards,
          profile,
          sourceArtifactId,
        },
      },
      {
        onSuccess: (run) => {
          queryClient.invalidateQueries({ queryKey: getListSpcPlayerRunsQueryKey() });
          toast({
            title: "Brief Registered",
            description: "Your SPC Player run has been created successfully.",
          });
          setLocation(`/spc-player/${run.id}`);
        },
        onError: (err) => {
          toast({
            title: "Registration Failed",
            description: err.message || "An unexpected error occurred.",
            variant: "destructive",
          });
        },
      }
    );
  };

  const renderCardItem = (card: SpcLibraryCard, isSelected: boolean) => {
    const isExemplar = card.provenance.source === "exemplar-library";
    return (
      <div
        key={card.id}
        onClick={() => toggleCard(card.id)}
        className={`
          group flex items-start gap-3 p-3 rounded-md border transition-all cursor-pointer select-none
          ${isSelected
            ? "border-primary bg-primary/5 shadow-sm"
            : "border-border/60 hover:border-primary/40 hover:bg-card"
          }
        `}
        data-testid={`card-select-${card.id}`}
      >
        <div className={`
          mt-0.5 shrink-0 h-4 w-4 rounded-sm border flex items-center justify-center transition-colors
          ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30 group-hover:border-primary/50"}
        `}>
          {isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-xs font-semibold leading-tight truncate">{card.name}</h4>
            {isExemplar && (
              <Badge variant="secondary" className="text-[8px] h-4 px-1 py-0 uppercase tracking-tighter shrink-0">
                Exemplar
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground truncate">
              {card.slug}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-[1200px]">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            if (sourceSessionId) {
              setLocation(`/session/${sourceSessionId}`);
            } else {
              setLocation("/spc-player");
            }
          }}
          className="mb-6 font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
          data-testid="button-back"
        >
          <ArrowLeft className="mr-2 h-3 w-3" />
          {sourceSessionId ? "Back to Session" : "Back to Dashboard"}
        </Button>

        <div className="mb-8 border-b border-border/40 pb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl tracking-wider text-foreground">
              REGISTER BRIEF
            </h1>
            <p className="text-muted-foreground font-mono text-[11px] mt-2 leading-relaxed max-w-2xl">
              Define the boundaries and requirements for this capability specification.
              Select draft card references to establish the precise capabilities needed.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8" data-testid="form-create-run">
          <div className="grid lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-6 bg-card border border-border/50 rounded-lg p-6 shadow-sm">
                <div className="space-y-3">
                  <Label htmlFor="title" className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold">
                    Project Title
                  </Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Genesis Platform Architecture"
                    maxLength={255}
                    className="font-semibold text-lg bg-background/50"
                    data-testid="input-title"
                  />
                </div>

                <ArtifactPicker
                  value={sourceArtifactId}
                  onChange={setSourceArtifactId}
                  label="Project file / artifact"
                  description="The selected artifact is passed into every SPC stage as the primary project context."
                />

                <div className="space-y-3">
                  <Label htmlFor="brief" className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold">
                    Capability Brief
                  </Label>
                  <Textarea
                    id="brief"
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    placeholder="Describe the operational context and specific capability requirements..."
                    maxLength={100000}
                    className="min-h-[160px] resize-y bg-background/50"
                    data-testid="textarea-brief"
                  />
                </div>

                <div className="space-y-3">
                  <Label htmlFor="profile" className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold">
                    Execution Profile
                  </Label>
                  <select
                    id="profile"
                    value={profile}
                    onChange={(e) => setProfile(e.target.value as "full" | "rapid")}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    data-testid="select-profile"
                  >
                    <option value="full">Full — retain every stage's evidence</option>
                    <option value="rapid">Rapid — concise stage content</option>
                  </select>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    Cards execute sequentially in your selected deck order for either profile.
                  </p>
                </div>
              </div>

              <div className="space-y-4 bg-card border border-border/50 rounded-lg p-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-border/40 pb-3 mb-2">
                  <Label className="font-mono text-[11px] uppercase tracking-wider text-foreground font-bold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    KIT DECK SEQUENCE
                  </Label>
                  <span className="font-mono text-[10px] font-bold px-2 py-1 bg-muted rounded uppercase tracking-widest text-muted-foreground">
                    {selectedCards.length} / {MAX_CARDS} SELECTED
                  </span>
                </div>

                <div className="mb-4">
                  <Select
                    key={dropdownKey}
                    onValueChange={(val) => {
                      toggleCard(val);
                      setDropdownKey((k) => k + 1);
                    }}
                  >
                    <SelectTrigger className="w-full bg-background font-mono text-xs h-9">
                      <SelectValue placeholder="Manually add an SPC from catalog..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unselectedCards.length === 0 ? (
                        <SelectItem value="none" disabled>
                          No available cards left
                        </SelectItem>
                      ) : (
                        unselectedCards.map((c) => {
                          const source = c.provenance.source;
                          const isExemplar = source === "exemplar-library";
                          return (
                            <SelectItem key={c.id} value={c.id} className="font-mono text-xs">
                              {c.name} {isExemplar ? "(Exemplar)" : source ? `(${source})` : ""}
                            </SelectItem>
                          );
                        })
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedCards.length === 0 ? (
                  <div className="text-center py-10 bg-background border border-dashed border-border/60 rounded-lg">
                    <p className="text-xs text-muted-foreground font-mono uppercase tracking-wider">No SPCs in deck.</p>
                    <p className="text-[10px] text-muted-foreground mt-2 max-w-xs mx-auto">Select cards from the catalog to build your execution sequence.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedCards.map((id, index) => {
                      const card = catalog?.find(c => c.id === id);
                      if (!card) return null;
                      const isExemplar = card.provenance.source === "exemplar-library";
                      return (
                        <div key={`${id}-${index}`} className="group flex items-center gap-3 bg-background border border-border/50 rounded-md p-2 shadow-sm transition-colors hover:border-border">
                          <div className="flex flex-col items-center justify-center shrink-0 w-6 h-8 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">
                            <button type="button" onClick={() => moveCard(index, -1)} disabled={index === 0} className="hover:text-foreground disabled:opacity-0 transition-opacity p-0.5"><ChevronUp className="h-3.5 w-3.5" /></button>
                            <span className="font-mono text-[10px] leading-none absolute">{index + 1}</span>
                            <button type="button" onClick={() => moveCard(index, 1)} disabled={index === selectedCards.length - 1} className="hover:text-foreground disabled:opacity-0 transition-opacity p-0.5"><ChevronDown className="h-3.5 w-3.5" /></button>
                          </div>

                          <div className="flex-1 min-w-0 pl-2 border-l border-border/40">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-semibold truncate">{card.name}</h4>
                              {isExemplar && (
                                <Badge variant="secondary" className="text-[8px] h-4 px-1 py-0 uppercase tracking-tighter shrink-0">Exemplar</Badge>
                              )}
                            </div>
                            <p className="text-[9px] font-mono text-muted-foreground truncate uppercase">{card.slug}</p>
                          </div>

                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10" onClick={() => removeCard(id)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-6">
              {recommendations.length > 0 && (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                  <h3 className="font-mono text-[10px] font-bold uppercase tracking-wider text-primary mb-3 flex items-center gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> Auto-Recommendations
                  </h3>
                  <div className="space-y-2">
                    {recommendations.map(card => renderCardItem(card, selectedCards.includes(card.id)))}
                  </div>
                </div>
              )}

              <div className="bg-card border border-border/50 rounded-lg flex flex-col h-[550px] shadow-sm">
                <div className="p-4 border-b border-border/40 space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-mono text-[11px] uppercase tracking-wider font-bold">SPC Catalog</Label>
                    <Button type="button" onClick={addBaseline} variant="outline" size="sm" className="h-7 text-[9px] px-2 font-mono" disabled={isCatalogLoading || !devKit}>
                      ADD 6-CARD BASELINE
                    </Button>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Search SPCs by name, slug, or tags..."
                      className="h-8 pl-8 text-xs font-mono bg-background"
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 bg-background/50">
                  {isCatalogLoading ? (
                    <div className="space-y-2 p-3">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Skeleton key={i} className="h-[60px] w-full rounded-md" />
                      ))}
                    </div>
                  ) : filteredCatalog.length > 0 ? (
                    <div className="space-y-2 p-3">
                      {filteredCatalog.map(card => renderCardItem(card, selectedCards.includes(card.id)))}
                    </div>
                  ) : (
                    <div className="p-8 text-center">
                      <p className="text-xs text-muted-foreground font-mono">No matching SPCs found.</p>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>

          <div className="pt-4 flex justify-end border-t border-border/40 mt-8 mb-16">
            <Button
              type="submit"
              disabled={createRun.isPending || !title.trim() || !brief.trim() || selectedCards.length === 0}
              size="lg"
              className="font-mono text-xs uppercase tracking-wider min-w-[200px]"
              data-testid="button-submit-run"
            >
              {createRun.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registering...
                </>
              ) : (
                "Register Draft"
              )}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}