import { useState } from "react";
import { Link, useLocation } from "wouter";
import { TopNav } from "@/components/layout/TopNav";
import { useListSessions } from "@workspace/api-client-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Plus, Calendar, Activity } from "lucide-react";
import { format } from "date-fns";

export default function Sessions() {
  const [, setLocation] = useLocation();
  const { data: sessions, isLoading } = useListSessions();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");

  const filteredSessions = sessions?.filter(session => {
    // Filter by search
    if (searchQuery && !session.sessionName.toLowerCase().includes(searchQuery.toLowerCase()) && 
        !session.id.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    
    // Filter by tab
    if (activeTab === "in_progress") return session.status !== "COMPLETE";
    if (activeTab === "complete") return session.status === "COMPLETE";
    
    return true;
  }) || [];

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <TopNav />
      <main className="flex-1 container py-8 px-4 md:px-6 max-w-6xl">
        
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-4xl tracking-wider mb-2">
              SESSIONS ARCHIVE
            </h1>
            <p className="text-muted-foreground font-mono text-sm">
              All historical and active HARNESS instances
            </p>
          </div>
          
          <Button asChild className="font-display tracking-wider gap-2">
            <Link href="/session/new">
              <Plus className="h-4 w-4" />
              NEW SESSION
            </Link>
          </Button>
        </div>

        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-6">
            <TabsList className="bg-card border w-full md:w-auto h-auto p-1 flex-wrap">
              <TabsTrigger value="all" className="font-mono text-xs h-8">ALL</TabsTrigger>
              <TabsTrigger value="in_progress" className="font-mono text-xs h-8">IN PROGRESS</TabsTrigger>
              <TabsTrigger value="complete" className="font-mono text-xs h-8">COMPLETE</TabsTrigger>
              <TabsTrigger value="library" className="font-mono text-xs h-8" disabled>LIBRARY (WIP)</TabsTrigger>
            </TabsList>
            
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-card font-mono text-sm"
              />
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0 outline-none">
            <div className="border rounded-lg bg-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium">SESSION NAME</th>
                      <th className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium w-40">STATUS</th>
                      <th className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium w-48">LAST MODIFIED</th>
                      <th className="py-3 px-4 font-mono text-xs text-muted-foreground font-medium w-24 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground font-mono text-sm animate-pulse">
                          RETRIEVING RECORDS...
                        </td>
                      </tr>
                    ) : filteredSessions.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-12 text-center text-muted-foreground font-mono text-sm">
                          NO RECORDS MATCHING CRITERIA
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map(session => (
                        <tr key={session.id} className="hover:bg-accent/30 transition-colors group cursor-pointer" onClick={() => setLocation(`/session/${session.id}`)}>
                          <td className="py-4 px-4">
                            <div className="font-medium mb-1 group-hover:text-primary transition-colors">
                              {session.sessionName}
                            </div>
                            <div className="font-mono text-xs text-muted-foreground">
                              ID: {session.id}
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <span className={`inline-flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded border ${
                              session.status === 'COMPLETE' ? 'bg-primary/10 text-primary border-primary/20' : 
                              'bg-accent text-accent-foreground'
                            }`}>
                              {session.status === 'COMPLETE' ? <CheckCircleIcon className="w-3 h-3" /> : <Activity className="w-3 h-3" />}
                              {session.status}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
                              <Calendar className="h-3.5 w-3.5" />
                              {format(new Date(session.updatedAt), "yyyy-MM-dd HH:mm")}
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right">
                            <Button size="sm" variant="ghost" className="font-mono text-xs">
                              ENTER
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function CheckCircleIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}
