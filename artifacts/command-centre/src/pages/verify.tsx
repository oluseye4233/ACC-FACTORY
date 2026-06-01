import { useState, useEffect } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { Footer } from "@/components/layout/Footer";
import { useVerifyCertificate, getVerifyCertificateQueryKey } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ShieldCheck, ShieldAlert, BadgeCheck } from "lucide-react";
import { CertTierChip } from "@/components/shared/CertTierChip";
import { GeneratedBy } from "@/components/shared/GeneratedBy";
import { format } from "date-fns";

export default function Verify() {
  const [certId, setCertId] = useState("");
  const [searchParams, setSearchParams] = useState<URLSearchParams | null>(null);
  
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setSearchParams(params);
    const certParam = params.get("cert");
    if (certParam) {
      setCertId(certParam);
    }
  }, []);

  const query = searchParams?.get("cert");
  
  const { data, isLoading, isError, error } = useVerifyCertificate(
    { cert: query || "" },
    { query: { enabled: !!query, queryKey: getVerifyCertificateQueryKey({ cert: query || "" }) } }
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (certId.trim()) {
      window.history.pushState({}, '', `?cert=${encodeURIComponent(certId.trim())}`);
      setSearchParams(new URLSearchParams(window.location.search));
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      <main className="flex-1 flex flex-col items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md space-y-8">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-secondary/10 mb-4">
              <BadgeCheck className="h-8 w-8 text-secondary" />
            </div>
            <h1 className="font-display text-4xl tracking-wider">CERTIFICATE VERIFICATION</h1>
            <p className="text-muted-foreground font-mono text-sm">
              Validate SPARTAN MVP PDD authenticity
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Enter Certificate ID..."
                value={certId}
                onChange={(e) => setCertId(e.target.value)}
                className="pl-9 font-mono bg-card"
              />
            </div>
            <Button type="submit" disabled={!certId.trim() || isLoading} className="font-display tracking-wider">
              {isLoading ? "VERIFYING..." : "VERIFY"}
            </Button>
          </form>

          {query && (
            <div className="pt-8 border-t">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground animate-pulse">
                  <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4" />
                  <p className="font-mono text-sm">QUERYING VERIFICATION MATRIX...</p>
                </div>
              ) : isError || (data && !data.valid) ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-destructive/20 bg-destructive/5 rounded-lg">
                  <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
                  <h2 className="font-display text-3xl text-destructive tracking-wider mb-2">NOT FOUND</h2>
                  <p className="text-sm text-muted-foreground max-w-[250px]">
                    The certificate ID provided does not exist in the active registry or has been revoked.
                  </p>
                </div>
              ) : data && data.valid ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-secondary/50 bg-secondary/5 rounded-lg shadow-[0_0_30px_rgba(201,162,39,0.1)]">
                  <ShieldCheck className="h-20 w-20 text-secondary mb-4 drop-shadow-[0_0_15px_rgba(201,162,39,0.5)]" />
                  <h2 className="font-display text-4xl text-secondary tracking-wider mb-2">VERIFIED AUTHENTIC</h2>

                  {data.productName ?? data.sessionName ? (
                    <p
                      className="font-display text-2xl tracking-wide text-foreground mb-6 max-w-[300px] break-words"
                      data-testid="verify-product-name"
                    >
                      {data.productName ?? data.sessionName}
                    </p>
                  ) : (
                    <div className="mb-6" />
                  )}

                  <div className="w-full max-w-[300px] space-y-3 text-left bg-background/50 p-4 rounded-md border border-secondary/20">
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="text-xs font-mono text-muted-foreground">SPC NAME</span>
                      <span
                        className="text-sm font-mono font-bold text-right max-w-[180px] break-words"
                        data-testid="verify-spc-name"
                      >
                        {data.productName ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="text-xs font-mono text-muted-foreground">SESSION</span>
                      <span
                        className="text-sm font-mono font-bold text-right max-w-[180px] break-words"
                        data-testid="verify-session-name"
                      >
                        {data.sessionName ?? "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="text-xs font-mono text-muted-foreground">ID</span>
                      <span className="text-sm font-mono font-bold">{data.certId}</span>
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="text-xs font-mono text-muted-foreground">CLASS</span>
                      <CertTierChip tier={data.class || "NONE"} />
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-border/50">
                      <span className="text-xs font-mono text-muted-foreground">COMPRESSION</span>
                      <span className="text-sm font-mono text-primary">{data.crP}% CR</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-mono text-muted-foreground">ISSUED</span>
                      <span className="text-sm font-mono">
                        {data.issuedAt ? format(new Date(data.issuedAt), 'yyyy-MM-dd HH:mm') : 'UNKNOWN'}
                      </span>
                    </div>
                    {data.provider ? (
                      <div className="pt-2 border-t border-border/50">
                        <GeneratedBy
                          provider={data.provider}
                          modelId={data.modelId}
                          testId="verify-generated-by"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
